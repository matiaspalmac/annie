import { db } from "../services/db.js";

// ── Constantes ────────────────────────────────────────────────────────────
/** Apuesta mínima permitida en el casino */
export const CASINO_MIN_BET = 50;

/** Apuesta máxima permitida en el casino */
export const CASINO_MAX_BET = 50000;

/** Cooldown entre apuestas en milisegundos (8 segundos) */
export const CASINO_COOLDOWN = 8000;

/** Límite de registros para ranking de casino */
const CASINO_TOP_LIMIT = 10;

// ── Validaciones ──────────────────────────────────────────────────────

/**
 * Valida que la cantidad de apuesta esté dentro de los límites permitidos.
 * @param {number} cantidad - Cantidad a validar
 * @returns {{ok: boolean, mensaje?: string}} Resultado de la validación
 */
export function validarApuesta(cantidad) {
  const monto = Number(cantidad);
  if (isNaN(monto) || monto < CASINO_MIN_BET || monto > CASINO_MAX_BET) {
    return {
      ok: false,
      mensaje: `❌ La apuesta debe estar entre **${CASINO_MIN_BET}** y **${CASINO_MAX_BET}** monedas.`,
    };
  }
  return { ok: true };
}

/**
 * Verifica si el usuario tiene cooldown activo para jugar en el casino.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @returns {Promise<{ok: boolean, mensaje?: string}>} Resultado de la verificación
 */
export async function verificarCooldownCasino(userId) {
  try {
    if (!userId) return { ok: false, mensaje: "❌ Usuario inválido." };

    const now = Date.now();
    const res = await db.execute({
      sql: `SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'casino' AND extra_id = ''`,
      args: [String(userId)],
    });

    if (res?.rows?.length > 0) {
      const limite = Number(res.rows[0]?.fecha_limite ?? 0);
      if (now < limite) {
        const restante = Math.ceil((limite - now) / 1000);
        return {
          ok: false,
          mensaje: `⏳ Debes esperar **${restante}s** antes de apostar de nuevo.`,
        };
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[Casino] Error verificando cooldown:", err);
    return { ok: false, mensaje: "❌ Error verificando cooldown." };
  }
}

/**
 * Actualiza el cooldown de casino para un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @returns {Promise<void>}
 */
export async function actualizarCooldownCasino(userId) {
  try {
    if (!userId) return;
    const limite = Date.now() + CASINO_COOLDOWN;
    await db.execute({
      sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) VALUES (?, 'casino', '', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
      args: [String(userId), limite],
    });
  } catch (err) {
    console.error("[Casino] Error actualizando cooldown:", err);
  }
}

/**
 * Obtiene el balance de monedas de un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @returns {Promise<number>} Cantidad de monedas (0 si no existe)
 */
export async function obtenerBalance(userId) {
  try {
    if (!userId) return 0;
    const res = await db.execute({
      sql: `SELECT monedas FROM usuarios WHERE id = ?`,
      args: [String(userId)],
    });
    return res?.rows?.length > 0 ? Number(res.rows[0]?.monedas ?? 0) : 0;
  } catch (err) {
    console.error("[Casino] Error obteniendo balance:", err);
    return 0;
  }
}

/**
 * Actualiza el balance de monedas de un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {number} nuevasMonedas - Nueva cantidad de monedas
 * @returns {Promise<void>}
 */
export async function actualizarBalance(userId, nuevasMonedas) {
  try {
    if (!userId) return;
    const monedas = Math.max(0, Number(nuevasMonedas) || 0);
    await db.execute({
      sql: `UPDATE usuarios SET monedas = ? WHERE id = ?`,
      args: [monedas, String(userId)],
    });
  } catch (err) {
    console.error("[Casino] Error actualizando balance:", err);
  }
}

/**
 * Actualiza las estadísticas del casino para un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {boolean} gano - Si el usuario ganó la apuesta
 * @param {number} apuesta - Cantidad apostada
 * @param {number} ganancia - Cantidad ganada (incluye la apuesta original)
 * @returns {Promise<void>}
 */
export async function actualizarEstadisticasCasino(userId, gano, apuesta, ganancia) {
  try {
    if (!userId) return;
    const netWinnings = Number(ganancia) - Number(apuesta);

    await db.execute({
      sql: `INSERT INTO casino_stats (user_id, wins, losses, total_betted, net_winnings)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              wins = wins + excluded.wins,
              losses = losses + excluded.losses,
              total_betted = total_betted + excluded.total_betted,
              net_winnings = net_winnings + excluded.net_winnings`,
      args: [String(userId), gano ? 1 : 0, gano ? 0 : 1, Number(apuesta), netWinnings],
    });
  } catch (err) {
    console.error("[Casino] Error actualizando estadísticas:", err);
  }
}

/**
 * Obtiene las estadísticas de casino de un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @returns {Promise<{wins: number, losses: number, total_betted: number, net_winnings: number}>}
 */
export async function obtenerEstadisticasCasino(userId) {
  try {
    if (!userId) return { wins: 0, losses: 0, total_betted: 0, net_winnings: 0 };

    const res = await db.execute({
      sql: `SELECT wins, losses, total_betted, net_winnings FROM casino_stats WHERE user_id = ?`,
      args: [String(userId)],
    });

    if (!res?.rows?.length) {
      return { wins: 0, losses: 0, total_betted: 0, net_winnings: 0 };
    }

    return {
      wins: Number(res.rows[0]?.wins ?? 0),
      losses: Number(res.rows[0]?.losses ?? 0),
      total_betted: Number(res.rows[0]?.total_betted ?? 0),
      net_winnings: Number(res.rows[0]?.net_winnings ?? 0),
    };
  } catch (err) {
    console.error("[Casino] Error obteniendo estadísticas:", err);
    return { wins: 0, losses: 0, total_betted: 0, net_winnings: 0 };
  }
}

/**
 * Obtiene el ranking de mejores jugadores del casino.
 * @async
 * @param {number} [limit=10] - Cantidad de jugadores a retornar
 * @returns {Promise<Array<{userId: string, wins: number, losses: number, totalBetted: number, netWinnings: number}>>}
 */
export async function obtenerTopCasino(limit = CASINO_TOP_LIMIT) {
  try {
    const numLimit = Math.min(Math.max(1, Number(limit) || CASINO_TOP_LIMIT), 50);
    const res = await db.execute({
      sql: `SELECT user_id, wins, losses, total_betted, net_winnings 
            FROM casino_stats 
            WHERE total_betted > 0 
            ORDER BY net_winnings DESC 
            LIMIT ?`,
      args: [numLimit],
    });

    return (res?.rows ?? []).map((row) => ({
      userId: String(row?.user_id ?? ""),
      wins: Number(row?.wins ?? 0),
      losses: Number(row?.losses ?? 0),
      totalBetted: Number(row?.total_betted ?? 0),
      netWinnings: Number(row?.net_winnings ?? 0),
    }));
  } catch (err) {
    console.error("[Casino] Error obteniendo top casino:", err);
    return [];
  }
}
