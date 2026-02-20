import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed } from "../utils.js";

// Estructura de la tienda. Puedes añadir roles predeterminados de Discord si tuvieras sus IDs creados.
const ITEMS_TIENDA = [
    { id: "color_custom", nombre: "Pincel Mágico (Color Personalizado)", precio_xp: 5000, desc: "¡Exclusivo! Elige tu propio color hexadecimal para tu nombre en el chat." },
    { id: "color_rosa", nombre: "Tinte Rosado (Rol)", precio_xp: 300, desc: "Tiñe tu nombre de un hermoso color rosa chicle." },
    { id: "color_celeste", nombre: "Tinte Celeste (Rol)", precio_xp: 300, desc: "Muestra tu nombre como el cielo despejado." },
    { id: "color_dorado", nombre: "Tinte Dorado (Rol)", precio_xp: 500, desc: "Brilla como el oro puro en el servidor." }
];

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
        return interaction.reply({ content: `${bostezo} Aún no sales a pasear por el pueblito... escribe en el chat para ganar alguito de XP.`, ephemeral: true });
    }

    const userData = result.rows[0];
    const userXp = Number(userData.xp);

    // 2. Render Shop Embed
    const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle("🛒 La Tiendita de Colores")
        .setDescription(`¡Bienvenido! Tienes en tus bolsillos ✨ **${userXp} XP** y 💰 **${userData.monedas} Moneditas**.\n\n` +
            `Aquí puedes comprar roles que teñirán tu nombre en el chat de un color especial.`);

    let shopText = "";
    const opcionesMenu = [];

    ITEMS_TIENDA.forEach((item, index) => {
        shopText += `**${index + 1}. ${item.nombre}**\n${item.desc}\n💎 Precio: **${item.precio_xp} XP**\n\n`;
        opcionesMenu.push({
            label: item.nombre,
            description: `Cuesta ${item.precio_xp} XP`,
            value: item.id
        });
    });

    embed.addFields({ name: "Inventario del Mercader", value: shopText, inline: false });

    // 3. Render Dropdown
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("tienda_comprar")
                .setPlaceholder("Elige qué deseas comprar...")
                .addOptions(opcionesMenu)
        );

    await interaction.reply({ content: bostezo, embeds: [embed], components: [row] });
}
