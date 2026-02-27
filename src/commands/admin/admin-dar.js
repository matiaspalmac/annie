import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

const OWNER_ID = "457299957955821569";

export const data = new SlashCommandBuilder()
    .setName("admin-dar")
    .setDescription("Otorga XP y/o Moneditas a un vecino desde la bóveda celestial (Solo Owner)")
    .addUserOption(o => o.setName("vecino").setDescription("El vecinito afortunado").setRequired(true))
    .addIntegerOption(o => o.setName("monedas").setDescription("Cantidad de moneditas a regalar").setMinValue(1))
    .addIntegerOption(o => o.setName("xp").setDescription("Cantidad de experiencia a regalar").setMinValue(1));

export async function execute(interaction) {
    if (interaction.user.id !== OWNER_ID) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("🚫 ¡Acceso denegado!")
            .setDescription("Solo el Creador Supremo del Pueblito puede abrir la bóveda mágica. ¡Ale, ale!");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const targetUser = interaction.options.getUser("vecino");
    const monedasOpcionales = interaction.options.getInteger("monedas") || 0;
    const xpOpcional = interaction.options.getInteger("xp") || 0;

    if (monedasOpcionales === 0 && xpOpcional === 0) {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("⚠️ ¡Nada que dar!")
            .setDescription("Tienes que escribir al menos un valor de monedas o XP para regalar, corazón.");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    try {
        await db.execute({
            sql: `INSERT INTO usuarios (id, username, monedas, xp, nivel)
                  VALUES (?, ?, ?, ?, 1)
                  ON CONFLICT(id) DO UPDATE SET
                  monedas = usuarios.monedas + ?,
                  xp = usuarios.xp + ?`,
            args: [targetUser.id, targetUser.username, monedasOpcionales, xpOpcional, monedasOpcionales, xpOpcional]
        });

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("✨ ¡Bóveda Celestial Abierta!")
            .setDescription(`Has enviado un regalo divino a **${targetUser.username}** desde la bóveda. 🌟`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                ...(monedasOpcionales > 0 ? [{ name: "🪙 Moneditas enviadas", value: `**+${monedasOpcionales.toLocaleString()}**`, inline: true }] : []),
                ...(xpOpcional > 0 ? [{ name: "✨ XP enviado", value: `**+${xpOpcional.toLocaleString()}**`, inline: true }] : []),
                { name: "👤 Destinatario", value: `<@${targetUser.id}>`, inline: true }
            );

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (e) {
        console.error("Error en comando /dar:", e);
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("❌ ¡Error en la bóveda!")
            .setDescription("Ocurrió un error al intentar repartir los regalos divinos. Revisa los logs.");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
