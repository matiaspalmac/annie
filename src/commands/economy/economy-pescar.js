import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo, crearEmbed, crearEmbedDrop } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { ganarXP, obtenerNivelHabilidad, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";
import { verificarCooldown, setCooldown, detectarMacro } from "../../features/cooldown.js";
import { degradarHerramienta } from "../../services/db-helpers.js";
import { progresarMision } from "../../features/misiones.js";

// Cooldown de 5 minutos = 300000 ms
const COOLDOWN_PESCAR = 300000;

const ROD_META = {
    herr_cana_lunar: { bonusRare: 12, bonusLegend: 6, nombre: "Caña Lunar" },
    herr_cana_fibra: { bonusRare: 7, bonusLegend: 3, nombre: "Caña de Fibra" },
};

function getChileHour() {
    const formatter = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", hour12: false });
    return Number(formatter.format(new Date()));
}

function getFranja(hora) {
    if (hora >= 6 && hora < 12) return "manana";
    if (hora >= 12 && hora < 19) return "tarde";
    if (hora >= 19 && hora < 23) return "noche";
    return "madrugada";
}

const FRANJA_LABELS = {
    manana: "🌅 Mañana",
    tarde: "☀️ Tarde",
    noche: "🌙 Noche",
    madrugada: "⭐ Madrugada",
};

async function getEquippedRod(userId) {
    const res = await db.execute({
        sql: `SELECT item_id, durabilidad, max_durabilidad
              FROM herramientas_durabilidad
              WHERE user_id = ? AND equipado = 1 AND item_id LIKE 'herr_cana_%'
              LIMIT 1`,
        args: [userId]
    });

    if (res.rows.length > 0) {
        return {
            itemId: String(res.rows[0].item_id),
            durabilidad: Number(res.rows[0].durabilidad || 0),
            maxDurabilidad: Number(res.rows[0].max_durabilidad || 0),
        };
    }

    await db.execute({
        sql: `INSERT OR IGNORE INTO herramientas_durabilidad (user_id, item_id, durabilidad, max_durabilidad, equipado)
              VALUES (?, 'herr_cana_basica', 60, 60, 1)`,
        args: [userId]
    });

    return { itemId: "herr_cana_basica", durabilidad: 60, maxDurabilidad: 60 };
}

export const data = new SlashCommandBuilder()
    .setName("pescar")
    .setDescription("Lanza tu caña en el río del pueblito a ver qué pica.")
    .addBooleanOption(option =>
        option
            .setName("usar_cebo")
            .setDescription("Usar automáticamente 1 cebo simple si tienes")
            .setRequired(false)
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const usarCebo = interaction.options.getBoolean("usar_cebo") ?? true;

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const cd = await verificarCooldown(userId, "pescar", COOLDOWN_PESCAR, bostezo);
        if (!cd.ok) return interaction.editReply({ embeds: [cd.embed] });

        // 2. Establecer nuevo cooldown
        await setCooldown(userId, "pescar", COOLDOWN_PESCAR);

        // Anti-macro
        const macroMult = await detectarMacro(userId, "pescar", COOLDOWN_PESCAR);

        const rod = await getEquippedRod(userId);
        if (rod.durabilidad <= 0) {
            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("🎣 ¡Caña rota!")
                .setDescription(
                    `${bostezo}Tu caña equipada está rota, mi cielo. No puedes pescar así...\n\n` +
                    `🛒 Pasa por la \`/tienda\` a conseguir una nueva caña.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        let bonusCebo = 0;
        let consumioCebo = false;

        if (usarCebo) {
            const resCebo = await db.execute({
                sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = 'cebo_simple'",
                args: [userId]
            });
            if (resCebo.rows.length > 0 && Number(resCebo.rows[0].cantidad) > 0) {
                await db.execute({
                    sql: "UPDATE inventario_economia SET cantidad = MAX(0, cantidad - 1) WHERE user_id = ? AND item_id = 'cebo_simple'",
                    args: [userId]
                });
                bonusCebo = 8;
                consumioCebo = true;
            }
        }

        // Ganar XP de Pesca
        const xpGanada = Math.floor(Math.random() * 16) + 10;
        const nivelPesca = await ganarXP(userId, "pesca", xpGanada, interaction);

        // 3. Lógica de drops
        const horaChile = getChileHour();
        const franja = getFranja(horaChile);
        const bonoNivel = (nivelPesca - 1) * 0.5;
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 8 : 0;
        const bonusRod = ROD_META[rod.itemId] || { bonusRare: 0, bonusLegend: 0, nombre: "Caña Básica" };

        // Bonos por Clima
        let bonusClimaPeces = 0;
        let mensajeClima = "";
        try {
            const resClima = await db.execute("SELECT texto FROM clima WHERE id = 'hoy'");
            if (resClima.rows.length > 0) {
                const climaTexto = String(resClima.rows[0].texto || "").toLowerCase();
                if (climaTexto.includes("lluvia") || climaTexto.includes("tormenta") || climaTexto.includes("llovizna")) {
                    bonusClimaPeces = 6;
                    mensajeClima = "☔ *La lluvia hace que los peces suban a la superficie. +6% de suerte.*";
                } else if (climaTexto.includes("sol")) {
                    mensajeClima = "☀️ *El sol calienta el río y los peces nadan tranquilos.*";
                } else if (climaTexto.includes("nieve") || climaTexto.includes("frio") || climaTexto.includes("frío")) {
                    bonusClimaPeces = -5;
                    mensajeClima = "❄️ *El frío hace que los peces se escondan en el fondo. −5% de suerte...*";
                } else if (climaTexto.includes("nublado") || climaTexto.includes("nube")) {
                    bonusClimaPeces = 2;
                    mensajeClima = "⛅ *El cielo nublado es perfecto para pescar. +2% de suerte.*";
                }
            }
        } catch { /* Si falla el clima, ignoramos el bono */ }

        const chanceMitico = Math.min(0.5 + (bonoNivel * 0.1) + bonusSuerte + bonusRod.bonusLegend + bonusCebo + bonusClimaPeces, 8) * macroMult;
        const chanceLegendaria = Math.min(3 + (bonoNivel * 0.25) + bonusSuerte + bonusRod.bonusLegend + bonusCebo + bonusClimaPeces, 18) * macroMult;
        const chanceEpica = Math.min(8 + (bonoNivel * 0.4) + bonusSuerte + bonusRod.bonusRare + bonusCebo + bonusClimaPeces, 30) * macroMult;
        const chanceRara = Math.min(15 + (bonoNivel * 0.6) + bonusSuerte + bonusRod.bonusRare + bonusCebo + bonusClimaPeces, 45) * macroMult;
        const chanceBotella = Math.min(20 + bonoNivel + bonusSuerte + bonusRod.bonusRare + bonusCebo, 60) * macroMult;
        const rand = Math.random() * 100;

        await degradarHerramienta(userId, rod.itemId);

        const resRodAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, rod.itemId]
        });
        const durabilidadRestante = Number(resRodAfter.rows[0]?.durabilidad || 0);

        // Campos comunes para todos los drops
        const camposBase = (extras = []) => [
            { name: "🎣 Caña usada", value: `**${bonusRod.nombre}** — \`${durabilidadRestante}/${rod.maxDurabilidad} dur.\``, inline: true },
            { name: "🧭 Franja horaria", value: FRANJA_LABELS[franja] || franja, inline: true },
            { name: "📊 Nv. Pesca", value: `\`${nivelPesca}\``, inline: true },
            ...(consumioCebo ? [{ name: "🪱 Cebo", value: "*Se consumió 1x cebo simple*", inline: true }] : []),
            ...(mensajeClima ? [{ name: "🌤️ Clima del pueblito", value: mensajeClima, inline: false }] : []),
            ...extras
        ];

        // MÍTICO
        if (rand <= chanceMitico) {
            const pecesmiticos = [
                { id: "Dragón Marino", emoji: "🐉", texto: "¡¡IMPOSIBLE!! ¡Las aguas del río se volvieron negras y de ahí salió un Dragón Marino! ¡Los pescadores hablarán de esto por generaciones!" },
                { id: "Leviatán Bebé", emoji: "🐳", texto: "¡POR TODOS LOS CIELOS! ¡Un bebé Leviatán! ¡Incluso Annie salió corriendo de la oficinita a ver este milagro!" },
                { id: "Sirena Escamosa", emoji: "🧜", texto: "¡NO PUEDE SER! ¿Una Sirena? ¡Te miró directo a los ojos antes de caer en tu red! ¡Esto desafía toda lógica!" },
            ];
            const elegido = pecesmiticos[Math.floor(Math.random() * pecesmiticos.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });
            await registrarBitacora(userId, `¡¡CAPTURÓ UN ${elegido.id.toUpperCase()} MÍTICO!!`);

            const embed = crearEmbedDrop({
                emoji: elegido.emoji,
                nombre: elegido.id,
                rareza: "mitico",
                narrativa: elegido.texto,
                extras: camposBase()
            });

            progresarMision(interaction.user.id, "pescar").catch(() => {});
            return interaction.editReply({ embeds: [embed] });
        }

        // LEGENDARIO
        if (rand <= chanceLegendaria) {
            const pecesLegendarios = [
                { id: "Anguila Astral", emoji: "⚡", texto: "Tu caña vibró con energía cósmica y del agua surgió un destello dorado..." },
                { id: "Koi Dorado", emoji: "🐟", texto: "Las aguas del río brillaron en puro dorado cuando lo viste asomar..." },
                { id: "Tiburón Bebé", emoji: "🦈", texto: "¡Cuidado con esos dientecitos! Se resistió con toda su fuerza..." },
                { id: "Pez Espada Lunar", emoji: "🗡️", texto: "Su espada reflejaba la luz de la luna mientras subía a la superficie..." },
                { id: "Manta Raya Celeste", emoji: "🫶", texto: "Planeó elegantemente justo hasta caer en tu caña. Hermosa criatura..." },
                { id: "Atún Gigante", emoji: "🐟", texto: "¡Qué fuerza! Casi te arrastra al agua antes de rendirse..." },
            ];
            const elegido = pecesLegendarios[Math.floor(Math.random() * pecesLegendarios.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });
            await registrarBitacora(userId, `Capturó un legendario ${elegido.id}!`);

            const embed = crearEmbedDrop({
                emoji: elegido.emoji,
                nombre: elegido.id,
                rareza: "legendario",
                narrativa: `🌊 *¡Mini-evento legendario de pesca!*\n\n${elegido.texto}`,
                extras: camposBase()
            });

            progresarMision(interaction.user.id, "pescar").catch(() => {});
            return interaction.editReply({ embeds: [embed] });
        }

        // ÉPICO
        if (rand <= chanceEpica) {
            const pecesEpicos = [
                { id: "Salmón Real", emoji: "🐟", texto: "Un salmón majestuoso que brillaba como metal bajo el agua." },
                { id: "Lubina Plateada", emoji: "🐠", texto: "Brillaba como plata pura cuando salió del agua." },
                { id: "Pez Globo Mágico", emoji: "🐡", texto: "¡Se infló sorprendido cuando lo sacaste! Qué personaje..." },
                { id: "Caballito de Mar Dorado", emoji: "🫘", texto: "Diminuto pero valiosísimo. ¡Qué hallazgo tan especial!" },
                { id: "Medusa Luna", emoji: "🌙", texto: "Translúcida y brillante, como un pedazo del cielo nocturno..." },
            ];
            const elegido = pecesEpicos[Math.floor(Math.random() * pecesEpicos.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });

            const embed = crearEmbedDrop({
                emoji: elegido.emoji,
                nombre: elegido.id,
                rareza: "epico",
                narrativa: `🎣 *¡Tirón fuerte en la caña!*\n\n${elegido.texto}`,
                extras: camposBase()
            });

            progresarMision(interaction.user.id, "pescar").catch(() => {});
            return interaction.editReply({ embeds: [embed] });
        }

        // RARO
        if (rand <= chanceRara) {
            const pecesRaros = [
                { id: "Trucha Arcoiris", emoji: "🌈", texto: "Sus escamas tienen todos los colores del arcoiris. Preciosa." },
                { id: "Carpa Koi", emoji: "🐟", texto: "Naranja y blanca, muy bonita. Con manchas simétricas." },
                { id: "Pez Payaso", emoji: "🤡", texto: "Naranjita con rayas blancas. Muy activo en el anzuelo." },
                { id: "Morena Verde", emoji: "🐍", texto: "Larga y resbaladiza, casi se te escapa antes de atraparla." },
                { id: "Perca Dorada", emoji: "🟡", texto: "Sus escamas brillan con tonos dorados bajo el sol." },
            ];
            const elegido = pecesRaros[Math.floor(Math.random() * pecesRaros.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });

            const embed = crearEmbedDrop({
                emoji: elegido.emoji,
                nombre: elegido.id,
                rareza: "raro",
                narrativa: `🎣 *Splash... algo picó!*\n\n${elegido.texto}`,
                extras: camposBase()
            });

            progresarMision(interaction.user.id, "pescar").catch(() => {});
            return interaction.editReply({ embeds: [embed] });
        }

        // BOTELLA CON MENSAJE
        if (rand <= chanceBotella) {
            const monedasGanadas = Math.floor(Math.random() * 41) + 10 + (nivelPesca * 2);

            await db.execute({
                sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
              VALUES (?, ?, 0, 1) 
              ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
                args: [userId, monedasGanadas]
            });
            await registrarBitacora(userId, `¡Pescó una misteriosa Botella con mensaje!`);

            const embed = crearEmbedDrop({
                emoji: "📜",
                nombre: "Botella con Mensaje",
                rareza: "raro",
                narrativa:
                    `🎣 *Sientes un tirón extraño en la caña...*\n\n` +
                    `¡Atrapaste una **📜 Botella con mensaje**! Adentro del vidrio había **${monedasGanadas} moneditas** esperándote. 🪙`,
                extras: [
                    { name: "💰 Monedas encontradas", value: `**+${monedasGanadas} 🪙**`, inline: true },
                    ...camposBase()
                ]
            });

            progresarMision(interaction.user.id, "pescar").catch(() => {});
            return interaction.editReply({ embeds: [embed] });
        }

        // COMÚN (por franja horaria)
        const tablaPorFranja = {
            manana: [{ id: "Pescado", emoji: "🐟" }, { id: "Trucha Clara", emoji: "🐠" }, { id: "Mojarra", emoji: "🐟" }, { id: "Bagre Joven", emoji: "🐟" }],
            tarde: [{ id: "Pescado", emoji: "🐟" }, { id: "Carpa Soleada", emoji: "🐠" }, { id: "Róbalo", emoji: "🐟" }, { id: "Pejerrey", emoji: "🐠" }],
            noche: [{ id: "Pescado", emoji: "🐟" }, { id: "Bagre Sombrío", emoji: "🐟" }, { id: "Anguila Común", emoji: "🐍" }, { id: "Pez Gato", emoji: "🐈" }],
            madrugada: [{ id: "Pescado", emoji: "🐟" }, { id: "Sardina de Luna", emoji: "🌙" }, { id: "Anchoa Nocturna", emoji: "🐟" }, { id: "Boquerón", emoji: "🐠" }],
        };
        const pool = tablaPorFranja[franja] || [{ id: "Pescado", emoji: "🐟" }];
        const elegido = pool[Math.floor(Math.random() * pool.length)];

        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
              VALUES (?, ?, 1) 
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
            args: [userId, elegido.id]
        });

        const mensajesPesca = [
            "*Splash...*\n\nAlgo picó bajo el agua...",
            "*La caña se doblaaaa...*\n\nUn tirón suave pero seguro...",
            "*Burbujitas en el río...*\n\nAlgo se acercó al anzuelo...",
            "*La caña se dobla un poquito...*\n\nCon paciencia lo sacas...",
            "*Calma total en el río... y de pronto...*\n\nUn leve tirón!",
        ];
        const mensajeAleatorio = mensajesPesca[Math.floor(Math.random() * mensajesPesca.length)];

        const embed = crearEmbedDrop({
            emoji: elegido.emoji,
            nombre: elegido.id,
            rareza: "comun",
            narrativa: `🎣 ${mensajeAleatorio}`,
            extras: camposBase()
        });

        progresarMision(interaction.user.id, "pescar").catch(() => {});
        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /pescar:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Se enredó el hilo!")
            .setDescription(`${bostezo}Pucha, se me enredó el hilo de la caña. Intentemos de nuevo después, corazón.`);
        return interaction.editReply({ embeds: [embed] });
    }
}
