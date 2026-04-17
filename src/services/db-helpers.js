/**
 * Helpers reutilizables para operaciones comunes de base de datos.
 * Eliminan la duplicación de SQL en commands y features.
 */
import { db } from "./db.js";

/**
 * Asegura que exista la fila base del usuario en `usuarios`.
 * @param {string} userId
 * @param {string|null} [username=null]
 * @param {string|null} [avatar=null]
 */
export async function ensureUser(userId, username = null, avatar = null) {
  await db.execute({
    sql: `INSERT INTO usuarios (id, username, avatar, monedas, xp, nivel)
          VALUES (?, ?, ?, 0, 0, 1)
          ON CONFLICT(id) DO NOTHING`,
    args: [userId, username, avatar],
  });
}

/**
 * Agrega items al inventario de un usuario (UPSERT).
 * @param {string} userId - ID del usuario
 * @param {string} itemId - ID del item
 * @param {number} [cantidad=1] - Cantidad a agregar
 */
export async function addToInventory(userId, itemId, cantidad = 1) {
  await db.execute({
    sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = inventario_economia.cantidad + ?`,
    args: [userId, itemId, cantidad, cantidad],
  });
}

/**
 * Obtiene el balance de monedas de un usuario.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getBalance(userId) {
  const res = await db.execute({
    sql: "SELECT monedas FROM usuarios WHERE id = ?",
    args: [userId],
  });
  return res.rows.length > 0 ? Number(res.rows[0].monedas ?? 0) : 0;
}

/**
 * Descuenta monedas del usuario.
 * @param {string} userId
 * @param {number} cantidad
 */
export async function deductBalance(userId, cantidad) {
  await db.execute({
    sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
    args: [cantidad, userId],
  });
}

/**
 * Suma monedas al usuario.
 * @param {string} userId
 * @param {number} cantidad
 */
export async function addBalance(userId, cantidad) {
  await db.execute({
    sql: `INSERT INTO usuarios (id, monedas, xp, nivel)
          VALUES (?, ?, 0, 1)
          ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
    args: [userId, cantidad],
  });
}

/**
 * Verifica si el usuario ya posee un item (cantidad > 0).
 * @param {string} userId
 * @param {string} itemId
 * @returns {Promise<boolean>}
 */
export async function hasItem(userId, itemId) {
  const res = await db.execute({
    sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
    args: [userId, itemId],
  });
  return res.rows.length > 0 && Number(res.rows[0].cantidad) > 0;
}

/**
 * Degrada la durabilidad de una herramienta equipada en 1 punto.
 * @param {string} userId
 * @param {string} itemId
 */
export async function degradarHerramienta(userId, itemId) {
  await db.execute({
    sql: "UPDATE herramientas_durabilidad SET durabilidad = MAX(0, durabilidad - 1) WHERE user_id = ? AND item_id = ?",
    args: [userId, itemId],
  });
}

/**
 * Obtiene la herramienta equipada de una familia (pico, cana, hacha, red).
 * @param {string} userId
 * @param {string} familyPattern - Patrón SQL LIKE (ej: 'herr_cana_%')
 * @returns {Promise<{item_id: string, durabilidad: number, max_durabilidad: number}|null>}
 */
export async function getHerramientaEquipada(userId, familyPattern) {
  const res = await db.execute({
    sql: `SELECT item_id, durabilidad, max_durabilidad
          FROM herramientas_durabilidad
          WHERE user_id = ? AND item_id LIKE ? AND equipado = 1 AND durabilidad > 0
          LIMIT 1`,
    args: [userId, familyPattern],
  });
  return res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * Actualiza username y avatar del usuario si cambiaron.
 * @param {string} userId
 * @param {string} username
 * @param {string|null} avatar
 */
export async function updateUserProfile(userId, username, avatar) {
  await db.execute({
    sql: `UPDATE usuarios SET username = ?, avatar = ?
          WHERE id = ? AND (username IS NULL OR username != ? OR avatar IS NULL OR avatar != ?)`,
    args: [username, avatar, userId, username, avatar],
  });
}
