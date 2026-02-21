import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed, agregarNarrativa } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("clima")
    .setDescription("Consulta qué clima hace hoy en el pueblito");

export async function execute(interaction, bostezo) {
    try {
        const result = await db.execute("SELECT * FROM clima WHERE id = 'hoy'");

        if (result.rows.length === 0) {
            return interaction.reply({
                content: `${bostezo} Ay, corazoncito... parece que la oficina del clima (la wiki) no me ha mandado el reporte de hoy todavía. ¡Dile a un admin que anote el clima allá!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const hoy = result.rows[0];
        const timeline = JSON.parse(hoy.timeline || "[]");

        const embed = crearEmbed(CONFIG.COLORES.CIELO)
            .setTitle(`☁️ Clima del Pueblito — Hoy`)
            .setDescription(`**${hoy.tipo || "--"}**\n${hoy.descripcion || ""}`);

        if (timeline.length > 0) {
            embed.addFields({
                name: "Pronóstico por hora",
                value: timeline.map(h => `${h.hora}:00 — ${h.texto}`).join("\n"),
            });
        }

        agregarNarrativa(embed, "clima");

        return interaction.reply({ content: bostezo, embeds: [embed] });

    } catch (e) {
        console.error("Error comando clima:", e.message);
        return interaction.reply({ content: "Ups, el termómetro se me cayó y no puedo ver el clima ahora mismo...", flags: MessageFlags.Ephemeral });
    }
}
