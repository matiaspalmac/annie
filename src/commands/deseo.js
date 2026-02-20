import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { isEstrellaActiva, setEstrellaActiva, crearEmbed } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("deseo")
    .setDescription("Pide un deseo rápido si viste caer una estrella fugaz");

export async function execute(interaction, bostezo) {
    if (!isEstrellaActiva()) {
        return interaction.reply({ content: `${bostezo} Pucha corazón... ahora mismo el cielo está tranquilito. No hay ninguna estrella cayendo.`, ephemeral: true });
    }

    // El jugador ganó la carrera, consumimos la estrella
    setEstrellaActiva(false);

    const xpGanada = Math.floor(Math.random() * 500) + 200; // 200 a 700 XP
    const monedasGanadas = Math.floor(Math.random() * 30) + 10; // 10 a 40 monedas

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
            .setDescription(`¡Felicidades <@${interaction.user.id}>!\nHas alcanzado la estrella fugaz antes que nadie.\n\nRecibes:\n⭐ **${xpGanada} XP**\n💰 **${monedasGanadas} Moneditas**`);

        // Reply in the same channel so everyone sees who won
        await interaction.reply({ content: "¡Tenemos un vecinito afortunado!", embeds: [embed] });
    } catch (e) {
        console.error("Error al dar premio de estrella:", e);
        await interaction.reply({ content: "Ups, la estrellita se me resbaló de las manos... avísale a los admins.", ephemeral: true });
    }
}
