import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
  .setName("template")
  .setDescription("Plantilla base para crear nuevos comandos");

export async function execute(interaction, bostezo) {
  await interaction.deferReply();

  try {
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("🧩 Plantilla de comando")
      .setDescription("Este comando es una base. Cámbiale nombre, opciones y lógica.");

    return interaction.followUp({ content: bostezo, embeds: [embed] });
  } catch (error) {
    console.error("Error en comando /template:", error);
    return interaction.followUp({
      content: "Ocurrió un error en la plantilla.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

// Opcional: habilita autocomplete cuando tu comando lo necesite
// export async function autocomplete(interaction) {
//   await interaction.respond([]);
// }
