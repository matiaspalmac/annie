import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { crearEmbed, getFechaChile } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import {
  generarMisionesDelDia,
  getMisionesHoy,
  reclamarBonus,
  BONUS_COMPLETAR_TODAS,
} from "../../features/misiones.js";

// ── Helpers de UI ────────────────────────────────────────────────────

/**
 * Genera una barra de progreso visual para una misión.
 */
function barraMision(progreso, meta) {
  const bloques = 8;
  const llenos = Math.min(bloques, Math.round((progreso / meta) * bloques));
  const vacios = bloques - llenos;
  return "▓".repeat(llenos) + "░".repeat(vacios);
}

// ── Comando ──────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("misiones")
  .setDescription("Revisa y reclama tus misiones diarias del pueblito")
  .addSubcommand((sub) =>
    sub
      .setName("ver")
      .setDescription("Muestra tus misiones del día y su progreso")
  )
  .addSubcommand((sub) =>
    sub
      .setName("reclamar")
      .setDescription("Reclama el bonus por completar todas las misiones")
  );

export async function execute(interaction, bostezo) {
  const userId = interaction.user.id;
  const subcomando = interaction.options.getSubcommand();

  await interaction.deferReply();

  try {
    if (subcomando === "ver") {
      return await mostrarMisiones(interaction, userId, bostezo);
    }

    if (subcomando === "reclamar") {
      return await reclamarBonusMisiones(interaction, userId, bostezo);
    }
  } catch (error) {
    console.error("Error en /misiones:", error);
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("❌ ¡Ay, se me perdió la lista!")
      .setDescription(
        `${bostezo}Pucha, se me traspapelaron las misiones, corazoncito. Inténtalo otra vez en un ratito.`
      );
    return interaction.editReply({ embeds: [embed] });
  }
}

// ── /misiones ver ────────────────────────────────────────────────────

async function mostrarMisiones(interaction, userId, bostezo) {
  const hoy = getFechaChile();

  // Generar misiones si es la primera vez del día
  await generarMisionesDelDia(userId, hoy);

  const { misiones, bonusReclamado } = await getMisionesHoy(userId, hoy);

  const completadas = misiones.filter((m) => m.completada).length;
  const totalMisiones = misiones.length;
  const todasCompletas = completadas === totalMisiones;

  // Construir lista de misiones
  const listaMisiones = misiones
    .map((m) => {
      const estado = m.completada ? "✅" : "🔲";
      const barra = barraMision(m.progreso, m.meta);
      return (
        `${estado} ${m.emoji} **${m.descripcion}**\n` +
        `> ${barra} \`${m.progreso}/${m.meta}\` — **${m.recompensa} 🪙**`
      );
    })
    .join("\n\n");

  // Estado del bonus
  let bonusTexto;
  if (bonusReclamado) {
    bonusTexto = "✅ *¡Ya reclamaste tu bonus de hoy!*";
  } else if (todasCompletas) {
    bonusTexto = "🎉 *¡Todas listas! Usa `/misiones reclamar` para tu bonus!*";
  } else {
    bonusTexto = `🔲 Completa las ${totalMisiones} misiones para desbloquear`;
  }

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("📋 Misiones del Día")
    .setDescription(
      `${bostezo}` +
        `¡Estas son tus misiones de hoy, corazoncito! Cumple todas y te doy un regalito extra.\n\n` +
        `${listaMisiones}\n\n` +
        `─────────────────────\n` +
        `🏆 **Bonus por completar todas:** ${BONUS_COMPLETAR_TODAS.monedas} 🪙 + ${BONUS_COMPLETAR_TODAS.xp} XP\n` +
        `${bonusTexto}`
    )
    .addFields({
      name: "📊 Progreso general",
      value: `**${completadas}/${totalMisiones}** misiones completadas`,
      inline: true,
    })
    .addFields({
      name: "📅 Fecha",
      value: hoy,
      inline: true,
    });

  return interaction.editReply({ embeds: [embed] });
}

// ── /misiones reclamar ───────────────────────────────────────────────

async function reclamarBonusMisiones(interaction, userId, bostezo) {
  const hoy = getFechaChile();
  const resultado = await reclamarBonus(userId, hoy);

  if (resultado.ok) {
    const embed = crearEmbed(CONFIG.COLORES.DORADO)
      .setTitle("🎊 ¡Bonus de Misiones Reclamado!")
      .setDescription(
        `${bostezo}` +
          `¡Wena, completaste TODAS las misiones del día! Annie está orgullosísima de ti, tesoro. 🌟\n\n` +
          `💰 **+${resultado.bonus.monedas} moneditas** depositadas en tu bolsillo\n` +
          `✨ **+${resultado.bonus.xp} XP** de experiencia\n\n` +
          `*Annie te da un aplauso desde la oficinita.* 👏`
      );
    return interaction.editReply({ embeds: [embed] });
  }

  // Manejar razones de rechazo
  let titulo, descripcion;

  switch (resultado.razon) {
    case "ya_reclamado":
      titulo = "⏳ ¡Ya reclamaste tu bonus hoy!";
      descripcion =
        `${bostezo}` +
        `Oye, ya te di tu regalito de hoy po, corazón. ¡Mañana hay misiones nuevas y bonus fresquito!`;
      break;

    case "incompletas":
      titulo = "📋 ¡Aún te faltan misiones!";
      descripcion =
        `${bostezo}` +
        `Todavía no has terminado todas las misiones del día, cielito. ` +
        `Usa \`/misiones ver\` para ver cuáles te faltan. ¡Tú puedes!`;
      break;

    case "no_misiones":
      titulo = "📋 ¡No tienes misiones aún!";
      descripcion =
        `${bostezo}` +
        `Parece que no has visto tus misiones de hoy. Usa \`/misiones ver\` para generarlas y empezar a completarlas.`;
      break;

    default:
      titulo = "❌ ¡Algo salió raro!";
      descripcion =
        `${bostezo}` +
        `Pucha, algo se enredó con las misiones. Inténtalo de nuevo en un ratito, tesoro.`;
      break;
  }

  const embed = crearEmbed(CONFIG.COLORES.ROJO).setTitle(titulo).setDescription(descripcion);
  return interaction.editReply({ embeds: [embed] });
}
