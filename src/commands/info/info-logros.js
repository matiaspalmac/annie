import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { esTodos } from "../../core/data.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../../core/utils.js";

const CATEGORIA_EMOJI = {
    pesca: "🎣", mineria: "⛏️", recoleccion: "🌿", caza: "🐛",
    fotografia: "📸", cocina: "🍳", exploracion: "🗺️", comercio: "🛒",
    social: "👥", casino: "🎰", general: "🏆"
};

export const data = new SlashCommandBuilder()
    .setName("logros")
    .setDescription("Consulta los logros y títulos del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del logro o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.DORADO;
    const em = EMOJI_CATEGORIA.logros;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM logros ORDER BY id ASC");
        const items = result.rows.map(row => [row.id, {
            categoria: row.categoria,
            requisito: row.requisito,
            titulo: row.titulo,
            nota: row.nota
        }]);

        return enviarPaginado({
            interaction,
            baseEmbed: crearEmbed(color),
            items,
            itemsPorPagina: 10,
            titulo: `${em.titulo} Logros de Heartopia ${em.titulo}`,
            descripcion: "Metas lindas que puedes alcanzar en el pueblito. \u00a1Tú puedes, tesoro! 🌸",
            content: bostezo,
            renderItem: ([nombre, l]) => {
                const catEmoji = CATEGORIA_EMOJI[String(l.categoria).toLowerCase()] || "🏆";
                return {
                    name: `${catEmoji} ${nombre}`,
                    value: `**${l.titulo || "Logro secreto"}**\n📋 ${l.requisito} | 📂 ${l.categoria}`
                };
            }
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM logros WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("logros", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const l = {
        categoria: row.categoria,
        requisito: row.requisito,
        titulo: row.titulo,
        titulo_recompensa: row.titulo_recompensa,
        consejos: row.consejos
    };

    const catEmoji = CATEGORIA_EMOJI[String(row.categoria || "").toLowerCase()] || "🏆";

    const embed = crearEmbed(color)
        .setTitle(`🏆 ${row.id}`)
        .setDescription(
            `${catEmoji} **${l.titulo_recompensa || "Logro sin título"}** — Categoría: **${l.categoria}**`
        )
        .addFields(
            { name: "📋 Requisito", value: l.requisito || "--", inline: false },
        );
    if (l.titulo_recompensa) {
        embed.addFields({ name: "🥇 Título desbloqueado", value: `**${l.titulo_recompensa}**`, inline: true });
    }
    if (l.consejos) {
        embed.addFields({ name: "💡 Consejos de Annie", value: l.consejos, inline: false });
    }

    agregarNarrativa(embed, "logros");

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`col_logros_${row.id}`)
            .setLabel("✅ ¡Lo conseguí!")
            .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ content: bostezo, embeds: [embed], components: [actionRow] });
}
