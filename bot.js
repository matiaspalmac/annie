require("dotenv").config();
const http = require("http");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ActivityType,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

// Constantes y configuración
const PRECIOS = require("./info/precios.json");
const PECES = require("./info/peces.json");
const CULTIVOS = require("./info/cultivos.json");
const ANIMALES = require("./info/animales.json");
const AVES = require("./info/aves.json");
const INSECTOS = require("./info/insectos.json");
const LOGROS = require("./info/logros.json");
const RECOLECTABLES = require("./info/recolectables.json");

const CONFIG = {
  TOKEN: process.env.DISCORD_BOT_TOKEN,
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  TIMEZONE: "America/New_York",
  GUILD_ID: "1463659718382977253",
  CANAL_HORA_ID: "1465953316029726801",
  CANAL_CLIMA_ID: "1466973835831283876",
  MENSAJE_ROLES_ID: "1466700694852472936",
  CANAL_GENERAL_ID: "1463659720207372464",
  CANAL_VOZ_DORMIR_ID: "1466250598302355570",
  ANNIE_IMG: "https://imgur.com/pCWlxKG.png",
  HORA_DORMIR: 23,
  HORA_DESPERTAR: 8,
  UMBRAL_CHISME: 15,
  VENTANA_CHISME: 180000,
  COOLDOWN_CHISME: 900000,

  REACTION_ROLES: {
    "🪲": "1465882704607449190",
    "🫧": "1465882796198330389",
    "🦆": "1465882906881818654",
    "🎣": "1465883005162885445",
    "🪺": "1465883082824483060",
    "💐": "1465928627123257550",
  },
};

const RUTINAS = [
  {
    hora: 8,
    mensaje:
      "🌅 *Annie abre la oficinita con cariño:* ¡Buenos días, pueblito lindo! Ya llegó el pancito para compartir 🥖💕",
  },
  {
    hora: 9,
    mensaje:
      "☕ *Annie se prepara su tecito:* Wena de nuevo, corazones... ¿quién quiere acompañarme con un sorbito? ✨",
  },
  {
    hora: 13,
    mensaje:
      "🍲 *Hora de almuerzo:* Annie se va a comer algo rico, pero igual escucha sus cositas con amor 👂💖",
  },
  {
    hora: 15,
    mensaje:
      "🍰 *Once dulce:* ¿Alguien comparte un pedacito de empanadita conmigo, tesoritos? 😋🌸",
  },
  {
    hora: 18,
    mensaje:
      "🌇 *La tarde se pone suave:* El pueblito está más tranquilo... Annie también se relaja con ustedes 🥱💕",
  },
  {
    hora: 20,
    mensaje:
      "🌙 *Annie mira las estrellitas:* Qué cielo tan bonito hoy, vecinitos... ¿lo están viendo conmigo? ✨🌌",
  },
  {
    hora: 22,
    mensaje:
      "🌙 *Annie bosteza suave:* Ya voy cerrando la oficinita, corazones... ¡a descansar juntitos! 😴💤",
  },
  {
    hora: 23,
    mensaje:
      "💤 *Annie se acurruca con cariño:* Buenas noches, mi pueblito lindo... sueñen bonito y abríguense, ¿ya? 🌙💕",
  },
];

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

const ACTIVIDADES = [
  "repartiendo cariñitos ✉️💖",
  "buscando sellitos con amor 🔍📮",
  "tomando mi tecito dulce ☕🌸",
  "persiguiendo mariposas suaves 🦋☀️",
  "ordenando paquetitos con ternura 📦💕",
  "mirando nubecitas con ustedes ☁️🦆",
  "echando la tallita dulce 👋😊",
  "comiéndome una sopapillita rica 🥟",
  "viendo la Jueza con mantita ⚖️📺",
  "charlando con la vecinita de al lado 💅",
  "bailando cuequita suave 💃🕺",
  "regando mis plantitas con besitos 🌱💦",
  "tomando mote con huesillo fresco 🍹",
  "escuchando musiquita vieja 🎶",
  "soñando con completitos ideales 🌭",
  "contando estrellitas con ternura 🌌",
  "hablando solita con los patitos del lago 🦆🗣️",
  "planeando la próxima once con amor 🍰☕",
];

const getTrato = () => {
  const tratos = [
    "vecino",
    "vecina",
    "iñor",
    "iñora",
    "jovencito",
    "jovencita",
  ];
  return tratos[Math.floor(Math.random() * tratos.length)];
};

const FRASES_ANNIE = [
  "¡Ay, vecin@ lindo/a! Qué alegría verte por aquí hoy... ¿cómo estás, corazón? 💕🌸",
  "No se te olvide regar tus plantitas, ¿ya? Te mando un besito para que crezcan precioso 🌷💋",
  "¡Uf, se me enredó el delantal otra vez! Casi me caigo, tesorito... menos mal que estás tú 💖",
  "¡Wena, mi alegría! Ese look te queda precioso hoy... ¿te lo pusiste para alegrarme? ✨👗",
  "¡Holi, holi, tesoro! Solo pasaba a decirte que eres lo más lindo del pueblo 🌎💕",
  "Amo mi trabajo... cada carta es como un abrazito que reparto por el pueblo 📮😊",
  "¡Qué ganas de un completo con harta mayo y palta! ¿Me invitas uno, corazoncito? 🌭🥰",
  "¡Ay, está fresquito! Abrígate po, mi rayito de sol, no quiero que te resfríes ❄️🧣",
  "¿Viste esa nube? Parece un pudú chiquitito durmiendo... ¡qué tierno, corazón! 🦌☁️",
  "Oye, vecin@ lindo/a... ¿ya regaste tus flores? Si no, te ayudo con un besito de agua 🌸💦",
  "¡Qué día lindo pa' sentarnos a charlar en la plaza! ¿Te animas conmigo, tesoro? ☺️",
  "No se me duerman, ¿ya? Que después extraño sus mensajitos dulces 📮💕",
  "Si necesitas un consejo del corazón, aquí estoy yo, mi personita favorita ❤️",
  "Hoy me siento más romántica que nunca... ¿me prestas tu hombro pa' soñar juntitos? 💘",
  "¡Quién me regala un tecito rico pa' seguir repartiendo cariñitos todo el día? ☕💖",
];

const CLIMA_PUEBLO = {
  hoy: {
    tipo: "☁️ Noche nubosa en el Pueblo",
    descripcion:
      "Parece que las nubes han llegado para quedarse un ratito, vecino. Aunque esté nuboso, el cielo tiene su encanto... ¡y prepárate, que mañana temprano necesitaremos el paraguas! ☁️☂️",
    eventos: [
      { hora: 8, evento: "Lluvia ligera", icono: "🌧️" },
      { hora: 14, evento: "Aparición de un arcoíris", icono: "🌈" },
    ],
    timeline: [
      { hora: 20, icono: "☁️🌙", texto: "Noche nubosa" },
      { hora: 2, icono: "🌙✨", texto: "Cielo despejado por la madrugada" },
      { hora: 8, icono: "🌧️", texto: "Mañana de lluvia, ¡saque el paraguas!" },
      { hora: 14, icono: "🌈☁️", texto: "Nuboso con un lindo arcoíris" },
      { hora: 20, icono: "🌙✨", texto: "Noche despejada" },
    ],
  },
  proximos: [
    { dia: "Sábado", icono: "🌈", clima: "Lluvia matutina y arcoíris" },
    { dia: "Domingo", icono: "☀️", clima: "Soleado y despejado" },
    { dia: "Lunes", icono: "☀️", clima: "Soleado y despejado" },
    { dia: "Martes", icono: "☀️", clima: "Soleado y despejado" },
    { dia: "Miércoles", icono: "☀️", clima: "Soleado y despejado" },
  ],
};

// Variables globales
let ultimaRutina = null;
let historialMensajes = [];
let ultimoChisme = 0;
let estaDurmiendoActual = false;

// Funciones
function getHoraChile() {
  return parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Santiago",
      hour: "numeric",
      hour12: false,
    }),
  );
}

function getCanalGeneral() {
  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  return guild?.channels.cache.get(CONFIG.CANAL_GENERAL_ID) ?? null;
}

async function anunciarClima(forzado = false) {
  const horaChile = getHoraChile();

  if (!forzado && horaChile !== 19) return;

  const canal = client.channels.cache.get(CONFIG.CANAL_GENERAL_ID);
  if (!canal) return;

  const hoy = CLIMA_PUEBLO.hoy;

  const embed = new EmbedBuilder()
    .setTitle(`🌦️ Clima del Pueblito — Hoy`)
    .setDescription(`**${hoy.tipo}**\n${hoy.descripcion}`)
    .addFields({
      name: "🕒 Horarios con cariño",
      value: hoy.timeline.map((h) => `🕰️ ${h.hora}:00 — ${h.texto}`).join("\n"),
    })
    .setThumbnail(CONFIG.ANNIE_IMG)
    .setColor("#A7D8DE");

  await canal.send({
    content: "📮 **Annie les trae el clima con amor:**",
    embeds: [embed],
  });
}

function ejecutarRutinaDiaria() {
  if (estaDurmiendoActual) return;

  const horaChile = getHoraChile();

  const rutina = RUTINAS.find((r) => r.hora === horaChile);
  if (!rutina || ultimaRutina === horaChile) return;

  ultimaRutina = horaChile;

  const canal = getCanalGeneral();
  if (!canal) return;

  canal.send(`📮 ${rutina.mensaje}`);
}

async function conectarOficina() {
  const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
  if (!guild) return;

  let canal;
  try {
    canal = await guild.channels.fetch(CONFIG.CANAL_VOZ_DORMIR_ID);
  } catch {
    console.error("❌ No pude obtener el canal de voz");
    return;
  }

  if (!canal || canal.type !== 2) return;

  const connection = getVoiceConnection(CONFIG.GUILD_ID);
  if (connection) return;

  try {
    joinVoiceChannel({
      channelId: canal.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });
    console.log("🏢 Annie entró a su oficinita");
  } catch (e) {
    console.error("Error conectando Annie al voice:", e);
  }
}

function actualizarEstado() {
  if (estaDurmiendoActual) {
    client.user.setActivity("Zzz... acurrucadita en la oficinita 💤", {
      type: ActivityType.Custom,
    });
  } else {
    const estado = ACTIVIDADES[Math.floor(Math.random() * ACTIVIDADES.length)];
    client.user.setActivity(estado, { type: ActivityType.Custom });
  }
}

async function gestionarSueno() {
  const horaChile = getHoraChile();
  const deberiaDormir =
    horaChile >= CONFIG.HORA_DORMIR || horaChile < CONFIG.HORA_DESPERTAR;
  if (deberiaDormir && !estaDurmiendoActual) {
    estaDurmiendoActual = true;
    actualizarEstado();
  } else if (!deberiaDormir && estaDurmiendoActual) {
    estaDurmiendoActual = false;
    actualizarEstado();
  }
}

async function updateWeatherChannel() {
  if (!CONFIG.CANAL_CLIMA_ID) return;
  try {
    const canalClima = await client.channels.fetch(CONFIG.CANAL_CLIMA_ID);
    if (!canalClima) return;

    const horaActual = new Date(new Date().toLocaleString("es-CL", {timeZone: 'America/Santiago'})).getHours();
    
    const estadosPasados = CLIMA_PUEBLO.hoy.timeline.filter(t => t.hora <= horaActual);
    const climaAhora = estadosPasados.length > 0 
      ? estadosPasados[estadosPasados.length - 1] 
      : CLIMA_PUEBLO.hoy.timeline[CLIMA_PUEBLO.hoy.timeline.length - 1];

    const nombreCanal = `${climaAhora.icono} Clima: ${climaAhora.texto}`;

    if (canalClima.name !== nombreCanal) {
      await canalClima.setName(nombreCanal);
      console.log(`[Canal] Clima actualizado a: ${nombreCanal}`);
    }
  } catch (error) {
    if (error.status !== 429) console.error("Error al actualizar canal de clima:", error);
  }
}

async function updateTimeChannel() {
  if (!CONFIG.CANAL_HORA_ID) return;
  try {
    const channel = await client.channels.fetch(CONFIG.CANAL_HORA_ID);
    if (!channel) return;

    const ahora = new Date();
    const time = ahora.toLocaleTimeString("es-ES", {
      timeZone: CONFIG.TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const hora12 = ahora.getHours() % 12 || 12;
    const relojes = ["🕛","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛"];
    const emojiReloj = relojes[hora12];

    const newName = `${time} ${emojiReloj} Pueblito`;

    if (channel.name !== newName) {
      await channel.setName(newName);
    }
  } catch (e) {
    if (e.status !== 429) console.error("Error reloj:", e.message);
  }
}

async function mencionarVecinoRandom() {
  if (estaDurmiendoActual) return;

  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  const canal = getCanalGeneral();
  if (!guild || !canal) return;

  const miembros = guild.members.cache.filter((m) => !m.user.bot).map((m) => m);

  if (miembros.length === 0) return;

  const vecino = miembros[Math.floor(Math.random() * miembros.length)];

  const frases = [
    `Ay, ${vecino}... hace ratito que no te veía por aquí 👀💕`,
    `${vecino} sabe algo dulce... yo no digo nada, pero... 👂🌸`,
    `¿Y ${vecino}? Siempre aparece cuando hay cositas lindas que contar 💬✨`,
    `${vecino}, ven a charlar un ratito conmigo, corazón po 💕`,
  ];

  canal.send(
    `📮✨ *Annie asoma la cabecita con cariño:* ${frases[Math.floor(Math.random() * frases.length)]}`,
  );
}

async function enviarPaginado({
  interaction,
  baseEmbed,
  items,
  itemsPorPagina = 15,
  titulo,
  descripcion,
  renderItem,
  content = null,
  timeout = 300000,
}) {
  let paginaActual = 1;
  const totalPaginas = Math.ceil(items.length / itemsPorPagina);

  const generarEmbedPagina = (pagina) => {
    const inicio = (pagina - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;

    const embed = EmbedBuilder.from(baseEmbed)
      .setTitle(`${titulo} — Página ${pagina}/${totalPaginas}`)
      .setDescription(descripcion);

    items.slice(inicio, fin).forEach((item) => {
      const field = renderItem(item);
      if (field) embed.addFields(field);
    });

    embed.setFooter({
      text: `Mostrando ${inicio + 1}-${Math.min(fin, items.length)} de ${items.length}`,
    });

    return embed;
  };

  const botonesBase = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPaginas === 1),
    new ButtonBuilder()
      .setCustomId("info")
      .setLabel(`Página 1/${totalPaginas}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
  );

  const message = await interaction.reply({
    content,
    embeds: [generarEmbedPagina(1)],
    components: [botonesBase],
    fetchReply: true,
  });

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: timeout,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();

    if (i.customId === "prev") paginaActual--;
    if (i.customId === "next") paginaActual++;

    paginaActual = Math.max(1, Math.min(totalPaginas, paginaActual));

    const botones = ActionRowBuilder.from(botonesBase);
    botones.components[0].setDisabled(paginaActual === 1);
    botones.components[1].setDisabled(paginaActual === totalPaginas);
    botones.components[2].setLabel(`Página ${paginaActual}/${totalPaginas}`);

    await i.editReply({
      embeds: [generarEmbedPagina(paginaActual)],
      components: [botones],
    });
  });

  collector.on("end", async () => {
    const disabled = ActionRowBuilder.from(botonesBase);
    disabled.components.forEach((b) => b.setDisabled(true));
    await interaction.editReply({ components: [disabled] }).catch(() => {});
  });
}

// Intervalos
setInterval(
  () => {
    if (estaDurmiendoActual) return;

    const canal = getCanalGeneral();
    if (!canal) return;

    const frase = FRASES_ANNIE[Math.floor(Math.random() * FRASES_ANNIE.length)];
    canal.send(`📮✨ *Annie comenta con cariño:* ${frase}`);
  },
  1000 * 60 * 90,
);
setInterval(ejecutarRutinaDiaria, 1000 * 60 * 5);
setInterval(mencionarVecinoRandom, 1000 * 60 * 90);
setInterval(anunciarClima, 1000 * 60 * 120);

// Eventos
client.once("clientReady", async () => {
  console.log(`✅ Annie conectada: ${client.user.tag}`);
  conectarOficina();
  actualizarEstado();
  if (CONFIG.MENSAJE_ROLES_ID) {
    client.guilds.cache.forEach(async (guild) => {
      guild.channels.cache.forEach(async (channel) => {
        if (channel.isTextBased()) {
          try {
            await channel.messages.fetch(CONFIG.MENSAJE_ROLES_ID);
            console.log(
              `📦 Mensaje ${CONFIG.MENSAJE_ROLES_ID} cargado en caché.`,
            );
          } catch (e) {}
        }
      });
    });
  }
  const commands = [
    new SlashCommandBuilder()
      .setName("precio")
      .setDescription("Consulta la libreta")
      .addStringOption((o) =>
        o
          .setName("item")
          .setDescription("Item")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("venta")
      .setDescription("Saca cuentas")
      .addStringOption((o) =>
        o
          .setName("item")
          .setDescription("Item")
          .setAutocomplete(true)
          .setRequired(true),
      )
      .addIntegerOption((o) =>
        o.setName("estrellas").setDescription("Calidad").setRequired(true),
      )
      .addIntegerOption((o) =>
        o.setName("cantidad").setDescription("Cantidad").setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("recordar")
      .setDescription("Anota un recadito")
      .addIntegerOption((o) =>
        o.setName("minutos").setDescription("Minutitos").setRequired(true),
      )
      .addStringOption((o) =>
        o.setName("mensaje").setDescription("Recadito").setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("peces")
      .setDescription("Muestra un pececito")
      .addStringOption((o) =>
        o
          .setName("item")
          .setDescription("Pez")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("clima")
      .setDescription("Muestra el clima del pueblito hoy y próximos días"),
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("Muestra esta cartita calentita con mis cositas 📮✨"),
    new SlashCommandBuilder()
      .setName("annie")
      .setDescription("¿Quién es Annie? Esta cartita es pa' conocerme 💖"),
    new SlashCommandBuilder()
      .setName("animales")
      .setDescription("Mira dónde encontrar a los animalitos del pueblito 🐾💕")
      .addStringOption((o) =>
        o
          .setName("animal")
          .setDescription("Nombre del animalito o 'todos'")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("aves")
      .setDescription("Mira dónde avistar a las avecitas del pueblito 🐦💕")
      .addStringOption((o) =>
        o
          .setName("ave")
          .setDescription("Nombre del pajarito o 'todos'")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("insectos")
      .setDescription(
        "Mira dónde atrapar a los bichitos lindos del pueblito 🪲💕",
      )
      .addStringOption((o) =>
        o
          .setName("insecto")
          .setDescription("Nombre del bichito o 'todos'")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("logros")
      .setDescription("Mira los títulos y logros lindos que puedes ganar 🏆💕")
      .addStringOption((o) =>
        o
          .setName("logro")
          .setDescription("Nombre del logro o 'todos'")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("recolectables")
      .setDescription("Mira dónde recolectar los recursos del pueblito 🌾💕")
      .addStringOption((o) =>
        o
          .setName("item")
          .setDescription("Nombre del recurso o 'todos'")
          .setAutocomplete(true)
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("cultivos")
      .setDescription("Mira los cultivos del pueblito 🌱💕")
      .addStringOption((o) =>
        o
          .setName("cultivos")
          .setDescription("Nombre del cultivo o 'todos'")
          .setAutocomplete(true)
          .setRequired(true),
      ),
  ].map((c) => c.toJSON());

const scheduleUpdate = () => {
    const now = new Date();
    const ms =
      (5 - (now.getMinutes() % 5)) * 60000 -
      now.getSeconds() * 1000 -
      now.getMilliseconds();
    
    setTimeout(() => {
      updateTimeChannel();
      updateWeatherChannel();
      scheduleUpdate();
    }, ms + 2000);
  };

  updateTimeChannel();
  updateWeatherChannel();
  scheduleUpdate();

  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
      { body: commands },
    );
  } catch (e) {
    console.error(e);
  }
  gestionarSueno();
  setInterval(gestionarSueno, 60000);
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const canal = await member.guild.channels.fetch(CONFIG.CANAL_GENERAL_ID);
    if (!canal) return;
    const embed = new EmbedBuilder()
      .setTitle("✨ ¡Un nuevo corazoncito llegó al pueblito!")
      .setDescription(
        `¡Bienvenid@, **${member.user.username}** a Heartopia! Pasa por la oficinita cuando quieras, te espero con tecito y abrazos 🌸💕`,
      )
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setColor("#FFB7C5");
    await canal.send({
      content: `📢 ¡Oigan toditos! Denle un abrazote dulce a ${member} 💖`,
      embeds: [embed],
    });
  } catch (e) {
    console.error(e);
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (
    oldState.member?.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    console.log("⚠️ Annie se desconectó del voice, volviendo suave...");
    return setTimeout(conectarOficina, 5000);
  }

  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    const canalTexto = newState.guild.channels.cache.get(
      CONFIG.CANAL_GENERAL_ID,
    );
    if (!canalTexto) return;

    const trato = getTrato();

    const frasesDia = [
      `👂✨ *Annie asoma la cabecita:* Oiga ${trato}... ¿escuché pasitos suaves? Parece que **${newState.member.user.username}** llegó a mi oficinita 💕`,
      `📮🌸 ¡Atención, pueblito lindo! **${newState.member.user.username}** anda dando vueltitas por aquí... qué alegría ✨`,
      `👀💬 Ay... **${newState.member.user.username}** entró a mi oficinita... ¿vendrá a charlar un ratito conmigo? ☺️`,
    ];

    const frasesNoche = [
      `🤫🌙 *(Annie susurra bajito)* Shhh... ${trato}... **${newState.member.user.username}** entró a la oficinita... que no se despierte nadie 💤`,
      `😴👂 *(voz suave)* Ay... creo que **${newState.member.user.username}** anda despierto todavía... ven a acurrucarte un ratito 🌙`,
      `🌙📮 *(susurro dulce)* Entró alguien a mi oficinita... es **${newState.member.user.username}**... qué lindo 💕`,
    ];

    const frase = estaDurmiendoActual
      ? frasesNoche[Math.floor(Math.random() * frasesNoche.length)]
      : frasesDia[Math.floor(Math.random() * frasesDia.length)];

    canalTexto.send(frase);
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.id !== CONFIG.MENSAJE_ROLES_ID) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (e) {
      console.error("Error fetch reacción:", e);
      return;
    }
  }

  const roleId = CONFIG.REACTION_ROLES[reaction.emoji.name];
  if (!roleId) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId);

    if (role) {
      await member.roles.add(role);
      console.log(`✨ Rol ${role.name} asignado a ${user.tag}`);

      try {
        await user.send(
          `Te puse el rol **${role.name}** con cariño, vecin@ lindo/a 💕`,
        );
      } catch (e) {
        console.log(
          `No pude enviar DM a ${user.tag}, puede que los tenga cerrados.`,
        );
      }
    }
  } catch (e) {
    console.error("No pude dar el rol:", e.message);
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot || reaction.message.id !== CONFIG.MENSAJE_ROLES_ID) return;
  if (reaction.partial) await reaction.fetch();

  const roleId = CONFIG.REACTION_ROLES[reaction.emoji.name];
  if (!roleId) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId);

    if (role) {
      await member.roles.remove(role);
      console.log(`❌ Rol ${role.name} quitado a ${user.tag}`);

      try {
        await user.send(
          `Te quité el rol **${role.name}** con cariño, vecin@... si lo quieres de vuelta, solo reacciona otra vez 💕`,
        );
      } catch (e) {
        console.log(`No pude enviar DM a ${user.tag}`);
      }
    }
  } catch (e) {
    console.error("No pude quitar el rol:", e.message);
  }
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  const texto = msg.content.toLowerCase();
  const ahora = Date.now();

  if (msg.channel.id === CONFIG.CANAL_GENERAL_ID) {
    historialMensajes.push(ahora);

    historialMensajes = historialMensajes.filter(
      (m) => ahora - m < CONFIG.VENTANA_CHISME,
    );

    if (
      historialMensajes.length >= CONFIG.UMBRAL_CHISME &&
      ahora - ultimoChisme > CONFIG.COOLDOWN_CHISME
    ) {
      ultimoChisme = ahora;
      historialMensajes = [];

      let frase = "";
      if (estaDurmiendoActual) {
        const frasesNoche = [
          `*(Annie abre un ojito)* Ay, vecin@ lindo/a... ¿qué pasó po? Se me pararon las orejititas curiosas... cuéntame bajito 💤👂`,
          `*(susurra somnolienta)* Zzz... ¿chismecito? Ay, no me dejes con la intriga, corazón... ¿qué pasó con ternura? 🌙💕`,
          `*(bosteza lindo)* Uf... desperté por el ruido dulce... ¿qué cosita linda pasó? Cuéntame con cariño po... 😴✨`,
        ];
        frase = frasesNoche[Math.floor(Math.random() * frasesNoche.length)];
      } else {
        const frasesDia = [
          `Ay, vecin@ lindo/a... se me pararon las orejititas curiosas con tanto mensajito 👀💕 ¿Qué pasó po? Cuéntame todo con cariño...`,
          `¡Uy, uy, tesoro! El chat está lleno de cositas lindas... ¿qué pasó? No me dejes con la intriga, corazón 💬🌸`,
          `¡Mi vecin@ precioso/a! Se siente olor a chismecito dulce... ¿me cuentas con ternura? Te prometo que guardo el secreto con amor ✨👂`,
        ];
        frase = frasesDia[Math.floor(Math.random() * frasesDia.length)];
      }

      await msg.channel.send(
        `✨ *Annie asoma la cabecita con cariño:* "${frase}"`,
      );
    }
  }

  if (texto === "11") return msg.reply("¡Chúpalo entonces, corazón! 🍭");
  if (texto === "5")
    return msg.reply("¡Por el cul* te la hinco con cariño! 🍑");
  if (texto === "13") return msg.reply("¡Más me crece de ternura! 🍆");
  if (texto === "8") return msg.reply("¡El cul* te abrocho con amor! 👟");
  if (texto === "4") return msg.reply("¡En tu cul* mi aparatito dulce! 🚜");
  if (texto.startsWith("me gusta"))
    return msg.reply(
      "¿Y el pico? 🍆 ¡Acuérdese que soy de campo, vecin@ lindo/a!",
    );

  if (!texto.includes("annie")) return;

  if (estaDurmiendoActual) {
    if (
      texto.includes("hola") ||
      texto.includes("holi") ||
      texto.includes("wena")
    ) {
      return msg.reply(
        "*(Annie se despereza suave)* Zzz... ¿ah? Wena mi vecin@ lindo/a... ¿qué necesitas tan tempranito? 💤🌸",
      );
    }
    if (texto.includes("gracias") || texto.includes("vale")) {
      return msg.reply(
        "*(susurra dormida)* De nada po, corazón... Zzz... siempre aquí para ti 💕",
      );
    }
    if (texto.includes("chao") || texto.includes("buenas noches")) {
      return msg.reply(
        "Buenas noches, mi vecin@ precioso/a... sueña bonito y abrígate, ¿ya? Zzz... 🌙💤",
      );
    }
  } else {
    if (
      texto.includes("hola") ||
      texto.includes("holi") ||
      texto.includes("wena")
    ) {
      return msg.reply(
        `¡Wena, wena mi vecin@ lindo/a! ✨ ¿Cómo estás hoy, corazón? Pasa no más, estoy con tecito dulce ☕💕`,
      );
    }
    if (texto.includes("gracias") || texto.includes("vale")) {
      return msg.reply(
        `¡De nada po, mi alegría! Siempre aquí para ti, ¿ya? 💖✨`,
      );
    }
    if (texto.includes("chao") || texto.includes("adios")) {
      return msg.reply(
        `¡Chao, corazón! Cuídate harto y vuelve prontito, ¿ya? 👋🌸`,
      );
    }
  }
});

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

client.on(Events.InteractionCreate, async (int) => {
  if (int.isAutocomplete()) {
    const focusedValue = int.options.getFocused(true).value.trim();

    const normalizedFocused = normalize(focusedValue);

    let source = [];

    if (int.commandName === "peces") {
      source = Object.keys(PECES);
    } else if (int.commandName === "precio" || int.commandName === "venta") {
      source = Object.keys(PRECIOS);
    } else if (int.commandName === "animales") {
      source = Object.keys(ANIMALES);
    } else if (int.commandName === "aves") {
      source = Object.keys(AVES);
    } else if (int.commandName === "insectos") {
      source = Object.keys(INSECTOS);
    } else if (int.commandName === "logros") {
      source = Object.keys(LOGROS);
    } else if (int.commandName === "recolectables") {
      source = Object.keys(RECOLECTABLES);
    } else if (int.commandName === "cultivos") {
      source = Object.keys(CULTIVOS);
    }

    if (source.length === 0) {
      return int.respond([]);
    }

    let matches = source.filter((item) =>
      normalize(item).includes(normalizedFocused),
    );

    if (matches.length === 0 && normalizedFocused === "") {
      matches = source.slice(0, 25);
    }

    matches = matches.slice(0, 25);

    const opciones = matches.map((item) => ({
      name: item,
      value: item,
    }));

    if (
      opciones.length < 25 &&
      [
        "peces",
        "animales",
        "aves",
        "recolectables",
        "cultivos",
        "logros",
      ].includes(int.commandName)
    ) {
      opciones.unshift({
        name: "Todos los items (* / todos)",
        value: "todos",
      });
    }

    if (opciones.length > 25) opciones.length = 25;

    return int.respond(opciones);
  }

  if (!int.isChatInputCommand()) return;

  const bostezo = estaDurmiendoActual
    ? "*(Bostezo suave)* Ya po... aquí tiene, corazón, pero no me despierte mucho, ¿ya? 💤📮\n\n"
    : "¡Wena, vecin@ lindo/a! Aquí le traigo su cosita dulce ✨📮\n\n";

  if (int.commandName === "animales") {
    let animalInput = int.options.getString("animal")?.trim() || "";

    const mostrarTodos = ["*", "todos", "todo"].includes(
      animalInput.toLowerCase(),
    );

    const embed = new EmbedBuilder()
      .setColor("#FFB6C1")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({
        text: `Notitas de animalitos del pueblito • Annie 🐾💕 • ${new Date().toLocaleDateString("es-CL")}`,
      });

    const fotoAnimales = "https://i.imgur.com/tnD0Pb6.png";

    if (mostrarTodos) {
      embed
        .setTitle("🐾 ¡Todos los animalitos del pueblito juntitos!")
        .setDescription(
          "Mira qué lindos están todos reuniditos... Annie los quiere muchísimo y los cuida con cariñito ✨\n" +
            "¡Ven a darles su comidita favorita cuando los veas!",
        )
        .setImage(fotoAnimales);

      Object.entries(ANIMALES)
        .sort((a, b) => a[0].localeCompare(b[0], "es"))
        .forEach(([nombre, data]) => {
          const comida = data.comida_favorita?.join(" • ") || "—";
          const clima = data.clima_preferido?.join(" ") || "—";

          embed.addFields({
            name: `✨ ${nombre}`,
            value: `📍 **${data.ubicacion}**\n🍎 Comida favorita: ${comida}\n⛅ Clima preferido: ${clima}`,
            inline: false,
          });
        });
    } else {
      const normalizedInput = normalize(animalInput);
      let animalData = ANIMALES[animalInput];

      if (!animalData) {
        const match = Object.keys(ANIMALES).find(
          (key) => normalize(key) === normalizedInput,
        );
        if (match) {
          animalData = ANIMALES[match];
          animalInput = match;
        }
      }

      if (!animalData) {
        const embedError = new EmbedBuilder()
          .setColor("#FFB7C5")
          .setTitle("🐾 ¡Ay, corazoncito!")
          .setDescription(
            estaDurmiendoActual
              ? "*(Annie busca con ojitos cerrados)* Zzz... ese animalito no lo encuentro... ¿se me escapó al bosque? 😴🐾"
              : `¡Ay, ${getTrato()}! No tengo anotado a "${animalInput}" todavía... ¿seguro que se escribe así, tesoro? 🐾📝`,
          )
          .setThumbnail(CONFIG.ANNIE_IMG)
          .setFooter({ text: "Annie busca mejor con cafecito y cariño ☕" });

        return int.reply({ embeds: [embedError], ephemeral: true });
      }

      const comida = animalData.comida_favorita?.join(" • ") || "—";
      const clima = animalData.clima_preferido?.join(" ") || "—";

      embed
        .setTitle(`🐾 ${animalInput}`)
        .setDescription(`**Ubicación:** ${animalData.ubicacion}`)
        .addFields(
          { name: "🍎 Comida favorita", value: comida, inline: false },
          { name: "⛅ Clima preferido", value: clima, inline: false },
        );
    }

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "precio") {
    let itemInput = int.options.getString("item")?.trim().toLowerCase() || "";

    const itemNormalized = normalize(itemInput);
    const mostrarTodos = ["*", "todos", "todo"].includes(itemNormalized);

    const embed = new EmbedBuilder()
      .setColor("#FAD02E")
      .setThumbnail(CONFIG.ANNIE_IMG);

    const items = Object.entries(PRECIOS).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    if (mostrarTodos) {
      await enviarPaginado({
        interaction: int,
        baseEmbed: embed,
        items,
        itemsPorPagina: 15,
        titulo: "📋 Libreta de Precios 💰🌸",
        descripcion: "Aquí va uno por uno, bien clarito y con cariño 🤫💕",
        content: bostezo,
        renderItem: ([nombre, valores]) => {
          const stars = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"];
          const preciosStr =
            valores
              .map((v, i) =>
                v > 0 ? `${stars[i]} ${v.toLocaleString("es-CL")}` : "",
              )
              .filter(Boolean)
              .join(" • ") || "— Sin precio";

          return {
            name: `**${nombre}**`,
            value: preciosStr,
            inline: false,
          };
        },
      });
      return;
    }

    let precios = PRECIOS[itemInput];
    if (!precios) {
      const match = items.find(([key]) => normalize(key) === itemNormalized);
      if (match) {
        precios = match[1];
        itemInput = match[0];
      }
    }

    if (!precios) {
      const embedError = new EmbedBuilder()
        .setColor("#FFB7C5")
        .setTitle("📝 ¡Uy, corazoncito!")
        .setDescription(
          estaDurmiendoActual
            ? "*(bosteza y busca con ojitos cerrados)* Zzz... no encuentro ese item en mi libretita... ¿se me cayó la hojita? 😴📝"
            : `¡Ay, ${getTrato()}! No tengo anotado "${itemInput}" todavía... ¿será que se me escapó? Prueba con otro, corazón ✨`,
        )
        .setThumbnail(CONFIG.ANNIE_IMG)
        .setFooter({ text: "Annie te ayuda siempre con amor 💖" });

      return int.reply({ embeds: [embedError], ephemeral: true });
    }

    embed
      .setTitle(`💰 Precio de ${itemInput}`)
      .setDescription(
        "Mire cuánto pagan según las estrellitas, vecin@ lindo/a ✨",
      );

    const stars = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"];
    precios.forEach((v, i) => {
      if (v > 0) {
        embed.addFields({
          name: stars[i],
          value: `\`${v.toLocaleString("es-CL")}\``,
          inline: true,
        });
      }
    });

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "peces") {
    let itemInput = int.options.getString("item")?.trim() || "";

    const mostrarTodos = ["*", "todos", "todo"].includes(itemInput);

    const embed = new EmbedBuilder()
      .setColor("#A8E6CF")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({
        text: `Notas de pesca de Annie • ${new Date().toLocaleDateString("es-CL")}`,
      });
    
    if (mostrarTodos) {
      const items = Object.entries(PECES).sort((a, b) =>
        a[0].localeCompare(b[0], "es"),
      );

      await enviarPaginado({
        interaction: int,
        baseEmbed: embed,
        items,
        itemsPorPagina: 15,
        titulo: "🐟 ¡Todos los pececitos del pueblito juntitos!",
        descripcion: "Mira qué lindos están todos reuniditos... Annie los quiere muchísimo y los cuida con cariñito ✨\n" +
          "¡Ven a pescar con amor cuando los veas!",
        renderItem: ([nombre, pez]) => {
          return {
            name: `✨ ${nombre}`,
            value: `📍 **${pez.ubicacion}** | **Nivel:** ${pez.nivel ?? "—"} | **Clima:** ${pez.clima?.join(" ") || "—"} | **Horario:** ${pez.horario?.join(" ") || "—"}`
          };
        },
        content: bostezo,
      });
      return;
    } else {
      const pez = PECES[itemInput];
      if (!pez) {
        const embedError = new EmbedBuilder()
          .setColor("#A8E6CF")
          .setTitle("🐟 ¡Ay, corazoncito!")
          .setDescription(
            estaDurmiendoActual
              ? "*(Annie revuelve las notitas medio dormida)* Zzz... ese pececito no lo tengo anotado... ¿se me escapó al mar? 😴🎣"
              : `¡Ay, ${getTrato()}! No encuentro "${itemInput}" en mis notitas de pesca... ¿seguro que se escribe así, tesoro? 🐟📝`,
          )
          .setThumbnail(CONFIG.ANNIE_IMG)
          .setFooter({ text: "Annie busca mejor con cafecito y cariño ☕" });

        return int.reply({ embeds: [embedError], ephemeral: true });
      }

      embed
        .setTitle(`🐟 ${itemInput}`)
        .setDescription(`**${pez.tipo || "—"}** en **${pez.ubicacion}**`)
        .addFields(
          { name: "Nivel", value: String(pez.nivel ?? "—"), inline: true },
          { name: "Clima", value: pez.clima?.join(" ") || "—", inline: true },
          {
            name: "Horario",
            value: pez.horario?.join(" ") || "—",
            inline: true,
          },
        );
    }

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "clima") {
    const hoy = CLIMA_PUEBLO.hoy;

    let pasoAlSiguienteDia = false;
    let ultimaHora = -1;
    const getSmartTimestamp = (hora) => {
      if (hora < ultimaHora) pasoAlSiguienteDia = true;
      ultimaHora = hora;
      const fecha = new Date();
      if (pasoAlSiguienteDia) fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(hora, 0, 0, 0);
      return Math.floor(fecha.getTime() / 1000);
    };

    const embed = new EmbedBuilder()
      .setColor(hoy.eventos.length > 0 ? "#FFD700" : "#A7D8DE")
      .setAuthor({
        name: "Servicio Meteorológico del Pueblo 🌸",
        iconURL: CONFIG.ANNIE_IMG,
      })
      .setTitle(`✨ ${hoy.tipo.toUpperCase()} ✨`)
      .setDescription(`${hoy.descripcion}\n\n${"┈".repeat(20)}`)
      .setThumbnail(CONFIG.ANNIE_IMG);

    if (hoy.eventos.length > 0) {
      pasoAlSiguienteDia = false;
      ultimaHora = 18;

      embed.addFields({
        name: "📢 ¡AVISOS IMPORTANTES!",
        value: "\u200B",
        inline: false,
      });

      hoy.eventos.forEach((ev) => {
        const ts = getSmartTimestamp(ev.hora);
        embed.addFields({
          name: `${ev.icono} ${ev.evento}`,
          value: `┣ ⌚ **Hora:** <t:${ts}:t>\n┗ ⏳ **Inicia:** <t:${ts}:R>`,
          inline: true,
        });
      });

      embed.addFields({ name: "\u200B", value: "─".repeat(32), inline: false });
    }

    pasoAlSiguienteDia = false;
    ultimaHora = -1;
    const textoTimeline = hoy.timeline
      .map((e) => {
        const ts = getSmartTimestamp(e.hora);
        return `🔹 <t:${ts}:t> ⮕ ${e.icono} **${e.texto}**`;
      })
      .join("\n");

    embed.addFields(
      { name: "🕒 CRONOLOGÍA DEL TIEMPO", value: textoTimeline, inline: false },
      {
        name: "📅 PRÓXIMOS DÍAS",
        value: `\`\`\`\n${CLIMA_PUEBLO.proximos.map((d) => `${d.icono} ${d.dia.padEnd(9)} | ${d.clima}`).join("\n")}\n\`\`\``,
        inline: false,
      },
    );

    embed.setFooter({
      text: "Pronóstico hecho con mucho amor • ¡Disfruta el clima, vecino!",
    });

    return int.reply({
      content: typeof bostezo !== "undefined" ? bostezo : null,
      embeds: [embed],
    });
  }
  if (int.commandName === "venta") {
    let itemInput = int.options.getString("item")?.trim() || "";
    const est = int.options.getInteger("estrellas");
    const cant = int.options.getInteger("cantidad");

    const normalize = (str) =>
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const itemNormalized = normalize(itemInput);

    const embed = new EmbedBuilder()
      .setColor("#FAD02E")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({ text: "Buena venta, corazoncito • Annie 💰🌸" });

    let precioUnitario = PRECIOS[itemInput]?.[est - 1] || 0;

    if (precioUnitario === 0) {
      const match = Object.entries(PRECIOS).find(
        ([key]) => normalize(key) === itemNormalized,
      );
      if (match) {
        precioUnitario = match[1][est - 1] || 0;
        itemInput = match[0];
      }
    }

    if (precioUnitario === 0 || !PRECIOS[itemInput]) {
      const embedError = new EmbedBuilder()
        .setColor("#FAD02E")
        .setTitle("💰 ¡Uy, tesorito!")
        .setDescription(
          estaDurmiendoActual
            ? "*(anotando dormidita)* Zzz... ese item no lo tengo en la libretita... ¿se me cayó la hojita? 😴📝"
            : `Ese item "${itemInput}" no lo tengo anotado todavía, ${getTrato()}. Prueba con /precio primero pa' chequear, corazón 💸`,
        )
        .setThumbnail(CONFIG.ANNIE_IMG)
        .setFooter({ text: "Annie cuenta moneditas con cariño 🪙" });

      return int.reply({ embeds: [embedError], ephemeral: true });
    }

    if (est < 1 || est > 5) {
      const embedError = new EmbedBuilder()
        .setColor("#FAD02E")
        .setTitle("🌟 ¡Ojo, corazoncito!")
        .setDescription(
          estaDurmiendoActual
            ? "*(bosteza contando estrellitas)* Zzz... las estrellitas van de 1 a 5 no más, vecin@ lindo/a... 😴"
            : `Las estrellitas van de 1 a 5 nomás, ${getTrato()}. ¡No me inventes calidades nuevas, tesoro! 🌟`,
        )
        .setThumbnail(CONFIG.ANNIE_IMG)
        .setFooter({ text: "Annie sabe de calidad con amor ✨" });

      return int.reply({ embeds: [embedError], ephemeral: true });
    }

    const total = precioUnitario * cant;

    embed
      .setTitle("💸 Cálculo de venta dulce")
      .setDescription(`Por **${cant}** de **${itemInput}** (${est}★)`)
      .addFields({
        name: "Total que le pagarían",
        value: `**${total.toLocaleString("es-CL")}** moneditas 🪙✨`,
        inline: false,
      });

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "recordar") {
    const min = int.options.getInteger("minutos");
    const mensaje = int.options.getString("mensaje");

    const embedConfirm = new EmbedBuilder()
      .setColor(estaDurmiendoActual ? "#A7D8DE" : "#FFB7C5")
      .setTitle(
        estaDurmiendoActual
          ? "💤 Notita anotada... Zzz"
          : "📅 ¡Recadito guardado con cariño!",
      )
      .setDescription(
        estaDurmiendoActual
          ? "*(Annie escribe suave con ojitos cerrados)* Zzz... ya está en mi libretita, no me despiertes mucho, ¿ya? 😴💕"
          : `¡Listo, ${getTrato()}! Te guardo tu recadito y te despierto en **${min}** minutitos. No se te olvide, corazón ✨⏰`,
      )
      .addFields({
        name: "Tu mensajito guardado",
        value: `**${mensaje}**`,
        inline: false,
      })
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({
        text: estaDurmiendoActual
          ? "Annie sueña con recaditos... 💭"
          : "Annie siempre cumple con amor • 💖",
      });

    await int.reply({ embeds: [embedConfirm], ephemeral: true });

    setTimeout(() => {
      const trato = getTrato();

      const embedRecordatorio = new EmbedBuilder()
        .setColor(estaDurmiendoActual ? "#A7D8DE" : "#FFB7C5")
        .setTitle(
          estaDurmiendoActual
            ? "🌙 ¡Shhh... recadito nocturnito!"
            : "⏰ ¡Oiga, corazoncito! Hora de recordar",
        )
        .setDescription(
          estaDurmiendoActual
            ? `*(Annie se despierta suave y busca su libretita)* ¡Uy! Casi se me olvida... pero aquí está, ${int.user}:`
            : `¡Despierta po, ${trato}! Aquí te traigo tu recadito dulce con cariño ✨📢`,
        )
        .addFields({
          name: "Lo que tenías que recordar",
          value: `**${mensaje}**`,
          inline: false,
        })
        .setThumbnail(CONFIG.ANNIE_IMG)
        .setFooter({
          text: "Annie no olvida nada... ni aunque esté acurrucadita 💤💕",
        });

      int.channel
        .send({
          content: `${int.user}`,
          embeds: [embedRecordatorio],
        })
        .catch((err) => console.error("Error enviando recordatorio:", err));
    }, min * 60000);
  }
  if (int.commandName === "help" || int.commandName === "annie") {
    const embed = new EmbedBuilder()
      .setColor("#FFB7C5")
      .setTitle("📮 —  Oficinita dulce de Annie")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setDescription(
        estaDurmiendoActual
          ? "*(Bosteza suave y se frota los ojitos)*\nZzz... Hola corazoncito, soy Annie. Aunque esté medio dormidita, aquí tienes mi libretita de ayuda con mucho cariño. 💤✨"
          : `¡Wena, ${getTrato()}! 💖\nSoy **Annie**, la carterista del pueblito. Entre repartos y chismecitos, aquí te dejo mis cositas para ayudarte. 🌸`,
      )
      .addFields(
        {
          name: "💰 Economía y Utilidad",
          value:
            "• `/precio` <item> — *Revisa la libretita de precios.*\n" +
            "• `/venta` <item> <⭐> <qty> — *Calcula tus ganancias.*\n" +
            "• `/recordar` <tiempo> <msg> — *Te aviso con cariño.*\n" +
            "• `/clima` — *Pronóstico del pueblito.* 🌦️",
          inline: false,
        },
        {
          name: "🌿 Enciclopedia del Pueblo",
          value:
            "```/animales   /aves      /insectos\n/peces      /cultivos  /recolectables\n/logros```\n*Usa `<nombre>` o `todos` después de cada comando.*",
          inline: false,
        },
        {
          name: "🎭 Comunidad & Voz",
          value:
            "✨ **Roles:** Reacciona con 🪲 🫧 🦆 🎣 🪺 💐 en el canal de roles.\n" +
            "🎙️ **Voz:** ¡Entra a mi oficina y pasaré a saludarte!",
          inline: false,
        },
        {
          name: "⏰ Horarios de Annie",
          value:
            "💤 **Sueño:** 23:00 - 08:00 (Chile)\n" +
            "🌦️ **Boletín:** 19:00 cada día",
          inline: true,
        },
      )
      .setFooter({
        text: `Annie v1.2 • ${estaDurmiendoActual ? "Zzz... sueñen bonito 💕" : "Hecho con amor para Heartopia 💖"}`,
        iconURL: int.guild.iconURL(),
      })
      .setTimestamp();

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "aves") {
    let aveInput = int.options.getString("ave")?.trim() || "";

    const mostrarTodos = ["*", "todos", "todo"].includes(
      aveInput.toLowerCase(),
    );

    const embed = new EmbedBuilder()
      .setColor("#A8DADC")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({
        text: `Notitas de avistamiento de Annie • 🐦💕 • ${new Date().toLocaleDateString("es-CL")}`,
      });

    if (mostrarTodos) {
      const items = Object.entries(AVES).sort((a, b) =>
        a[0].localeCompare(b[0], "es"),
      );

      await enviarPaginado({
        interaction: int,
        baseEmbed: embed,
        items,
        itemsPorPagina: 10,
        titulo: "🐦 Aves del pueblito",
        descripcion:
          "Todas las pajaritas anotaditas con cariño 💕\nSal a buscarlas cuando el clima esté rico ✨",
        content: bostezo,
        renderItem: ([nombre, data]) => {
          const clima = data.clima?.join(" ") || "—";
          const horario = data.horario?.join(" ") || "—";

          return {
            name: `✨ ${nombre}`,
            value:
              `📍 **${data.ubicacion}**\n` +
              `Nivel **${data.nivel_avistamiento}** • ${data.actividad}\n` +
              `⛅ ${clima}  🕒 ${horario}`,
            inline: false,
          };
        },
      });
      return;
    } else {
      const normalizedInput = normalize(aveInput);
      let aveData = AVES[aveInput];

      if (!aveData) {
        const match = Object.keys(AVES).find(
          (key) => normalize(key) === normalizedInput,
        );
        if (match) {
          aveData = AVES[match];
          aveInput = match;
        }
      }

      if (!aveData) {
        const embedError = new EmbedBuilder()
          .setColor("#A8DADC")
          .setTitle("🐦 ¡Ay, corazoncito!")
          .setDescription(
            estaDurmiendoActual
              ? "*(Annie busca con ojitos cerrados entre plumas)* Zzz... esa avecita no la encuentro... ¿se me voló? 😴🐦"
              : `¡Ay, ${getTrato()}! No tengo anotada a "${aveInput}" todavía... ¿seguro que se escribe así, tesoro? 🐦📝`,
          )
          .setThumbnail(CONFIG.ANNIE_IMG)
          .setFooter({ text: "Annie busca mejor con cafecito y cariño ☕" });

        return int.reply({ embeds: [embedError], ephemeral: true });
      }

      const clima = aveData.clima?.join(" ") || "—";
      const horario = aveData.horario?.join(" ") || "—";

      embed
        .setTitle(`🐦 ${aveInput}`)
        .setDescription(`**Ubicación:** ${aveData.ubicacion}`)
        .addFields(
          {
            name: "Nivel de avistamiento",
            value: String(aveData.nivel_avistamiento),
            inline: true,
          },
          { name: "Actividad", value: aveData.actividad, inline: true },
          { name: "Clima", value: clima, inline: true },
          { name: "Horario", value: horario, inline: true },
        );
    }

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "insectos") {
    let insectoInput = int.options.getString("insecto")?.trim() || "";

    const mostrarTodos = ["*", "todos", "todo"].includes(
      insectoInput.toLowerCase(),
    );

    const embed = new EmbedBuilder()
      .setColor("#FFD166")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({
        text: `Notitas de bichitos del pueblito • Annie 🪲💕 • ${new Date().toLocaleDateString("es-CL")}`,
      });

    if (mostrarTodos) {
      const items = Object.entries(INSECTOS).sort((a, b) =>
        a[0].localeCompare(b[0], "es"),
      );

      await enviarPaginado({
        interaction: int,
        baseEmbed: embed,
        items,
        itemsPorPagina: 12,
        titulo: "🪲 Insectos del pueblito",
        descripcion:
          "Todos los bichitos que Annie ha visto 🪲💕\n¡Red lista y a buscar!",
        content: bostezo,
        renderItem: ([nombre, data]) => {
          const clima = data.clima?.join(" ") || "—";
          const horario = data.horario?.join(" ") || "—";

          return {
            name: `✨ ${nombre}`,
            value:
              `📍 **${data.ubicacion}**\n` +
              `Nivel **${data.nivel}** • ${data.tipo}\n` +
              `⛅ ${clima}  🕒 ${horario}`,
            inline: false,
          };
        },
      });
      return;
    } else {
      const normalizedInput = normalize(insectoInput);
      let insectoData = INSECTOS[insectoInput];

      if (!insectoData) {
        const match = Object.keys(INSECTOS).find(
          (key) => normalize(key) === normalizedInput,
        );
        if (match) {
          insectoData = INSECTOS[match];
          insectoInput = match;
        }
      }

      if (!insectoData) {
        const embedError = new EmbedBuilder()
          .setColor("#FFD166")
          .setTitle("🪲 ¡Ay, corazoncito!")
          .setDescription(
            estaDurmiendoActual
              ? "*(Annie busca con ojitos cerrados entre hojitas)* Zzz... ese bichito no lo encuentro... ¿se me escapó volando? 😴🪲"
              : `¡Ay, ${getTrato()}! No tengo anotado a "${insectoInput}" todavía... ¿seguro que se escribe así, tesoro? 🪲📝`,
          )
          .setThumbnail(CONFIG.ANNIE_IMG)
          .setFooter({ text: "Annie busca mejor con cafecito y cariño ☕" });

        return int.reply({ embeds: [embedError], ephemeral: true });
      }

      const clima = insectoData.clima?.join(" ") || "—";
      const horario = insectoData.horario?.join(" ") || "—";

      embed
        .setTitle(`🪲 ${insectoInput}`)
        .setDescription(`**Ubicación:** ${insectoData.ubicacion}`)
        .addFields(
          { name: "Nivel", value: String(insectoData.nivel), inline: true },
          { name: "Tipo", value: insectoData.tipo, inline: true },
          { name: "Clima", value: clima, inline: true },
          { name: "Horario", value: horario, inline: true },
        );
    }

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "logros") {
    const logroInput = int.options.getString("logro")?.trim() || "";
    const normalizedInput = normalize(logroInput);

    const mostrarTodos = ["*", "todos", "todo"].includes(normalizedInput);

    const embed = new EmbedBuilder()
      .setColor("#FFD700")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({
        text: `Trofeítos del pueblito • Annie 🏆💕 • ${new Date().toLocaleDateString("es-CL")}`,
      });
    if (mostrarTodos) {
      const items = Object.entries(LOGROS);

      await enviarPaginado({
        interaction: int,
        baseEmbed: embed,
        items,
        itemsPorPagina: 5,
        titulo: "🏆 Logros del pueblito",
        descripcion:
          "Cada esfuerzo cuenta, vecin@ 💖\nAnnie está orgullosa de ti ✨",
        content: bostezo,
        renderItem: ([nombre, info]) => ({
          name: `🏆 ${nombre}`,
          value:
            `📌 **Requisito:** ${info.requisito}\n` +
            `🎖️ **Título:** ${info.titulo} (${info.nota})`,
          inline: false,
        }),
      });

      return;
    }

    const logroEntry = Object.entries(LOGROS).find(
      ([nombre]) => normalize(nombre) === normalizedInput,
    );

    if (!logroEntry) {
      const embedError = new EmbedBuilder()
        .setColor("#FFD700")
        .setTitle("🏆 ¡Ay, corazoncito!")
        .setDescription(
          estaDurmiendoActual
            ? "*(Annie revisa los trofeítos medio dormida)* Zzz... no encuentro ese logro... 😴🏆"
            : `¡Ay, ${getTrato()}! No tengo anotado ningún logro llamado **"${logroInput}"** todavía… ¿seguro que es así el nombre, tesoro? 🏆📝`,
        )
        .setThumbnail(CONFIG.ANNIE_IMG)
        .setFooter({ text: "Annie busca mejor con cafecito ☕" });

      return int.reply({ embeds: [embedError], ephemeral: true });
    }

    const [nombre, info] = logroEntry;

    embed
      .setTitle(`🏆 ${nombre}`)
      .setDescription(
        `📌 **Requisito:** ${info.requisito}\n` +
          `🎖️ **Título obtenido:** ${info.titulo} (${info.nota})`,
      );

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "recolectables") {
    let recolectablesInput = int.options.getString("item");

    const mostrarTodos = ["*", "todos", "todo"].includes(
      recolectablesInput?.toLowerCase() || "",
    );

    const embed = new EmbedBuilder()
      .setColor("#90BE6D")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({
        text: `Notitas de recolección de Annie • 🌿💕 • ${new Date().toLocaleDateString("es-CL")}`,
      });

    if (mostrarTodos) {
      const items = Object.entries(RECOLECTABLES);

      await enviarPaginado({
        interaction: int,
        baseEmbed: embed,
        items,
        itemsPorPagina: 12,
        titulo: "🌿 Recolección del pueblito",
        descripcion: "Todo lo que puedes juntar con tus manitos 🌿💕",
        content: bostezo,
        renderItem: ([nombre, info]) => ({
          name: `🌿 ${nombre}`,
          value:
            `📍 **Ubicación:** ${info.ubicacion}\n` +
            `💰 **Precio de venta:** ${info.precio_venta}\n` +
            `⚡ **Energía:** ${info.ganancia_energia ?? "—"}`,
          inline: false,
        }),
      });

      return;
    }

    const itemNormalized = normalize(recolectablesInput || "");
    const itemEntry = Object.entries(RECOLECTABLES).find(
      ([nombre]) => normalize(nombre) === itemNormalized,
    );

    if (!itemEntry) {
      const embedError = new EmbedBuilder()
        .setColor("#90BE6D")
        .setTitle("🌿 ¡Ay, corazoncito!")
        .setDescription(
          estaDurmiendoActual
            ? "*(Annie busca items medio dormida)* Zzz... no encuentro ese item... 😴🌿"
            : `¡Ay, ${getTrato()}! No tengo información sobre **"${itemInput}"** todavía... ¿seguro que es así el nombre, tesoro? 🌿📝`,
        )
        .setThumbnail(CONFIG.ANNIE_IMG)
        .setFooter({ text: "Annie busca mejor con cafecito ☕" });

      return int.reply({ embeds: [embedError], ephemeral: true });
    }

    const [nombre, info] = itemEntry;

    embed
      .setTitle(`🌿 ${nombre}`)
      .setDescription(
        `📍 **Ubicación:** ${info.ubicacion}\n` +
          `💰 **Precio de venta:** ${info.precio_venta}\n` +
          `⚡ **Energía:** ${info.ganancia_energia ?? "—"}`,
      );

    return int.reply({ content: bostezo, embeds: [embed] });
  }
  if (int.commandName === "cultivos") {
    let cultivoInput = int.options.getString("cultivos");

    const mostrarTodos = ["*", "todos", "todo"].includes(
      cultivoInput?.toLowerCase() || "",
    );

    const embed = new EmbedBuilder()
      .setColor("#F8961E")
      .setThumbnail(CONFIG.ANNIE_IMG)
      .setFooter({
        text: `Notitas de cultivos de Annie • 🌾💕 • ${new Date().toLocaleDateString("es-CL")}`,
      });

    if (mostrarTodos) {
      const items = Object.entries(CULTIVOS);

      await enviarPaginado({
        interaction: int,
        baseEmbed: embed,
        items,
        itemsPorPagina: 12,
        titulo: "🌾 Cultivos del pueblito",
        descripcion: "Planta con amor y cosecha con paciencia 🌾✨",
        content: bostezo,
        renderItem: ([nombre, info]) => ({
          name: `🌾 ${nombre}`,
          value:
            `**Tiempo de crecimiento:** ${info.tiempo_crecimiento}\n` +
            `**Nivel requerido:** ${info.nivel_jardineria}\n` +
            `**Venta semilla:** ${info.venta_semilla}  •  **Compra semilla:** ${info.compra_semilla}\n`,
          inline: false,
        }),
      });

      return;
    }

    const cultivo = Object.keys(CULTIVOS).find(
      (c) => normalize(c) === normalize(cultivoInput),
    );

    if (!cultivo) {
      const embedError = new EmbedBuilder()
        .setColor("#F8961E")
        .setTitle("🌾 ¡Ay, corazoncito!")
        .setDescription(
          estaDurmiendoActual
            ? "*(Annie busca cultivos medio dormida)* Zzz... no encuentro ese cultivo... 😴🌾"
            : `¡Ay, ${getTrato()}! No tengo información sobre "${cultivoInput}" todavía... 🌾📝`,
        )
        .setThumbnail(CONFIG.ANNIE_IMG)
        .setFooter({ text: "Annie busca mejor con cafecito ☕" });

      return int.reply({ embeds: [embedError], ephemeral: true });
    }

    const info = CULTIVOS[cultivo];
    embed
      .setTitle(`🌾 ${cultivo}`)
      .setDescription(
        `**Tiempo de crecimiento:** ${info.tiempo_crecimiento}\n` +
          `**Nivel requerido:** ${info.nivel_jardineria}\n` +
          `**Venta semilla:** ${info.venta_semilla}  •  **Compra semilla:** ${info.compra_semilla}\n`,
      );

    return int.reply({ content: bostezo, embeds: [embed] });
  }
});

http
  .createServer((req, res) => {
    res.write("Annie is live");
    res.end();
  })
  .listen(8000);
client.login(CONFIG.TOKEN);

