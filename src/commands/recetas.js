import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CONFIG } from "../config.js";
import { esTodos } from "../data.js";
import { db } from "../db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("recetas")
    .setDescription("Consulta las recetas de cocina del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre de la receta o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.NARANJA;
    const em = EMOJI_CATEGORIA.recetas;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM recetas ORDER BY id ASC");
        const items = result.rows.map(row => [row.id, {
            rareza: row.rareza,
            nivel_receta: row.nivel_receta,
            ingredientes: row.ingredientes,
            valores: JSON.parse(row.valores || "[]"), // Assuming valores is an array string
            costo: row.costo,
            energia: JSON.parse(row.energia || "{}") // Assuming energia is an object string
        }]);

        return enviarPaginado({
            interaction,
            baseEmbed: crearEmbed(color),
            items,
            itemsPorPagina: 8,
            titulo: `${em.titulo} Recetas de cocina ${em.titulo}`,
            descripcion: "¡Huele a pancito recién horneado! 🥖 Mira qué de cosas ricas podemos preparar:",
            content: bostezo,
            renderItem: ([nombre, r]) => ({
                name: `${em.icono} ${nombre}`,
                value: `**✨ Rareza:** ${r.rareza || "--"} | **⭐ Nivel:** ${r.nivel_receta || "--"}\n**🥣 Ingredientes:** ${r.ingredientes || "--"}\n**⚡ Energía:** ${r.energia?.base || "--"}`,
            }),
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM recetas WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("recetas", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const r = {
        rareza: row.rareza,
        nivel_receta: row.nivel_receta,
        ingredientes: row.ingredientes,
        valores: JSON.parse(row.valores || "[]"), // Assuming valores is an array string
        costo: row.costo,
        energia: JSON.parse(row.energia || "{}") // Assuming energia is an object string
    };

    const stars = ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"];
    const valoresStr = r.valores && Array.isArray(r.valores) ? r.valores.map((v, i) => `${stars[i]}: ${v.toLocaleString("es-CL")} monedas`).join("\n") : "--";

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} ${row.id}`)
        .setDescription(`Una recetita nivel **${r.nivel_receta || "--"}**... ¡Qué rico, testoro! 🍰`)
        .addFields(
            { name: "🧂 Ingredientes", value: r.ingredientes, inline: false },
            { name: "💰 Valores de Venta", value: valoresStr, inline: true },
            { name: "💲 Costo Original", value: String(r.costo ?? "Requiere recetas previas"), inline: true },
        );

    if (row.energia && row.energia !== "null") {
        const data = JSON.parse(row.energia);
        if (Array.isArray(data)) {
            embed.addFields([{ name: "Energía", value: data.join(", "), inline: true }]);
        } else {
            if (data.base) {
                embed.addFields([{ name: "Energía", value: `${data.base}`, inline: true }]);
            }
            if (data.buff) {
                embed.addFields([{ name: "Buff", value: data.buff, inline: true }]);
            }
        }
    }

    agregarNarrativa(embed, "recetas");

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`col_recetas_${row.id}`)
            .setLabel("✅ ¡La aprendí!")
            .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ content: bostezo, embeds: [embed], components: [actionRow] });
}
