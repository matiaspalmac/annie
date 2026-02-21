import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { crearEmbed } from "../utils.js";
import { esTodos } from "../data.js";

const CATEGORIAS_VALIDAS = ["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "recetas", "logros"];

export const data = new SlashCommandBuilder()
    .setName("destacar")
    .setDescription("Elige tus descubrimientos favoritos para mostrarlos en el tope de tu Libretita Web")
    .addIntegerOption(o =>
        o.setName("ranura")
            .setDescription("¿Qué ranura quieres actualizar? (1, 2 o 3)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(3)
    )
    .addStringOption(o =>
        o.setName("categoria")
            .setDescription("¿De qué categoría es el ítem?")
            .setRequired(true)
            .addChoices(...CATEGORIAS_VALIDAS.map(c => ({ name: c, value: c })))
    )
    .addStringOption(o =>
        o.setName("nombre")
            .setDescription("Nombre del bicho, pez o logro que quieres destacar")
            .setRequired(true)
    );

export async function execute(interaction, bostezo) {
    const slot = interaction.options.getInteger("ranura");
    const categoria = interaction.options.getString("categoria");
    const nombreItemRaw = interaction.options.getString("nombre");
    const userId = interaction.user.id;

    // 1. Validate if item exists in their collections
    const nombreFormatted = nombreItemRaw.toLowerCase().trim();

    const resCheck = await db.execute({
        sql: "SELECT item_id FROM colecciones WHERE user_id = ? AND categoria = ? AND LOWER(item_id) LIKE ?",
        args: [userId, categoria, `%${nombreFormatted}%`]
    });

    if (resCheck.rows.length === 0) {
        return interaction.reply({
            content: `Ay corazón... he revisado tu libretita pero no veo que tengas anotado ningún "${nombreItemRaw}" en recolecciones de ${categoria}. ¡Tienes que descubrirlo primero!`,
            flags: MessageFlags.Ephemeral
        });
    }

    // Usamos el id oficial que trajo la base de datos de colecciones para prevenir typos
    const itemIdConfirmado = Array.from(resCheck.rows)[0].item_id;

    try {
        await db.execute({
            sql: `INSERT INTO destacados (user_id, slot, categoria, item_id) 
                  VALUES (?, ?, ?, ?) 
                  ON CONFLICT(user_id, slot) DO UPDATE SET categoria = excluded.categoria, item_id = excluded.item_id`,
            args: [userId, slot, categoria, itemIdConfirmado]
        });

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("📌 ¡Vitrina Actualizada!")
            .setDescription(`He pegado fotitos de tu **${itemIdConfirmado}** en la ranura #${slot} de tu perfil web.\n\n[Míralo haciendo clic aquí](${CONFIG.WIKI_URL}perfil/${userId})`);

        await interaction.reply({ content: bostezo, embeds: [embed] });

    } catch (e) {
        console.error("Error comando destacar:", e.message);
        return interaction.reply({ content: "Se me acabó mi cinta adhesiva para pegarlo... intentalo en un ratito.", flags: MessageFlags.Ephemeral });
    }
}
