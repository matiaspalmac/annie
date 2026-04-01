import { db } from "../services/db.js";

// ── Mapa de bonificaciones por tipo de mascota ──────────────────────────
const PET_BONUSES = {
    mascota_kiltro: {
        tipo: "economia",
        label: "Monedas por venta",
        emoji: "🪙",
        baseMultiplicador: 0.10, // +10% base
        descripcion: "+{pct}% monedas al vender"
    },
    mascota_gatito: {
        tipo: "suerte",
        label: "Drops raros",
        emoji: "🍀",
        baseMultiplicador: 0.08, // +8% base
        descripcion: "+{pct}% chance de drops raros"
    },
    mascota_pudu: {
        tipo: "xp",
        label: "Experiencia",
        emoji: "✨",
        baseMultiplicador: 0.15, // +15% base
        descripcion: "+{pct}% XP de todas las fuentes"
    }
};

// ── Constantes de nivelado ──────────────────────────────────────────────
const MAX_NIVEL = 20;
const BONUS_PER_LEVEL = 0.005; // +0.5% por nivel

/**
 * Calcula el nivel a partir de la XP acumulada de la mascota.
 * Formula: nivel = floor(sqrt(xp / 10)) + 1, max 20
 * @param {number} xp - XP acumulada de la mascota
 * @returns {number} Nivel calculado (1-20)
 */
export function calcularNivelMascota(xp) {
    const nivel = Math.floor(Math.sqrt(xp / 10)) + 1;
    return Math.min(nivel, MAX_NIVEL);
}

/**
 * Calcula la XP necesaria para alcanzar un nivel dado.
 * Inversa de la formula: xp = (nivel - 1)^2 * 10
 * @param {number} nivel - Nivel objetivo
 * @returns {number} XP total necesaria para ese nivel
 */
export function xpParaNivel(nivel) {
    return Math.pow(nivel - 1, 2) * 10;
}

/**
 * Obtiene la bonificacion activa de la mascota de un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @returns {Promise<Object|null>} Objeto con { tipo, multiplicador, activo, nivel, label, emoji, descripcion, mascotaId } o null si no hay mascota
 */
export async function getPetBonus(userId) {
    try {
        if (!userId) return null;

        // Obtener mascota activa
        const resMascota = await db.execute({
            sql: "SELECT mascota_id FROM usuarios WHERE id = ?",
            args: [String(userId)]
        });

        if (!resMascota?.rows?.length || !resMascota.rows[0].mascota_id) return null;

        const mascotaId = String(resMascota.rows[0].mascota_id);
        const bonusInfo = PET_BONUSES[mascotaId];
        if (!bonusInfo) return null;

        // Obtener estado de la mascota
        const resEstado = await db.execute({
            sql: "SELECT felicidad, hambre, nivel, xp FROM mascotas_estado WHERE user_id = ?",
            args: [String(userId)]
        });

        let felicidad = 50;
        let hambre = 50;
        let nivel = 1;
        let xp = 0;

        if (resEstado?.rows?.length > 0) {
            felicidad = Number(resEstado.rows[0].felicidad ?? 50);
            hambre = Number(resEstado.rows[0].hambre ?? 50);
            nivel = Number(resEstado.rows[0].nivel ?? 1);
            xp = Number(resEstado.rows[0].xp ?? 0);
        }

        // Bonus activo solo si mascota contenta (felicidad >= 60 AND hambre <= 50)
        const activo = felicidad >= 60 && hambre <= 50;

        // Calcular multiplicador con bonus de nivel: base + (nivel * 0.5%)
        const multiplicadorExtra = nivel * BONUS_PER_LEVEL;
        const multiplicadorTotal = 1 + bonusInfo.baseMultiplicador + multiplicadorExtra;
        const porcentaje = Math.round((bonusInfo.baseMultiplicador + multiplicadorExtra) * 100 * 10) / 10;

        return {
            tipo: bonusInfo.tipo,
            multiplicador: multiplicadorTotal,
            activo,
            nivel,
            xp,
            label: bonusInfo.label,
            emoji: bonusInfo.emoji,
            descripcion: bonusInfo.descripcion.replace("{pct}", porcentaje.toString()),
            mascotaId,
            porcentaje
        };
    } catch (err) {
        console.error("[MascotaBonus] Error en getPetBonus:", err);
        return null;
    }
}

export { PET_BONUSES, MAX_NIVEL, BONUS_PER_LEVEL };
