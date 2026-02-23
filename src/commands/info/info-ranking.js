import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed, agregarNarrativa } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Muestra a los vecinos más aplicaditos del pueblito")
    .addStringOption(o =>
        o.setName("tipo")
            .setDescription("¿Qué ranking quieres ver?")
            .setRequired(false)
            .addChoices(
                { name: "Experiencia (XP)", value: "xp" },
                { name: "Moneditas", value: "monedas" }
            )
    );

export async function execute(interaction, bostezo) {
    const tipo = interaction.options.getString("tipo") || "xp";
    const esXP = tipo === "xp";

    const result = await db.execute(`
        SELECT id, nivel, xp, monedas 
        FROM usuarios 
        ORDER BY ${esXP ? "xp" : "monedas"} DESC 
        LIMIT 10
    `);

    if (result.rows.length === 0) {
        return interaction.reply({
            content: `${bostezo} Aún no hay nadie paseando por el pueblito... ¡se el primero!`,
            flags: MessageFlags.Ephemeral
        });
    }

    const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle(esXP ? "🏆 Ranking de Vecinos - Mayor XP" : "💰 Ranking de Vecinos - Más Moneditas")
        .setDescription("Aquí están los corazones más activos de Heartopia. ¡Sigan así de lindos!");

    let leaderboard = "";

    result.rows.forEach((row, index) => {
        let medalla = `${index + 1}.`;
        if (index === 0) medalla = "🥇";
        else if (index === 1) medalla = "🥈";
        else if (index === 2) medalla = "🥉";

        const valor = esXP ? `✨ **${row.xp} XP** (Nivel ${row.nivel})` : `💰 **${row.monedas} Moneditas**`;
        leaderboard += `${medalla} <@${row.id}> — ${valor}\n\n`;
    });

    embed.addFields([{ name: "Top 10", value: leaderboard }]);
    agregarNarrativa(embed, "general");

    return interaction.reply({ content: bostezo, embeds: [embed] });
}
