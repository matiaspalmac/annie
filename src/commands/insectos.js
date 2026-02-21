import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CONFIG } from "../config.js";
import { esTodos } from "../data.js";
import { db } from "../db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("insectos")
    .setDescription("Consulta los insectos del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del insecto o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.INSECTO;
    const em = EMOJI_CATEGORIA.insectos;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM insectos ORDER BY id ASC");
        const items = result.rows.map(row => [row.id, {
            ubicacion: row.ubicacion,
            tipo: row.tipo,
            nivel: row.nivel,
            clima: JSON.parse(row.clima || "[]"),
            horario: JSON.parse(row.horario || "[]")
        }]);

        return enviarPaginado({
            interaction,
            baseEmbed: crearEmbed(color),
            items,
            itemsPorPagina: 12,
            titulo: `${em.titulo} Insectos del pueblito ${em.titulo}`,
            descripcion: "Todos los bichitos que Annie ha visto. Red lista y a buscar.",
            content: bostezo,
            renderItem: ([nombre, data]) => ({
                name: `${em.icono} ${nombre}`,
                value: `**${data.ubicacion}**\n⭐ Nivel ${data.nivel} | 🎯 ${data.tipo}\n${em.clima} Clima: ${data.clima?.join(", ") || "--"}\n${em.horario} Horario: ${data.horario?.join(", ") || "--"}`,
            }),
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM insectos WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("insectos", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const data = {
        tipo: row.tipo,
        ubicacion: row.ubicacion,
        nivel: row.nivel,
        clima: JSON.parse(row.clima || "[]"),
        horario: JSON.parse(row.horario || "[]")
    };

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} ${row.id}`)
        .setDescription(`**${data.tipo}** en **${data.ubicacion}**`)
        .addFields(
            { name: "⭐ Nivel", value: String(data.nivel), inline: true },
            { name: `${em.clima} Clima`, value: data.clima?.join(", ") || "--", inline: true },
            { name: `${em.horario} Horario`, value: data.horario?.join(", ") || "--", inline: true },
        );

    agregarNarrativa(embed, "insectos");

    // Add Collections Button
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`col_insectos_${row.id}`)
            .setLabel("✅ ¡Lo atrapé!")
            .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ content: bostezo, embeds: [embed], components: [actionRow] });
}
