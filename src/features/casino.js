import { db } from "../services/db.js";

// ── Constantes ────────────────────────────────────────────────────────────
export const CASINO_MIN_BET = 50;
export const CASINO_MAX_BET = 50000;
export const CASINO_COOLDOWN = 8000; // 8 segundos

// ── Validar apuesta ───────────────────────────────────────────────────────
export function validarApuesta(cantidad) {
  if (isNaN(cantidad) || cantidad < CASINO_MIN_BET || cantidad > CASINO_MAX_BET) {
    return {
      ok: false,
      mensaje: `❌ La apuesta debe estar entre **${CASINO_MIN_BET}** y **${CASINO_MAX_BET}** monedas.`,
    };
  }
  return { ok: true };
}

// ── Verificar cooldown ────────────────────────────────────────────────────
export async function verificarCooldownCasino(userId) {
  const now = Date.now();
  const res = await db.execute({
    sql: `SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'casino' AND extra_id = ''`,
    args: [userId],
  });

  if (res.rows.length > 0) {
    const limite = Number(res.rows[0].fecha_limite);
    if (now < limite) {
      const restante = Math.ceil((limite - now) / 1000);
      return {
        ok: false,
        mensaje: `⏳ Debes esperar **${restante}s** antes de apostar de nuevo.`,
      };
    }
  }
  return { ok: true };
}

// ── Actualizar cooldown ───────────────────────────────────────────────────
export async function actualizarCooldownCasino(userId) {
  const limite = Date.now() + CASINO_COOLDOWN;
  await db.execute({
    sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) VALUES (?, 'casino', '', ?) 
          ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
    args: [userId, limite],
  });
}

// ── Obtener balance del usuario ───────────────────────────────────────────
export async function obtenerBalance(userId) {
  const res = await db.execute({
    sql: `SELECT monedas FROM usuarios WHERE id = ?`,
    args: [userId],
  });
  return res.rows.length > 0 ? Number(res.rows[0].monedas) : 0;
}

// ── Actualizar balance ────────────────────────────────────────────────────
export async function actualizarBalance(userId, nuevasMonedas) {
  await db.execute({
    sql: `UPDATE usuarios SET monedas = ? WHERE id = ?`,
    args: [nuevasMonedas, userId],
  });
}

// ── Actualizar estadísticas del casino ────────────────────────────────────
export async function actualizarEstadisticasCasino(userId, gano, apuesta, ganancia) {
  const netWinnings = ganancia - apuesta;

  await db.execute({
    sql: `INSERT INTO casino_stats (user_id, wins, losses, total_betted, net_winnings)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            wins = wins + excluded.wins,
            losses = losses + excluded.losses,
            total_betted = total_betted + excluded.total_betted,
            net_winnings = net_winnings + excluded.net_winnings`,
    args: [userId, gano ? 1 : 0, gano ? 0 : 1, apuesta, netWinnings],
  });
}

// ── Obtener estadísticas de un usuario ────────────────────────────────────
export async function obtenerEstadisticasCasino(userId) {
  const res = await db.execute({
    sql: `SELECT wins, losses, total_betted, net_winnings FROM casino_stats WHERE user_id = ?`,
    args: [userId],
  });

  if (res.rows.length === 0) {
    return { wins: 0, losses: 0, total_betted: 0, net_winnings: 0 };
  }

  return {
    wins: Number(res.rows[0].wins),
    losses: Number(res.rows[0].losses),
    total_betted: Number(res.rows[0].total_betted),
    net_winnings: Number(res.rows[0].net_winnings),
  };
}

// ── Obtener top ganadores del casino ──────────────────────────────────────
export async function obtenerTopCasino(limit = 10) {
  const res = await db.execute({
    sql: `SELECT user_id, wins, losses, total_betted, net_winnings 
          FROM casino_stats 
          WHERE total_betted > 0 
          ORDER BY net_winnings DESC 
          LIMIT ?`,
    args: [limit],
  });

  return res.rows.map((row) => ({
    userId: row.user_id,
    wins: Number(row.wins),
    losses: Number(row.losses),
    totalBetted: Number(row.total_betted),
    netWinnings: Number(row.net_winnings),
  }));
}
