/**
 * Utilidades compartidas de Annie
 * - Funciones de tiempo/fecha
 * - Creación de embeds con estilo Annie
 * - Barra de progreso
 * - Paginación
 * - Estrella fugaz
 */
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { CONFIG } from "./config.js";
import {
  estaDurmiendo, setDurmiendo,
  isEstrellaActiva, setEstrellaActiva,
  getEstrellaMensaje, setEstrellaMensaje,
  getItemEnDemanda, setItemEnDemanda,
} from "./state.js";
import { getTrato, getFraseAnnie, debeSugerir, getSugerencia } from "./personality.js";

// Re-exportar estado para mantener compatibilidad con comandos existentes
export {
  estaDurmiendo, setDurmiendo,
  isEstrellaActiva, setEstrellaActiva,
  getEstrellaMensaje, setEstrellaMensaje,
  getItemEnDemanda, setItemEnDemanda,
};

// ── Datos ─────────────────────────────────────────────────────

export const EMOJI_CATEGORIA = {
  peces: { icono: "🐟", titulo: "🐟", clima: "🌧️", horario: "⏰" },
  insectos: { icono: "🦋", titulo: "🦋", clima: "🌧️", horario: "⏰" },
  aves: { icono: "🐦", titulo: "🐦", clima: "🌧️", horario: "⏰" },
  animales: { icono: "🐾", titulo: "🐾", clima: "☀️", horario: "⏰" },
  cultivos: { icono: "🌱", titulo: "🌱", clima: "☀️", horario: "⏰" },
  recolectables: { icono: "🍄", titulo: "🍄", clima: "☀️", horario: "⏰" },
  recetas: { icono: "🍳", titulo: "🍳", clima: "☀️", horario: "⏰" },
  habitantes: { icono: "🏡", titulo: "🏡", clima: "☀️", horario: "⏰" },
  logros: { icono: "🏆", titulo: "🏆", clima: "☀️", horario: "⏰" },
  codigos: { icono: "🎁", titulo: "🎁", clima: "☀️", horario: "⏰" },
  clima: { icono: "☁️", titulo: "☁️", clima: "☀️", horario: "⏰" },
  general: { icono: "❤️", titulo: "❤️", clima: "☀️", horario: "⏰" },
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
  "La Aldea te quiere, corazón 🏡",
  "Un abrazo apretado desde la oficinita 🤗",
  "¡Wena, sigue adelante! Annie te apoya 🌈",
  "Despachado con amor desde el correo 📬",
  "Annie anotó esto con su mejor pluma 🖊️",
  "Firmado y sellado con besitos de Annie 💝",
  "Tu carterita favorita siempre aquí 🌺",
];

const DURACION_ESTRELLA_FUGAZ = 5 * 60 * 1000;
const TIMEOUT_PAGINACION_DEFAULT = 300_000;

// ── Footer helper (elimina la duplicación) ────────────────────

/**
 * Genera el texto de footer según el estado de Annie.
 * @returns {{ text: string, iconURL: string }}
 */
export function getAnnieFooter() {
  const text = estaDurmiendo()
    ? "Zzz... Annie te cuida desde la oficinita ♡"
    : FOOTERS_ANNIE[Math.floor(Math.random() * FOOTERS_ANNIE.length)];
  return { text, iconURL: CONFIG.ANNIE_IMG };
}

// ── Tiempo / Fecha ────────────────────────────────────────────

export function getHoraChile() {
  const horaStr = new Date().toLocaleString("en-US", {
    timeZone: CONFIG.TIMEZONE,
    hour: "numeric",
    hour12: false,
  });
  const hora = parseInt(horaStr, 10);
  return isNaN(hora) ? 0 : hora;
}

export function getFechaChile() {
  try {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: CONFIG.TIMEZONE }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

// ── Canal general ─────────────────────────────────────────────

export function getCanalGeneral(client) {
  if (!client?.guilds?.cache) return null;
  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  if (!guild) return null;
  return guild.channels.cache.get(CONFIG.CANAL_GENERAL_ID) ?? null;
}

// ── Embeds ────────────────────────────────────────────────────

export function crearEmbed(color) {
  return new EmbedBuilder()
    .setColor(color || CONFIG.COLORES.ROSA)
    .setThumbnail(CONFIG.ANNIE_IMG)
    .setFooter(getAnnieFooter());
}

export function barraProgreso(valor, max = 100, emojiLleno = "█", emojiVacio = "░", bloques = 10) {
  const maxVal = Math.max(1, Number(max) || 100);
  const porcentaje = Math.max(0, Math.min(100, ((Number(valor) || 0) / maxVal) * 100));
  const llenos = Math.round((porcentaje / 100) * bloques);
  const vacios = bloques - llenos;
  return emojiLleno.repeat(llenos) + emojiVacio.repeat(vacios) + ` **${Math.round(porcentaje)}%**`;
}

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
      `⌛ Vuelve en ${tiempoTexto} y lo intentamos de nuevo.`,
    )
    .setFooter({ text: "Annie te guarda el turno con cariño 🌸" });
}

export function crearEmbedDrop({ emoji, nombre, rareza, narrativa, extras = [] }) {
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

  embed.setFooter(getAnnieFooter());
  return embed;
}

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

  embed.setFooter(getAnnieFooter());
  return embed;
}

// ── Estrella Fugaz ────────────────────────────────────────────

export async function lanzarEstrellaFugaz(client) {
  if (estaDurmiendo() || isEstrellaActiva()) return;

  setEstrellaActiva(true);
  const canal = getCanalGeneral(client);
  if (!canal) {
    setEstrellaActiva(false);
    return;
  }

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("🌠 ¡Una Estrella Fugaz en el cielo!")
    .setDescription(
      "*Annie se asoma rápido por la ventanita de la oficinita...*\n\n" +
      "¡Oh! Acabo de ver caer una estrella brillante en el pueblito... " +
      "**¡El primero que escriba `/deseo` se la lleva!** ✨",
    );

  try {
    const msg = await canal.send({ embeds: [embed] });
    setEstrellaMensaje(msg);
  } catch (error) {
    console.error("Error enviando estrella:", error);
    setEstrellaActiva(false);
    return;
  }

  setTimeout(() => {
    if (isEstrellaActiva()) {
      setEstrellaActiva(false);
      setEstrellaMensaje(null);
      canal.send("❄️ La chispita de la estrella se apagó solita... ¡Ojalá para la próxima estemos más atentos!").catch(() => {});
    }
  }, DURACION_ESTRELLA_FUGAZ);
}

// ── Bostezo / Saludo ──────────────────────────────────────────

export function getBostezo() {
  if (estaDurmiendo()) {
    return "*(Bostezo suave)* Ya po... aqui tiene, corazón, pero no me despierte mucho, ya?\n\n";
  }
  return `Wena, ${getTrato()}! Aqui le traigo su cosita con cariño.\n\n`;
}

// ── Narrativa ─────────────────────────────────────────────────

export function agregarNarrativa(embed, categoria) {
  const frase = getFraseAnnie(categoria);
  const em = EMOJI_CATEGORIA[categoria] || EMOJI_CATEGORIA.general;
  embed.addFields({ name: "\u200B", value: `${em.icono} *${frase}* ❤️`, inline: false });

  if (debeSugerir()) {
    const sug = getSugerencia(categoria);
    if (sug) {
      embed.addFields({ name: "💡 Quizás te interese...", value: sug, inline: false });
    }
  }
}

// ── Embed de Error ────────────────────────────────────────────

export function crearEmbedError(categoria, itemBuscado) {
  const color = CONFIG.COLORES[categoria?.toUpperCase()] || CONFIG.COLORES.ROSA;
  const em = EMOJI_CATEGORIA[categoria] || EMOJI_CATEGORIA.general;
  const itemSeguro = String(itemBuscado || "ese item").substring(0, 100);
  return crearEmbed(color)
    .setTitle(`${em.icono} Ay, corazóncito!`)
    .setDescription(
      estaDurmiendo()
        ? `*(Annie busca con ojitos cerrados)* Zzz... no encuentro "${itemSeguro}" en mi libretita...`
        : `Ay, ${getTrato()}! No tengo anotado "${itemSeguro}" todavía... seguro que se escribe así, tesoro?`,
    )
    .setFooter({ text: "☕ Annie busca mejor con cafecito y cariño" });
}

// ── Paginación ────────────────────────────────────────────────

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
  if (!items || !Array.isArray(items) || items.length === 0) {
    const embed = crearEmbed(CONFIG.COLORES.ROSA).setTitle(titulo).setDescription("No hay items para mostrar");
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
        if (field?.name && field?.value) embed.addFields(field);
      } catch (error) {
        console.error("Error renderizando item:", error);
      }
    });

    embed.setFooter({ text: `Mostrando ${inicio + 1}-${Math.min(fin, items.length)} de ${items.length} | Annie` });
    return embed;
  };

  const crearBotones = (pagina) =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("prev").setLabel("Anterior").setStyle(ButtonStyle.Secondary).setDisabled(pagina === 1),
      new ButtonBuilder().setCustomId("next").setLabel("Siguiente").setStyle(ButtonStyle.Secondary).setDisabled(pagina === totalPaginas),
      new ButtonBuilder().setCustomId("info").setLabel(`${pagina}/${totalPaginas}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    );

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
      await i.editReply({ embeds: [generarEmbedPagina(paginaActual)], components: [crearBotones(paginaActual)] });
    } catch (error) {
      console.error("Error en paginación:", error);
    }
  });

  collector.on("end", async () => {
    const disabled = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("prev").setLabel("Anterior").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("next").setLabel("Siguiente").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("info").setLabel(`${paginaActual}/${totalPaginas}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    );
    await interaction.editReply({ components: [disabled] }).catch(() => {});
  });
}
