import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { getGameId, saveGameId } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
    .setName("admin-linkid")
    .setDescription("Vincula un Game ID a un usuario (Solo Admins)")
    .addUserOption(o => o.setName("usuario").setDescription("El usuario al que vincular").setRequired(true))
    .addStringOption(o => o.setName("game_id").setDescription("El Game ID del usuario").setRequired(true));

export async function execute(interaction, bostezo) {
    if (!interaction.member.permissions.has("Administrator")) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("🚫 Sin permisos")
            .setDescription("Ay, tesorito... solo los administradores pueden vincular IDs del juego.");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const usuario = interaction.options.getUser("usuario");
    const gameId = interaction.options.getString("game_id");

    try {
        await saveGameId(usuario.id, gameId);

        const embed = crearEmbed(CONFIG.COLORES.VERDE)
            .setTitle("🎮 Game ID Vinculado")
            .setDescription(`${bostezo}¡Listo, corazón! He anotado el Game ID en mi libretita. 📝`)
            .setThumbnail(usuario.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "👤 Usuario", value: `${usuario}`, inline: true },
                { name: "🎮 Game ID", value: `\`${gameId}\``, inline: true }
            );

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (err) {
        console.error("Error en /linkid:", err);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ Error al vincular")
            .setDescription("Ocurrió un error al guardar el Game ID. Revisa los logs, corazón.");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
