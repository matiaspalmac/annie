import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { lanzarEstrellaFugaz } from "../../core/utils.js";
import { lanzarTriviaAleatoria } from "../../features/trivia.js";

export const data = new SlashCommandBuilder()
    .setName("evento")
    .setDescription("Lanza un evento especial en el pueblito (Admin).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option.setName("tipo")
            .setDescription("El tipo de evento a lanzar")
            .setRequired(true)
            .addChoices(
                { name: "🌠 Estrella Fugaz", value: "estrella" },
                { name: "🧠 Trivia del Pueblito", value: "trivia" }
            )
    );

export async function execute(interaction, bostezo) {
    const tipo = interaction.options.getString("tipo");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        if (tipo === "estrella") {
            lanzarEstrellaFugaz(interaction.client);
            await interaction.followUp("🌠 ¡Estrella fugaz lanzada con éxito!");
        } else if (tipo === "trivia") {
            lanzarTriviaAleatoria(interaction.client);
            await interaction.followUp("🧠 ¡Trivia lanzada con éxito!");
        }
    } catch (error) {
        console.error("Error al lanzar evento:", error);
        await interaction.followUp("Hubo un problema al lanzar el evento.");
    }
}
