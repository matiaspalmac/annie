import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { CONFIG } from "./config.js";
import { getTrato, getFraseAnnie, debeSugerir, getSugerencia } from "./personality.js";

export const EMOJI_CATEGORIA = {
  peces: { icono: "\uD83D\uDC1F", titulo: "\uD83D\uDC1F", clima: "\uD83C\uDF27\uFE0F", horario: "\u23F0" },
  insectos: { icono: "\uD83E\uDD8B", titulo: "\uD83E\uDD8B", clima: "\uD83C\uDF27\uFE0F", horario: "\u23F0" },
  aves: { icono: "\uD83D\uDC26", titulo: "\uD83D\uDC26", clima: "\uD83C\uDF27\uFE0F", horario: "\u23F0" },
  animales: { icono: "\uD83D\uDC3E", titulo: "\uD83D\uDC3E", clima: "\u2600\uFE0F", horario: "\u23F0" },
  cultivos: { icono: "\uD83C\uDF31", titulo: "\uD83C\uDF31", clima: "\u2600\uFE0F", horario: "\u23F0" },
  recolectables: { icono: "\uD83C\uDF44", titulo: "\uD83C\uDF44", clima: "\u2600\uFE0F", horario: "\u23F0" },
  recetas: { icono: "\uD83C\uDF73", titulo: "\uD83C\uDF73", clima: "\u2600\uFE0F", horario: "\u23F0" },
  habitantes: { icono: "\uD83C\uDFE1", titulo: "\uD83C\uDFE1", clima: "\u2600\uFE0F", horario: "\u23F0" },
  logros: { icono: "\uD83C\uDFC6", titulo: "\uD83C\uDFC6", clima: "\u2600\uFE0F", horario: "\u23F0" },
  codigos: { icono: "\uD83C\uDF81", titulo: "\uD83C\uDF81", clima: "\u2600\uFE0F", horario: "\u23F0" },
  clima: { icono: "\u2601\uFE0F", titulo: "\u2601\uFE0F", clima: "\u2600\uFE0F", horario: "\u23F0" },
  general: { icono: "\u2764\uFE0F", titulo: "\u2764\uFE0F", clima: "\u2600\uFE0F", horario: "\u23F0" },
};

const FOOTERS_ANNIE = [
  "Hecho con amor por Annie 🌸",
  "Con cariñito de tu carterita ❤️",
  "Annie te manda un abrazote 🌼",
  "De la oficinita con ternura ☕",
  "Annie siempre cuida del pueblito 🌻",
  "Preparado con tecito y amor 🍵",
  "Susurros del pueblito con cariñito 🌿",
  "Annie dice: ¡Cuídate mucho, tesoro! 🫶",
  "Con mimo y buen rollo de tu carterita 💌",
  "Heartopia te quiere, corazón 🏡",
  "Un abrazo apretado desde la oficinita 🤗",
  "¡Wena, sigue adelante! Annie te apoya 🌈",
  "Despachado con amor desde el correo 📬",
  "Annie anotó esto con su mejor pluma 🖊️",
  "Firmado y sellado con besitos de Annie 💝",
  "Tu carterita favorita siempre aquí 🌺",
];

// Constantes de tiempo
const DURACION_ESTRELLA_FUGAZ = 5 * 60 * 1000; // 5 minutos
const TIMEOUT_PAGINACION_DEFAULT = 300000; // 5 minutos

/**
 * Obtiene la hora actual en Chile (0-23)
 * @returns {number} Hora en formato 24h
 */
export function getHoraChile() {
  const horaStr = new Date().toLocaleString("en-US", {
    timeZone: CONFIG.TIMEZONE,
    hour: "numeric",
    hour12: false,
  });
  const hora = parseInt(horaStr, 10);
  return isNaN(hora) ? 0 : hora;
}

/**
 * Obtiene la fecha actual en Chile (formato YYYY-MM-DD)
 * @returns {string} Fecha en formato ISO
 */
export function getFechaChile() {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: CONFIG.TIMEZONE,
    }).format(new Date());
  } catch (error) {
    console.error("Error obteniendo fecha Chile:", error);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Obtiene el canal general del servidor
 * @param {Client} client - Cliente de Discord
 * @returns {Channel|null} Canal general o null
 */
export function getCanalGeneral(client) {
  if (!client?.guilds?.cache) {
    console.error("Cliente de Discord no inicializado correctamente");
    return null;
  }
  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  if (!guild) {
    console.warn(`Guild ${CONFIG.GUILD_ID} no encontrado`);
    return null;
  }
  return guild.channels.cache.get(CONFIG.CANAL_GENERAL_ID) ?? null;
}

let _estaDurmiendo = false;
export function estaDurmiendo() { return _estaDurmiendo; }
export function setDurmiendo(val) { _estaDurmiendo = val; }

let _estrellaActiva = false;
export function isEstrellaActiva() { return _estrellaActiva; }
export function setEstrellaActiva(val) { _estrellaActiva = val; }

// ---- Evento Mercader Doris ----
let _itemEnDemanda = null; // Guardará el nombre del ítem que están comprando caro
let _demandaActivaHasta = 0; // Timestamp hasta cuándo dura la oferta

/**
 * Obtiene el item actualmente en demanda (evento Mercader Doris)
 * @returns {string|null} Nombre del item o null si no hay demanda activa
 */
export function getItemEnDemanda() {
  const ahora = Date.now();
  if (_itemEnDemanda && ahora < _demandaActivaHasta) {
    return _itemEnDemanda;
  }
  // Limpiar item vencido
  if (_itemEnDemanda && ahora >= _demandaActivaHasta) {
    _itemEnDemanda = null;
    _demandaActivaHasta = 0;
  }
  return null;
}

/**
 * Establece un item en demanda por duración específica
 * @param {string} item - Nombre del item
 * @param {number} duracionMs - Duración en milisegundos
 */
export function setItemEnDemanda(item, duracionMs) {
  if (!item || typeof item !== 'string') {
    console.warn("setItemEnDemanda: item inválido", item);
    return;
  }
  if (!duracionMs || duracionMs <= 0) {
    console.warn("setItemEnDemanda: duración inválida", duracionMs);
    return;
  }
  _itemEnDemanda = item;
  _demandaActivaHasta = Date.now() + duracionMs;
}

/**
 * Crea un embed con el estilo de Annie
 * @param {string} color - Color del embed (hex)
 * @param {string} [categoria] - Categoría para personalización futura
 * @returns {EmbedBuilder} Embed configurado
 */
export function crearEmbed(color, categoria) {
  const embed = new EmbedBuilder()
    .setColor(color || CONFIG.COLORES.ROSA)
    .setThumbnail(CONFIG.ANNIE_IMG);
  const footerText = _estaDurmiendo
    ? "Zzz... Annie te cuida desde la oficinita ♡"
    : FOOTERS_ANNIE[Math.floor(Math.random() * FOOTERS_ANNIE.length)];
  embed.setFooter({ text: footerText, iconURL: CONFIG.ANNIE_IMG });
  return embed;
}

/**
 * Genera una barra de progreso visual con emojis
 * @param {number} valor - Valor actual (0-100)
 * @param {string} [emojiLleno="█"] - Emoji para bloques llenos
 * @param {string} [emojiVacio="░"] - Emoji para bloques vacíos
 * @param {number} [bloques=10] - Número de bloques totales
 * @returns {string} Barra de progreso visual
 */
export function barraProgreso(valor, emojiLleno = "█", emojiVacio = "░", bloques = 10) {
  const porcentaje = Math.max(0, Math.min(100, Number(valor) || 0));
  const llenos = Math.round((porcentaje / 100) * bloques);
  const vacios = bloques - llenos;
  return emojiLleno.repeat(llenos) + emojiVacio.repeat(vacios) + ` **${porcentaje}%**`;
}

/**
 * Crea un embed de cooldown para mostrar tiempo de espera
 * @param {number} minutosRestantes - Minutos restantes
 * @param {string} [bostezo=""] - Saludo de Annie
 * @param {string} [nombreComando=""] - Nombre del comando en cooldown
 * @returns {EmbedBuilder} Embed de cooldown
 */
export function crearEmbedCooldown(minutosRestantes, bostezo = "", nombreComando = "") {
  const tiempoTexto = minutosRestantes >= 60
    ? `**${Math.floor(minutosRestantes / 60)}h ${minutosRestantes % 60}min**`
    : `**${minutosRestantes} minutos**`;

  return new EmbedBuilder()
    .setColor(CONFIG.COLORES.ROJO || "#E74C3C")
    .setTitle("⏳ Pausa, corazoncito...")
    .setDescription(
      `${bostezo ? `*${bostezo}*\n\n` : ""}` +
      `${nombreComando ? `El comando \`/${nombreComando}\` ` : "Este comando "}todavía está descansando.\n\n` +
      `⌛ Vuelve en ${tiempoTexto} y lo intentamos de nuevo.`
    )
    .setFooter({ text: "Annie te guarda el turno con cariño 🌸" });
}

/**
 * Crea un embed visual para drops/resultados de recolección con tema por rareza
 * @param {Object} params - Parámetros del drop
 * @param {string} params.emoji - Emoji del ítem
 * @param {string} params.nombre - Nombre del ítem
 * @param {string} params.rareza - Rareza: comun|poco_comun|raro|epico|legendario|mitico
 * @param {string} params.narrativa - Descripción narrativa del resultado
 * @param {Object} [params.extras] - Campos adicionales {nombre, valor, inline}[]
 * @returns {{ color: string, embed: EmbedBuilder }} Color y embed del drop
 */
export function crearEmbedDrop({ emoji, nombre, rareza, narrativa, extras = [] }) {
  // Configuración visual por rareza
  const CONFIG_RAREZA = {
    mitico: { color: "#FF0080", etiqueta: "✨✨ MÍTICO ✨✨", prefijo: "🌟💫" },
    legendario: { color: "#FFD700", etiqueta: "⭐ Legendario", prefijo: "🌟" },
    epico: { color: "#9B59B6", etiqueta: "💜 Épico", prefijo: "💜" },
    raro: { color: "#5B8DEF", etiqueta: "💙 Raro", prefijo: "✨" },
    poco_comun: { color: "#2ECC71", etiqueta: "💚 Poco Común", prefijo: "🍀" },
    comun: { color: "#95A5A6", etiqueta: "⬜ Común", prefijo: "" },
  };

  const cfg = CONFIG_RAREZA[rareza] || CONFIG_RAREZA.comun;

  const embed = new EmbedBuilder()
    .setColor(cfg.color)
    .setTitle(`${cfg.prefijo} ${emoji} ${nombre}`.trim())
    .setDescription(narrativa);

  if (cfg.etiqueta) {
    embed.addFields({ name: "✦ Rareza", value: cfg.etiqueta, inline: true });
  }

  for (const extra of extras) {
    if (extra?.name && extra?.value) {
      embed.addFields({ name: extra.name, value: extra.value, inline: extra.inline ?? true });
    }
  }

  const footerText = _estaDurmiendo
    ? "Zzz... Annie te cuida desde la oficinita ♡"
    : FOOTERS_ANNIE[Math.floor(Math.random() * FOOTERS_ANNIE.length)];
  embed.setFooter({ text: footerText, iconURL: CONFIG.ANNIE_IMG });

  return embed;
}

/**
 * Crea un embed de confirmación de éxito
 * @param {string} titulo - Título del embed
 * @param {string} descripcion - Descripción del resultado
 * @param {string} [color] - Color hex (por defecto verde)
 * @param {Object[]} [fields] - Campos adicionales
 * @returns {EmbedBuilder} Embed de éxito
 */
export function crearEmbedExito(titulo, descripcion, color, fields = []) {
  const embed = new EmbedBuilder()
    .setColor(color || CONFIG.COLORES.VERDE || "#4CAF50")
    .setTitle(`✅ ${titulo}`)
    .setDescription(descripcion);

  for (const f of fields) {
    if (f?.name && f?.value) {
      embed.addFields({ name: f.name, value: f.value, inline: f.inline ?? false });
    }
  }

  const footerText = _estaDurmiendo
    ? "Zzz... Annie te cuida desde la oficinita ♡"
    : FOOTERS_ANNIE[Math.floor(Math.random() * FOOTERS_ANNIE.length)];
  embed.setFooter({ text: footerText, iconURL: CONFIG.ANNIE_IMG });
  return embed;
}

export function lanzarEstrellaFugaz(client) {
  if (estaDurmiendo() || isEstrellaActiva()) return;

  setEstrellaActiva(true);
  const canal = getCanalGeneral(client);
  if (canal) {
    const embed = crearEmbed(CONFIG.COLORES.DORADO)
      .setTitle("🌠 ¡Una Estrella Fugaz en el cielo!")
      .setDescription("*Annie se asoma rápido por la ventanita de la oficinita...*\n\n¡Oh! Acabo de ver caer una estrella brillante en el pueblito... **¡El primero que escriba `/deseo` se la lleva!** ✨");
    canal.send({ embeds: [embed] }).catch(console.error);

    // La estrella caduca después de la duración configurada
    setTimeout(() => {
      if (isEstrellaActiva()) {
        setEstrellaActiva(false);
        canal.send("❄️ La chispita de la estrella se apagó solita... ¡Ojalá para la próxima estemos más atentos!").catch(() => { });
      }
    }, DURACION_ESTRELLA_FUGAZ);
  }
}

/**
 * Obtiene mensaje de saludo según el estado de Annie
 * @returns {string} Mensaje personalizado
 */
export function getBostezo() {
  if (_estaDurmiendo) {
    return "*(Bostezo suave)* Ya po... aqui tiene, corazón, pero no me despierte mucho, ya?\n\n";
  }
  return `Wena, ${getTrato()}! Aqui le traigo su cosita con cariño.\n\n`;
}

/**
 * Agrega narrativa y sugerencias de Annie al embed
 * @param {EmbedBuilder} embed - Embed a modificar
 * @param {string} categoria - Categoría del contenido
 */
export function agregarNarrativa(embed, categoria) {
  const frase = getFraseAnnie(categoria);
  const em = EMOJI_CATEGORIA[categoria] || EMOJI_CATEGORIA.general;
  embed.addFields({ name: "\u200B", value: `${em.icono} *${frase}* \u2764\uFE0F`, inline: false });

  if (debeSugerir()) {
    const sug = getSugerencia(categoria);
    if (sug) {
      embed.addFields({
        name: "\uD83D\uDCA1 Quizás te interese...",
        value: sug,
        inline: false,
      });
    }
  }
}

/**
 * Crea un embed de error personalizado
 * @param {string} categoria - Categoría del contenido
 * @param {string} itemBuscado - Item que no se encontró
 * @returns {EmbedBuilder} Embed de error
 */
export function crearEmbedError(categoria, itemBuscado) {
  const color = CONFIG.COLORES[categoria?.toUpperCase()] || CONFIG.COLORES.ROSA;
  const em = EMOJI_CATEGORIA[categoria] || EMOJI_CATEGORIA.general;
  const itemSeguro = String(itemBuscado || "ese item").substring(0, 100); // Limitar longitud
  const embed = crearEmbed(color)
    .setTitle(`${em.icono} Ay, corazóncito!`)
    .setDescription(
      _estaDurmiendo
        ? `*(Annie busca con ojitos cerrados)* Zzz... no encuentro "${itemSeguro}" en mi libretita...`
        : `Ay, ${getTrato()}! No tengo anotado "${itemSeguro}" todavía... seguro que se escribe así, tesoro?`
    )
    .setFooter({ text: "\u2615 Annie busca mejor con cafecito y cariño" });
  return embed;
}

/**
 * Envía un mensaje paginado con botones de navegación
 * @param {Object} params - Parámetros de paginación
 * @param {CommandInteraction} params.interaction - Interacción de Discord
 * @param {EmbedBuilder} params.baseEmbed - Embed base
 * @param {Array} params.items - Items a paginar
 * @param {number} [params.itemsPorPagina=12] - Items por página
 * @param {string} params.titulo - Título del embed
 * @param {string} params.descripcion - Descripción del embed
 * @param {Function} params.renderItem - Función para renderizar cada item
 * @param {string} [params.content=null] - Contenido adicional del mensaje
 * @param {number} [params.timeout=300000] - Timeout del collector en ms
 */
export async function enviarPaginado({
  interaction,
  baseEmbed,
  items,
  itemsPorPagina = 12,
  titulo,
  descripcion,
  renderItem,
  content = null,
  timeout = TIMEOUT_PAGINACION_DEFAULT,
}) {
  // Validaciones
  if (!items || !Array.isArray(items) || items.length === 0) {
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle(titulo)
      .setDescription("No hay items para mostrar");
    return interaction.reply({ content, embeds: [embed] });
  }

  let paginaActual = 1;
  const totalPaginas = Math.ceil(items.length / itemsPorPagina);

  const generarEmbedPagina = (pagina) => {
    const inicio = (pagina - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;

    const embed = EmbedBuilder.from(baseEmbed)
      .setTitle(`${titulo} - Página ${pagina}/${totalPaginas}`)
      .setDescription(descripcion);

    items.slice(inicio, fin).forEach((item) => {
      try {
        const field = renderItem(item);
        if (field && field.name && field.value) {
          embed.addFields(field);
        }
      } catch (error) {
        console.error("Error renderizando item:", error);
      }
    });

    embed.setFooter({
      text: `Mostrando ${inicio + 1}-${Math.min(fin, items.length)} de ${items.length} | Annie`,
    });

    return embed;
  };

  const crearBotones = (pagina) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("Anterior")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === 1),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("Siguiente")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pagina === totalPaginas),
      new ButtonBuilder()
        .setCustomId("info")
        .setLabel(`${pagina}/${totalPaginas}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );
  };

  const response = await interaction.reply({
    content,
    embeds: [generarEmbedPagina(1)],
    components: totalPaginas > 1 ? [crearBotones(1)] : [],
  });

  const message = await response.fetch();

  if (totalPaginas <= 1) return;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: timeout,
  });

  collector.on("collect", async (i) => {
    try {
      await i.deferUpdate();
      if (i.customId === "prev") paginaActual--;
      if (i.customId === "next") paginaActual++;
      paginaActual = Math.max(1, Math.min(totalPaginas, paginaActual));

      await i.editReply({
        embeds: [generarEmbedPagina(paginaActual)],
        components: [crearBotones(paginaActual)],
      });
    } catch (error) {
      console.error("Error en collector de paginación:", error);
    }
  });

  collector.on("end", async () => {
    const disabled = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("prev").setLabel("Anterior").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("next").setLabel("Siguiente").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("info").setLabel(`${paginaActual}/${totalPaginas}`).setStyle(ButtonStyle.Primary).setDisabled(true)
    );
    await interaction.editReply({ components: [disabled] }).catch(() => { });
  });
}
