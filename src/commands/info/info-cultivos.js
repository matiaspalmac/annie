import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { esTodos } from "../../core/data.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
    .setName("cultivos")
    .setDescription("Consulta los cultivos y flores del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del cultivo o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.NARANJA;
    const em = EMOJI_CATEGORIA.cultivos;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM cultivos ORDER BY id ASC");
        const items = result.rows.map(row => [row.id, {
            tiempo_crecimiento: row.tiempo_crecimiento,
            nivel_jardineria: row.nivel_jardineria,
            venta_semilla: row.venta_semilla,
            compra_semilla: row.compra_semilla
        }]);

        return enviarPaginado({
            interaction,
            baseEmbed: crearEmbed(color),
            items,
            itemsPorPagina: 12,
            titulo: `${em.titulo} Cultivos del pueblito ${em.titulo}`,
            descripcion: "Semillitas que crecen con amor y paciencia.",
            content: bostezo,
            renderItem: ([nombre, data]) => ({
                name: `${em.icono} ${nombre}`,
                value: `⏳ **${data.tiempo_crecimiento} min** | ⭐ Nivel ${data.nivel_jardineria}\n💰 Compra: ${data.compra_semilla || "--"} | 🤝 Venta: ${data.venta_semilla || "--"}`,
            }),
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM cultivos WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("cultivos", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const data = {
        tiempo_crecimiento: row.tiempo_crecimiento,
        nivel_jardineria: row.nivel_jardineria,
        venta_semilla: row.venta_semilla,
        compra_semilla: row.compra_semilla
    };

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} ${row.id}`)
        .setDescription("Recuerda regar la plantita todos los días, tesoro.");

    if (row.tiempo_crecimiento) {
        embed.addFields([{ name: "Crecimiento", value: `${row.tiempo_crecimiento}`, inline: true }]);
    }
    embed.addFields(
        { name: "⭐ Nivel jardinería", value: String(data.nivel_jardineria), inline: true },
        { name: "💰 Venta semilla", value: String(data.venta_semilla), inline: true },
        { name: "🛒 Compra semilla", value: String(data.compra_semilla), inline: true },
    );

    agregarNarrativa(embed, "cultivos");

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`col_cultivos_${row.id}`)
            .setLabel("✅ ¡Lo coseché!")
            .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ content: bostezo, embeds: [embed], components: [actionRow] });
}
