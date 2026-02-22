import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed, enviarPaginado } from "../utils.js";

const tipoMeta = {
    rol: { emoji: "🎨", titulo: "Tintes y Colores" },
    tema: { emoji: "🖼️", titulo: "Temas Web" },
    mascota: { emoji: "🐾", titulo: "Mascotas" },
    consumible: { emoji: "⚗️", titulo: "Consumibles" },
    servicio: { emoji: "🛟", titulo: "Servicios" },
    marco: { emoji: "🪞", titulo: "Marcos de Perfil" },
};

export const data = new SlashCommandBuilder()
    .setName("tienda")
    .setDescription("Explora los productos de la tienda");

export async function execute(interaction, bostezo) {
    // 1. Fetch user wealth
    const result = await db.execute({
        sql: "SELECT monedas FROM usuarios WHERE id = ?",
        args: [interaction.user.id]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ 
            content: `${bostezo} Aún no sales a pasear por el pueblito... escribe en el chat para ganar moneditas y luego vuelve a la tienda.`, 
            flags: MessageFlags.Ephemeral 
        });
    }

    const userMonedas = Number(result.rows[0].monedas);

    // 2. Fetch shop items from DB
    const resTienda = await db.execute(
        "SELECT id, nombre, descripcion, precio_monedas, tipo FROM tienda_items ORDER BY precio_monedas ASC, nombre ASC"
    );
    const ITEMS_TIENDA = resTienda.rows;

    if (ITEMS_TIENDA.length === 0) {
        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("🛒 Mercadito Encantado de Annie")
            .setDescription("La tienda está vacía por ahora. Vuelve más ratito ✨");
        return interaction.reply({ content: bostezo, embeds: [embed] });
    }

    // 3. Usar enviarPaginado
    const baseEmbed = crearEmbed(CONFIG.COLORES.DORADO);

    await enviarPaginado({
        interaction,
        baseEmbed,
        items: ITEMS_TIENDA,
        itemsPorPagina: 6,
        titulo: "🛒 Mercadito Encantado de Annie",
        descripcion: 
            `💰 **Moneditas disponibles:** ${userMonedas.toLocaleString("es-CL")}\n\n` +
            `Usa **/comprar** y elige el item con sugerencias automáticas.\n`,
        renderItem: (item) => {
            const tipo = String(item.tipo || "other");
            const meta = tipoMeta[tipo] || { emoji: "🧺", titulo: "Otros" };
            return {
                name: `${meta.emoji} ${item.nombre}`,
                value: 
                    `ID: \`${item.id}\` • Tipo: ${meta.titulo}\n` +
                    `${item.descripcion}\n` +
                    `💰 **${Number(item.precio_monedas).toLocaleString("es-CL")} moneditas**`,
                inline: false
            };
        },
        content: bostezo,
        timeout: 300000
    });
}
