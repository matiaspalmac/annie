import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { lanzarTriviaEnCanal, getTopTrivia } from "../../features/trivia.js";

// ── Cooldowns por canal (30 minutos) ─────────────────────────────────────
const COOLDOWN_MS = 30 * 60 * 1000;
const cooldowns = new Map();

const MEDALLAS = ["🥇", "🥈", "🥉"];

export const data = new SlashCommandBuilder()
  .setName("trivia")
  .setDescription("¡Pon a prueba tus conocimientos del pueblito!")
  .addSubcommand((sub) =>
    sub
      .setName("jugar")
      .setDescription("Lanza una pregunta de trivia en este canal.")
  )
  .addSubcommand((sub) =>
    sub
      .setName("ranking")
      .setDescription("Muestra el ranking de los mejores respondedores de trivia.")
  );

export async function execute(interaction, bostezo) {
  const subcomando = interaction.options.getSubcommand();

  if (subcomando === "jugar") {
    return ejecutarJugar(interaction, bostezo);
  }

  if (subcomando === "ranking") {
    return ejecutarRanking(interaction, bostezo);
  }
}

// ── /trivia jugar ─────────────────────────────────────────────────────────

async function ejecutarJugar(interaction, bostezo) {
  const canalId = interaction.channelId;
  const ahora = Date.now();

  // Verificar cooldown por canal
  const ultimoUso = cooldowns.get(canalId) || 0;
  const tiempoRestante = ultimoUso + COOLDOWN_MS - ahora;

  if (tiempoRestante > 0) {
    const minutosRestantes = Math.ceil(tiempoRestante / 60000);
    const embed = crearEmbed(CONFIG.COLORES.ROJO)
      .setTitle("⏳ ¡Calma, corazoncito!")
      .setDescription(
        `${bostezo}Ya hubo una trivia recién en este canal, po.\n\n` +
        `⌛ Espera **${minutosRestantes} minuto${minutosRestantes !== 1 ? "s" : ""}** y lo intentamos de nuevo.`
      );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Registrar cooldown
  cooldowns.set(canalId, ahora);

  // Responder rápido y luego lanzar la trivia en el canal
  await interaction.reply({
    content: "🧠 *Annie busca en su libretita...* ¡Preparando una trivia para el canal!",
    flags: MessageFlags.Ephemeral,
  });

  const canal = interaction.channel;
  if (!canal) {
    return interaction.followUp({
      content: "No pude encontrar el canal, corazón. Intenta de nuevo.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await lanzarTriviaEnCanal(canal);
}

// ── /trivia ranking ───────────────────────────────────────────────────────

async function ejecutarRanking(interaction, bostezo) {
  await interaction.deferReply();

  try {
    const top = await getTopTrivia(10);

    if (!top.length) {
      const embed = crearEmbed(CONFIG.COLORES.ROSA)
        .setTitle("🧠 Ranking de Trivia — Vacío")
        .setDescription(
          `${bostezo}Todavía nadie ha respondido una trivia correctamente... ` +
          `¡Sé el primero en aparecer aquí usando \`/trivia jugar\`!`
        );
      return interaction.editReply({ embeds: [embed] });
    }

    const embed = crearEmbed(CONFIG.COLORES.DORADO)
      .setTitle("🧠 Ranking de Trivia — Los más sabios del pueblito")
      .setDescription(
        "Los vecinitos que más saben de Heartopia. ¡Annie está orgullosa de ustedes! 🌸"
      );

    top.forEach((entry, index) => {
      const medalla = MEDALLAS[index] ?? `**${index + 1}.**`;
      embed.addFields({
        name: `${medalla} <@${entry.ganador_id}>`,
        value: `🧠 **${entry.correctas}** respuesta${entry.correctas !== 1 ? "s" : ""} correcta${entry.correctas !== 1 ? "s" : ""}`,
        inline: false,
      });
    });

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("[Trivia] Error en ranking:", error);
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("❌ ¡Ay, la libretita!")
      .setDescription(
        `${bostezo}Se me enredaron los papeles del ranking. Intenta de nuevo en un ratito, corazón.`
      );
    return interaction.editReply({ embeds: [embed] });
  }
}
