import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { getGameId, saveGameId } from "../../services/db.js";
import { crearEmbed, agregarNarrativa } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
    .setName("linkid")
    .setDescription("Vincula un Game ID a un usuario (Solo Admins)")
    .addUserOption(o => o.setName("usuario").setDescription("El usuario al que vincular").setRequired(true))
    .addStringOption(o => o.setName("game_id").setDescription("El Game ID del usuario").setRequired(true));

export async function execute(interaction, bostezo) {
    if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({
            content: "Ay, tesorito... solo los administradores pueden vincular IDs del juego.",
            flags: MessageFlags.Ephemeral,
        });
    }

    const usuario = interaction.options.getUser("usuario");
    const gameId = interaction.options.getString("game_id");

    try {
        await saveGameId(usuario.id, gameId);

        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("✨ Game ID Vinculado ✨")
            .setDescription(`Listo, corazón! He vinculado el Game ID **${gameId}** al usuario ${usuario}.`);

        agregarNarrativa(embed, "general");
        return interaction.reply({ content: bostezo, embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (err) {
        throw err;
    }
}
