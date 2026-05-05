import { SlashCommandBuilder } from "discord.js";
import { crearEmbed, getFechaChile } from "../../core/utils.js";
import { db } from "../../services/db.js";
import { deductBalance, ensureUser, getBalance } from "../../services/db-helpers.js";
import { CONFIG } from "../../core/config.js";
import {
  COSTO_BOLETO,
  MAX_BOLETOS_DIA,
  MIN_PARTICIPANTES_SORTEO,
  POZO_MINIMO,
  getEstadisticasRifa,
  getBoletosUsuario,
  getHistorialGanadores,
} from "../../features/rifa.js";

export const data = new SlashCommandBuilder()
  .setName("rifa")
  .setDescription("Participa en la rifa diaria del pueblito.")
  .addSubcommand((subcmd) =>
    subcmd.setName("ver").setDescription("Mira de cuánto es el pozo acumulado actual de la rifa."),
  )
  .addSubcommand((subcmd) =>
    subcmd
      .setName("comprar")
      .setDescription(`Compra boletos para la rifa por ${COSTO_BOLETO} moneditas c/u.`)
      .addIntegerOption((opt) =>
        opt
          .setName("cantidad")
          .setDescription(`Cuántos boletos comprar (1-${MAX_BOLETOS_DIA})`)
          .setMinValue(1)
          .setMaxValue(MAX_BOLETOS_DIA)
          .setRequired(false),
      ),
  )
  .addSubcommand((subcmd) =>
    subcmd.setName("historial").setDescription("Mira los últimos ganadores de la rifa."),
  );

export async function execute(interaction, bostezo) {
  const subcomando = interaction.options.getSubcommand();
  const hoyStr = getFechaChile();

  await interaction.deferReply();

  try {
    if (subcomando === "ver") return handleVer(interaction, bostezo, hoyStr);
    if (subcomando === "comprar") return handleComprar(interaction, bostezo, hoyStr);
    if (subcomando === "historial") return handleHistorial(interaction, bostezo);
  } catch (error) {
    console.error("Error en comando /rifa:", error);
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("❌ ¡Los boletos se enredaron!")
      .setDescription(`${bostezo}Uy... se me enredaron los boletos y no pude procesar eso. ¿Intentamos de nuevo más ratito?`);
    return interaction.followUp({ embeds: [embed] });
  }
}

// ── /rifa ver ─────────────────────────────────────────────────

async function handleVer(interaction, bostezo, hoyStr) {
  const { totalBoletos, pozoVentas, pozoAcumulado, pozoTotal, participantes } = await getEstadisticasRifa(hoyStr);
  const misBoletos = await getBoletosUsuario(interaction.user.id, hoyStr);
  const numParticipantes = Object.keys(participantes).length;
  const faltanParticipantes = Math.max(0, MIN_PARTICIPANTES_SORTEO - numParticipantes);
  const sorteoHabilitado = numParticipantes >= MIN_PARTICIPANTES_SORTEO;
  const miChance = totalBoletos > 0 ? ((misBoletos / totalBoletos) * 100).toFixed(1) : "0";
  const boletosRestantes = MAX_BOLETOS_DIA - misBoletos;

  // Desglose del pozo
  const desgloseLines = [];
  if (pozoVentas > 0) desgloseLines.push(`🎫 Boletos de hoy: ${pozoVentas.toLocaleString()} 🪙`);
  if (pozoAcumulado > 0) desgloseLines.push(`📦 Acumulado anterior: ${pozoAcumulado.toLocaleString()} 🪙`);

  const annieAporta = totalBoletos > 0 ? Math.max(0, POZO_MINIMO - pozoVentas - pozoAcumulado) : 0;
  if (annieAporta > 0) desgloseLines.push(`🌸 Annie completará: ${annieAporta.toLocaleString()} 🪙`);

  if (desgloseLines.length === 0) desgloseLines.push("*Sin movimiento todavía*");

  // Top 5 participantes
  const topParticipantes = Object.entries(participantes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, boletos], i) => {
      const medallas = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
      const chance = ((boletos / totalBoletos) * 100).toFixed(1);
      return `${medallas[i]} <@${uid}> — ${boletos} boleto(s) (${chance}%)`;
    })
    .join("\n");

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("🎟️ La Rifa Diaria de Annie")
    .setDescription(
      `${bostezo}*A ver, a ver... veamos cómo va la cajita de los boletos...*\n\n` +
      `¡El sorteo es esta noche a las **23:59**! ¿Ya tienes tu boleto? 🌸` +
      (pozoAcumulado > 0 ? `\n\n📦 *¡Hay **${pozoAcumulado.toLocaleString()} 🪙** acumuladas de días anteriores!*` : "") +
      (!sorteoHabilitado
        ? `\n\n⚠️ *Faltan **${faltanParticipantes} participante(s)** para habilitar el sorteo de hoy.*`
        : ""),
    )
    .addFields(
      { name: "💰 Pozo Estimado", value: `**${pozoTotal.toLocaleString()} 🪙**`, inline: true },
      { name: "🎫 Boletos Vendidos", value: `**${totalBoletos}**`, inline: true },
      { name: "👥 Participantes", value: `**${numParticipantes}**`, inline: true },
      {
        name: "🎯 Estado del sorteo",
        value: sorteoHabilitado
          ? `✅ Habilitado (mínimo ${MIN_PARTICIPANTES_SORTEO})`
          : `⏳ En espera (${faltanParticipantes} participante(s) más)\nSi no se llega al mínimo: reembolso de boletos + aporte de Annie`,
        inline: false,
      },
      { name: "📊 Desglose", value: desgloseLines.join("\n"), inline: false },
      {
        name: "🎯 Tu Participación",
        value: misBoletos > 0
          ? `**${misBoletos}/${MAX_BOLETOS_DIA} boleto(s)** — ${miChance}% de ganar\n*(puedes comprar ${boletosRestantes} más)*`
          : `*Aún no tienes boleto. Usa \`/rifa comprar\` para participar!*`,
        inline: false,
      },
    );

  if (topParticipantes && numParticipantes > 0) {
    embed.addFields({ name: "🏅 Top participantes", value: topParticipantes, inline: false });
  }

  embed.setFooter({
    text: `Mín. pozo: ${POZO_MINIMO} 🪙 | Mín. participantes: ${MIN_PARTICIPANTES_SORTEO} | Máx. ${MAX_BOLETOS_DIA} boletos/día`,
  });

  return interaction.followUp({ embeds: [embed] });
}

// ── /rifa comprar ─────────────────────────────────────────────

async function handleComprar(interaction, bostezo, hoyStr) {
  const cantidad = interaction.options.getInteger("cantidad") || 1;
  const avatarUrl = interaction.user.displayAvatarURL({ extension: "png", size: 256 }) || null;

  await ensureUser(interaction.user.id, interaction.user.username, avatarUrl);

  const monedasActuales = await getBalance(interaction.user.id);

  // Verificar límite diario
  const boletosHoy = await getBoletosUsuario(interaction.user.id, hoyStr);
  const boletosRestantes = MAX_BOLETOS_DIA - boletosHoy;

  if (boletosRestantes <= 0) {
    const embed = crearEmbed(CONFIG.COLORES.NARANJA)
      .setTitle("🎫 ¡Ya compraste el máximo!")
      .setDescription(
        `${bostezo}Ya tienes **${boletosHoy}/${MAX_BOLETOS_DIA}** boletos hoy, corazón. ` +
        `No quiero que te gastes todas las moneditas en la rifa, ya?\n\n` +
        `¡Espera al sorteo de las **23:59** y cruza los deditos! 🤞`,
      );
    return interaction.followUp({ embeds: [embed] });
  }

  // Ajustar cantidad si excede el límite
  const cantidadFinal = Math.min(cantidad, boletosRestantes);
  const costoFinal = COSTO_BOLETO * cantidadFinal;

  // Verificar fondos
  if (monedasActuales < costoFinal) {
    const puedeComprar = Math.floor(monedasActuales / COSTO_BOLETO);
    const embed = crearEmbed(CONFIG.COLORES.NARANJA)
      .setTitle("💸 ¡Sin fondos suficientes!")
      .setDescription(
        `${bostezo}Pucha mi tesoro... necesitas **${costoFinal.toLocaleString()} 🪙** para ${cantidadFinal} boleto(s).`,
      )
      .addFields(
        { name: "💰 Tienes", value: `**${monedasActuales.toLocaleString()} 🪙**`, inline: true },
        { name: "❌ Faltan", value: `**${(costoFinal - monedasActuales).toLocaleString()} 🪙**`, inline: true },
        {
          name: "💡 Tip",
          value: puedeComprar > 0
            ? `Puedes comprar hasta **${puedeComprar}** boleto(s) con lo que tienes.`
            : `Necesitas al menos **${COSTO_BOLETO} 🪙** para un boleto.`,
          inline: false,
        },
      );
    return interaction.followUp({ embeds: [embed] });
  }

  // Descontar monedas
  await deductBalance(interaction.user.id, costoFinal);

  // Insertar boletos
  const inserts = [];
  for (let i = 0; i < cantidadFinal; i++) {
    inserts.push(
      db.execute({
        sql: "INSERT INTO rifa_boletos (user_id, fecha) VALUES (?, ?)",
        args: [interaction.user.id, hoyStr],
      }),
    );
  }
  await Promise.all(inserts);

  // Estadísticas actualizadas
  const totalMios = boletosHoy + cantidadFinal;
  const { totalBoletos: totalGeneral, pozoTotal } = await getEstadisticasRifa(hoyStr);
  const miChance = ((totalMios / totalGeneral) * 100).toFixed(1);

  const embed = crearEmbed(CONFIG.COLORES.MAGENTA)
    .setTitle(cantidadFinal > 1 ? "🎟️ ¡Boletos Comprados!" : "🎟️ ¡Boleto Comprado!")
    .setDescription(
      `${bostezo}¡Te acabo de anotar en la libretita de la rifa, <@${interaction.user.id}>!\n\n` +
      `*Annie firma ${cantidadFinal > 1 ? `${cantidadFinal} boletos` : "el boleto"} con su mejor pluma y te ${cantidadFinal > 1 ? "los" : "lo"} entrega con una sonrisa.*`,
    )
    .addFields(
      { name: "🎟️ Tus boletos hoy", value: `**${totalMios}/${MAX_BOLETOS_DIA}**`, inline: true },
      { name: "💸 Costo", value: `**${costoFinal.toLocaleString()} 🪙**`, inline: true },
      { name: "🎯 Tu chance", value: `**${miChance}%**`, inline: true },
      { name: "💰 Pozo estimado", value: `**${pozoTotal.toLocaleString()} 🪙**`, inline: true },
      { name: "⏰ Sorteo", value: "Hoy a las **23:59**", inline: true },
    );

  if (totalMios < MAX_BOLETOS_DIA) {
    embed.addFields({
      name: "💡 Tip",
      value: `Puedes comprar hasta **${MAX_BOLETOS_DIA - totalMios}** boleto(s) más hoy.`,
      inline: false,
    });
  }

  return interaction.followUp({ embeds: [embed] });
}

// ── /rifa historial ───────────────────────────────────────────

async function handleHistorial(interaction, bostezo) {
  const historial = await getHistorialGanadores(7);

  if (historial.length === 0) {
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("📜 Historial de la Rifa")
      .setDescription(`${bostezo}Todavía no tengo anotado ningún ganador en mi libretita. ¡Pronto habrá historia!`);
    return interaction.followUp({ embeds: [embed] });
  }

  const lineas = historial.map((row) => {
    const chance = ((Number(row.boletos_ganador) / Number(row.boletos_totales)) * 100).toFixed(1);
    const esHoy = row.fecha === getFechaChile();
    return (
      `${esHoy ? "🌟" : "📅"} **${row.fecha}** — <@${row.user_id}>\n` +
      `   💰 ${Number(row.pozo).toLocaleString()} 🪙 | 🎫 ${row.boletos_ganador}/${row.boletos_totales} boletos (${chance}%)`
    );
  });

  const totalPozos = historial.reduce((sum, r) => sum + Number(r.pozo), 0);
  const totalBoletos = historial.reduce((sum, r) => sum + Number(r.boletos_totales), 0);

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("📜 Historial de la Rifa")
    .setDescription(
      `${bostezo}*Annie abre la libretita de ganadores con ternura...*\n\n` +
      lineas.join("\n\n"),
    )
    .addFields({
      name: "📊 Resumen",
      value:
        `Total repartido: **${totalPozos.toLocaleString()} 🪙** en ${historial.length} sorteo(s)\n` +
        `Total boletos vendidos: **${totalBoletos.toLocaleString()}**`,
      inline: false,
    })
    .setFooter({ text: `Mostrando los últimos ${historial.length} sorteos | Annie` });

  return interaction.followUp({ embeds: [embed] });
}
