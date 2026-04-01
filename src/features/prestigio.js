/**
 * Sistema de Prestigio — Heartopia
 *
 * Cuando un usuario alcanza nivel 50+, puede "prestigiar":
 * - Resetea nivel, XP, monedas de bolsillo, racha diaria y stats de casino
 * - Conserva colecciones, títulos, inventario, banco, habilidades, mascotas
 * - Gana un multiplicador permanente (+10% por nivel de prestigio) a monedas, XP, drops
 * - Recibe un título exclusivo y (opcionalmente) un marco de perfil
 */
import { db } from "../services/db.js";
import { getFechaChile } from "../core/utils.js";

// ── Constantes ────────────────────────────────────────────────────────────

const NIVEL_MINIMO_PRESTIGIO = 50;
const BONUS_POR_PRESTIGIO = 0.10; // +10% per prestige level
const MAX_PRESTIGIO = 10; // Cap at prestige 10 (x2.0 multiplier)

/** Recompensas exclusivas por nivel de prestigio */
const RECOMPENSAS_PRESTIGIO = {
  1:  { titulo: "⭐ Renacido/a",                marco: "marco_prestigio_1",  monedas_inicio: 500 },
  2:  { titulo: "⭐⭐ Veterano/a",              marco: "marco_prestigio_2",  monedas_inicio: 1000 },
  3:  { titulo: "⭐⭐⭐ Leyenda",               marco: "marco_prestigio_3",  monedas_inicio: 1500 },
  4:  { titulo: "🌟 Alma del Pueblo",            marco: "marco_prestigio_4",  monedas_inicio: 2000 },
  5:  { titulo: "🌟🌟 Guardián/a Eterno/a",     marco: "marco_prestigio_5",  monedas_inicio: 2500 },
  6:  { titulo: "💫 Espíritu de Heartopia",      marco: null,                 monedas_inicio: 3000 },
  7:  { titulo: "💫💫 Corazón del Mundo",        marco: null,                 monedas_inicio: 3500 },
  8:  { titulo: "✨ Inmortal del Pueblito",      marco: null,                 monedas_inicio: 4000 },
  9:  { titulo: "✨✨ Trascendente",             marco: null,                 monedas_inicio: 4500 },
  10: { titulo: "🏆 El/La Absoluto/a",           marco: null,                 monedas_inicio: 5000 },
};

// ── Helpers públicos ──────────────────────────────────────────────────────

/**
 * Devuelve las estrellas de prestigio para mostrar en perfil/ranking.
 * @param {number} nivel - Nivel de prestigio (0-10)
 * @returns {string} Representación visual (ej: "⭐⭐⭐" o "" si es 0)
 */
export function renderEstrellas(nivel) {
  const n = Math.max(0, Math.min(MAX_PRESTIGIO, Number(nivel) || 0));
  if (n === 0) return "";
  if (n <= 3) return "⭐".repeat(n);
  if (n <= 5) return "🌟".repeat(n - 3) + "⭐".repeat(3);
  if (n <= 7) return "💫".repeat(n - 5) + "🌟🌟⭐⭐⭐";
  if (n <= 9) return "✨".repeat(n - 7) + "💫💫🌟🌟⭐⭐⭐";
  return "🏆✨✨💫💫🌟🌟⭐⭐⭐"; // level 10
}

/**
 * Obtiene toda la información de prestigio de un usuario.
 * @param {string} userId
 * @returns {Promise<{nivel: number, multiplicador: number, puedePrestigiar: boolean, nivelUsuario: number, recompensaActual: object|null, recompensaSiguiente: object|null}>}
 */
export async function getPrestigio(userId) {
  // Nivel de prestigio
  const resPrest = await db.execute({
    sql: "SELECT nivel_prestigio FROM prestigio WHERE user_id = ?",
    args: [String(userId)],
  });
  const nivel = resPrest.rows.length > 0 ? Number(resPrest.rows[0].nivel_prestigio ?? 0) : 0;

  // Nivel del usuario
  const resUser = await db.execute({
    sql: "SELECT nivel FROM usuarios WHERE id = ?",
    args: [String(userId)],
  });
  const nivelUsuario = resUser.rows.length > 0 ? Number(resUser.rows[0].nivel ?? 1) : 1;

  const multiplicador = 1 + (nivel * BONUS_POR_PRESTIGIO);
  const puedePrestigiar = nivelUsuario >= NIVEL_MINIMO_PRESTIGIO && nivel < MAX_PRESTIGIO;

  return {
    nivel,
    multiplicador: Math.round(multiplicador * 100) / 100,
    puedePrestigiar,
    nivelUsuario,
    recompensaActual: RECOMPENSAS_PRESTIGIO[nivel] || null,
    recompensaSiguiente: RECOMPENSAS_PRESTIGIO[nivel + 1] || null,
  };
}

/**
 * Devuelve el multiplicador de prestigio de un usuario.
 * Llamar desde otros comandos para aplicar bonus a monedas/XP/drops.
 * @param {string} userId
 * @returns {Promise<number>} 1.0, 1.1, 1.2, ... 2.0
 */
export async function getMultiplicadorPrestigio(userId) {
  try {
    const res = await db.execute({
      sql: "SELECT nivel_prestigio FROM prestigio WHERE user_id = ?",
      args: [String(userId)],
    });
    const nivel = res.rows.length > 0 ? Number(res.rows[0].nivel_prestigio ?? 0) : 0;
    return Math.round((1 + nivel * BONUS_POR_PRESTIGIO) * 100) / 100;
  } catch {
    return 1.0;
  }
}

/**
 * Ejecuta el prestigio para un usuario.
 * @param {string} userId
 * @returns {Promise<{ok: boolean, nuevoNivel: number, recompensa: object|null, mensaje?: string}>}
 */
export async function ejecutarPrestigio(userId) {
  const uid = String(userId);

  // 1. Obtener datos del usuario
  const resUser = await db.execute({
    sql: "SELECT nivel FROM usuarios WHERE id = ?",
    args: [uid],
  });
  if (resUser.rows.length === 0) {
    return { ok: false, nuevoNivel: 0, recompensa: null, mensaje: "No estás registrado/a en el pueblito todavía." };
  }
  const nivelUsuario = Number(resUser.rows[0].nivel ?? 1);

  // 2. Check nivel mínimo
  if (nivelUsuario < NIVEL_MINIMO_PRESTIGIO) {
    return {
      ok: false,
      nuevoNivel: 0,
      recompensa: null,
      mensaje: `Necesitas ser **Nivel ${NIVEL_MINIMO_PRESTIGIO}** para prestigiar. Actualmente estás en Nivel ${nivelUsuario}.`,
    };
  }

  // 3. Check prestigio actual
  const resPrest = await db.execute({
    sql: "SELECT nivel_prestigio FROM prestigio WHERE user_id = ?",
    args: [uid],
  });
  const prestigioActual = resPrest.rows.length > 0 ? Number(resPrest.rows[0].nivel_prestigio ?? 0) : 0;

  if (prestigioActual >= MAX_PRESTIGIO) {
    return {
      ok: false,
      nuevoNivel: prestigioActual,
      recompensa: null,
      mensaje: "Ya alcanzaste el **Prestigio Máximo** (10). Eres una leyenda absoluta del pueblito.",
    };
  }

  const nuevoNivel = prestigioActual + 1;
  const recompensa = RECOMPENSAS_PRESTIGIO[nuevoNivel];
  const fecha = getFechaChile();

  // 4. RESET — nivel, xp, monedas de bolsillo, racha diaria
  await db.execute({
    sql: "UPDATE usuarios SET nivel = 1, xp = 0, monedas = ?, diario_racha = 0, prestigio = ? WHERE id = ?",
    args: [recompensa.monedas_inicio, nuevoNivel, uid],
  });

  // 5. Reset casino stats
  await db.execute({
    sql: "DELETE FROM casino_stats WHERE user_id = ?",
    args: [uid],
  });

  // 6. Actualizar tabla de prestigio (upsert)
  await db.execute({
    sql: `INSERT INTO prestigio (user_id, nivel_prestigio, fecha_ultimo)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET nivel_prestigio = ?, fecha_ultimo = ?`,
    args: [uid, nuevoNivel, fecha, nuevoNivel, fecha],
  });

  // 7. Otorgar título exclusivo
  await db.execute({
    sql: `INSERT INTO titulos (user_id, titulo, equipado) VALUES (?, ?, 0) ON CONFLICT DO NOTHING`,
    args: [uid, recompensa.titulo],
  });

  // 8. Otorgar marco exclusivo (si aplica)
  if (recompensa.marco) {
    await db.execute({
      sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
      args: [uid, recompensa.marco],
    });
  }

  return {
    ok: true,
    nuevoNivel,
    recompensa,
  };
}

/**
 * Obtiene el ranking de prestigio.
 * @param {number} [limit=10]
 * @returns {Promise<Array<{user_id: string, nivel_prestigio: number, fecha_ultimo: string}>>}
 */
export async function getTopPrestigio(limit = 10) {
  const res = await db.execute({
    sql: `SELECT p.user_id, p.nivel_prestigio, p.fecha_ultimo, u.username
          FROM prestigio p
          LEFT JOIN usuarios u ON u.id = p.user_id
          WHERE p.nivel_prestigio > 0
          ORDER BY p.nivel_prestigio DESC, p.fecha_ultimo ASC
          LIMIT ?`,
    args: [limit],
  });
  return res.rows.map(r => ({
    user_id: String(r.user_id),
    nivel_prestigio: Number(r.nivel_prestigio),
    fecha_ultimo: String(r.fecha_ultimo || ""),
    username: String(r.username || "Desconocido"),
  }));
}

// Re-exportar constantes útiles para otros módulos
export { NIVEL_MINIMO_PRESTIGIO, MAX_PRESTIGIO, RECOMPENSAS_PRESTIGIO };
