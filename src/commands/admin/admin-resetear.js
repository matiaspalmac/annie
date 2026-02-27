import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

export const data = new SlashCommandBuilder()
    .setName("resetear")
    .setDescription("Resetea los XP y Moneditas de un usuario a 0 (Solo Administradores)")
    .addUserOption(o => o.setName("vecino").setDescription("El vecinito a resetear").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, bostezo) {
    const targetUser = interaction.options.getUser("vecino");

    try {
        const resDb = await db.execute({
            sql: "SELECT id FROM usuarios WHERE id = ?",
            args: [targetUser.id]
        });

        if (resDb.rows.length === 0) {
            const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle("🔍 Vecinito no encontrado")
                .setDescription(`**${targetUser.username}** aún no tiene cuenta en el pueblito. No hay nada que resetear, corazón.`);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        await db.execute({
            sql: "UPDATE usuarios SET xp = 0, monedas = 0, nivel = 1 WHERE id = ?",
            args: [targetUser.id]
        });

        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("🗑️ ¡Reseteo Completado!")
            .setDescription(`Se ha limpiado el perfil de **${targetUser.username}** y sus datos han vuelto a cero.`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "👤 Usuario", value: `<@${targetUser.id}>`, inline: true },
                { name: "💰 Monedas", value: "`0`", inline: true },
                { name: "✨ XP / Nivel", value: "`0 XP / Nivel 1`", inline: true }
            );

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (e) {
        console.error("Error al resetear usuario:", e);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Error al resetear!")
            .setDescription("Ocurrió un error al intentar resetear al usuario. Revisa los logs, corazón.");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
