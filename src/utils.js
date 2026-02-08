// ============================================================
// Utilidades de Discord (embeds, paginacion, helpers)
// ============================================================

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { CONFIG } from "./config.js";
import { getTrato, getFraseAnnie, debeSugerir, getSugerencia } from "./personality.js";

// -------------------------------------------------------
// Obtener hora en Chile
// -------------------------------------------------------
export function getHoraChile() {
  return parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: CONFIG.TIMEZONE,
      hour: "numeric",
      hour12: false,
    })
  );
}

// -------------------------------------------------------
// Estado de sueno global
// -------------------------------------------------------
let _estaDurmiendo = false;
export function estaDurmiendo() { return _estaDurmiendo; }
export function setDurmiendo(val) { _estaDurmiendo = val; }

// -------------------------------------------------------
// Construir embed base con colores y thumbnail de Annie
// -------------------------------------------------------
export function crearEmbed(color) {
  return new EmbedBuilder()
    .setColor(color || CONFIG.COLORES.ROSA)
    .setThumbnail(CONFIG.ANNIE_IMG);
}

// -------------------------------------------------------
// Prefijo narrativo de Annie segun estado
// -------------------------------------------------------
export function getBostezo() {
  if (_estaDurmiendo) {
    return "*(Bostezo suave)* Ya po... aqui tiene, corazon, pero no me despierte mucho, ya?\n\n";
  }
  return `Wena, ${getTrato()}! Aqui le traigo su cosita con carino.\n\n`;
}

// -------------------------------------------------------
// Agregar footer narrativo a un embed (frase + sugerencia)
// -------------------------------------------------------
export function agregarNarrativa(embed, categoria) {
  const frase = getFraseAnnie(categoria);
  embed.addFields({ name: "\u200B", value: `*${frase}*`, inline: false });

  if (debeSugerir()) {
    const sug = getSugerencia(categoria);
    if (sug) {
      embed.addFields({
        name: "Quizas te interese...",
        value: sug,
        inline: false,
      });
    }
  }
}

// -------------------------------------------------------
// Error embed bonito de Annie
// -------------------------------------------------------
export function crearEmbedError(categoria, itemBuscado) {
  const color = CONFIG.COLORES[categoria?.toUpperCase()] || CONFIG.COLORES.ROSA;
  const embed = crearEmbed(color)
    .setTitle(`Ay, corazoncito!`)
    .setDescription(
      _estaDurmiendo
        ? `*(Annie busca con ojitos cerrados)* Zzz... no encuentro "${itemBuscado}" en mi libretita...`
        : `Ay, ${getTrato()}! No tengo anotado "${itemBuscado}" todavia... seguro que se escribe asi, tesoro?`
    )
    .setFooter({ text: "Annie busca mejor con cafecito y carino" });
  return embed;
}

// -------------------------------------------------------
// Sistema de paginacion para listas largas
// -------------------------------------------------------
export async function enviarPaginado({
  interaction,
  baseEmbed,
  items,
  itemsPorPagina = 12,
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
      .setTitle(`${titulo} - Pagina ${pagina}/${totalPaginas}`)
      .setDescription(descripcion);

    items.slice(inicio, fin).forEach((item) => {
      const field = renderItem(item);
      if (field) embed.addFields(field);
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

  const message = await interaction.reply({
    content,
    embeds: [generarEmbedPagina(1)],
    components: totalPaginas > 1 ? [crearBotones(1)] : [],
    fetchReply: true,
  });

  if (totalPaginas <= 1) return;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: timeout,
  });

  collector.on("collect", async (i) => {
    await i.deferUpdate();
    if (i.customId === "prev") paginaActual--;
    if (i.customId === "next") paginaActual++;
    paginaActual = Math.max(1, Math.min(totalPaginas, paginaActual));

    await i.editReply({
      embeds: [generarEmbedPagina(paginaActual)],
      components: [crearBotones(paginaActual)],
    });
  });

  collector.on("end", async () => {
    const disabled = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("prev").setLabel("Anterior").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("next").setLabel("Siguiente").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("info").setLabel(`${paginaActual}/${totalPaginas}`).setStyle(ButtonStyle.Primary).setDisabled(true)
    );
    await interaction.editReply({ components: [disabled] }).catch(() => {});
  });
}
