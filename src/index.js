import "dotenv/config";
import http from "node:http";
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  REST,
  Routes,
  ActivityType,
  Events,
} from "discord.js";
import { joinVoiceChannel, getVoiceConnection } from "@discordjs/voice";

import { CONFIG } from "./config.js";

import { loadCommands, getCommandDefs, handleCommand } from "./commands.js";
import { handleAutocompleteGlobal } from "./data.js";
import {
  getTrato, getSaludoHora,
  ACTIVIDADES, RUTINAS, FRASES_AMBIENT,
} from "./personality.js";
import {
  getHoraChile, estaDurmiendo, setDurmiendo, getCanalGeneral,
  crearEmbed, getBostezo, isEstrellaActiva, setEstrellaActiva
} from "./utils.js";
import { initDB, loadConfig, buildAutocompleteCache, db } from "./db.js";
import { setAutocompleteCache } from "./data.js";
import { logStartup } from "./logger.js";
import { lanzarTriviaAleatoria } from "./trivia.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let ultimaRutina = null;
let historialMensajes = [];
let ultimoChisme = 0;

function actualizarEstado() {
  if (estaDurmiendo()) {
    client.user.setActivity("Zzz... acurrucadita en la oficinita", { type: ActivityType.Custom });
  } else {
    const estado = ACTIVIDADES[Math.floor(Math.random() * ACTIVIDADES.length)];
    client.user.setActivity(estado, { type: ActivityType.Custom });
  }
}

function gestionarSueno() {
  const hora = getHoraChile();
  const deberiaDormir = hora >= CONFIG.HORA_DORMIR || hora < CONFIG.HORA_DESPERTAR;

  if (deberiaDormir && !estaDurmiendo()) {
    setDurmiendo(true);
    actualizarEstado();
  } else if (!deberiaDormir && estaDurmiendo()) {
    setDurmiendo(false);
    actualizarEstado();
  }
}

async function conectarOficina() {
  if (!CONFIG.CANAL_VOZ_DORMIR_ID) return;

  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    const canal = await guild.channels.fetch(CONFIG.CANAL_VOZ_DORMIR_ID);
    if (!canal || canal.type !== 2) return;

    const connection = getVoiceConnection(CONFIG.GUILD_ID);
    if (connection) return;

    joinVoiceChannel({
      channelId: canal.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });
    console.log("Annie entro a su oficinita de voz");
  } catch (e) {
    console.error("Error conectando Annie al voice:", e.message);
  }
}

/* 
async function anunciarClima(forzado = false) {
  const hora = getHoraChile();
  if (!forzado && hora !== 19) return;

  const canal = getCanalGeneral(client);
  if (!canal) return;

  const hoy = CLIMA_PUEBLO.hoy;
  const embed = crearEmbed(CONFIG.COLORES.CIELO)
    .setTitle(`Clima del Pueblito -- Hoy`)
    .setDescription(`**${hoy.tipo}**\n${hoy.descripcion}`)
    .addFields({
      name: "Horarios con cariño",
      value: hoy.timeline.map(h => `${h.hora}:00 -- ${h.texto}`).join("\n"),
    })
    .setFooter({ text: "Pronostico hecho con amor | Annie" });

  await canal.send({ content: "Annie les trae el clima con amor:", embeds: [embed] }).catch(console.error);
} */

function ejecutarRutinaDiaria() {
  if (estaDurmiendo()) return;
  const hora = getHoraChile();
  const rutina = RUTINAS.find(r => r.hora === hora);
  if (!rutina || ultimaRutina === hora) return;

  ultimaRutina = hora;
  const canal = getCanalGeneral(client);
  if (!canal) return;

  canal.send(rutina.mensaje).catch(console.error);
}

async function updateTimeChannel() {
  if (!CONFIG.CANAL_HORA_ID) return;
  try {
    const channel = await client.channels.fetch(CONFIG.CANAL_HORA_ID);
    if (!channel) return;

    const ahora = new Date();
    const time = ahora.toLocaleTimeString("es-ES", {
      timeZone: CONFIG.TIMEZONE_VOZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const hora12 = parseInt(ahora.toLocaleString("en-US", { timeZone: CONFIG.TIMEZONE_VOZ, hour: "numeric", hour12: true }).split(" ")[0]) || 12;
    const newName = `${time} Pueblito`;

    if (channel.name !== newName) {
      await channel.setName(newName);
    }
  } catch (e) {
    if (e.status !== 429) console.error("Error reloj:", e.message);
  }
}

/* 
async function updateWeatherChannel() {
  if (!CONFIG.CANAL_CLIMA_ID) return;
  try {
    const canal = await client.channels.fetch(CONFIG.CANAL_CLIMA_ID);
    if (!canal) return;

    const horaActual = getHoraChile();
    const estadosPasados = CLIMA_PUEBLO.hoy.timeline.filter(t => t.hora <= horaActual);
    const climaAhora = estadosPasados.length > 0
      ? estadosPasados[estadosPasados.length - 1]
      : CLIMA_PUEBLO.hoy.timeline[CLIMA_PUEBLO.hoy.timeline.length - 1];

    const nombreCanal = `Clima: ${climaAhora.texto}`;
    if (canal.name !== nombreCanal) {
      await canal.setName(nombreCanal);
    }
  } catch (e) {
    if (e.status !== 429) console.error("Error actualizando canal de clima:", e.message);
  }
}
 */

async function mencionarVecinoRandom() {
  if (estaDurmiendo()) return;

  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  const canal = getCanalGeneral(client);
  if (!guild || !canal) return;

  const miembros = guild.members.cache.filter(m => !m.user.bot).map(m => m);
  if (miembros.length === 0) return;

  const vecino = miembros[Math.floor(Math.random() * miembros.length)];
  const frases = [
    `Ay, ${vecino}... hace ratito que no te veia por aqui.`,
    `${vecino} sabe algo dulce... yo no digo nada, pero...`,
    `Y ${vecino}? Siempre aparece cuando hay cositas lindas que contar.`,
    `${vecino}, ven a charlar un ratito conmigo, corazón po.`,
  ];

  canal.send(`*Annie asoma la cabecita con cariño:* ${frases[Math.floor(Math.random() * frases.length)]}`).catch(console.error);
}

client.once("clientReady", async () => {
  console.log(`Annie v2 conectada: ${client.user.tag}`);

  await initDB();
  await loadConfig();
  const cache = await buildAutocompleteCache();
  setAutocompleteCache(cache);
  console.log(`Cache de autocompletado cargada para ${Object.keys(cache).length} categorías.`);
  conectarOficina();
  actualizarEstado();

  if (CONFIG.MENSAJE_ROLES_ID) {
    client.guilds.cache.forEach(async (guild) => {
      guild.channels.cache.forEach(async (channel) => {
        if (channel.isTextBased()) {
          try { await channel.messages.fetch(CONFIG.MENSAJE_ROLES_ID); } catch { }
        }
      });
    });
  }

  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);
  try {
    await loadCommands();
    const commandDefs = getCommandDefs();

    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
      { body: commandDefs },
    );
    console.log(`Slash commands registrados correctamente (${commandDefs.length} comandos)`);
    await logStartup(client);
  } catch (e) {
    console.error("Error registrando commands o cargando archivos:", e);
  }

  const scheduleUpdate = () => {
    const now = new Date();
    const ms = (5 - (now.getMinutes() % 5)) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
    setTimeout(() => {
      updateTimeChannel();
      scheduleUpdate();
    }, ms + 2000);
  };
  updateTimeChannel();
  scheduleUpdate();

  function programarEstrellaFugaz() {
    // Entre 30 y 120 minutos
    const proxMinutos = Math.floor(Math.random() * 90) + 30;
    setTimeout(async () => {
      if (!estaDurmiendo() && !isEstrellaActiva()) {
        setEstrellaActiva(true);
        const canal = getCanalGeneral(client);
        if (canal) {
          const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("🌠 ¡Una Estrella Fugaz en el cielo!")
            .setDescription("*Annie se asoma rápido por la ventanita de la oficinita...*\n\n¡Oh! Acabo de ver caer una estrella brillante en el pueblito... **¡El primero que escriba `/deseo` se la lleva!** ✨");
          canal.send({ embeds: [embed] }).catch(console.error);

          // La estrella caduca en 5 minutos
          setTimeout(() => {
            if (isEstrellaActiva()) {
              setEstrellaActiva(false);
              canal.send("❄️ La chispita de la estrella se apagó solita... ¡Ojalá para la próxima estemos más atentos!").catch(() => { });
            }
          }, 5 * 60 * 1000);
        }
      }
      programarEstrellaFugaz(); // loop infinito
    }, proxMinutos * 60 * 1000);
  }
  programarEstrellaFugaz();

  gestionarSueno();
  setInterval(gestionarSueno, 60000);

  setInterval(actualizarEstado, 600000);

  // Motor de Trivias (cada 2 horas)
  setInterval(() => {
    lanzarTriviaAleatoria(client);
  }, 1000 * 60 * 120);

});

setInterval(() => {
  if (estaDurmiendo()) return;
  const canal = getCanalGeneral(client);
  if (!canal) return;
  const frase = FRASES_AMBIENT[Math.floor(Math.random() * FRASES_AMBIENT.length)];
  canal.send(`*Annie comenta con cariño:* ${frase}`).catch(console.error);
}, 1000 * 60 * 240);

setInterval(ejecutarRutinaDiaria, 1000 * 60 * 5);

setInterval(mencionarVecinoRandom, 1000 * 60 * 360);

/* setInterval(anunciarClima, 1000 * 60 * 120); */

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const canal = await member.guild.channels.fetch(CONFIG.CANAL_GENERAL_ID);
    if (!canal) return;

    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("Un nuevo corazóncito llego al pueblito!")
      .setDescription(
        `Bienvenid@, **${member.user.username}** a Heartopia! Pasa por la oficinita cuando quieras, te espero con tecito y abrazos.`
      );

    await canal.send({
      content: `Oigan toditos! Denle un abrazote dulce a ${member}`,
      embeds: [embed],
    });
  } catch (e) {
    console.error("Error bienvenida:", e.message);
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (
    oldState.member?.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    console.log("Annie se desconecto del voice, reconectando...");
    return setTimeout(conectarOficina, 5000);
  }

  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    const canalTexto = newState.guild.channels.cache.get(CONFIG.CANAL_GENERAL_ID);
    if (!canalTexto) return;

    const trato = getTrato();
    const username = newState.member.user.username;

    const frasesDia = [
      `*Annie asoma la cabecita:* Oiga ${trato}... parece que **${username}** llego a mi oficinita.`,
      `Atencion, pueblito lindo! **${username}** anda dando vueltitas por aqui... que alegria.`,
      `Ay... **${username}** entro a mi oficinita... vendra a charlar un ratito conmigo?`,
    ];
    const frasesNoche = [
      `*(Annie susurra bajito)* Shhh... ${trato}... **${username}** entro a la oficinita... que no se despierte nadie.`,
      `*(voz suave)* Ay... creo que **${username}** anda despierto todavia... ven a acurrucarte un ratito.`,
      `*(susurro dulce)* Entro alguien a mi oficinita... es **${username}**... que lindo.`,
    ];

    const pool = estaDurmiendo() ? frasesNoche : frasesDia;
    canalTexto.send(pool[Math.floor(Math.random() * pool.length)]).catch(console.error);
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.id !== CONFIG.MENSAJE_ROLES_ID) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }

  const roleId = CONFIG.REACTION_ROLES[reaction.emoji.name];
  if (!roleId) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId);
    if (role) {
      await member.roles.add(role);
      console.log(`Rol ${role.name} asignado a ${user.tag}`);
      try { await user.send(`Te puse el rol **${role.name}** con cariño, vecino.`); } catch { }
    }
  } catch (e) {
    console.error("Error dando rol:", e.message);
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot || reaction.message.id !== CONFIG.MENSAJE_ROLES_ID) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }

  const roleId = CONFIG.REACTION_ROLES[reaction.emoji.name];
  if (!roleId) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId);
    if (role) {
      await member.roles.remove(role);
      console.log(`Rol ${role.name} quitado a ${user.tag}`);
      try { await user.send(`Te quite el rol **${role.name}** con cariño, vecino... si lo quieres de vuelta, solo reacciona otra vez.`); } catch { }
    }
  } catch (e) {
    console.error("Error quitando rol:", e.message);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const msg = message;
  const texto = message.content.toLowerCase();

  const ahora = Date.now();

  if (message.channel.id === CONFIG.CANAL_GENERAL_ID) {
    historialMensajes.push(ahora);
    historialMensajes = historialMensajes.filter(m => ahora - m < CONFIG.VENTANA_CHISME);

    if (
      historialMensajes.length >= CONFIG.UMBRAL_CHISME &&
      ahora - ultimoChisme > CONFIG.COOLDOWN_CHISME
    ) {
      ultimoChisme = ahora;
      historialMensajes = [];
      const frasesChismeDia = [
        `Ay, vecino lindo... se me pararon las orejititas curiosas con tanto mensajito. Que paso po? Cuentame todo con cariño...`,
        `Uy, uy, tesoro! El chat esta lleno de cositas lindas... que paso? No me dejes con la intriga, corazón.`,
        `Mi vecino precioso! Se siente olor a chismecito dulce... me cuentas con ternura?`,
      ];
      const frasesChismeNoche = [
        `*(Annie abre un ojito)* Ay, vecino lindo... que paso po? Se me pararon las orejititas curiosas... cuentame bajito.`,
        `*(susurra somnolienta)* Zzz... chismecito? Ay, no me dejes con la intriga, corazón... que paso?`,
        `*(bosteza lindo)* Uf... desperte por el ruido dulce... que cosita linda paso?`,
      ];

      const pool = estaDurmiendo() ? frasesChismeNoche : frasesChismeDia;
      await msg.channel.send(`*Annie asoma la cabecita con cariño:* "${pool[Math.floor(Math.random() * pool.length)]}"`).catch(console.error);
    }
  }

  if (texto === "11") return msg.reply("Chupalo entonces, corazón!").catch(err => console.warn("Fallo envio easter egg:", err.message));
  if (texto === "5") return msg.reply("Por el culo te la hinco con cariño!").catch(err => console.warn("Fallo envio easter egg:", err.message));
  if (texto === "13") return msg.reply("Mas me crece de ternura!").catch(err => console.warn("Fallo envio easter egg:", err.message));
  if (texto === "8") return msg.reply("El culo te abrocho con amor!").catch(err => console.warn("Fallo envio easter egg:", err.message));
  if (texto === "4") return msg.reply("En tu culo mi aparatito dulce!").catch(err => console.warn("Fallo envio easter egg:", err.message));
  if (texto.startsWith("me gusta")) return msg.reply("Y el pico? Acuerdese que soy de campo, vecino lindo!").catch(err => console.warn("Fallo envio easter egg:", err.message));

  const mencionaAnnie = texto.includes("annie");

  if (estaDurmiendo()) {
    if ((texto.includes("hola") || texto.includes("holi") || texto.includes("wena")) && mencionaAnnie) {
      return msg.reply("*(Annie se despereza suave)* Zzz... ah? Wena mi vecino lindo... que necesitas tan tempranito?");
    }
    if ((texto.includes("gracias") || texto.includes("vale")) && mencionaAnnie) {
      return msg.reply("*(susurra dormida)* De nada po, corazón... Zzz... siempre aqui para ti.");
    }
    if (texto.includes("chao") || texto.includes("buenas noches")) {
      return msg.reply("Buenas noches, mi vecino precioso... suena bonito y abrigate, ya? Zzz...");
    }
  } else {
    if ((texto.includes("hola") || texto.includes("holi") || texto.includes("wena")) && mencionaAnnie) {
      return msg.reply(`Wena, wena mi vecino lindo! Como estas hoy, corazón? Pasa no mas, estoy con tecito dulce.`);
    }
    if ((texto.includes("gracias") || texto.includes("vale")) && mencionaAnnie) {
      return msg.reply("De nada po, mi alegria! Siempre aqui para ti, ya?");
    }
    if ((texto.includes("chao") || texto.includes("adios")) && mencionaAnnie) {
      return msg.reply("Chao, corazón! Cuidate harto y vuelve prontito, ya?");
    }
  }

  // ---- Sistema de Economía y XP ----
  // Chance de ganar 1 a 3 XP y un 15% de chance de ganar una moneda
  const chanceXp = Math.random();
  if (chanceXp > 0.3) {
    const xpGanada = Math.floor(Math.random() * 3) + 1; // 1 to 3
    const monedaGanada = Math.random() > 0.85 ? 1 : 0;

    try {
      // Usar UPSERT para crear el usuario si no existe, o añadirle la exp/monedas
      await db.execute({
        sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
              VALUES (?, ?, ?, 1) 
              ON CONFLICT(id) DO UPDATE SET 
                xp = usuarios.xp + excluded.xp, 
                monedas = usuarios.monedas + excluded.monedas`,
        args: [msg.author.id, monedaGanada, xpGanada]
      });

      // Chequear nivel actual
      const r = await db.execute({ sql: "SELECT xp, nivel FROM usuarios WHERE id = ?", args: [msg.author.id] });
      if (r.rows.length > 0) {
        const xp = Number(r.rows[0].xp);
        const nivelAnterior = Number(r.rows[0].nivel);
        const nivelNuevo = Math.floor(0.1 * Math.sqrt(xp)) + 1;

        if (nivelNuevo > nivelAnterior) {
          await db.execute({ sql: "UPDATE usuarios SET nivel = ? WHERE id = ?", args: [nivelNuevo, msg.author.id] });
          const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("¡Subiste de Nivel!")
            .setDescription(`¡Felicidades <@${msg.author.id}>! Has alcanzado el **Nivel ${nivelNuevo}** paseando por el pueblito. 🥳`);

          await msg.channel.send({ embeds: [embed] }).catch(() => { });
        }
      }
    } catch (e) {
      console.error("Error otorgando XP:", e.message);
    }
  }
});

// Configuración de la tienda compartida. Idealmente esto debería importarse de tienda.js pero lo definimos aquí para el handler por simplicidad.
const TIENDA_PRICES = {
  "color_custom": 5000,
  "color_rosa": 300,
  "color_celeste": 300,
  "color_dorado": 500
};

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "tienda_comprar") {
    // Evitar que otro usuario toque el dropdown de alguien más
    if (interaction.user.id !== interaction.message.interaction?.user.id && interaction.message.interaction) {
      return interaction.reply({ content: "¡Ey! Esta tienda la abrió otra personita. Escribe `/tienda` tú mismo para comprar.", ephemeral: true });
    }

    const itemSeleccionado = interaction.values[0];
    const precio = TIENDA_PRICES[itemSeleccionado];

    if (!precio) return interaction.reply({ content: "Item inválido.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const result = await db.execute({
      sql: "SELECT xp, color_rol_id FROM usuarios WHERE id = ?",
      args: [interaction.user.id]
    });

    if (result.rows.length === 0) {
      return interaction.followUp("No estás registrado en el pueblito.");
    }

    const currentXp = Number(result.rows[0].xp);

    if (currentXp < precio) {
      return interaction.followUp(`Pucha corazón, te faltan **${precio - currentXp} XP** para comprar eso. ¡Sigue charlando en el pueblito!`);
    }

    try {
      // Descontar XP y dar el item
      await db.execute({
        sql: "UPDATE usuarios SET xp = xp - ?, color_rol_id = ? WHERE id = ?",
        args: [precio, itemSeleccionado, interaction.user.id]
      });

      if (itemSeleccionado === "color_custom") {
        await interaction.followUp("✨ ¡Felicidades! Has comprado el **Pincel Mágico**. Ahora puedes usar el comando `/color [hex]` para pintar tu nombre del color que quieras.");
      } else {
        // Nota: Si son colores base, el Admin de discord debe crear roles llamados exactamente igual ("color_rosa", etc)
        // O el bot debería crearlos también mediante código. Por ahora otorgamos el ID de la base de datos al usuario.
        await interaction.followUp(`🛍️ ¡Felicidades! Compraste el color **${itemSeleccionado.replace("color_", "")}**. En breve Annie te lo equipará automáticamente cuando hables, o usa \`/perfil\` para forzar la actualización.`);
      }
    } catch (e) {
      console.error("Error comprando en tienda", e);
      await interaction.followUp("Ocurrió un error mágico al procesar tu compra.");
    }
    return;
  }

  // ---- Visor de Colecciones desde el Perfil ----
  if (interaction.isStringSelectMenu() && interaction.customId === "perfil_ver_coleccion") {
    const value = interaction.values[0]; // format: "vt_categoria_userId"
    if (!value.startsWith("vt_")) return;

    const [, categoria, targetUserId] = value.split("_");

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await db.execute({
        sql: "SELECT item_id FROM colecciones WHERE user_id = ? AND categoria = ? ORDER BY item_id ASC",
        args: [targetUserId, categoria]
      });

      if (result.rows.length === 0) {
        return interaction.followUp(`No hay ningún registro de **${categoria}** en esa libretita.`);
      }

      const items = result.rows.map(r => r.item_id).join(", ");
      const content = `**Libretita de ${categoria.charAt(0).toUpperCase() + categoria.slice(1)} de <@${targetUserId}>**\n\n\`\`\`\n${items}\n\`\`\``;

      // Split if too long for Discord (2000 chars max)
      if (content.length > 2000) {
        await interaction.followUp(`**Libretita de ${categoria.charAt(0).toUpperCase() + categoria.slice(1)} de <@${targetUserId}>**\n(¡Tiene muchísimos! Te muestro los primeros)\n\n\`\`\`\n${items.substring(0, 1850)}...\n\`\`\``);
      } else {
        await interaction.followUp(content);
      }

    } catch (e) {
      console.error("Error cargando colección desde dropdown:", e);
      await interaction.followUp("Hubo un error al hojear la libretita.");
    }
    return;
  }

  // ---- Sistema de Colecciones (Botón: ¡Lo tengo!) ----
  if (interaction.isButton() && interaction.customId.startsWith("col_")) {
    const [, categoria, ...itemIdParts] = interaction.customId.split("_");
    const itemId = itemIdParts.join("_");

    await interaction.deferReply({ ephemeral: true });

    try {
      await db.execute({
        sql: "INSERT INTO colecciones (user_id, categoria, item_id) VALUES (?, ?, ?)",
        args: [interaction.user.id, categoria, itemId]
      });

      // Mensaje dinámico según la categoría
      const verbos = {
        "peces": "¡pescado",
        "insectos": "¡atrapado",
        "aves": "¡avistado",
        "animales": "¡acariciado",
        "cultivos": "¡cosechado",
        "recolectables": "¡recolectado",
        "recetas": "¡cocinado",
        "logros": "¡desbloqueado"
      };
      const verbo = verbos[categoria] || "¡registrado";

      await interaction.followUp(`💖 **${itemId}** ${verbo}! Lo he anotado en tu libretita de colecciones.`);
    } catch (e) {
      if (e.message.includes("UNIQUE constraint failed")) {
        await interaction.followUp("Jeje, tranquilo corazón... ya tenías a este amiguito registrado en tu colección. ✨");
      } else {
        console.error("Error guardando colección:", e);
        await interaction.followUp("Uy... se me cayó el lápiz y no pude anotarlo. Intenta de nuevo.");
      }
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    try {
      await handleAutocompleteGlobal(interaction);
    } catch (err) {
      const code = err?.code ?? err?.rawError?.code;
      if (code === 10062) {
        console.warn(`[InteractionCreate] Autocomplete expirado (10062) para /${interaction.commandName}`);
      } else {
        console.error(`[InteractionCreate] Error no manejado en autocomplete /${interaction.commandName}:`, err);
      }
    }
    return;
  }
  if (interaction.isChatInputCommand()) return handleCommand(client, interaction);
});

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Annie v2 is live");
}).listen(8000);

client.login(CONFIG.TOKEN);
