import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { progresarMision } from "../../features/misiones.js";

// ── Niveles de Maestría ──────────────────────────────────────────────────
const NIVELES_MAESTRIA = [
    { nombre: "Aprendiz", emoji: "🔰", minCrafts: 5, bonus: 0.10 },
    { nombre: "Experto", emoji: "⚒️", minCrafts: 15, bonus: 0.20 },
    { nombre: "Maestro", emoji: "🏅", minCrafts: 30, bonus: 0.30 },
    { nombre: "Gran Maestro", emoji: "👑", minCrafts: 50, bonus: 0.50 },
];

/**
 * Obtiene el nivel de maestría y datos asociados para un usuario y receta
 * @param {number} vecesCrafteado - Cantidad de veces crafteado
 * @returns {{ nivel: object|null, siguiente: object|null, bonus: number, progreso: string }}
 */
function getMaestriaInfo(vecesCrafteado) {
    let nivelActual = null;
    let siguiente = null;

    for (let i = NIVELES_MAESTRIA.length - 1; i >= 0; i--) {
        if (vecesCrafteado >= NIVELES_MAESTRIA[i].minCrafts) {
            nivelActual = NIVELES_MAESTRIA[i];
            siguiente = NIVELES_MAESTRIA[i + 1] || null;
            break;
        }
    }

    if (!nivelActual) {
        siguiente = NIVELES_MAESTRIA[0];
    }

    const bonus = nivelActual?.bonus || 0;
    let progreso;
    if (!siguiente) {
        progreso = nivelActual ? "MAX" : `${vecesCrafteado}/${NIVELES_MAESTRIA[0].minCrafts}`;
    } else {
        progreso = `${vecesCrafteado}/${siguiente.minCrafts}`;
    }

    return { nivel: nivelActual, siguiente, bonus, progreso };
}

// ── Recetas ──────────────────────────────────────────────────────────────
// precio_venta SIEMPRE >= 1.5x el costo raw de los ingredientes
export const RECETAS = [
    // 🍰 Postres y comida
    {
        id: "tarta_manzana", nombre: "Tarta de Manzana", cantidad: 1, emoji: "🥧", precio_venta: 180,
        ingredientes: [{ item: "Manzanas", cantidad: 3 }],
        descripcion: "Una tarta casera con el aroma del otoño del pueblito."
        // Raw: 3*8 = 24 → 180 = 7.5x ✓
    },
    {
        id: "jugo_frutas", nombre: "Jugo de Frutas", cantidad: 2, emoji: "🧃", precio_venta: 120,
        ingredientes: [{ item: "Naranjas", cantidad: 2 }, { item: "Duraznos", cantidad: 1 }],
        descripcion: "Refrescante y lleno de vitaminas."
        // Raw: 2*20 + 19 = 59 → 120 = 2.0x ✓
    },
    {
        id: "mermelada_ciruela", nombre: "Mermelada de Ciruela", cantidad: 1, emoji: "🫙", precio_venta: 130,
        ingredientes: [{ item: "Ciruelas", cantidad: 4 }],
        descripcion: "Perfecta para el pan de la mañana."
        // Raw: 4*17 = 68 → 130 = 1.9x ✓
    },
    {
        id: "ensalada_frutas", nombre: "Ensalada de Frutas", cantidad: 1, emoji: "🥗", precio_venta: 200,
        ingredientes: [{ item: "Manzanas", cantidad: 1 }, { item: "Peras", cantidad: 1 }, { item: "Naranjas", cantidad: 1 }],
        descripcion: "Una mezcla colorida y nutritiva."
        // Raw: 8 + 18 + 20 = 46 → 200 = 4.3x ✓
    },
    // ⚒️ Materiales
    {
        id: "polvo_diamante", nombre: "Polvo de Diamante", cantidad: 1, emoji: "💎", precio_venta: 500,
        ingredientes: [{ item: "Diamante puro", cantidad: 2 }],
        descripcion: "Diamantes molidos con paciencia eterna."
        // Raw: 2*150 = 300 → 500 = 1.67x ✓
    },
    {
        id: "aleacion_oro", nombre: "Aleación de Oro", cantidad: 1, emoji: "🥇", precio_venta: 350,
        ingredientes: [{ item: "Topacio dorado", cantidad: 3 }, { item: "Hierro", cantidad: 2 }],
        descripcion: "Oro refinado listo para el mercado."
        // Raw: 3*30 + 2*8 = 106 → 350 = 3.3x ✓
    },
    {
        id: "cristal_cuarzo", nombre: "Cristal de Cuarzo", cantidad: 1, emoji: "🔮", precio_venta: 280,
        ingredientes: [{ item: "Cuarzo rosa", cantidad: 2 }, { item: "Obsidiana", cantidad: 1 }],
        descripcion: "Un cristal con energía mística del bosque."
        // Raw: 2*25 + 10 = 60 → 280 = 4.67x ✓
    },
    // 🦋 Bichos
    {
        id: "tinta_mariposa", nombre: "Tinta de Mariposa", cantidad: 1, emoji: "🎨", precio_venta: 300,
        ingredientes: [{ item: "Mariposa Emperador", cantidad: 1 }, { item: "Mariposa Nocturna", cantidad: 2 }],
        descripcion: "Colores únicos extraídos delicadamente."
        // Raw: 65 + 2*32 = 129 → 300 = 2.3x ✓
    },
    {
        id: "miel_abeja", nombre: "Tarro de Miel", cantidad: 1, emoji: "🍯", precio_venta: 250,
        ingredientes: [{ item: "Abeja Reina", cantidad: 1 }, { item: "Manzanas", cantidad: 2 }],
        descripcion: "La miel más dulce que hayas probado."
        // Raw: 100 + 2*8 = 116 → 250 = 2.15x ✓
    },

    // ── Nuevas Recetas ───────────────────────────────────────────────────

    // 🍲 Comidas mejoradas
    {
        id: "sopa_del_pueblo", nombre: "Sopa del Pueblo", cantidad: 1, emoji: "🍲", precio_venta: 180,
        ingredientes: [{ item: "Manzanas", cantidad: 2 }, { item: "Peras", cantidad: 2 }, { item: "Cerezas", cantidad: 1 }],
        descripcion: "La receta secreta de la abuelita del pueblito, calientita y reconfortante."
        // Raw: 2*8 + 2*18 + 16 = 68 → 180 = 2.6x ✓
    },
    {
        id: "pastel_de_manzana", nombre: "Pastel de Manzana", cantidad: 1, emoji: "🎂", precio_venta: 250,
        ingredientes: [{ item: "Manzanas", cantidad: 4 }, { item: "Fresas", cantidad: 3 }],
        descripcion: "Un pastelito dorado que huele a hogar. Receta de la Annie."
        // Raw: 4*8 + 3*7 = 53 → 250 = 4.7x ✓
    },
    {
        id: "sushi_artesanal", nombre: "Sushi Artesanal", cantidad: 1, emoji: "🍣", precio_venta: 350,
        ingredientes: [{ item: "Pescado", cantidad: 3 }, { item: "Plátanos", cantidad: 2 }, { item: "Coco", cantidad: 1 }],
        descripcion: "Sushi del pueblito con ingredientes fresquitos del río y los árboles."
        // Raw: 3*8 + 2*6 + 12 = 48 → 350 = 7.3x ✓
    },
    {
        id: "pocion_energia", nombre: "Poción de Energía", cantidad: 1, emoji: "⚡", precio_venta: 400,
        ingredientes: [{ item: "Abeja Mielera", cantidad: 2 }, { item: "Naranjas", cantidad: 3 }],
        descripcion: "Un brebaje revitalizante que te pone las pilas. ¡Más fuerte que un café cargao!"
        // Raw: 2*35 + 3*20 = 130 → 400 = 3.1x ✓
    },
    {
        id: "mermelada_mix", nombre: "Mermelada Surtida", cantidad: 1, emoji: "🫙", precio_venta: 220,
        ingredientes: [{ item: "Fresas", cantidad: 3 }, { item: "Duraznos", cantidad: 2 }, { item: "Limones", cantidad: 1 }],
        descripcion: "Mezcla de frutas del pueblito en un tarrito. Sabor explosivo."
        // Raw: 3*7 + 2*19 + 15 = 74 → 220 = 3.0x ✓
    },
    {
        id: "ceviche_pueblito", nombre: "Ceviche del Pueblito", cantidad: 1, emoji: "🐟", precio_venta: 280,
        ingredientes: [{ item: "Pescado", cantidad: 2 }, { item: "Limones", cantidad: 2 }, { item: "Cerezas", cantidad: 2 }],
        descripcion: "Ceviche estilo chileno con pescadito fresco del río. ¡Puro sabor!"
        // Raw: 2*8 + 2*15 + 2*16 = 78 → 280 = 3.6x ✓
    },

    // ✨ Items exclusivos de crafting (no se obtienen de otra forma)
    {
        id: "amuleto_artesanal", nombre: "Amuleto Artesanal", cantidad: 1, emoji: "🔮", precio_venta: 500,
        ingredientes: [{ item: "Amatista cristalina", cantidad: 2 }, { item: "Hierro", cantidad: 5 }],
        descripcion: "Dicen que trae buena suerte... o al menos se ve bonito.",
        exclusivo: true
        // Raw: 2*50 + 5*8 = 140 → 500 = 3.6x ✓
    },
    {
        id: "perfume_flores", nombre: "Perfume de Flores", cantidad: 1, emoji: "🌺", precio_venta: 300,
        ingredientes: [{ item: "Cerezas", cantidad: 3 }, { item: "Naranjas", cantidad: 2 }, { item: "Fresas", cantidad: 2 }],
        descripcion: "Un perfumito floral hecho con las frutas más aromáticas del campo.",
        exclusivo: true
        // Raw: 3*16 + 2*20 + 2*7 = 102 → 300 = 2.9x ✓
    },
    {
        id: "fertilizante_premium", nombre: "Fertilizante Premium", cantidad: 1, emoji: "🧪", precio_venta: 200,
        ingredientes: [{ item: "Gusano", cantidad: 5 }, { item: "Piedra", cantidad: 3 }],
        descripcion: "Hecho con lo mejor del suelo. Las plantitas agradecen.",
        exclusivo: true
        // Raw: 5*3 + 3*2 = 21 → 200 = 9.5x ✓
    },
    {
        id: "collar_mascota", nombre: "Collar para Mascota", cantidad: 1, emoji: "🎀", precio_venta: 350,
        ingredientes: [{ item: "Pluma brillante", cantidad: 2 }, { item: "Cuarzo rosa", cantidad: 1 }],
        descripcion: "Un collarcito artesanal para tu mascota favorita. ¡Se ve precioso!",
        exclusivo: true
        // Raw: 2*35 + 25 = 95 → 350 = 3.7x ✓
    },
    {
        id: "elixir_oceano", nombre: "Elixir del Océano", cantidad: 1, emoji: "🌊", precio_venta: 450,
        ingredientes: [{ item: "Salmón Real", cantidad: 1 }, { item: "Trucha Arcoiris", cantidad: 2 }, { item: "Limones", cantidad: 2 }],
        descripcion: "Un brebaje con la esencia del río. Se dice que cura la tristeza.",
        exclusivo: true
        // Raw: 55 + 2*30 + 2*15 = 145 → 450 = 3.1x ✓
    },
];

// ── Mapa de precios raw de ingredientes (para calcular ganancia) ─────
const PRECIOS_RAW = {
    "Manzanas": 8, "Naranjas": 20, "Duraznos": 19, "Ciruelas": 17,
    "Peras": 18, "Cerezas": 16, "Limones": 15, "Fresas": 7,
    "Plátanos": 6, "Coco": 12, "Uvas": 5, "Sandía": 15, "Melón": 14,
    "Diamante puro": 150, "Topacio dorado": 30, "Cuarzo rosa": 25,
    "Obsidiana": 10, "Hierro": 8, "Cobre": 7, "Jade": 12, "Ópalo": 15,
    "Piedra": 2, "Amatista cristalina": 50, "Fluorita impecable": 45,
    "Pescado": 8, "Trucha Arcoiris": 30, "Salmón Real": 55,
    "Abeja Reina": 100, "Abeja Mielera": 35,
    "Mariposa Emperador": 65, "Mariposa Nocturna": 32,
    "Pluma brillante": 35, "Gusano": 3,
};

/**
 * Calcula el costo raw total de una receta
 * @param {Array} ingredientes - Lista de ingredientes
 * @returns {number} Costo total de vender ingredientes por separado
 */
function calcularCostoRaw(ingredientes) {
    return ingredientes.reduce((total, ing) => {
        const precio = PRECIOS_RAW[ing.item] || 0;
        return total + (precio * ing.cantidad);
    }, 0);
}

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
            .setDescription(`${bostezo}¡Mira todo lo que puedes crear con los ingredientes que farmeas! Usa \`/craftear [nombre]\` para crear algo.\n\n✨ = *Exclusivo de crafting (no se obtiene de otra forma)*`);

        for (const r of RECETAS) {
            const ings = r.ingredientes.map(i => `${i.item} x${i.cantidad}`).join(" + ");
            const costoRaw = calcularCostoRaw(r.ingredientes);
            const ganancia = r.precio_venta - costoRaw;
            const exclusivoTag = r.exclusivo ? " ✨" : "";
            embed.addFields({
                name: `${r.emoji} ${r.nombre}${exclusivoTag}`,
                value: `${ings} → 💰 ${r.precio_venta} 🪙 *(+${ganancia} vs raw)*`,
                inline: false
            });
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

    // Agregar resultado al catálogo de items
    try {
        await db.execute({
            sql: `INSERT OR IGNORE INTO items_economia (id, nombre, emoji, tipo, precio_venta, rareza)
                  VALUES (?, ?, ?, 'objeto', ?, 'raro')`,
            args: [receta.nombre, receta.nombre, receta.emoji, receta.precio_venta]
        });
    } catch { /* ya existe */ }

    // Agregar item crafteado al inventario
    await db.execute({
        sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
              VALUES (?, ?, ?)
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?`,
        args: [userId, receta.nombre, receta.cantidad, receta.cantidad]
    });

    // ── Maestría de crafting ─────────────────────────────────────────
    await db.execute({
        sql: `INSERT INTO crafting_maestria (user_id, receta_id, veces_crafteado)
              VALUES (?, ?, 1)
              ON CONFLICT(user_id, receta_id) DO UPDATE SET veces_crafteado = veces_crafteado + 1`,
        args: [userId, receta.id]
    });

    const resMaestria = await db.execute({
        sql: "SELECT veces_crafteado FROM crafting_maestria WHERE user_id = ? AND receta_id = ?",
        args: [userId, receta.id]
    });
    const vecesCrafteado = Number(resMaestria.rows[0]?.veces_crafteado ?? 1);
    const maestria = getMaestriaInfo(vecesCrafteado);

    // Calcular bonus de maestría y dar monedas extra
    let bonoMonedas = 0;
    if (maestria.bonus > 0) {
        bonoMonedas = Math.floor(receta.precio_venta * maestria.bonus);
        await db.execute({
            sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?",
            args: [bonoMonedas, userId]
        });
    }

    // ── Calcular ganancia vs vender raw ──────────────────────────────
    const costoRaw = calcularCostoRaw(receta.ingredientes);
    const gananciaVsRaw = receta.precio_venta - costoRaw;

    // ── Construir embed de resultado ─────────────────────────────────
    const ingsTexto = receta.ingredientes.map(i => `**${i.item}** x${i.cantidad}`).join("\n");
    const exclusivoTag = receta.exclusivo ? " ✨" : "";

    const embed = crearEmbed(CONFIG.COLORES.VERDE)
        .setTitle(`🔨 ¡Crafteo Exitoso!${exclusivoTag}`)
        .setDescription(
            `${bostezo}*Annie mezcla los ingredientes con cuidado y en un abrir y cerrar de ojos...*` +
            (receta.exclusivo ? "\n\n✨ **¡Item exclusivo de crafting!** No se consigue de otra forma." : "")
        )
        .addFields(
            { name: `${receta.emoji} Resultado`, value: `**${receta.nombre}** x${receta.cantidad}`, inline: true },
            { name: "💰 Valor de venta", value: `**${receta.precio_venta} 🪙** en \`/vender\``, inline: true },
            { name: "💡 Ganancia vs raw", value: `**+${gananciaVsRaw} 🪙** de ganancia`, inline: true },
            { name: "⚗️ Ingredientes usados", value: ingsTexto, inline: false },
            { name: "📝 Descripción", value: `*${receta.descripcion}*`, inline: false },
        );

    // Maestría info
    if (maestria.nivel) {
        const bonoTexto = bonoMonedas > 0 ? ` → **+${bonoMonedas} 🪙 bonus!**` : "";
        embed.addFields({
            name: `${maestria.nivel.emoji} Maestría: ${maestria.nivel.nombre}`,
            value: `Crafteado **${vecesCrafteado}** veces (${maestria.progreso})${bonoTexto}\n+${Math.round(maestria.bonus * 100)}% bonus por maestría`,
            inline: false
        });
    } else {
        embed.addFields({
            name: "🔰 Maestría: Novato",
            value: `Crafteado **${vecesCrafteado}** veces (${maestria.progreso})\nCraftea más para desbloquear bonuses de maestría!`,
            inline: false
        });
    }

    progresarMision(interaction.user.id, "craftear").catch(() => {});
    return interaction.followUp({ embeds: [embed] });
}
