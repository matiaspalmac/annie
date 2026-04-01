/**
 * Helper unificado de cooldown + detección anti-macro.
 *
 * Reemplaza las ~15 lineas duplicadas en pescar, minar, talar, capturar, fotografiar.
 * También incluye detección de macro que antes solo existía en capturar.
 */
import { db } from "../services/db.js";
import { crearEmbedCooldown } from "../core/utils.js";

// ── Anti-macro: tolerancia en ms para detectar timing "perfecto" ──
const MACRO_TOLERANCIA_MS = 2500;
const MACRO_UMBRAL = 3; // Detecciones antes de penalizar
const MACRO_PENALIZACION = 0.8; // Multiplica chances de drop

/**
 * Verifica el cooldown de un comando para un usuario.
 * Si está en cooldown, retorna un embed listo para enviar.
 *
 * @param {string} userId - ID del usuario
 * @param {string} comando - Nombre del comando (pescar, minar, etc.)
 * @param {number} cooldownMs - Duración del cooldown en ms
 * @param {string} [bostezo=""] - Saludo de Annie
 * @returns {Promise<{ok: boolean, embed?: import("discord.js").EmbedBuilder}>}
 */
export async function verificarCooldown(userId, comando, cooldownMs, bostezo = "") {
  const ahora = Date.now();

  const res = await db.execute({
    sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = ? AND extra_id = 'global'",
    args: [userId, comando],
  });

  if (res.rows.length > 0) {
    const limite = Number(res.rows[0].fecha_limite);
    if (ahora < limite) {
      const faltanMinutos = Math.ceil((limite - ahora) / 60000);
      const embed = crearEmbedCooldown(faltanMinutos, bostezo.trim(), comando);
      return { ok: false, embed };
    }
  }

  return { ok: true };
}

/**
 * Establece/renueva el cooldown de un comando.
 *
 * @param {string} userId
 * @param {string} comando
 * @param {number} cooldownMs
 */
export async function setCooldown(userId, comando, cooldownMs) {
  const nuevoLimite = Date.now() + cooldownMs;
  await db.execute({
    sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite)
          VALUES (?, ?, 'global', ?)
          ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
    args: [userId, comando, nuevoLimite],
  });
}

/**
 * Detecta patrones de macro (ejecución con timing perfecto al cooldown).
 * Retorna un multiplicador de penalización (1.0 = sin penalización, 0.8 = penalizado).
 *
 * @param {string} userId
 * @param {string} comando
 * @param {number} cooldownMs - Cooldown del comando (para comparar timing)
 * @returns {Promise<number>} Multiplicador de penalización (1.0 o MACRO_PENALIZACION)
 */
export async function detectarMacro(userId, comando, cooldownMs) {
  const ahora = Date.now();

  try {
    const res = await db.execute({
      sql: "SELECT ultimo_ts, patron_count FROM macro_patrones WHERE user_id = ? AND comando = ?",
      args: [userId, comando],
    });

    let patronCount = Number(res.rows[0]?.patron_count || 0);
    const ultimoTs = Number(res.rows[0]?.ultimo_ts || 0);
    const delta = ultimoTs > 0 ? (ahora - ultimoTs) : 0;

    // Si el delta está sospechosamente cerca del cooldown exacto → incrementar
    if (delta > 0 && Math.abs(delta - cooldownMs) <= MACRO_TOLERANCIA_MS) {
      patronCount += 1;
    } else {
      patronCount = Math.max(0, patronCount - 1);
    }

    // Guardar nuevo estado
    await db.execute({
      sql: `INSERT INTO macro_patrones (user_id, comando, ultimo_ts, patron_count)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, comando) DO UPDATE SET ultimo_ts = excluded.ultimo_ts, patron_count = excluded.patron_count`,
      args: [userId, comando, ahora, patronCount],
    });

    return patronCount >= MACRO_UMBRAL ? MACRO_PENALIZACION : 1.0;
  } catch (err) {
    console.error("[Macro] Error detectando macro:", err.message);
    return 1.0; // No penalizar si falla la detección
  }
}
