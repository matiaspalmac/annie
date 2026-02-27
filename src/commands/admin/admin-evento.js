import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { lanzarEstrellaFugaz } from "../../core/utils.js";
import { lanzarTriviaAleatoria } from "../../features/trivia.js";

export const data = new SlashCommandBuilder()
    .setName("admin-evento")
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
            const embed = crearEmbed(CONFIG.COLORES.DORADO)
                .setTitle("🌠 ¡Estrella Fugaz Lanzada!")
                .setDescription(
                    `${bostezo}¡Zuum! La estrella fugaz ya está surcando el cielo del pueblito.\n\n` +
                    `Los vecinos tienen unos segundos para usar \`/deseo\` antes de que desaparezca. ¡Que tengan suerte!`
                );
            return interaction.editReply({ embeds: [embed] });

        } else if (tipo === "trivia") {
            lanzarTriviaAleatoria(interaction.client);
            const embed = crearEmbed(CONFIG.COLORES.CIELO)
                .setTitle("🧠 ¡Trivia del Pueblito Lanzada!")
                .setDescription(
                    `${bostezo}¡Ding ding! La trivia ya apareció en el canal correspondiente.\n\n` +
                    `¡Los vecinos más listos del pueblito van a brillar!`
                );
            return interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        console.error("Error al lanzar evento:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("❌ ¡Error al lanzar evento!")
            .setDescription("Hubo un problema al lanzar el evento. Revisa los logs, corazón.");
        return interaction.editReply({ embeds: [embed] });
    }
}
