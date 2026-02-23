import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed, enviarPaginado } from "../../core/utils.js";

const tipoMeta = {
    rol: { emoji: "🎨", titulo: "Tintes y Colores" },
    tema: { emoji: "🖼️", titulo: "Temas Web" },
    mascota: { emoji: "🐾", titulo: "Mascotas" },
    consumible: { emoji: "⚗️", titulo: "Consumibles" },
    servicio: { emoji: "🛟", titulo: "Servicios" },
    marco: { emoji: "🪞", titulo: "Marcos de Perfil" },
    herramienta: { emoji: "🧰", titulo: "Herramientas" },
};

export const data = new SlashCommandBuilder()
    .setName("tienda")
    .setDescription("Explora los productos de la tienda")
    .addStringOption(option =>
        option
            .setName("tipo")
            .setDescription("Filtrar por tipo")
            .setRequired(false)
            .addChoices(
                { name: "Todos", value: "todos" },
                { name: "Roles", value: "rol" },
                { name: "Temas", value: "tema" },
                { name: "Mascotas", value: "mascota" },
                { name: "Consumibles", value: "consumible" },
                { name: "Servicios", value: "servicio" },
                { name: "Marcos", value: "marco" },
                { name: "Herramientas", value: "herramienta" },
            )
    )
    .addIntegerOption(option =>
        option
            .setName("precio_min")
            .setDescription("Precio mínimo en moneditas")
            .setRequired(false)
            .setMinValue(0)
    )
    .addIntegerOption(option =>
        option
            .setName("precio_max")
            .setDescription("Precio máximo en moneditas")
            .setRequired(false)
            .setMinValue(0)
    )
    .addBooleanOption(option =>
        option
            .setName("solo_destacados")
            .setDescription("Mostrar solo rotación destacada del día")
            .setRequired(false)
    );

function getTodaySeed() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function getDailyFeaturedIds(items, count = 4) {
    if (items.length === 0) return [];
    const sorted = [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const seed = getTodaySeed();
    const start = seed % sorted.length;
    const featured = [];

    for (let i = 0; i < Math.min(count, sorted.length); i++) {
        featured.push(String(sorted[(start + i) % sorted.length].id));
    }

    return featured;
}

export async function execute(interaction, bostezo) {
    const tipoFiltro = interaction.options.getString("tipo") || "todos";
    const precioMin = interaction.options.getInteger("precio_min");
    const precioMax = interaction.options.getInteger("precio_max");
    const soloDestacados = interaction.options.getBoolean("solo_destacados") ?? false;

    if (precioMin !== null && precioMax !== null && precioMin > precioMax) {
        return interaction.reply({
            content: `${bostezo} El precio mínimo no puede ser mayor que el máximo, corazoncito.`,
            flags: MessageFlags.Ephemeral
        });
    }

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
    const ALL_ITEMS = resTienda.rows;
    const featuredIds = getDailyFeaturedIds(ALL_ITEMS, 4);
    const nuevosSet = new Set(Array.isArray(CONFIG.TIENDA_ITEMS_NUEVOS) ? CONFIG.TIENDA_ITEMS_NUEVOS.map(i => String(i)) : []);

    const ITEMS_TIENDA = ALL_ITEMS.filter(item => {
        const tipoItem = String(item.tipo || "other");
        const precio = Number(item.precio_monedas || 0);
        const isFeatured = featuredIds.includes(String(item.id));

        if (tipoFiltro !== "todos" && tipoItem !== tipoFiltro) return false;
        if (precioMin !== null && precio < precioMin) return false;
        if (precioMax !== null && precio > precioMax) return false;
        if (soloDestacados && !isFeatured) return false;
        return true;
    });

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
            `🔥 **Destacados de hoy:** ${featuredIds.map(id => `\`${id}\``).join(" • ")}\n` +
            `Usa **/comprar** y elige el item con sugerencias automáticas.\n`,
        renderItem: (item) => {
            const tipo = String(item.tipo || "other");
            const meta = tipoMeta[tipo] || { emoji: "🧺", titulo: "Otros" };
            const isFeatured = featuredIds.includes(String(item.id));
            const isNuevo = nuevosSet.has(String(item.id));
            const tags = [
                isFeatured ? "🔥 OFERTA" : null,
                isNuevo ? "🆕 NUEVO" : null,
            ].filter(Boolean).join(" · ");

            return {
                name: `${meta.emoji} ${item.nombre}${tags ? ` [${tags}]` : ""}`,
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
