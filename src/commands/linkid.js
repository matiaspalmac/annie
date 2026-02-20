import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { getGameId, saveGameId } from "../db.js";
import { crearEmbed, agregarNarrativa } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("linkid")
    .setDescription("Vincula un Game ID a un usuario (Solo Admins)")
    .addUserOption(o => o.setName("usuario").setDescription("El usuario al que vincular").setRequired(true))
    .addStringOption(o => o.setName("game_id").setDescription("El Game ID del usuario").setRequired(true));

export async function execute(interaction, bostezo) {
    if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({
            content: "Ay, tesorito... solo los administradores pueden vincular IDs del juego.",
            ephemeral: true,
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
        return interaction.reply({ content: bostezo, embeds: [embed], ephemeral: true });
    } catch (err) {
        throw err;
    }
}
