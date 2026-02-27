import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

export const RECETAS = [
    // 🍰 Postres y comida
    {
        id: "tarta_manzana", nombre: "Tarta de Manzana", cantidad: 1, emoji: "🥧", precio_venta: 180,
        ingredientes: [{ item: "Manzanas", cantidad: 3 }],
        descripcion: "Una tarta casera con el aroma del otoño del pueblito."
    },
    {
        id: "jugo_frutas", nombre: "Jugo de Frutas", cantidad: 2, emoji: "🧃", precio_venta: 90,
        ingredientes: [{ item: "Naranjas", cantidad: 2 }, { item: "Duraznos", cantidad: 1 }],
        descripcion: "Refrescante y lleno de vitaminas."
    },
    {
        id: "mermelada_ciruela", nombre: "Mermelada de Ciruela", cantidad: 1, emoji: "🫙", precio_venta: 120,
        ingredientes: [{ item: "Ciruelas", cantidad: 4 }],
        descripcion: "Perfecta para el pan de la mañana."
    },
    {
        id: "ensalada_frutas", nombre: "Ensalada de Frutas", cantidad: 1, emoji: "🥗", precio_venta: 200,
        ingredientes: [{ item: "Manzanas", cantidad: 1 }, { item: "Peras", cantidad: 1 }, { item: "Naranjas", cantidad: 1 }],
        descripcion: "Una mezcla colorida y nutritiva."
    },
    // ⚒️ Materiales
    {
        id: "polvo_diamante", nombre: "Polvo de Diamante", cantidad: 1, emoji: "💎", precio_venta: 500,
        ingredientes: [{ item: "Diamante puro", cantidad: 2 }],
        descripcion: "Diamantes molidos con paciencia eterna."
    },
    {
        id: "aleacion_oro", nombre: "Aleación de Oro", cantidad: 1, emoji: "🥇", precio_venta: 350,
        ingredientes: [{ item: "Pepita de Oro", cantidad: 3 }],
        descripcion: "Oro refinado listo para el mercado."
    },
    {
        id: "cristal_cuarzo", nombre: "Cristal de Cuarzo", cantidad: 1, emoji: "🔮", precio_venta: 280,
        ingredientes: [{ item: "Cuarzo Rosa", cantidad: 2 }, { item: "Obsidiana", cantidad: 1 }],
        descripcion: "Un cristal con energía mística del bosque."
    },
    // 🦋 Bichos
    {
        id: "tinta_mariposa", nombre: "Tinta de Mariposa", cantidad: 1, emoji: "🎨", precio_venta: 300,
        ingredientes: [{ item: "Mariposa Monarca", cantidad: 2 }, { item: "Mariposa Azul", cantidad: 1 }],
        descripcion: "Colores únicos extraídos delicadamente."
    },
    {
        id: "miel_abeja", nombre: "Tarro de Miel", cantidad: 1, emoji: "🍯", precio_venta: 250,
        ingredientes: [{ item: "Abeja Reina", cantidad: 1 }, { item: "Manzanas", cantidad: 2 }],
        descripcion: "La miel más dulce que hayas probado."
    },
];

export const data = new SlashCommandBuilder()
    .setName("craftear")
    .setDescription("Combina ítems de tu mochila para crear objetos nuevos y valiosos.")
    .addStringOption(o => o
        .setName("receta")
        .setDescription("¿Qué quieres craftear? (escribe el nombre o 'lista' para ver todas)")
        .setRequired(true)
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const input = interaction.options.getString("receta")?.toLowerCase().trim();

    await interaction.deferReply();

    // Mostrar lista de recetas
    if (input === "lista" || input === "ver" || input === "recetas") {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("📖 Libro de Recetas del Pueblito")
            .setDescription(`${bostezo}¡Mira todo lo que puedes crear con los ingredientes que farmeas! Usa \`/craftear [nombre]\` para crear algo.`);

        const pagina1 = RECETAS.slice(0, 5);
        const pagina2 = RECETAS.slice(5);

        for (const r of pagina1) {
            const ings = r.ingredientes.map(i => `${i.item} x${i.cantidad}`).join(" + ");
            embed.addFields({ name: `${r.emoji} ${r.nombre}`, value: `${ings} → 💰 ${r.precio_venta} 🪙`, inline: false });
        }
        if (pagina2.length > 0) {
            for (const r of pagina2) {
                const ings = r.ingredientes.map(i => `${i.item} x${i.cantidad}`).join(" + ");
                embed.addFields({ name: `${r.emoji} ${r.nombre}`, value: `${ings} → 💰 ${r.precio_venta} 🪙`, inline: false });
            }
        }

        return interaction.followUp({ embeds: [embed] });
    }

    // Buscar receta
    const receta = RECETAS.find(r =>
        r.nombre.toLowerCase().includes(input) ||
        r.id.includes(input.replace(/ /g, "_"))
    );

    if (!receta) {
        const sugerencias = RECETAS.slice(0, 3).map(r => `\`${r.nombre}\``).join(", ");
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🔎 Receta no encontrada")
            .setDescription(
                `${bostezo}No encontré esa receta en el libro. ¿Quizás quisiste decir algo como ${sugerencias}?\n\n` +
                `Escribe \`/craftear lista\` para ver todas las recetas disponibles.`
            );
        return interaction.followUp({ embeds: [embed] });
    }

    // Verificar inventario
    const faltan = [];
    for (const ing of receta.ingredientes) {
        const res = await db.execute({
            sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
            args: [userId, ing.item]
        });
        const tiene = Number(res.rows[0]?.cantidad ?? 0);
        if (tiene < ing.cantidad) {
            faltan.push({ item: ing.item, tienes: tiene, necesitas: ing.cantidad });
        }
    }

    if (faltan.length > 0) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle(`❌ ¡Faltan ingredientes para ${receta.emoji} ${receta.nombre}!`)
            .setDescription(`${bostezo}Te faltan algunos ingredientes en la mochila para hacer esta receta:`);

        for (const f of faltan) {
            embed.addFields({
                name: `❌ ${f.item}`,
                value: `Tienes **${f.tienes}**, necesitas **${f.necesitas}**`,
                inline: true
            });
        }
        return interaction.followUp({ embeds: [embed] });
    }

    // Consumir ingredientes
    for (const ing of receta.ingredientes) {
        await db.execute({
            sql: "UPDATE inventario_economia SET cantidad = cantidad - ? WHERE user_id = ? AND item_id = ?",
            args: [ing.cantidad, userId, ing.item]
        });
    }

    // Agregar resultado
    try {
        await db.execute({
            sql: `INSERT OR IGNORE INTO items_economia (id, nombre, emoji, tipo, precio_venta, precio_compra, descripcion, rareza)
                  VALUES (?, ?, ?, 'objeto', ?, 0, ?, 'raro')`,
            args: [receta.nombre, receta.nombre, receta.emoji, receta.precio_venta, receta.descripcion]
        });
    } catch { /* ya existe */ }

    await db.execute({
        sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
              VALUES (?, ?, ?)
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?`,
        args: [userId, receta.nombre, receta.cantidad, receta.cantidad]
    });

    const ingsTexto = receta.ingredientes.map(i => `${i.item} x${i.cantidad}`).join(", ");

    const embed = crearEmbed(CONFIG.COLORES.VERDE)
        .setTitle(`🔨 ¡Crafteo Exitoso!`)
        .setDescription(`${bostezo}*Annie mezcla los ingredientes con cuidado y en un abrir y cerrar de ojos...*`)
        .addFields(
            { name: `${receta.emoji} Resultado`, value: `**${receta.nombre}** x${receta.cantidad}`, inline: true },
            { name: "⚗️ Ingredientes usados", value: ingsTexto, inline: false },
            { name: "📝 Descripción", value: `*${receta.descripcion}*`, inline: false },
            { name: "💰 Valor de venta", value: `**${receta.precio_venta} 🪙** en \`/vender\``, inline: true }
        );

    return interaction.followUp({ embeds: [embed] });
}
