import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { esTodos } from "../data.js";
import { db } from "../db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("habitantes")
    .setDescription("Consulta los NPCs y habitantes del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del habitante o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.ROSA;
    const em = EMOJI_CATEGORIA.habitantes;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM habitantes ORDER BY id ASC");
        const items = result.rows.map(row => [row.id, {
            rol: row.rol,
            descripcion: row.descripcion,
            ubicacion: row.ubicacion
        }]);

        return enviarPaginado({
            interaction,
            baseEmbed: crearEmbed(color),
            items,
            itemsPorPagina: 10,
            titulo: `${em.titulo} Vecinitos del pueblo ${em.titulo}`,
            descripcion: "Todos los rostros amables que caminan por Heartopia. Diles hola de parte de Annie.",
            content: bostezo,
            renderItem: ([nombre, data]) => ({
                name: `${em.icono} ${nombre}`,
                value: `**${data.rol}** | 📍 ${data.ubicacion}\n_${data.descripcion}_`,
            }),
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM habitantes WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("habitantes", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const data = {
        rol: row.rol,
        descripcion: row.descripcion,
        ubicacion: row.ubicacion
    };

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} ${row.id}`)
        .setDescription(`**${data.rol}**\n${data.descripcion}`)
        .addFields(
            { name: "📝 Descripción", value: data.descripcion, inline: false },
            { name: "📍 Ubicación", value: data.ubicacion, inline: true },
        );

    agregarNarrativa(embed, "habitantes");
    return interaction.reply({ content: bostezo, embeds: [embed] });
}
