import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { getGameId } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

export const data = new SlashCommandBuilder()
    .setName("id")
    .setDescription("Muestra el Game ID vinculado de un usuario")
    .addUserOption(o => o.setName("usuario").setDescription("El usuario a consultar").setRequired(true));

export async function execute(interaction, bostezo) {
    const usuario = interaction.options.getUser("usuario");

    try {
        const gameId = await getGameId(usuario.id);

        if (!gameId) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("📋 Game ID no encontrado")
                .setDescription(
                    `${bostezo}Ay no... no tengo ningún Game ID anotado para ${usuario} en mi libretita.\n\n` +
                    `Un administrador puede vincularlo usando \`/linkid\`.`
                );
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const embed = crearEmbed(CONFIG.COLORES.CIELO)
            .setTitle("🎮 Game ID Encontrado")
            .setThumbnail(usuario.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "👤 Usuario", value: `${usuario}`, inline: true },
                { name: "🎮 Game ID", value: `\`${gameId}\``, inline: true }
            );

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (err) {
        throw err;
    }
}
