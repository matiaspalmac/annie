import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";

const MEDALLAS = ["🥇", "🥈", "🥉"];

export const data = new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Muestra a los vecinos más aplicaditos del pueblito")
    .addStringOption(o =>
        o.setName("tipo")
            .setDescription("¿Qué ranking quieres ver?")
            .setRequired(false)
            .addChoices(
                { name: "⭐ Experiencia (XP)", value: "xp" },
                { name: "💰 Moneditas", value: "monedas" }
            )
    );

export async function execute(interaction, bostezo) {
    const tipo = interaction.options.getString("tipo") || "xp";
    const esXP = tipo === "xp";

    await interaction.deferReply();

    const result = await db.execute(`
        SELECT id, nivel, xp, monedas
        FROM usuarios
        ORDER BY ${esXP ? "xp" : "monedas"} DESC
        LIMIT 10
    `);

    if (result.rows.length === 0) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🏆 Ranking desierto...")
            .setDescription(`${bostezo} Aún no hay nadie paseando por el pueblito... ¡sé el primero en aparecer aquí!`);
        return interaction.editReply({ embeds: [embed] });
    }

    const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle(esXP
            ? "🏆 Ranking — Vecinos con más XP"
            : "💰 Ranking — Vecinos más adinerados")
        .setDescription(
            esXP
                ? "Los corazones más constantes y aventureros del pueblito. ¡Sigan así de lindos!"
                : "Los vecinos más ricos del pueblito. ¡A ver si los alcanzan!"
        );

    result.rows.forEach((row, index) => {
        const medalla = MEDALLAS[index] ?? `**${index + 1}.**`;
        const valor = esXP
            ? `✨ \`${Number(row.xp).toLocaleString("es-CL")} XP\`  ·  Nivel **${row.nivel}**`
            : `💰 \`${Number(row.monedas).toLocaleString("es-CL")} 🪙\``;

        embed.addFields({
            name: `${medalla} <@${row.id}>`,
            value: valor,
            inline: false
        });
    });

    // Mostrar posición del usuario
    const selfRes = await db.execute({
        sql: `SELECT COUNT(*) + 1 AS pos FROM usuarios WHERE ${esXP ? "xp" : "monedas"} > (SELECT ${esXP ? "xp" : "monedas"} FROM usuarios WHERE id = ?)`,
        args: [interaction.user.id]
    });
    const miPos = Number(selfRes.rows[0]?.pos ?? 0);
    if (miPos > 10) {
        embed.addFields({
            name: `📍 Tu posición`,
            value: `Estás en el puesto **#${miPos}** del ranking. ¡Sigue esforzándote!`,
            inline: false
        });
    }

    return interaction.editReply({ embeds: [embed] });
}
