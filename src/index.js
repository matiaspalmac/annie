// ============================================================
// Annie Bot v2 — Punto de entrada principal
// Heartopia Wiki Bot (discord.js v14 + ESM)
// ============================================================

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
import { COMMAND_DEFS, handleAutocomplete, handleCommand } from "./commands.js";
import {
  getTrato, getSaludoHora,
  ACTIVIDADES, RUTINAS, FRASES_AMBIENT, CLIMA_PUEBLO,
} from "./personality.js";
import {
  getHoraChile, estaDurmiendo, setDurmiendo,
  crearEmbed, getBostezo,
} from "./utils.js";

// ============================================================
// Cliente de Discord
// ============================================================
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

// ============================================================
// Variables globales
// ============================================================
let ultimaRutina = null;
let historialMensajes = [];
let ultimoChisme = 0;

// ============================================================
// Funciones de ciclo de vida
// ============================================================

function getCanalGeneral() {
  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  return guild?.channels.cache.get(CONFIG.CANAL_GENERAL_ID) ?? null;
}

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

// ============================================================
// Conexion a canal de voz (oficinita de Annie)
// ============================================================
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

// ============================================================
// Anuncio de clima (diario a las 19:00)
// ============================================================
async function anunciarClima(forzado = false) {
  const hora = getHoraChile();
  if (!forzado && hora !== 19) return;

  const canal = getCanalGeneral();
  if (!canal) return;

  const hoy = CLIMA_PUEBLO.hoy;
  const embed = crearEmbed(CONFIG.COLORES.CIELO)
    .setTitle(`Clima del Pueblito -- Hoy`)
    .setDescription(`**${hoy.tipo}**\n${hoy.descripcion}`)
    .addFields({
      name: "Horarios con carino",
      value: hoy.timeline.map(h => `${h.hora}:00 -- ${h.texto}`).join("\n"),
    })
    .setFooter({ text: "Pronostico hecho con amor | Annie" });

  await canal.send({ content: "Annie les trae el clima con amor:", embeds: [embed] }).catch(console.error);
}

// ============================================================
// Rutinas diarias (frases por hora)
// ============================================================
function ejecutarRutinaDiaria() {
  if (estaDurmiendo()) return;
  const hora = getHoraChile();
  const rutina = RUTINAS.find(r => r.hora === hora);
  if (!rutina || ultimaRutina === hora) return;

  ultimaRutina = hora;
  const canal = getCanalGeneral();
  if (!canal) return;

  canal.send(rutina.mensaje).catch(console.error);
}

// ============================================================
// Actualizar nombre de canal de hora y clima
// ============================================================
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

// ============================================================
// Mencion random a vecino (cada 90 min, con proteccion de sueno)
// ============================================================
async function mencionarVecinoRandom() {
  if (estaDurmiendo()) return;

  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  const canal = getCanalGeneral();
  if (!guild || !canal) return;

  const miembros = guild.members.cache.filter(m => !m.user.bot).map(m => m);
  if (miembros.length === 0) return;

  const vecino = miembros[Math.floor(Math.random() * miembros.length)];
  const frases = [
    `Ay, ${vecino}... hace ratito que no te veia por aqui.`,
    `${vecino} sabe algo dulce... yo no digo nada, pero...`,
    `Y ${vecino}? Siempre aparece cuando hay cositas lindas que contar.`,
    `${vecino}, ven a charlar un ratito conmigo, corazon po.`,
  ];

  canal.send(`*Annie asoma la cabecita con carino:* ${frases[Math.floor(Math.random() * frases.length)]}`).catch(console.error);
}

// ============================================================
// Evento: Bot listo
// ============================================================
client.once("clientReady", async () => {
  console.log(`Annie v2 conectada: ${client.user.tag}`);

  conectarOficina();
  actualizarEstado();

  // Cachear mensaje de roles
  if (CONFIG.MENSAJE_ROLES_ID) {
    client.guilds.cache.forEach(async (guild) => {
      guild.channels.cache.forEach(async (channel) => {
        if (channel.isTextBased()) {
          try { await channel.messages.fetch(CONFIG.MENSAJE_ROLES_ID); } catch {}
        }
      });
    });
  }

  // Registrar slash commands
  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
      { body: COMMAND_DEFS },
    );
    console.log("Slash commands registrados correctamente");
  } catch (e) {
    console.error("Error registrando commands:", e);
  }

  // Programar actualizacion de canales cada 5 min
  const scheduleUpdate = () => {
    const now = new Date();
    const ms = (5 - (now.getMinutes() % 5)) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
    setTimeout(() => {
      updateTimeChannel();
      updateWeatherChannel();
      scheduleUpdate();
    }, ms + 2000);
  };
  updateTimeChannel();
  updateWeatherChannel();
  scheduleUpdate();

  // Gestion de sueno (check cada minuto)
  gestionarSueno();
  setInterval(gestionarSueno, 60000);

  // Actualizar presencia cada 10 min
  setInterval(actualizarEstado, 600000);
});

// ============================================================
// Intervalos ambientales
// ============================================================
// Frase ambient cada 90 min
setInterval(() => {
  if (estaDurmiendo()) return;
  const canal = getCanalGeneral();
  if (!canal) return;
  const frase = FRASES_AMBIENT[Math.floor(Math.random() * FRASES_AMBIENT.length)];
  canal.send(`*Annie comenta con carino:* ${frase}`).catch(console.error);
}, 1000 * 60 * 90);

// Rutinas diarias cada 5 min
setInterval(ejecutarRutinaDiaria, 1000 * 60 * 5);

// Mencion random cada 90 min
setInterval(mencionarVecinoRandom, 1000 * 60 * 90);

// Boletin del clima cada 2 horas
setInterval(anunciarClima, 1000 * 60 * 120);

// ============================================================
// Evento: Nuevo miembro
// ============================================================
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const canal = await member.guild.channels.fetch(CONFIG.CANAL_GENERAL_ID);
    if (!canal) return;

    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("Un nuevo corazoncito llego al pueblito!")
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

// ============================================================
// Evento: Voice state (reconexion + saludo)
// ============================================================
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  // Reconexion automatica si Annie es desconectada
  if (
    oldState.member?.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    console.log("Annie se desconecto del voice, reconectando...");
    return setTimeout(conectarOficina, 5000);
  }

  // Saludo cuando alguien entra a un voice
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

// ============================================================
// Evento: Reacciones para roles
// ============================================================
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
      try { await user.send(`Te puse el rol **${role.name}** con carino, vecino.`); } catch {}
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
      try { await user.send(`Te quite el rol **${role.name}** con carino, vecino... si lo quieres de vuelta, solo reacciona otra vez.`); } catch {}
    }
  } catch (e) {
    console.error("Error quitando rol:", e.message);
  }
});

// ============================================================
// Evento: Mensajes de texto (chisme + respuestas contextuales)
// ============================================================
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  const texto = msg.content.toLowerCase();
  const ahora = Date.now();

  // --- Sistema de chisme (mucha actividad en general) ---
  if (msg.channel.id === CONFIG.CANAL_GENERAL_ID) {
    historialMensajes.push(ahora);
    historialMensajes = historialMensajes.filter(m => ahora - m < CONFIG.VENTANA_CHISME);

    if (
      historialMensajes.length >= CONFIG.UMBRAL_CHISME &&
      ahora - ultimoChisme > CONFIG.COOLDOWN_CHISME
    ) {
      ultimoChisme = ahora;
      historialMensajes = [];

      const frasesChismeDia = [
        `Ay, vecino lindo... se me pararon las orejititas curiosas con tanto mensajito. Que paso po? Cuentame todo con carino...`,
        `Uy, uy, tesoro! El chat esta lleno de cositas lindas... que paso? No me dejes con la intriga, corazon.`,
        `Mi vecino precioso! Se siente olor a chismecito dulce... me cuentas con ternura?`,
      ];
      const frasesChismeNoche = [
        `*(Annie abre un ojito)* Ay, vecino lindo... que paso po? Se me pararon las orejititas curiosas... cuentame bajito.`,
        `*(susurra somnolienta)* Zzz... chismecito? Ay, no me dejes con la intriga, corazon... que paso?`,
        `*(bosteza lindo)* Uf... desperte por el ruido dulce... que cosita linda paso?`,
      ];

      const pool = estaDurmiendo() ? frasesChismeNoche : frasesChismeDia;
      await msg.channel.send(`*Annie asoma la cabecita con carino:* "${pool[Math.floor(Math.random() * pool.length)]}"`).catch(console.error);
    }
  }

  // --- Easter eggs numericos (mantenidos del bot original) ---
  if (texto === "11") return msg.reply("Chupalo entonces, corazon!");
  if (texto === "5")  return msg.reply("Por el culo te la hinco con carino!");
  if (texto === "13") return msg.reply("Mas me crece de ternura!");
  if (texto === "8")  return msg.reply("El culo te abrocho con amor!");
  if (texto === "4")  return msg.reply("En tu culo mi aparatito dulce!");
  if (texto.startsWith("me gusta")) return msg.reply("Y el pico? Acuerdese que soy de campo, vecino lindo!");

  // --- Respuestas contextuales a Annie ---
  const mencionaAnnie = texto.includes("annie");

  if (estaDurmiendo()) {
    if ((texto.includes("hola") || texto.includes("holi") || texto.includes("wena")) && mencionaAnnie) {
      return msg.reply("*(Annie se despereza suave)* Zzz... ah? Wena mi vecino lindo... que necesitas tan tempranito?");
    }
    if ((texto.includes("gracias") || texto.includes("vale")) && mencionaAnnie) {
      return msg.reply("*(susurra dormida)* De nada po, corazon... Zzz... siempre aqui para ti.");
    }
    if (texto.includes("chao") || texto.includes("buenas noches")) {
      return msg.reply("Buenas noches, mi vecino precioso... suena bonito y abrigate, ya? Zzz...");
    }
  } else {
    if ((texto.includes("hola") || texto.includes("holi") || texto.includes("wena")) && mencionaAnnie) {
      return msg.reply(`Wena, wena mi vecino lindo! Como estas hoy, corazon? Pasa no mas, estoy con tecito dulce.`);
    }
    if ((texto.includes("gracias") || texto.includes("vale")) && mencionaAnnie) {
      return msg.reply("De nada po, mi alegria! Siempre aqui para ti, ya?");
    }
    if ((texto.includes("chao") || texto.includes("adios")) && mencionaAnnie) {
      return msg.reply("Chao, corazon! Cuidate harto y vuelve prontito, ya?");
    }
  }
});

// ============================================================
// Evento: Interacciones (autocomplete + comandos)
// ============================================================
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) return handleAutocomplete(interaction);
  if (interaction.isChatInputCommand()) return handleCommand(interaction);
});

// ============================================================
// Servidor HTTP (keep-alive para hosting)
// ============================================================
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Annie v2 is live");
}).listen(8000);

// ============================================================
// Login
// ============================================================
client.login(CONFIG.TOKEN);
