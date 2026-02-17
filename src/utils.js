import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { CONFIG } from "./config.js";
import { getTrato, getFraseAnnie, debeSugerir, getSugerencia } from "./personality.js";

export const EMOJI_CATEGORIA = {
  peces:         { icono: "\uD83D\uDC1F", titulo: "\uD83D\uDC1F", clima: "\uD83C\uDF27\uFE0F", horario: "\u23F0" },
  insectos:      { icono: "\uD83E\uDD8B", titulo: "\uD83E\uDD8B", clima: "\uD83C\uDF27\uFE0F", horario: "\u23F0" },
  aves:          { icono: "\uD83D\uDC26", titulo: "\uD83D\uDC26", clima: "\uD83C\uDF27\uFE0F", horario: "\u23F0" },
  animales:      { icono: "\uD83D\uDC3E", titulo: "\uD83D\uDC3E", clima: "\u2600\uFE0F", horario: "\u23F0" },
  cultivos:      { icono: "\uD83C\uDF31", titulo: "\uD83C\uDF31", clima: "\u2600\uFE0F", horario: "\u23F0" },
  recolectables: { icono: "\uD83C\uDF44", titulo: "\uD83C\uDF44", clima: "\u2600\uFE0F", horario: "\u23F0" },
  recetas:       { icono: "\uD83C\uDF73", titulo: "\uD83C\uDF73", clima: "\u2600\uFE0F", horario: "\u23F0" },
  habitantes:    { icono: "\uD83C\uDFE1", titulo: "\uD83C\uDFE1", clima: "\u2600\uFE0F", horario: "\u23F0" },
  logros:        { icono: "\uD83C\uDFC6", titulo: "\uD83C\uDFC6", clima: "\u2600\uFE0F", horario: "\u23F0" },
  codigos:       { icono: "\uD83C\uDF81", titulo: "\uD83C\uDF81", clima: "\u2600\uFE0F", horario: "\u23F0" },
  clima:         { icono: "\u2601\uFE0F", titulo: "\u2601\uFE0F", clima: "\u2600\uFE0F", horario: "\u23F0" },
  general:       { icono: "\u2764\uFE0F", titulo: "\u2764\uFE0F", clima: "\u2600\uFE0F", horario: "\u23F0" },
};

const FOOTERS_ANNIE = [
  "Hecho con amor por Annie \uD83C\uDF38",
  "Con carinito de tu carterita \u2764\uFE0F",
  "Annie te manda un abrazote \uD83C\uDF3C",
  "De la oficinita con ternura \u2615",
  "Annie siempre cuida del pueblito \uD83C\uDF3B",
  "Preparado con tecito y amor \uD83C\uDF75",
];

export function getHoraChile() {
  return parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: CONFIG.TIMEZONE,
      hour: "numeric",
      hour12: false,
    })
  );
}

let _estaDurmiendo = false;
export function estaDurmiendo() { return _estaDurmiendo; }
export function setDurmiendo(val) { _estaDurmiendo = val; }

export function crearEmbed(color, categoria) {
  const embed = new EmbedBuilder()
    .setColor(color || CONFIG.COLORES.ROSA)
    .setThumbnail(CONFIG.ANNIE_IMG);
  const footerText = _estaDurmiendo
    ? "Zzz... Annie te cuida desde la oficinita \u2661"
    : FOOTERS_ANNIE[Math.floor(Math.random() * FOOTERS_ANNIE.length)];
  embed.setFooter({ text: footerText, iconURL: CONFIG.ANNIE_IMG });
  return embed;
}

export function getBostezo() {
  if (_estaDurmiendo) {
    return "*(Bostezo suave)* Ya po... aqui tiene, corazon, pero no me despierte mucho, ya?\n\n";
  }
  return `Wena, ${getTrato()}! Aqui le traigo su cosita con cariño.\n\n`;
}

export function agregarNarrativa(embed, categoria) {
  const frase = getFraseAnnie(categoria);
  const em = EMOJI_CATEGORIA[categoria] || EMOJI_CATEGORIA.general;
  embed.addFields({ name: "\u200B", value: `${em.icono} *${frase}* \u2764\uFE0F`, inline: false });

  if (debeSugerir()) {
    const sug = getSugerencia(categoria);
    if (sug) {
      embed.addFields({
        name: "\uD83D\uDCA1 Quizas te interese...",
        value: sug,
        inline: false,
      });
    }
  }
}

export function crearEmbedError(categoria, itemBuscado) {
  const color = CONFIG.COLORES[categoria?.toUpperCase()] || CONFIG.COLORES.ROSA;
  const em = EMOJI_CATEGORIA[categoria] || EMOJI_CATEGORIA.general;
  const embed = crearEmbed(color)
    .setTitle(`${em.icono} Ay, corazoncito!`)
    .setDescription(
      _estaDurmiendo
        ? `*(Annie busca con ojitos cerrados)* Zzz... no encuentro "${itemBuscado}" en mi libretita...`
        : `Ay, ${getTrato()}! No tengo anotado "${itemBuscado}" todavia... seguro que se escribe asi, tesoro?`
    )
    .setFooter({ text: "\u2615 Annie busca mejor con cafecito y cariño" });
  return embed;
}

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
