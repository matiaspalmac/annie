import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed } from "../utils.js";

// Estructura de la tienda ahora se lee desde la DB
export const data = new SlashCommandBuilder()
    .setName("tienda")
    .setDescription("Explora los productos de la tienda por páginas")
    .addIntegerOption(o =>
        o.setName("pagina")
            .setDescription("Número de página")
            .setMinValue(1)
    );

export async function execute(interaction, bostezo) {
    // 1. Fetch user wealth
    const result = await db.execute({
        sql: "SELECT monedas FROM usuarios WHERE id = ?",
        args: [interaction.user.id]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ content: `${bostezo} Aún no sales a pasear por el pueblito... escribe en el chat para ganar moneditas y luego vuelve a la tienda.`, flags: MessageFlags.Ephemeral });
    }

    const userMonedas = Number(result.rows[0].monedas);
    const pageSize = 6;
    const pagina = interaction.options.getInteger("pagina") || 1;

    const tipoMeta = {
        rol: { emoji: "🎨", titulo: "Tintes y Colores" },
        tema: { emoji: "🖼️", titulo: "Temas Web" },
        mascota: { emoji: "🐾", titulo: "Mascotas" },
        consumible: { emoji: "⚗️", titulo: "Consumibles" },
        servicio: { emoji: "🛟", titulo: "Servicios" },
        marco: { emoji: "🪞", titulo: "Marcos de Perfil" },
    };

    // 2. Render Shop Embed
    const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle("🛒 Mercadito Encantado de Annie");

    // Fetch shop items from DB
    const resTienda = await db.execute("SELECT id, nombre, descripcion, precio_monedas, tipo FROM tienda_items ORDER BY precio_monedas ASC, nombre ASC");
    const ITEMS_TIENDA = resTienda.rows;

    if (ITEMS_TIENDA.length === 0) {
        embed.setDescription("La tienda está vacía por ahora. Vuelve más ratito ✨");
        return interaction.reply({ content: bostezo, embeds: [embed] });
    }

    const totalPages = Math.max(1, Math.ceil(ITEMS_TIENDA.length / pageSize));
    const safePage = Math.min(Math.max(1, pagina), totalPages);
    const start = (safePage - 1) * pageSize;
    const pageItems = ITEMS_TIENDA.slice(start, start + pageSize);

    const lines = pageItems.map((item, idx) => {
        const tipo = String(item.tipo || "other");
        const meta = tipoMeta[tipo] || { emoji: "🧺", titulo: "Otros" };
        return `**${start + idx + 1}. ${meta.emoji} ${item.nombre}**\n` +
            `ID: \`${item.id}\` · Tipo: ${meta.titulo}\n` +
            `${item.descripcion}\n` +
            `💰 **${Number(item.precio_monedas).toLocaleString("es-CL")} moneditas**`;
    }).join("\n\n");

    embed.setDescription(
        `💰 **Moneditas disponibles:** ${userMonedas.toLocaleString("es-CL")}\n` +
        `📄 **Página ${safePage}/${totalPages}**\n\n` +
        `${lines}\n\n` +
        `Usa **/comprar** y elige el item con sugerencias automáticas.`
    );

    embed.setFooter({ text: "Tip: /comprar tiene autocompletado por nombre e ID." });

    await interaction.reply({ content: bostezo, embeds: [embed] });
}
