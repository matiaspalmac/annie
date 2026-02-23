import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";

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

    // 3. Agrupar items por tipo para mejor visualización
    const itemsPorTipo = {};
    for (const item of ITEMS_TIENDA) {
        const tipo = String(item.tipo || "other");
        if (!itemsPorTipo[tipo]) itemsPorTipo[tipo] = [];
        itemsPorTipo[tipo].push(item);
    }

    // Ordenar tipos según importancia
    const ordenTipos = ["herramienta", "mascota", "tema", "marco", "rol", "consumible", "servicio"];
    const tiposOrdenados = ordenTipos.filter(t => itemsPorTipo[t]).concat(
        Object.keys(itemsPorTipo).filter(t => !ordenTipos.includes(t))
    );

    // Crear páginas agrupadas por tipo
    const paginas = [];
    let paginaActual = [];
    let itemsEnPagina = 0;

    for (const tipo of tiposOrdenados) {
        const items = itemsPorTipo[tipo];
        const meta = tipoMeta[tipo] || { emoji: "🧺", titulo: "Otros" };
        
        // Si agregar esta categoría completa excede 5 items, crear nueva página
        if (itemsEnPagina > 0 && itemsEnPagina + items.length > 5) {
            paginas.push(paginaActual);
            paginaActual = [];
            itemsEnPagina = 0;
        }

        // Agregar header de categoría
        paginaActual.push({
            tipo: 'header',
            categoria: tipo,
            meta: meta,
            count: items.length
        });

        // Agregar items de esta categoría
        for (const item of items) {
            paginaActual.push({
                tipo: 'item',
                data: item
            });
            itemsEnPagina++;
        }
    }

    // Agregar última página si tiene items
    if (paginaActual.length > 0) {
        paginas.push(paginaActual);
    }

    if (paginas.length === 0) {
        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("🛒 Mercadito Encantado de Annie")
            .setDescription("La tienda está vacía por ahora. Vuelve más ratito ✨");
        return interaction.reply({ content: bostezo, embeds: [embed] });
    }

    // 4. Renderizar con paginación mejorada
    await interaction.deferReply();
    
    const embeds = paginas.map((items, index) => {
        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("🛒 Mercadito Encantado de Annie")
            .setDescription(
                `💰 **Tu balance:** ${userMonedas.toLocaleString("es-CL")} moneditas\n` +
                `🔥 **Destacados de hoy:** ${featuredIds.map(id => `\`${id}\``).join(" • ")}\n\n` +
                `✨ Usa **/comprar** para adquirir items\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
            )
            .setFooter({ text: `Página ${index + 1} de ${paginas.length} • Total: ${ITEMS_TIENDA.length} items` });

        for (const entrada of items) {
            if (entrada.tipo === 'header') {
                // Header de categoría
                embed.addFields({
                    name: `\n${entrada.meta.emoji} ━━━ **${entrada.meta.titulo.toUpperCase()}** ━━━`,
                    value: `┗━ ${entrada.count} ${entrada.count === 1 ? 'item disponible' : 'items disponibles'}`,
                    inline: false
                });
            } else {
                // Item individual
                const item = entrada.data;
                const isFeatured = featuredIds.includes(String(item.id));
                const isNuevo = nuevosSet.has(String(item.id));
                
                const badges = [];
                if (isFeatured) badges.push("🔥 OFERTA DEL DÍA");
                if (isNuevo) badges.push("🆕 NUEVO");
                
                const canAfford = userMonedas >= Number(item.precio_monedas);
                const pricePrefix = canAfford ? "✅" : "❌";

                embed.addFields({
                    name: `${item.nombre}${badges.length > 0 ? ` (${badges.join(' • ')})` : ''}`,
                    value: 
                        `┣ **ID:** \`${item.id}\`\n` +
                        `┣ ${item.descripcion}\n` +
                        `┗ ${pricePrefix} **${Number(item.precio_monedas).toLocaleString("es-CL")}** 💰`,
                    inline: false
                });
            }
        }

        return embed;
    });

    // Crear botones de navegación si hay múltiples páginas
    if (embeds.length === 1) {
        return interaction.editReply({ content: bostezo, embeds: [embeds[0]] });
    }

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import("discord.js");
    
    let currentPage = 0;
    const message = await interaction.editReply({
        content: bostezo,
        embeds: [embeds[0]],
        components: [{
            type: 1,
            components: [
                {
                    type: 2,
                    style: ButtonStyle.Secondary,
                    label: "◀ Anterior",
                    custom_id: "prev",
                    disabled: true
                },
                {
                    type: 2,
                    style: ButtonStyle.Primary,
                    label: `${currentPage + 1} / ${embeds.length}`,
                    custom_id: "page_info",
                    disabled: true
                },
                {
                    type: 2,
                    style: ButtonStyle.Secondary,
                    label: "Siguiente ▶",
                    custom_id: "next",
                    disabled: embeds.length === 1
                }
            ]
        }]
    });

    const collector = message.createMessageComponentCollector({ 
        time: 300000, // 5 minutos
        filter: (i) => i.user.id === interaction.user.id 
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'next') {
            currentPage++;
        } else if (i.customId === 'prev') {
            currentPage--;
        }

        await i.update({
            embeds: [embeds[currentPage]],
            components: [{
                type: 1,
                components: [
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        label: "◀ Anterior",
                        custom_id: "prev",
                        disabled: currentPage === 0
                    },
                    {
                        type: 2,
                        style: ButtonStyle.Primary,
                        label: `${currentPage + 1} / ${embeds.length}`,
                        custom_id: "page_info",
                        disabled: true
                    },
                    {
                        type: 2,
                        style: ButtonStyle.Secondary,
                        label: "Siguiente ▶",
                        custom_id: "next",
                        disabled: currentPage === embeds.length - 1
                    }
                ]
            }]
        });
    });

    collector.on('end', () => {
        message.edit({ components: [] }).catch(() => {});
    });
}
