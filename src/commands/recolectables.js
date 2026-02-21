import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config.js";
import { esTodos } from "../data.js";
import { db } from "../db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("recolectables")
    .setDescription("Consulta los recursos recolectables del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del recurso o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.OLIVA;
    const em = EMOJI_CATEGORIA.recolectables;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM recolectables ORDER BY id ASC");
        const items = result.rows.map(row => [row.id, {
            ubicacion: row.ubicacion,
            precio_venta: row.precio_venta,
            ganancia_energia: row.ganancia_energia
        }]);

        return enviarPaginado({
            interaction,
            baseEmbed: crearEmbed(color),
            items,
            itemsPorPagina: 12,
            titulo: `${em.titulo} Recolectables del pueblito ${em.titulo}`,
            descripcion: "Cositas que la naturaleza nos regala. Búscalas paseando.",
            content: bostezo,
            renderItem: ([nombre, data]) => ({
                name: `${em.icono} ${nombre}`,
                value: `**${data.ubicacion}**\n💰 Precio: ${data.precio_venta ?? "--"} | ⚡ Energía: ${data.ganancia_energia ?? "--"}`,
            }),
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM recolectables WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("recolectables", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const data = {
        ubicacion: row.ubicacion,
        precio_venta: row.precio_venta,
        ganancia_energia: row.ganancia_energia
    };

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} ${row.id}`)
        .setDescription(`Suele encontrarse en **${data.ubicacion}**`)
        .addFields(
            { name: "💰 Precio de venta", value: String(data.precio_venta), inline: true },
            { name: "⚡ Energía que otorga", value: String(data.ganancia_energia ?? "--"), inline: true },
        );

    agregarNarrativa(embed, "recolectables");

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`col_recolectables_${row.id}`)
            .setLabel("✅ ¡Lo recolecté!")
            .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ content: bostezo, embeds: [embed], components: [actionRow] });
}
