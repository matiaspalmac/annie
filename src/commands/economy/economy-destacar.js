import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed } from "../../core/utils.js";
import { esTodos } from "../../core/data.js";

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
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("🔍 No está en tu colección")
            .setDescription(
                `Ay corazón... he revisado tu libretita pero no veo que tengas anotado ningún **"${nombreItemRaw}"** en recolecciones de ${categoria}.

¡Tienes que descubrirlo primero antes de destacarlo!`
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
            .setDescription(`${bostezo}He pegado fotitos de tu **${itemIdConfirmado}** en la vitrina de tu perfil web. 💖`)
            .addFields(
                { name: "📂 Categoría", value: categoria, inline: true },
                { name: "📌 Ranura", value: `#${slot}`, inline: true },
                { name: "🌐 Ver perfil", value: `[Haz clic aquí](${CONFIG.WIKI_URL}perfil/${userId})`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });

    } catch (e) {
        console.error("Error comando destacar:", e.message);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Cinta adhesiva agotada!")
            .setDescription(`${bostezo}Se me acabó la cinta adhesiva para pegarlo... inténtalo en un ratito.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
