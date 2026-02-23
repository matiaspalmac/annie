import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";
import { ganarXP, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";

// Cooldown de 5 minutos = 300000 ms
const COOLDOWN_MINAR = 300000;

const PICK_META = {
    herr_pico_acero: { bonusRare: 14, nombre: "Pico de Acero", maxDurabilidad: 120 },
    herr_pico_hierro: { bonusRare: 8, nombre: "Pico de Hierro", maxDurabilidad: 80 },
};

function getSeasonBonus() {
    const month = new Date().getMonth() + 1;
    // Invierno austral: junio-agosto
    if ([6, 7, 8].includes(month)) return 1.15;
    // Verano austral: diciembre-febrero
    if ([12, 1, 2].includes(month)) return 0.95;
    return 1;
}

async function getEquippedPick(userId) {
    const res = await db.execute({
        sql: `SELECT item_id, durabilidad, max_durabilidad
              FROM herramientas_durabilidad
              WHERE user_id = ? AND equipado = 1 AND item_id LIKE 'herr_pico_%'
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
              VALUES (?, 'herr_pico_basico', 50, 50, 1)`,
        args: [userId]
    });

    return { itemId: "herr_pico_basico", durabilidad: 50, maxDurabilidad: 50 };
}

export const data = new SlashCommandBuilder()
    .setName("minar")
    .setDescription("Golpea las rocas cerca del pueblito para obtener materiales.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'minar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Ay mi tesoro, tienes los bracitos cansados. Espera **${faltanMinutos} minutos** antes de volver a picar piedritas.`);
            }
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_MINAR;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'minar', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        const pick = await getEquippedPick(userId);
        if (pick.durabilidad <= 0) {
            return interaction.followUp(`${bostezo}Tu pico equipado está roto, corazón. Necesitas repararlo o comprar una herramienta en **/tienda**.`);
        }

        // Ganar XP de Minería (10 a 20 xp por intento)
        const xpGanada = Math.floor(Math.random() * 11) + 10;
        const nivelMineria = await ganarXP(userId, "mineria", xpGanada, interaction);

        // 3. Lógica de drops
        const bonoNivel = (nivelMineria - 1) * 0.5;
        const rand = Math.random() * 100;
        let itemId = "";
        let emoji = "";
        let rarezaTexto = "";

        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 10 : 0;
        const bonusPick = PICK_META[pick.itemId]?.bonusRare || 0;
        const chanceFluorita = Math.min(5 + bonoNivel + bonusSuerte + bonusPick, 45);
        const chanceMineral = Math.min(30 + (bonoNivel * 1.5) + bonusSuerte, 70);

        await db.execute({
            sql: "UPDATE herramientas_durabilidad SET durabilidad = MAX(0, durabilidad - 1) WHERE user_id = ? AND item_id = ?",
            args: [userId, pick.itemId]
        });

        const resPickAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, pick.itemId]
        });
        const durRestante = Number(resPickAfter.rows[0]?.durabilidad || 0);

        // Evento raro de minería
        const chanceEventoRaro = Math.min(4 + (nivelMineria * 0.15) + bonusPick, 25);
        if (Math.random() * 100 <= chanceEventoRaro) {
            const evento = Math.random() < 0.5 ? "veta" : "caverna";
            const recompensa = evento === "veta" ? 2 : 1;
            const itemEvento = evento === "veta" ? "Mineral" : "Fluorita impecable";

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                      VALUES (?, ?, ?)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
                args: [userId, itemEvento, recompensa]
            });

            return interaction.followUp(
                `⛏️ **¡Evento raro de minería!**\n` +
                `${evento === "veta" ? "Encontraste una veta rica escondida." : "Diste con una mini-caverna cristalina."}\n` +
                `Ganaste **${recompensa}x ${itemEvento}**.\n` +
                `🛠️ Durabilidad de ${PICK_META[pick.itemId]?.nombre || "Pico básico"}: **${durRestante}/${pick.maxDurabilidad}** *(Nv. Minería: ${nivelMineria})*`
            );
        }

        if (rand <= chanceFluorita) {
            itemId = "Fluorita impecable";
            emoji = "💎";
            rarezaTexto = "¡Cielo santo! ¡Qué brillo tan hermoso!";
            await registrarBitacora(userId, `Desenterró una codiciada Fluorita impecable.`);
        } else if (rand <= chanceMineral) {
            itemId = "Mineral";
            emoji = "🪨✨"; // Mineral genérico
            rarezaTexto = "¡Conseguiste algo de mineral brillante!";
        } else {
            itemId = "Piedra";
            emoji = "🪨";
            rarezaTexto = "¡Pura piedrecilla sólida y rústica!";
        }

        // 4. Guardar en inventario (ajuste económico estacional)
        const seasonFactor = getSeasonBonus();
        const cantidadDrop = (itemId === "Piedra" || seasonFactor < 1) ? 1 : Math.random() < (seasonFactor - 1) ? 2 : 1;

        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
            args: [userId, itemId, cantidadDrop]
        });

        // 5. Mensaje de éxito
        return interaction.followUp(
            `⛏️ *Clink, clink... clank!*\n\n${rarezaTexto}\n` +
            `Has obtenido **${cantidadDrop}x ${emoji} ${itemId}**.\n` +
            `📈 Ajuste estacional: **x${seasonFactor.toFixed(2)}**\n` +
            `🛠️ Durabilidad de ${PICK_META[pick.itemId]?.nombre || "Pico básico"}: **${durRestante}/${pick.maxDurabilidad}** *(Nv. Minería: ${nivelMineria})*`
        );

    } catch (error) {
        console.error("Error en comando /minar:", error);
        return interaction.followUp(`${bostezo}Uy... la pala se me resbaló y no pude picar nada. ¡Inténtalo de nuevo más ratito!`);
    }
}
