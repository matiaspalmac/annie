import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config.js";
import { esTodos } from "../data.js";
import { db } from "../db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("peces")
    .setDescription("Consulta los peces del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del pez o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.VERDE;
    const em = EMOJI_CATEGORIA.peces;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM peces ORDER BY id ASC");
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
            titulo: `${em.titulo} Todos los peces del pueblito ${em.titulo}`,
            descripcion: "Mira qué lindos están todos reuniditos... Annie los quiere muchísimo.\nVen a pescar con amor cuando los veas.",
            content: bostezo,
            renderItem: ([nombre, pez]) => ({
                name: `${em.icono} ${nombre}`,
                value: `**${pez.ubicacion}**\n⭐ Nivel ${pez.nivel ?? "--"} | 🐟 Tipo: ${pez.tipo ?? "--"}\n${em.clima} Clima: ${pez.clima?.join(", ") || "--"}\n${em.horario} Horario: ${pez.horario?.join(", ") || "--"}`,
            }),
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM peces WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("peces", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const pez = {
        tipo: row.tipo,
        ubicacion: row.ubicacion,
        nivel: row.nivel,
        clima: JSON.parse(row.clima || "[]"),
        horario: JSON.parse(row.horario || "[]")
    };

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} ${row.id}`)
        .setDescription(`**${pez.tipo || "--"}** en **${pez.ubicacion}**`)
        .addFields(
            { name: "⭐ Nivel", value: String(pez.nivel ?? "--"), inline: true },
            { name: `${em.clima} Clima`, value: pez.clima?.join(", ") || "--", inline: true },
            { name: `${em.horario} Horario`, value: pez.horario?.join(", ") || "--", inline: true },
        );

    agregarNarrativa(embed, "peces");

    // Add Collections Button
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`col_peces_${row.id}`)
            .setLabel("✅ ¡Lo tengo!")
            .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ content: bostezo, embeds: [embed], components: [actionRow] });
}
