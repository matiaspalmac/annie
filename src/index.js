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

import { loadCommands, getCommandDefs, handleCommand, handleAutocomplete } from "./commands.js";
import { handleAutocompleteGlobal } from "./data.js";
import {
  getTrato, getSaludoHora,
  ACTIVIDADES, RUTINAS, FRASES_AMBIENT,
} from "./personality.js";
import {
  getHoraChile, estaDurmiendo, setDurmiendo, getCanalGeneral,
  crearEmbed, getBostezo, isEstrellaActiva, setEstrellaActiva,
  lanzarEstrellaFugaz, getItemEnDemanda, setItemEnDemanda
} from "./utils.js";
import { initDB, loadConfig, buildAutocompleteCache, db, getLatestLogId, getLogsSince } from "./db.js";
import { setAutocompleteCache } from "./data.js";
import { logStartup } from "./logger.js";
import { lanzarTriviaAleatoria } from "./trivia.js";
import { procesarCompraTienda } from "./shop.js";

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
let lastKnownLogId = 0;

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

async function anunciarClima(forzado = false) {
  const hora = getHoraChile();
  if (!forzado && hora !== 19) return;

  const canal = getCanalGeneral(client);
  if (!canal) return;

  try {
    const result = await db.execute("SELECT * FROM clima WHERE id = 'hoy'");
    if (result.rows.length === 0) return;
    const hoy = result.rows[0];
    const timeline = JSON.parse(hoy.timeline || "[]");

    const embed = crearEmbed(CONFIG.COLORES.CIELO)
      .setTitle(`☁️ Clima del Pueblito — Hoy`)
      .setDescription(`**${hoy.tipo || "--"}**\n${hoy.descripcion || ""}`);

    if (timeline.length > 0) {
      embed.addFields({
        name: "Horarios con cariño",
        value: timeline.map(h => `${h.hora}:00 — ${h.texto}`).join("\n"),
      });
    }
    embed.setFooter({ text: "Pronóstico hecho con amor | Annie" });

    await canal.send({ content: "Annie les trae el clima con amor:", embeds: [embed] }).catch(console.error);
  } catch (e) {
    console.error("[Clima] Error anunciando clima:", e.message);
  }
}


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

// ---- Lógica de la Rifa Diaria (Sorteo Automático) ----
let rifaSorteadaHoy = false;

async function procesarSorteoRifa() {
  try {
    const ahora = new Date();
    // Obtener la hora y minutos en el timezone correcto (Chile)
    const options = { timeZone: CONFIG.TIMEZONE, hour: 'numeric', minute: 'numeric', hour12: false };
    const [, hm] = ahora.toLocaleString('en-US', options).match(/(\d+):(\d+)/) || [];

    // Si no son las 23:5X (o 59) reseteamos la flag y salimos
    if (hm && parseInt(hm, 10) !== 23) {
      rifaSorteadaHoy = false;
      return;
    }

    // Queremos correrlo a las 23:59 (minuto 59). Si ya lo sorteamos hoy, evitar doble sorteo.
    const minutoEnChile = parseInt(ahora.toLocaleString('en-US', { timeZone: CONFIG.TIMEZONE, minute: 'numeric' }), 10);

    // Solo sorteamos si es exactamente 23:59 y no se ha sorteado aún
    if (minutoEnChile === 59 && !rifaSorteadaHoy) {
      rifaSorteadaHoy = true;
      const canal = getCanalGeneral(client);
      if (!canal) return;

      const hoyStr = ahora.toISOString().split('T')[0]; // YYYY-MM-DD

      const resBoletos = await db.execute({
        sql: "SELECT id, user_id FROM rifa_boletos WHERE fecha = ?",
        args: [hoyStr]
      });

      if (resBoletos.rows.length === 0) {
        // Nadie compró boletos
        await canal.send("🎫 ¡Llegó la hora de la rifa! ...Pero *Annie abre la libretita y ve que está vacía*... Pucha, nadie compró un boleto hoy. ¡Mañana será otro día!");
        return;
      }

      // Coste por cada boleto (el mismo que en commands/rifa.js)
      const COSTO_BOLETO = 10;
      const totalBoletos = resBoletos.rows.length;
      const pozo = totalBoletos * COSTO_BOLETO;

      // Escoger un ganador random
      const boletoGanador = resBoletos.rows[Math.floor(Math.random() * totalBoletos)];
      const ganadorId = boletoGanador.user_id;

      // Pagar
      await db.execute({
        sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?",
        args: [pozo, ganadorId]
      });

      // Anunciar
      const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle("🎉 ¡Sorteo Histórico de la Rifa!")
        .setDescription(`*Annie saca un papelito temblando de un frasco de vidrio... y lee en voz alta:* \n\n¡YEEEEEEEI! ¡Tenemos un ganadorcito para las **${pozo} Moneditas**!\n\nSe nos van directamente a los bolsillos de: <@${ganadorId}>. \n¡Disfrútalas y hazte algo rico para cenar, mi tesoro! 💖`)
        .setFooter({ text: `Se vendieron ${totalBoletos} boletos hoy.` });

      await canal.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Error sorteando rifa:", error);
  }
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

async function updateWeatherChannel() {
  if (!CONFIG.CANAL_CLIMA_ID) return;
  try {
    const canal = await client.channels.fetch(CONFIG.CANAL_CLIMA_ID);
    if (!canal) return;

    const result = await db.execute("SELECT * FROM clima WHERE id = 'hoy'");
    if (result.rows.length === 0) return;
    const hoy = result.rows[0];
    const timeline = JSON.parse(hoy.timeline || "[]");

    const horaActual = getHoraChile();
    const estadosPasados = timeline.filter(t => t.hora <= horaActual);
    const climaAhora = estadosPasados.length > 0
      ? estadosPasados[estadosPasados.length - 1]
      : timeline[timeline.length - 1];

    if (!climaAhora) return;
    const nombreCanal = `Clima: ${climaAhora.texto}`;
    if (canal.name !== nombreCanal) {
      await canal.setName(nombreCanal);
    }
  } catch (e) {
    if (e.status !== 429 && e.code !== 10003) console.error("Error actualizando canal de clima:", e.message);
  }
}


async function mencionarVecinoRandom() {
  if (estaDurmiendo()) return;

  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  const canal = getCanalGeneral(client);
  if (!guild || !canal) return;

  const miembros = guild.members.cache.filter(m => !m.user.bot).map(m => m);
  if (miembros.length === 0) return;

  const vecino = miembros[Math.floor(Math.random() * miembros.length)];
  const trato = getTrato();
  const fraseAleatoria = FRASES_AMBIENT[Math.floor(Math.random() * FRASES_AMBIENT.length)];

  const intros = [
    `*Annie le hace señitas a ${vecino} desde lejos:*`,
    `*Annie le deja una cartita perfumada a ${vecino}:*`,
    `*Annie sonríe al ver pasar a ${vecino}:*`,
    `*Annie se acerca despacito a ${vecino}:*`
  ];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  canal.send(`${intro} "${fraseAleatoria.replace('corazón', trato).replace('vecin@', trato)}"`).catch(console.error);
}

// ---- Evento Mercader Estelar (Doris) ----
function chequearDoris() {
  if (estaDurmiendo() || getItemEnDemanda()) return;

  // 15% de probabilidad de que aparezca cuando se llama a esta función
  const rand = Math.random();
  if (rand > 0.15) return;

  const ITEMS_GRANJABLES = [
    { id: "Piedra", emoji: "🪨" },
    { id: "Mineral", emoji: "🪨✨" },
    { id: "Fluorita impecable", emoji: "💎" },
    { id: "Pescado", emoji: "🐟" },
    { id: "Manzanas", emoji: "🍎" },
    { id: "Mantis Religiosa", emoji: "🦗" },
    { id: "Mariposa Emperador", emoji: "🦋" },
    { id: "Tarántula", emoji: "🕷️" },
  ];

  const elegido = ITEMS_GRANJABLES[Math.floor(Math.random() * ITEMS_GRANJABLES.length)];

  // La oferta durará 3 horas (10800000 ms)
  setItemEnDemanda(elegido.id, 10800000);

  const canal = getCanalGeneral(client);
  if (canal) {
    const embed = crearEmbed(CONFIG.COLORES.DORADO)
      .setTitle("🚀 ¡Doris ha aterrizado de emergencia!")
      .setDescription(`*Doris se baja corriendo de su nave espacial...*\n\n"¡Oigan, pueblerinos terrícolas! Mi nave necesita combustible rápido y estoy pagando EL TRIPLE por un ítem específico en el mercado de Annie."\n\n🎯 **Ítem en Alta Demanda:** ${elegido.emoji} **${elegido.id}**\n⏱️ **Duración de la oferta:** 3 Horas\n\n*(¡Vayan corriendo a usar \`/vender\` si tienen este ítem!)*`)
      .setThumbnail("https://heartopiachile.vercel.app/npc/doris-rain.webp");
    canal.send({ embeds: [embed] }).catch(console.error);
  }
}

client.once("clientReady", async () => {
  console.log(`Annie v2 conectada: ${client.user.tag}`);

  await initDB();
  await loadConfig();
  lastKnownLogId = await getLatestLogId();
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
      lanzarEstrellaFugaz(client);
      programarEstrellaFugaz(); // loop infinito
    }, proxMinutos * 60 * 1000);
  }
  programarEstrellaFugaz();

  gestionarSueno();
  setInterval(gestionarSueno, 60000);

  // Comprobar si es hora de la Rifa (cada minuto)
  setInterval(procesarSorteoRifa, 60000);

  setInterval(actualizarEstado, 600000);

  // Motor de Trivias (cada 2 horas)
  setInterval(() => {
    lanzarTriviaAleatoria(client);
  }, 1000 * 60 * 120);

  // Comprobar si Doris aterriza (cada 1 hora y media)
  setInterval(chequearDoris, 1000 * 60 * 90);

  // Refrescar cache de autocompletado cada 30 minutos + notificar cambios de admins (F1)
  setInterval(async () => {
    try {
      const nuevaCache = await buildAutocompleteCache();
      setAutocompleteCache(nuevaCache);
      console.log(`[Cache] Autocompletado refrescado (${Object.keys(nuevaCache).length} categorías).`);

      // F1: detectar cambios nuevos en admin_logs
      const latestId = await getLatestLogId();
      if (latestId > lastKnownLogId) {
        const logs = await getLogsSince(lastKnownLogId);
        lastKnownLogId = latestId;

        if (logs.length > 0 && CONFIG.LOG_CHANNEL_ID) {
          const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
          if (logChannel) {
            const resumen = logs.map(l => {
              const iconos = { agregar: "✅", editar: "✏️", eliminar: "🗑️" };
              const icono = iconos[l.accion] ?? "•";
              return `${icono} **${l.admin}** ${l.accion} en \`${l.tabla ?? "??"}\` — \`${l.item_id ?? ""}`;
            }).join("\n").slice(0, 1900);

            const embed = crearEmbed(CONFIG.COLORES.AZUL)
              .setTitle("📋 Cambios en la Wiki")
              .setDescription(resumen)
              .setFooter({ text: `${logs.length} cambio(s) detectado(s)` });

            logChannel.send({ embeds: [embed] }).catch(console.error);
          }
        }
      }
    } catch (e) {
      console.error("[Cache] Error en refresh:", e.message);
    }
  }, 1000 * 60 * 30);

  // Clima cada hora (F4)
  setInterval(anunciarClima, 1000 * 60 * 60);
  updateWeatherChannel();
  setInterval(updateWeatherChannel, 1000 * 60 * 15);

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
      `Ay... **${username}** entro a mi oficinita... ¿vendra a tomarse un tecito conmigo?`,
      `*Annie saluda con la mano:* ¡Wena wena **${username}**! Pasa nomás, ponte cómodo.`,
      `Miren quién llegó... **${username}** anda de chismoso por aquí, jeje. ¡Bienvenido, corazón!`
    ];
    const frasesNoche = [
      `*(Annie susurra bajito)* Shhh... ${trato}... **${username}** entro a la oficinita... que no se despierte nadie.`,
      `*(voz suave)* Ay... creo que **${username}** anda de búho todavía... ven a acurrucarte un ratito.`,
      `*(susurro dulce)* Entro alguien a mi oficinita... es **${username}**... abrigate bien que hace frío.`,
      `*(bostezando)* Buenas noches, **${username}**... pasa calladito nomás, corazón.`
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
  const avatarUrl = msg.author.displayAvatarURL({ extension: "png", size: 256 }) || null;
  // Silently update username & avatar in case it changed or was never set
  db.execute({
    sql: "UPDATE usuarios SET username = ?, avatar = ? WHERE id = ? AND (username IS NULL OR username != ? OR avatar IS NULL OR avatar != ?)",
    args: [msg.author.username, avatarUrl, msg.author.id, msg.author.username, avatarUrl]
  }).catch(() => { });

  const texto = message.content.toLowerCase();
  const ahora = Date.now();

  // F16: El Tarro de las Chuchadas (Swear Jar Chileno)
  const CHUCHADAS = /\b(weon|weón|conchetumare|ctm|culiao|qlao|ql|puta|wea|weá|mierda)\b/i;

  if (CHUCHADAS.test(texto)) {
    try {
      const resVal = await db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [msg.author.id] });
      if (resVal.rows.length > 0 && Number(resVal.rows[0].monedas) >= 5) {
        // Descontar al usuario
        await db.execute({ sql: "UPDATE usuarios SET monedas = monedas - 5 WHERE id = ?", args: [msg.author.id] });

        // Abonar al evento global activo
        const resEvento = await db.execute("SELECT id FROM eventos_globales WHERE activo = 1 LIMIT 1");
        if (resEvento.rows.length > 0) {
          const eventoId = resEvento.rows[0].id;
          await db.execute({ sql: "UPDATE eventos_globales SET progreso_monedas = progreso_monedas + 5 WHERE id = ?", args: [eventoId] });
          await db.execute({
            sql: "INSERT INTO evento_donaciones (evento_id, user_id, cantidad) VALUES (?, ?, 5) ON CONFLICT(evento_id, user_id) DO UPDATE SET cantidad = cantidad + 5",
            args: [eventoId, "Tarro Chuchadas"] // Se asienta a nombre del "Tarro Chuchadas"
          });
        }
        await msg.reply("*(Annie frunce el ceño)* ¡Ay! ¡Esa boquita! 🧼 Te saqué **5 moneditas** p'al tarro de la Junta de Vecinos.");
      } else {
        await msg.reply("*(Annie te mira feo)* ¡Qué vocabulario! Te multaría, pero veo que andas aguja de monedas... ¡Pórtate bien!");
      }
    } catch (e) {
      console.error("Error tarro chuchadas:", e.message);
    }
  }

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

          let canalDestino = msg.channel;
          if (nivelNuevo % 5 === 0) {
            if (CONFIG.CANAL_GENERAL_ID) {
              const cGeneral = client.channels.cache.get(CONFIG.CANAL_GENERAL_ID);
              if (cGeneral) canalDestino = cGeneral;
            }
          } else {
            const canalComandosId = CONFIG.CONFIG_COMANDOS_ID || "1463662463693230110";
            const cComandos = client.channels.cache.get(canalComandosId);
            if (cComandos) canalDestino = cComandos;
          }

          await canalDestino.send({ embeds: [embed] }).catch(() => { });
        }
      }
    } catch (e) {
      console.error("Error otorgando XP:", e.message);
    }
  }
});

// Handler logic for interactions

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "tienda_comprar") {
    // Evitar que otro usuario toque el dropdown de alguien más
    if (interaction.user.id !== interaction.message.interaction?.user.id && interaction.message.interaction) {
      return interaction.reply({ content: "¡Ey! Esta tienda la abrió otra personita. Escribe `/tienda` tú mismo para comprar.", ephemeral: true });
    }

    const itemSeleccionado = interaction.values[0];
    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await procesarCompraTienda(interaction, itemSeleccionado);
      await interaction.followUp(result.message);
    } catch (e) {
      console.error("Error comprando en tienda", e);
      await interaction.followUp("Ocurrió un error mágico al procesar tu compra.");
    }
    return;
  }

  // ---- Visor de Colecciones desde el Perfil ----
  if (interaction.isStringSelectMenu() && interaction.customId === "perfil_ver_mas") {
    const value = interaction.values[0]; // format: pv_tipo_userId
    if (!value.startsWith("pv_")) return;

    const parts = value.split("_");
    const tipo = parts[1];
    const targetUserId = parts.slice(2).join("_");

    await interaction.deferReply({ ephemeral: true });

    try {
      const resUser = await db.execute({
        sql: "SELECT monedas, xp, nivel FROM usuarios WHERE id = ?",
        args: [targetUserId],
      });

      if (resUser.rows.length === 0) {
        return interaction.followUp("No pude encontrar ese perfil en la base de datos.");
      }

      const user = resUser.rows[0];
      const xp = Number(user.xp || 0);
      const nivel = Number(user.nivel || 1);
      const monedas = Number(user.monedas || 0);

      const xpBaseNivelDesc = Math.pow((nivel - 1) * 10, 2);
      const xpSigNivel = Math.pow(nivel * 10, 2);
      const xpRestante = Math.max(0, xpSigNivel - xp);

      const formatCompact = (n) => new Intl.NumberFormat("es-CL", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(Number(n || 0));

      if (tipo === "objetivo") {
        const totalResult = await db.execute("SELECT 'peces' as cat, COUNT(*) as c FROM peces UNION ALL SELECT 'insectos', COUNT(*) FROM insectos UNION ALL SELECT 'aves', COUNT(*) FROM aves UNION ALL SELECT 'animales', COUNT(*) FROM animales UNION ALL SELECT 'cultivos', COUNT(*) FROM cultivos UNION ALL SELECT 'recolectables', COUNT(*) FROM recolectables UNION ALL SELECT 'recetas', COUNT(*) FROM recetas UNION ALL SELECT 'logros', COUNT(*) FROM logros");
        const maxItems = {};
        for (const r of totalResult.rows) maxItems[r.cat] = Number(r.c);

        const colResult = await db.execute({
          sql: "SELECT categoria, COUNT(*) as total FROM colecciones WHERE user_id = ? GROUP BY categoria",
          args: [targetUserId]
        });
        const colMap = {};
        for (const r of colResult.rows) colMap[String(r.categoria)] = Number(r.total);

        const categorias = ["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "recetas", "logros"];
        let objetivoColeccion = "Completa una categoría nueva en tu libretita";
        let menorFaltante = Number.MAX_SAFE_INTEGER;

        for (const cat of categorias) {
          const owned = Number(colMap[cat] || 0);
          const total = Number(maxItems[cat] || 0);
          if (total <= 0 || owned >= total) continue;
          const faltan = total - owned;
          if (faltan < menorFaltante) {
            menorFaltante = faltan;
            objetivoColeccion = `${cat}: faltan ${faltan} (${owned}/${total})`;
          }
        }

        const embed = crearEmbed(CONFIG.COLORES.AZUL)
          .setTitle("🎯 Objetivo Siguiente")
          .setDescription(`Faltan **${formatCompact(xpRestante)} XP** para subir a nivel **${nivel + 1}**.`)
          .addFields({ name: "Colección más cercana", value: objetivoColeccion });

        return interaction.followUp({ embeds: [embed] });
      }

      if (tipo === "actividad") {
        const resDiasActivos = await db.execute({
          sql: `SELECT fecha FROM actividad_diaria
                WHERE user_id = ?
                AND (acciones > 0 OR xp_ganado > 0 OR monedas_ganadas > 0)
                ORDER BY fecha DESC LIMIT 180`,
          args: [targetUserId]
        });
        const resHoyChile = await db.execute({
          sql: `SELECT date(
                'now',
                COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours')
              ) as hoy`,
        });

        const diasActivos = new Set(resDiasActivos.rows.map(r => String(r.fecha || "")));
        const prevDateKey = (key) => {
          const d = new Date(`${key}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          return d.toISOString().slice(0, 10);
        };

        let racha = 0;
        let cursorKey = String(resHoyChile.rows[0]?.hoy || new Date().toISOString().slice(0, 10));
        while (true) {
          if (!diasActivos.has(cursorKey)) break;
          racha += 1;
          cursorKey = prevDateKey(cursorKey);
        }

        const resActividadMes = await db.execute({
          sql: `SELECT 
                COALESCE(SUM(xp_ganado), 0) as xp_mes,
                COALESCE(SUM(monedas_ganadas), 0) as monedas_mes,
                COUNT(*) as dias_activos_mes
                FROM actividad_diaria
                WHERE user_id = ?
                AND fecha >= date(
                  'now',
                  COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours'),
                  'start of month'
                )
                AND (acciones > 0 OR xp_ganado > 0 OR monedas_ganadas > 0)`,
          args: [targetUserId]
        });

        const xpMes = Number(resActividadMes.rows[0]?.xp_mes || 0);
        const monedasMes = Number(resActividadMes.rows[0]?.monedas_mes || 0);
        const diasActivosMes = Number(resActividadMes.rows[0]?.dias_activos_mes || 0);

        const objetivoXpMensual = Math.max(1000, nivel * 300);
        const progresoXpMensual = Math.min(100, Math.round((xpMes / objetivoXpMensual) * 100));

        const embed = crearEmbed(CONFIG.COLORES.VERDE)
          .setTitle("🔥 Racha y Actividad")
          .setDescription(`Racha activa: **${racha}** días`)
          .addFields({
            name: "Resumen mensual",
            value:
              `Días activos este mes: **${diasActivosMes}**\n` +
              `XP mensual: **${formatCompact(xpMes)}** / ${formatCompact(objetivoXpMensual)} (${progresoXpMensual}%)\n` +
              `Monedas obtenidas este mes: **${formatCompact(monedasMes)}**`
          });

        return interaction.followUp({ embeds: [embed] });
      }

      if (tipo === "comparativa") {
        const resRanking = await db.execute({
          sql: "SELECT COUNT(*) as rank FROM usuarios WHERE monedas > ?",
          args: [monedas]
        });
        const puestoEconomico = Number(resRanking.rows[0]?.rank || 0) + 1;
        const totalUsersRes = await db.execute("SELECT COUNT(*) as total FROM usuarios");
        const totalUsers = Math.max(1, Number(totalUsersRes.rows[0]?.total || 1));

        const resColecciones = await db.execute({
          sql: "SELECT COUNT(*) as total FROM colecciones WHERE user_id = ?",
          args: [targetUserId]
        });
        const totalColeccionUsuario = Number(resColecciones.rows[0]?.total || 0);

        const resRankingColeccion = await db.execute({
          sql: "SELECT COUNT(*) as rank FROM (SELECT user_id, COUNT(*) as total_items FROM colecciones GROUP BY user_id) t WHERE t.total_items > ?",
          args: [totalColeccionUsuario]
        });
        const puestoColeccion = Number(resRankingColeccion.rows[0]?.rank || 0) + 1;
        const totalColeccionistasRes = await db.execute("SELECT COUNT(DISTINCT user_id) as total FROM colecciones");
        const totalColeccionistas = Math.max(1, Number(totalColeccionistasRes.rows[0]?.total || 1));

        const topEconomicoPercent = Math.min(100, Math.max(1, Math.ceil((puestoEconomico / totalUsers) * 100)));
        const topColeccionPercent = Math.min(100, Math.max(1, Math.ceil((puestoColeccion / totalColeccionistas) * 100)));

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
          .setTitle("🧭 Comparativa Vecinal")
          .setDescription(
            `💸 Económico: **Top ${topEconomicoPercent}%** (puesto #${puestoEconomico}/${totalUsers})\n` +
            `📚 Coleccionista: **Top ${topColeccionPercent}%** (puesto #${puestoColeccion}/${totalColeccionistas})`
          );

        return interaction.followUp({ embeds: [embed] });
      }

      if (tipo === "insignias") {
        const resHabilidades = await db.execute({
          sql: "SELECT habilidad, nivel FROM habilidades WHERE user_id = ?",
          args: [targetUserId]
        });
        const pescaNivel = Number((resHabilidades.rows.find(r => String(r.habilidad) === "pesca") || {}).nivel || 0);

        const resRanking = await db.execute({
          sql: "SELECT COUNT(*) as rank FROM usuarios WHERE monedas > ?",
          args: [monedas]
        });
        const puestoEconomico = Number(resRanking.rows[0]?.rank || 0) + 1;
        const totalUsersRes = await db.execute("SELECT COUNT(*) as total FROM usuarios");
        const totalUsers = Math.max(1, Number(totalUsersRes.rows[0]?.total || 1));
        const topEconomicoPercent = Math.max(1, Math.round((puestoEconomico / totalUsers) * 100));

        const resColecciones = await db.execute({
          sql: "SELECT COUNT(*) as total FROM colecciones WHERE user_id = ?",
          args: [targetUserId]
        });
        const totalColeccionUsuario = Number(resColecciones.rows[0]?.total || 0);

        const resDiasActivos = await db.execute({
          sql: `SELECT fecha FROM actividad_diaria
                WHERE user_id = ?
                AND (acciones > 0 OR xp_ganado > 0 OR monedas_ganadas > 0)
                ORDER BY fecha DESC LIMIT 180`,
          args: [targetUserId]
        });
        const resHoyChile = await db.execute({
          sql: `SELECT date(
                'now',
                COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours')
              ) as hoy`,
        });
        const diasActivos = new Set(resDiasActivos.rows.map(r => String(r.fecha || "")).filter(Boolean));
        const prevDateKey = (key) => {
          const d = new Date(`${key}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          return d.toISOString().slice(0, 10);
        };
        let racha = 0;
        let cursorKey = String(resHoyChile.rows[0]?.hoy || new Date().toISOString().slice(0, 10));
        while (true) {
          if (!diasActivos.has(cursorKey)) break;
          racha += 1;
          cursorKey = prevDateKey(cursorKey);
        }

        const insignias = [];
        if (topEconomicoPercent <= 10) insignias.push("💸 Top 10% económico");
        if (monedas >= 10000) insignias.push("💰 Millonario");
        if (pescaNivel >= 10) insignias.push("🎣 Maestro de pesca");
        if (totalColeccionUsuario >= 100) insignias.push("📚 Coleccionista experto");
        if (racha >= 7) insignias.push("🔥 Constancia 7d");

        const embed = crearEmbed(CONFIG.COLORES.OLIVA)
          .setTitle("🏅 Insignias Dinámicas")
          .setDescription(insignias.length ? insignias.join("\n") : "Aún no hay insignias desbloqueadas.");

        return interaction.followUp({ embeds: [embed] });
      }

      if (tipo === "progreso") {
        const resHabilidades = await db.execute({
          sql: "SELECT habilidad, nivel FROM habilidades WHERE user_id = ?",
          args: [targetUserId]
        });

        const textoHabilidades = resHabilidades.rows.length
          ? resHabilidades.rows
            .map(r => `• ${String(r.habilidad)}: Nv.${Number(r.nivel)}`)
            .join("\n")
          : "Sin habilidades registradas aún.";

        const totalResult = await db.execute("SELECT 'peces' as cat, COUNT(*) as c FROM peces UNION ALL SELECT 'insectos', COUNT(*) FROM insectos UNION ALL SELECT 'aves', COUNT(*) FROM aves UNION ALL SELECT 'animales', COUNT(*) FROM animales UNION ALL SELECT 'cultivos', COUNT(*) FROM cultivos UNION ALL SELECT 'recolectables', COUNT(*) FROM recolectables UNION ALL SELECT 'recetas', COUNT(*) FROM recetas UNION ALL SELECT 'logros', COUNT(*) FROM logros");
        const maxItems = {};
        for (const r of totalResult.rows) maxItems[r.cat] = Number(r.c);

        const colResult = await db.execute({
          sql: "SELECT categoria, COUNT(*) as total FROM colecciones WHERE user_id = ? GROUP BY categoria",
          args: [targetUserId]
        });
        const textoColecciones = colResult.rows.length
          ? colResult.rows
            .map(r => {
              const cat = String(r.categoria);
              const own = Number(r.total);
              const total = Number(maxItems[cat] || 0);
              return `• ${cat}: ${own}/${total}`;
            })
            .join("\n")
          : "Sin colecciones registradas.";

        const resBitacora = await db.execute({
          sql: "SELECT accion FROM bitacora WHERE user_id = ? ORDER BY id DESC LIMIT 5",
          args: [targetUserId]
        });
        const textoBitacora = resBitacora.rows.length
          ? resBitacora.rows.map(r => `• ${String(r.accion)}`).join("\n")
          : "Sin aventuras recientes.";

        const embed = crearEmbed(CONFIG.COLORES.CIELO)
          .setTitle("📊 Progreso Detallado")
          .addFields(
            { name: "🌟 Habilidades", value: textoHabilidades, inline: false },
            { name: "📔 Colecciones", value: textoColecciones, inline: false },
            { name: "📖 Bitácora", value: textoBitacora, inline: false }
          );

        return interaction.followUp({ embeds: [embed] });
      }

      if (tipo === "inventario") {
        const resMascotas = await db.execute({
          sql: "SELECT item_id FROM inventario_economia WHERE user_id = ? AND item_id LIKE 'mascota_%' AND cantidad > 0",
          args: [targetUserId]
        });
        const resTemas = await db.execute({
          sql: "SELECT item_id FROM inventario_economia WHERE user_id = ? AND item_id LIKE 'tema_%' AND cantidad > 0",
          args: [targetUserId]
        });
        const resMarcos = await db.execute({
          sql: "SELECT item_id FROM inventario_economia WHERE user_id = ? AND item_id LIKE 'marco_perfil_%' AND cantidad > 0",
          args: [targetUserId]
        });
        const resConsumibles = await db.execute({
          sql: "SELECT item_id, cantidad FROM inventario_economia WHERE user_id = ? AND item_id IN ('booster_xp_30m','amuleto_suerte_15m','reset_racha_perdon') AND cantidad > 0",
          args: [targetUserId]
        });
        const resTitulos = await db.execute({
          sql: "SELECT titulo, equipado FROM titulos WHERE user_id = ? ORDER BY equipado DESC, titulo ASC",
          args: [targetUserId]
        });

        const mascotas = resMascotas.rows.map(r => String(r.item_id).replace("mascota_", ""));
        const temas = resTemas.rows.map(r => String(r.item_id).replace("tema_", ""));
        const marcos = resMarcos.rows.map(r => String(r.item_id).replace("marco_perfil_", ""));
        const consumibles = resConsumibles.rows.map(r => `${String(r.item_id)} x${Number(r.cantidad || 0)}`);
        const titulos = resTitulos.rows.map(r => `${Number(r.equipado) === 1 ? "✨ " : ""}${String(r.titulo)}`);

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
          .setTitle("🎒 Inventario y Logros")
          .addFields(
            { name: "🐾 Mascotas", value: mascotas.length ? mascotas.join(", ") : "Ninguna", inline: false },
            { name: "🖼️ Temas", value: temas.length ? temas.join(", ") : "Ninguno", inline: false },
            { name: "🪞 Marcos de Perfil", value: marcos.length ? marcos.join(", ") : "Ninguno", inline: false },
            { name: "⚗️ Consumibles / Servicios", value: consumibles.length ? consumibles.join("\n") : "Ninguno", inline: false },
            { name: "🏆 Títulos", value: titulos.length ? titulos.join("\n") : "Ninguno", inline: false }
          );

        return interaction.followUp({ embeds: [embed] });
      }

      return interaction.followUp("No entendí esa opción de perfil.");
    } catch (e) {
      console.error("Error en perfil_ver_mas:", e);
      return interaction.followUp("Hubo un error al abrir esa sección del perfil.");
    }
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

  // ---- Blackjack Buttons ----
  if (interaction.isButton() && interaction.customId.startsWith("blackjack_")) {
    const { handleBlackjackButton } = await import("./commands/blackjack.js");
    return await handleBlackjackButton(interaction);
  }

  // ---- Casino Buttons ----
  if (interaction.isButton() && interaction.customId.startsWith("casino_")) {
    const { handleCasinoButton } = await import("./commands/casino.js");
    return await handleCasinoButton(interaction);
  }

  if (interaction.isAutocomplete()) {
    try {
      const globalAutocompleteCommands = new Set([
        "peces", "insectos", "aves", "animales", "cultivos",
        "recolectables", "recetas", "habitantes", "logros"
      ]);

      if (globalAutocompleteCommands.has(interaction.commandName)) {
        await handleAutocompleteGlobal(interaction);
      } else {
        await handleAutocomplete(interaction);
      }
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
