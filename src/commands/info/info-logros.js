import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { esTodos } from "../../core/data.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../../core/utils.js";

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
            descripcion: "Metas lindas que puedes alcanzar en el pueblito. ¡Tú puedes, tesoro!",
            content: bostezo,
            renderItem: ([nombre, l]) => ({
                name: `${em.icono} ${nombre}`,
                value: `**${l.titulo || "--"}**\n🏆 ${l.requisito} | 📂 ${l.categoria}`,
            }),
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

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} Logro: ${row.id}`)
        .setDescription(`**Título recompensa:** ${l.titulo_recompensa || "Ninguno"}\n**Categoría:** ${l.categoria}`)
        .addFields(
            { name: "📋 Requisito", value: l.requisito, inline: false },
        );
    if (row.titulo_recompensa) {
        embed.addFields([{ name: "Recompensa", value: row.titulo_recompensa, inline: true }]);
    }
    if (row.consejos) {
        embed.addFields([{ name: "Consejos", value: row.consejos, inline: false }]);
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
