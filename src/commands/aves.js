import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CONFIG } from "../config.js";
import { esTodos } from "../data.js";
import { db } from "../db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("aves")
    .setDescription("Consulta las aves del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del ave o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.AZUL;
    const em = EMOJI_CATEGORIA.aves;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM aves ORDER BY id ASC");
        const items = result.rows.map(row => [row.id, {
            ubicacion: row.ubicacion,
            actividad: row.actividad,
            nivel: row.nivel,
            clima: JSON.parse(row.clima || "[]"),
            horario: JSON.parse(row.horario || "[]")
        }]);

        return enviarPaginado({
            interaction,
            baseEmbed: crearEmbed(color),
            items,
            itemsPorPagina: 12,
            titulo: `${em.titulo} Aves del pueblito ${em.titulo}`,
            descripcion: "Pajaritos hermosos que adornan nuestro cielo. Ven a observarlos.",
            content: bostezo,
            renderItem: ([nombre, data]) => ({
                name: `${em.icono} ${nombre}`,
                value: `**${data.ubicacion}**\n⭐ Nivel ${data.nivel} | 🎭 ${data.actividad}\n${em.clima} Clima: ${data.clima?.join(", ") || "--"}\n${em.horario} Horario: ${data.horario?.join(", ") || "--"}`,
            }),
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM aves WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("aves", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const data = {
        actividad: row.actividad,
        ubicacion: row.ubicacion,
        nivel: row.nivel,
        clima: JSON.parse(row.clima || "[]"),
        horario: JSON.parse(row.horario || "[]")
    };

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} ${row.id}`)
        .setDescription(`**${data.actividad}** en **${data.ubicacion}**`)
        .addFields(
            { name: "⭐ Nivel", value: String(data.nivel), inline: true },
            { name: `${em.clima} Clima`, value: data.clima?.join(", ") || "--", inline: true },
            { name: `${em.horario} Horario`, value: data.horario?.join(", ") || "--", inline: true },
        );

    agregarNarrativa(embed, "aves");

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`col_aves_${row.id}`)
            .setLabel("✅ ¡La vi!")
            .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ content: bostezo, embeds: [embed], components: [actionRow] });
}
