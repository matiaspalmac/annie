import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { isEstrellaActiva, setEstrellaActiva } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
    .setName("deseo")
    .setDescription("Pide un deseo rápido si viste caer una estrella fugaz");

export async function execute(interaction, bostezo) {
    if (!isEstrellaActiva()) {
        const embed = crearEmbed(CONFIG.COLORES.CIELO)
            .setTitle("🌌 El cielo está tranquilo...")
            .setDescription(`${bostezo} Pucha corazón... ahora mismo no hay ninguna estrella cayendo por el cielo del pueblito.\n\n*Mantén los ojos abiertos — las estrellas fugaces son muy impredecibles y aparecen de repente.*`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Consumir la estrella
    setEstrellaActiva(false);

    const xpGanada = Math.floor(Math.random() * 500) + 200;       // 200–700 XP
    const monedasGanadas = Math.floor(Math.random() * 30) + 10;   // 10–40 monedas

    try {
        await db.execute({
            sql: `INSERT INTO usuarios (id, monedas, xp, nivel)
                  VALUES (?, ?, ?, 1)
                  ON CONFLICT(id) DO UPDATE SET
                    xp = usuarios.xp + excluded.xp,
                    monedas = usuarios.monedas + excluded.monedas`,
            args: [interaction.user.id, monedasGanadas, xpGanada]
        });

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("✨ ¡Deseo Cumplido!")
            .setDescription(
                `¡<@${interaction.user.id}> fue el primero en alcanzar la estrella fugaz!\n\n` +
                `*El pueblito entero vio el destello y sonrió... ¡La estrella escuchó tu deseo!* 🌠`
            )
            .addFields(
                { name: "⭐ XP Ganado", value: `**+${xpGanada}**`, inline: true },
                { name: "💰 Moneditas ganadas", value: `**+${monedasGanadas} 🪙**`, inline: true }
            );

        await interaction.reply({
            content: "🌠 ¡¡Tenemos un vecinito afortunado!! ¡Lanzó su deseo primero!",
            embeds: [embed]
        });
    } catch (e) {
        console.error("Error al dar premio de estrella:", e);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("💫 ¡La estrella se me escapó!")
            .setDescription(`${bostezo}Ups, la estrellita se me resbaló de las manos... avísale a los admins, corazón.`);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
