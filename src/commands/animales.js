import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { CONFIG } from "../config.js";
import { esTodos } from "../data.js";
import { db } from "../db.js";
import { crearEmbed, crearEmbedError, agregarNarrativa, enviarPaginado, EMOJI_CATEGORIA } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("animales")
    .setDescription("Consulta los animales del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del animal o 'todos'").setAutocomplete(true).setRequired(true));

export async function execute(interaction, bostezo) {
    const input = interaction.options.getString("nombre")?.trim() || "";
    const color = CONFIG.COLORES.ROSA;
    const em = EMOJI_CATEGORIA.animales;

    if (esTodos(input)) {
        const result = await db.execute("SELECT * FROM animales ORDER BY id ASC");
        const items = result.rows.map(row => [row.id, {
            ubicacion: row.ubicacion,
            comida_favorita: JSON.parse(row.comida_favorita || "[]"),
            clima_preferido: JSON.parse(row.clima_preferido || "[]")
        }]);

        return enviarPaginado({
            interaction,
            baseEmbed: crearEmbed(color),
            items,
            itemsPorPagina: 12,
            titulo: `${em.titulo} Animalitos del pueblito ${em.titulo}`,
            descripcion: "Nuestros dulces amiguitos del bosque. Llevales algo rico.",
            content: bostezo,
            renderItem: ([nombre, data]) => ({
                name: `${em.icono} ${nombre}`,
                value: `**${data.ubicacion}**\n� Comida: ${data.comida_favorita?.join(", ") || "--"}\n${em.clima} Clima: ${data.clima_preferido?.join(", ") || "Cualquiera"}`,
            }),
        });
    }

    const result = await db.execute({
        sql: "SELECT * FROM animales WHERE id COLLATE NOCASE = ?",
        args: [input]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ embeds: [crearEmbedError("animales", input)], flags: MessageFlags.Ephemeral });
    }

    const row = result.rows[0];
    const data = {
        ubicacion: row.ubicacion,
        comida_favorita: JSON.parse(row.comida_favorita || "[]"),
        clima_preferido: JSON.parse(row.clima_preferido || "[]")
    };

    const embed = crearEmbed(color)
        .setTitle(`${em.titulo} ${row.id}`)
        .setDescription(`Suele estar por **${data.ubicacion}**. ¡Acércate con cuidadito!`)
        .addFields(
            { name: "🍲 Comida favorita", value: data.comida_favorita?.join(", ") || "--", inline: false },
            { name: `${em.clima} Clima preferido`, value: data.clima_preferido?.join(", ") || "--", inline: false },
        );

    agregarNarrativa(embed, "animales");

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`col_animales_${row.id}`)
            .setLabel("✅ ¡Lo acaricié!")
            .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({ content: bostezo, embeds: [embed], components: [actionRow] });
}
