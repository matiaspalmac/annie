import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed } from "../utils.js";

// Estructura de la tienda ahora se lee desde la DB
export const data = new SlashCommandBuilder()
    .setName("tienda")
    .setDescription("Compra colores, temas y mascotitas con tus Moneditas 💰");

export async function execute(interaction, bostezo) {
    // 1. Fetch user wealth
    const result = await db.execute({
        sql: "SELECT xp, monedas FROM usuarios WHERE id = ?",
        args: [interaction.user.id]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ content: `${bostezo} Aún no sales a pasear por el pueblito... escribe en el chat para ganar alguito de XP.`, flags: MessageFlags.Ephemeral });
    }

    const userData = result.rows[0];
    const userMonedas = Number(userData.monedas);

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
        .setTitle("🛒 Mercadito Encantado de Annie")
        .setDescription(
            `✨ **XP:** ${Number(userData.xp).toLocaleString("es-CL")}\n` +
            `💰 **Moneditas disponibles:** ${userMonedas.toLocaleString("es-CL")}\n\n` +
            "Elige con calma, corazoncito. Cada compra suma a tu aventura 💖"
        );

    // Fetch shop items from DB
    const resTienda = await db.execute("SELECT * FROM tienda_items ORDER BY precio_monedas ASC");
    const ITEMS_TIENDA = resTienda.rows;

    const opcionesMenu = [];

    const agrupados = {
        rol: [], tema: [], mascota: [], consumible: [], servicio: [], marco: [], other: []
    };

    ITEMS_TIENDA.forEach((item) => {
        const tipo = String(item.tipo || "other");
        if (agrupados[tipo]) agrupados[tipo].push(item);
        else agrupados.other.push(item);

        const meta = tipoMeta[tipo] || { emoji: "🧺", titulo: "Otros" };
        opcionesMenu.push({
            label: String(item.nombre).slice(0, 100),
            description: `${meta.emoji} ${meta.titulo} · ${item.precio_monedas} moneditas`,
            value: String(item.id).slice(0, 100)
        });
    });

    const order = ["rol", "tema", "marco", "mascota", "consumible", "servicio", "other"];
    for (const tipo of order) {
        const items = agrupados[tipo];
        if (!items || items.length === 0) continue;
        const meta = tipoMeta[tipo] || { emoji: "🧺", titulo: "Otros" };
        const value = items
            .map((it) => `• **${it.nombre}** — ${it.precio_monedas}💰\n${it.descripcion}`)
            .join("\n\n")
            .slice(0, 1024);

        embed.addFields({
            name: `${meta.emoji} ${meta.titulo}`,
            value,
            inline: false,
        });
    }

    if (ITEMS_TIENDA.length === 0) {
        embed.addFields({
            name: "Mercader ausente",
            value: "La tienda está vacía por ahora. Vuelve más ratito ✨",
            inline: false,
        });
    }

    embed.setFooter({ text: "Tip: algunos ítems aplican efecto inmediato al comprar." });

    const components = [];
    if (opcionesMenu.length > 0) {
        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("tienda_comprar")
                    .setPlaceholder("Elige qué deseas comprar...")
                    .addOptions(opcionesMenu)
            )
        );
    }

    await interaction.reply({ content: bostezo, embeds: [embed], components });
}
