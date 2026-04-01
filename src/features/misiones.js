/**
 * Sistema de Misiones Diarias de Annie
 * Cada día se generan misiones aleatorias del pool para cada usuario.
 * Al completar cada misión se otorgan monedas individuales.
 * Al completar todas se puede reclamar un bonus extra.
 */
import { db } from "../services/db.js";
import { addBalance } from "../services/db-helpers.js";
import { getFechaChile } from "../core/utils.js";

// ── Pool de misiones disponibles ─────────────────────────────────────
const POOL_MISIONES = [
  { tipo: "pescar", descripcion: "Pesca {n} veces", emoji: "🎣", minN: 2, maxN: 5, recompensa: 60 },
  { tipo: "minar", descripcion: "Mina {n} veces", emoji: "⛏️", minN: 2, maxN: 4, recompensa: 60 },
  { tipo: "talar", descripcion: "Sacude {n} árboles", emoji: "🌲", minN: 2, maxN: 4, recompensa: 50 },
  { tipo: "capturar", descripcion: "Captura {n} bichos", emoji: "🦋", minN: 2, maxN: 4, recompensa: 60 },
  { tipo: "fotografiar", descripcion: "Toma {n} foto(s)", emoji: "📸", minN: 1, maxN: 3, recompensa: 50 },
  { tipo: "vender", descripcion: "Vende {n} items", emoji: "💰", minN: 3, maxN: 6, recompensa: 50 },
  { tipo: "craftear", descripcion: "Craftea {n} receta(s)", emoji: "🍳", minN: 1, maxN: 2, recompensa: 70 },
  { tipo: "casino", descripcion: "Juega {n} partida(s) en el casino", emoji: "🎰", minN: 1, maxN: 3, recompensa: 40 },
  { tipo: "mascota", descripcion: "Interactúa con tu mascota", emoji: "🐾", minN: 1, maxN: 1, recompensa: 40 },
  { tipo: "social", descripcion: "Regala monedas a alguien", emoji: "🎁", minN: 1, maxN: 1, recompensa: 50 },
];

// ── Constantes ───────────────────────────────────────────────────────
const MISIONES_POR_DIA = 4;
const BONUS_COMPLETAR_TODAS = { monedas: 200, xp: 80 };

// ── Helpers internos ─────────────────────────────────────────────────

/**
 * Genera un número entero aleatorio entre min y max (inclusive).
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Selecciona N elementos aleatorios únicos de un array.
 */
function seleccionarAleatorios(array, n) {
  const copia = [...array];
  const resultado = [];
  for (let i = 0; i < n && copia.length > 0; i++) {
    const idx = Math.floor(Math.random() * copia.length);
    resultado.push(copia.splice(idx, 1)[0]);
  }
  return resultado;
}

// ── Funciones públicas ───────────────────────────────────────────────

/**
 * Genera las misiones del día para un usuario.
 * Si ya existen misiones para hoy, las retorna sin regenerar.
 * @param {string} userId - ID del usuario de Discord
 * @param {string} [fecha] - Fecha en formato YYYY-MM-DD (default: hoy Chile)
 * @returns {Promise<Object[]>} Array de misiones generadas
 */
export async function generarMisionesDelDia(userId, fecha) {
  const hoy = fecha || getFechaChile();

  // Revisar si ya tiene misiones para hoy
  const res = await db.execute({
    sql: "SELECT misiones FROM misiones_diarias WHERE user_id = ? AND fecha = ?",
    args: [userId, hoy],
  });

  if (res.rows.length > 0) {
    try {
      const misiones = JSON.parse(String(res.rows[0].misiones));
      if (Array.isArray(misiones) && misiones.length > 0) {
        return misiones;
      }
    } catch {
      // Si el JSON es inválido, regeneramos
    }
  }

  // Generar misiones nuevas
  const seleccionadas = seleccionarAleatorios(POOL_MISIONES, MISIONES_POR_DIA);
  const misiones = seleccionadas.map((m) => {
    const n = randInt(m.minN, m.maxN);
    return {
      tipo: m.tipo,
      emoji: m.emoji,
      descripcion: m.descripcion.replace("{n}", String(n)),
      meta: n,
      progreso: 0,
      completada: false,
      recompensa: m.recompensa,
    };
  });

  // Guardar en DB (UPSERT)
  await db.execute({
    sql: `INSERT INTO misiones_diarias (user_id, fecha, misiones, bonus_reclamado)
          VALUES (?, ?, ?, 0)
          ON CONFLICT(user_id, fecha) DO UPDATE SET misiones = ?`,
    args: [userId, hoy, JSON.stringify(misiones), JSON.stringify(misiones)],
  });

  return misiones;
}

/**
 * Progresa una misión del tipo indicado para el usuario.
 * Si la misión se completa, otorga las monedas de recompensa automáticamente.
 * @param {string} userId - ID del usuario de Discord
 * @param {string} tipo - Tipo de misión (pescar, minar, etc.)
 * @param {number} [cantidad=1] - Cantidad a progresar
 * @returns {Promise<{completada: boolean, mision?: Object, todasCompletas?: boolean}>}
 */
export async function progresarMision(userId, tipo, cantidad = 1) {
  const hoy = getFechaChile();

  // Cargar misiones de hoy
  const res = await db.execute({
    sql: "SELECT misiones FROM misiones_diarias WHERE user_id = ? AND fecha = ?",
    args: [userId, hoy],
  });

  // Si no tiene misiones generadas hoy, no hay nada que progresar
  if (res.rows.length === 0) {
    return { completada: false };
  }

  let misiones;
  try {
    misiones = JSON.parse(String(res.rows[0].misiones));
  } catch {
    return { completada: false };
  }

  if (!Array.isArray(misiones)) {
    return { completada: false };
  }

  // Buscar la misión del tipo indicado
  const mision = misiones.find((m) => m.tipo === tipo);
  if (!mision) {
    return { completada: false };
  }

  // Si ya estaba completada, no hacer nada más
  if (mision.completada) {
    const todasCompletas = misiones.every((m) => m.completada);
    return { completada: false, todasCompletas };
  }

  // Incrementar progreso
  mision.progreso = Math.min(mision.progreso + cantidad, mision.meta);

  let recienCompletada = false;

  // Verificar si se completó
  if (mision.progreso >= mision.meta && !mision.completada) {
    mision.completada = true;
    recienCompletada = true;

    // Otorgar recompensa individual
    await addBalance(userId, mision.recompensa);
  }

  // Guardar misiones actualizadas
  await db.execute({
    sql: "UPDATE misiones_diarias SET misiones = ? WHERE user_id = ? AND fecha = ?",
    args: [JSON.stringify(misiones), userId, hoy],
  });

  const todasCompletas = misiones.every((m) => m.completada);

  return {
    completada: recienCompletada,
    mision: recienCompletada ? { ...mision } : undefined,
    todasCompletas,
  };
}

/**
 * Obtiene las misiones del día para un usuario.
 * Si no existen, las genera automáticamente.
 * @param {string} userId - ID del usuario de Discord
 * @param {string} [fecha] - Fecha en formato YYYY-MM-DD (default: hoy Chile)
 * @returns {Promise<{misiones: Object[], bonusReclamado: boolean}>}
 */
export async function getMisionesHoy(userId, fecha) {
  const hoy = fecha || getFechaChile();

  const res = await db.execute({
    sql: "SELECT misiones, bonus_reclamado FROM misiones_diarias WHERE user_id = ? AND fecha = ?",
    args: [userId, hoy],
  });

  if (res.rows.length > 0) {
    try {
      const misiones = JSON.parse(String(res.rows[0].misiones));
      if (Array.isArray(misiones) && misiones.length > 0) {
        return {
          misiones,
          bonusReclamado: Number(res.rows[0].bonus_reclamado) === 1,
        };
      }
    } catch {
      // JSON inválido, regeneramos
    }
  }

  // Generar si no existen
  const misiones = await generarMisionesDelDia(userId, hoy);
  return { misiones, bonusReclamado: false };
}

/**
 * Reclama el bonus por completar todas las misiones del día.
 * @param {string} userId - ID del usuario de Discord
 * @param {string} [fecha] - Fecha en formato YYYY-MM-DD (default: hoy Chile)
 * @returns {Promise<{ok: boolean, razon?: string, bonus?: Object}>}
 */
export async function reclamarBonus(userId, fecha) {
  const hoy = fecha || getFechaChile();

  const res = await db.execute({
    sql: "SELECT misiones, bonus_reclamado FROM misiones_diarias WHERE user_id = ? AND fecha = ?",
    args: [userId, hoy],
  });

  if (res.rows.length === 0) {
    return { ok: false, razon: "no_misiones" };
  }

  const bonusReclamado = Number(res.rows[0].bonus_reclamado) === 1;
  if (bonusReclamado) {
    return { ok: false, razon: "ya_reclamado" };
  }

  let misiones;
  try {
    misiones = JSON.parse(String(res.rows[0].misiones));
  } catch {
    return { ok: false, razon: "error_datos" };
  }

  if (!Array.isArray(misiones) || misiones.length === 0) {
    return { ok: false, razon: "no_misiones" };
  }

  const todasCompletas = misiones.every((m) => m.completada);
  if (!todasCompletas) {
    return { ok: false, razon: "incompletas" };
  }

  // Otorgar bonus
  await addBalance(userId, BONUS_COMPLETAR_TODAS.monedas);

  // Otorgar XP del bonus
  await db.execute({
    sql: `UPDATE usuarios SET xp = xp + ? WHERE id = ?`,
    args: [BONUS_COMPLETAR_TODAS.xp, userId],
  });

  // Marcar bonus como reclamado
  await db.execute({
    sql: "UPDATE misiones_diarias SET bonus_reclamado = 1 WHERE user_id = ? AND fecha = ?",
    args: [userId, hoy],
  });

  return { ok: true, bonus: { ...BONUS_COMPLETAR_TODAS } };
}

export { BONUS_COMPLETAR_TODAS, MISIONES_POR_DIA };
