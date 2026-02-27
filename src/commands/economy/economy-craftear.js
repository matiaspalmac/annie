import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";

// ── Recetas Predefinidas (se seed-ean al init) ──────────────────────────────
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

    // ⚒️ Herramientas y materiales
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
        const lineas = RECETAS.map(r => {
            const ings = r.ingredientes.map(i => `${i.item} x${i.cantidad}`).join(" + ");
            return `${r.emoji} **${r.nombre}** → ${ings} *(vende: ${r.precio_venta} 🪙)*`;
        });

        // Dividir en páginas de 5
        const paginas = [];
        for (let i = 0; i < lineas.length; i += 5) paginas.push(lineas.slice(i, i + 5));

        return interaction.followUp(
            `📖 **Libro de Recetas del Pueblito**\n\n` +
            paginas[0].join("\n") +
            `\n\n*Usa \`/craftear [nombre de la receta]\` para crear un ítem.*`
        );
    }

    // Buscar receta por nombre
    const receta = RECETAS.find(r =>
        r.nombre.toLowerCase().includes(input) ||
        r.id.includes(input.replace(/ /g, "_"))
    );

    if (!receta) {
        const sugerencias = RECETAS.slice(0, 3).map(r => `\`${r.nombre}\``).join(", ");
        return interaction.followUp(
            `${bostezo}No encontré esa receta en el libro. ¿Quizás quisiste decir algo como ${sugerencias}?\n` +
            `Escribe \`/craftear lista\` para ver todas las recetas disponibles.`
        );
    }

    // Verificar inventario para todos los ingredientes
    const faltan = [];
    for (const ing of receta.ingredientes) {
        const res = await db.execute({
            sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
            args: [userId, ing.item]
        });
        const tiene = Number(res.rows[0]?.cantidad ?? 0);
        if (tiene < ing.cantidad) {
            faltan.push(`${ing.item} (tienes ${tiene}, necesitas ${ing.cantidad})`);
        }
    }

    if (faltan.length > 0) {
        return interaction.followUp(
            `${bostezo}¡Te faltan ingredientes para **${receta.emoji} ${receta.nombre}**!\n\n` +
            `❌ ${faltan.join("\n❌ ")}`
        );
    }

    // Consumir ingredientes
    for (const ing of receta.ingredientes) {
        await db.execute({
            sql: "UPDATE inventario_economia SET cantidad = cantidad - ? WHERE user_id = ? AND item_id = ?",
            args: [ing.cantidad, userId, ing.item]
        });
    }

    // Agregar resultado al inventario (asegurarse que exista en items_economia primero)
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

    return interaction.followUp(
        `🔨 *Mezclando ingredientes con cuidado...*\n\n` +
        `✨ **¡Crafteo exitoso!** Combinaste ${ingsTexto}\n` +
        `y obtuviste: **${receta.emoji} ${receta.nombre}** x${receta.cantidad}\n\n` +
        `📝 *${receta.descripcion}*\n` +
        `💰 Puedes venderlo en **/vender** por **${receta.precio_venta} moneditas**.`
    );
}
