import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed } from "../utils.js";

// Estructura de la tienda ahora se lee desde la DB
export const data = new SlashCommandBuilder()
    .setName("tienda")
    .setDescription("Compra colores y cositas lindas con tus Puntos de Experiencia (XP)");

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
    const userXp = Number(userData.xp);

    // 2. Render Shop Embed
    const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle("🛒 La Tiendita de Colores")
        .setDescription(`¡Bienvenido! Tienes en tus bolsillos ✨ **${userXp} XP** y 💰 **${userData.monedas} Moneditas**.\n\n` +
            `Aquí puedes comprar roles que teñirán tu nombre en el chat de un color especial.`);

    // Fetch shop items from DB
    const resTienda = await db.execute("SELECT * FROM tienda_items ORDER BY precio_xp ASC");
    const ITEMS_TIENDA = resTienda.rows;

    let shopText = ITEMS_TIENDA.length > 0 ? "" : "La tienda está vacía ahora mismo. ¡Vuelve más ratito!";
    const opcionesMenu = [];

    ITEMS_TIENDA.forEach((item, index) => {
        shopText += `**${index + 1}. ${item.nombre}**\n${item.descripcion}\n💎 Precio: **${item.precio_xp} XP**\n\n`;
        opcionesMenu.push({
            label: String(item.nombre).slice(0, 100),
            description: `Cuesta ${item.precio_xp} XP`,
            value: String(item.id).slice(0, 100)
        });
    });

    embed.addFields({ name: "Inventario del Mercader", value: shopText, inline: false });

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
