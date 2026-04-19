import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";

const CLIMA_EMOJI = {
    soleado: "☀️",
    nublado: "⛅",
    lluvia: "🌧️",
    tormenta: "⛈️",
    niebla: "🌫️",
    viento: "💨",
    nieve: "❄️",
    despejado: "🌤️",
};

function getClimaEmoji(tipo) {
    const tipoBajo = String(tipo || "").toLowerCase();
    for (const [clave, emoji] of Object.entries(CLIMA_EMOJI)) {
        if (tipoBajo.includes(clave)) return emoji;
    }
    return "🌡️";
}

function getClimaColor(tipo) {
    const t = String(tipo || "").toLowerCase();
    if (t.includes("lluv") || t.includes("tormenta")) return CONFIG.COLORES.AZUL;
    if (t.includes("soleado") || t.includes("despejado")) return CONFIG.COLORES.DORADO;
    if (t.includes("nieve")) return CONFIG.COLORES.CIELO;
    return CONFIG.COLORES.CIELO;
}

export const data = new SlashCommandBuilder()
    .setName("clima")
    .setDescription("Consulta qué clima hace hoy en el pueblito");

export async function execute(interaction, bostezo) {
    await interaction.deferReply();

    try {
        const result = await db.execute("SELECT * FROM clima WHERE id = 'hoy'");

        if (result.rows.length === 0) {
            const embed = crearEmbed(CONFIG.COLORES.CIELO)
                .setTitle("🌡️ ¡Sin reporte de hoy!")
                .setDescription(
                    `${bostezo} Ay, corazoncito... parece que la oficina del clima no me ha mandado el reporte de hoy todavía.\n\n` +
                    `¡Dile a un admin que actualice el clima del pueblito!`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const hoy = result.rows[0];
        const timeline = JSON.parse(hoy.timeline || "[]");
        const climaEmoji = getClimaEmoji(hoy.tipo);
        const color = getClimaColor(hoy.tipo);

        const embed = crearEmbed(color)
            .setTitle(`${climaEmoji} Clima del Pueblito — Hoy`)
            .setDescription(
                `${bostezo}Aquí tienes el reporte del tiempo para hoy en la Aldea, corazón. 🌸`
            )
            .addFields(
                {
                    name: `${climaEmoji} Tipo de clima`,
                    value: `**${hoy.tipo || "Desconocido"}**`,
                    inline: true
                },
                ...(hoy.temperatura ? [{ name: "🌡️ Temperatura", value: `**${hoy.temperatura}**`, inline: true }] : []),
                ...(hoy.descripcion ? [{ name: "📋 Descripción", value: hoy.descripcion, inline: false }] : [])
            );

        // Efectos del clima en el juego
        const t = String(hoy.tipo || "").toLowerCase();
        const efectos = [];
        if (t.includes("lluv")) efectos.push("🐛 +6% suerte en **capturar**");
        if (t.includes("viento")) { efectos.push("🐛 +3% suerte en **capturar**"); efectos.push("🌳 +3% monedas al **talar**"); }
        if (t.includes("soleado")) efectos.push("🐝 +2% chance de Abejas al **talar**");
        if (t.includes("tormenta")) efectos.push("🌊 +5% peces raros al **pescar**");
        if (efectos.length > 0) {
            embed.addFields({ name: "🎮 Efectos en el juego", value: efectos.join("\n"), inline: false });
        }

        if (timeline.length > 0) {
            embed.addFields({
                name: "🕐 Pronóstico por hora",
                value: timeline.map(h => `\`${String(h.hora).padStart(2, "0")}:00\` ${h.texto}`).join("\n"),
                inline: false
            });
        }

        return interaction.editReply({ embeds: [embed] });

    } catch (e) {
        console.error("Error comando clima:", e.message);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡El termómetro se rompió!")
            .setDescription("Ups, el termómetro se me cayó y no puedo ver el clima ahora mismo...");
        return interaction.editReply({ embeds: [embed] });
    }
}
