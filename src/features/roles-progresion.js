/**
 * Sistema de roles de progresión — Aldea Luciérnaga
 *
 * Otorga roles automáticos según el nivel más alto del usuario entre todas
 * sus habilidades (pesca, minería, caza, recolección, fotografía).
 *
 * Los tiers se definen en CONFIG.ROLES_PROGRESION (cargado desde la DB).
 * Estructura esperada:
 *   [
 *     { nivel: 1,  nombre: "🍃 Aprendiz",           roleId: "..." },
 *     { nivel: 10, nombre: "🐛 Coleccionista",      roleId: "..." },
 *     ...
 *   ]
 */
import { db } from "../services/db.js";
import { CONFIG } from "../core/config.js";

/**
 * Devuelve el nivel más alto del usuario entre todas sus habilidades.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function obtenerNivelMaximo(userId) {
  try {
    if (!userId) return 1;
    const res = await db.execute({
      sql: "SELECT MAX(nivel) as maxNivel FROM habilidades WHERE user_id = ?",
      args: [String(userId)],
    });
    return Number(res?.rows?.[0]?.maxNivel ?? 1);
  } catch (err) {
    console.error("[RolesProgresion] Error obteniendo nivel max:", err);
    return 1;
  }
}

/**
 * Sincroniza los roles de progresión del miembro según su nivel máximo.
 * Otorga el rol del tier alcanzado y remueve los tiers previos.
 * @param {import("discord.js").GuildMember} member
 * @param {number} nivelMaximo
 * @returns {Promise<{nivel:number, nombre:string, roleId:string}|null>} tier nuevo si se promovió, null si ya lo tenía
 */
export async function sincronizarRolesProgresion(member, nivelMaximo) {
  try {
    if (!member?.guild || !member?.roles) return null;

    const tiers = Array.isArray(CONFIG.ROLES_PROGRESION) ? CONFIG.ROLES_PROGRESION : [];
    if (tiers.length === 0) return null;

    const ordenados = [...tiers]
      .filter((t) => t && Number.isFinite(Number(t.nivel)) && t.roleId)
      .sort((a, b) => Number(a.nivel) - Number(b.nivel));

    if (ordenados.length === 0) return null;

    // Encontrar el tier más alto alcanzado
    let tierActual = null;
    for (const t of ordenados) {
      if (Number(nivelMaximo) >= Number(t.nivel)) tierActual = t;
    }
    if (!tierActual) return null;

    const idActual = String(tierActual.roleId);
    const todosIds = ordenados.map((t) => String(t.roleId));

    // Quitar tiers anteriores
    for (const rid of todosIds) {
      if (rid === idActual) continue;
      if (member.roles.cache.has(rid)) {
        await member.roles.remove(rid).catch(() => {});
      }
    }

    // Otorgar el tier actual
    if (!member.roles.cache.has(idActual)) {
      await member.roles.add(idActual).catch(() => {});
      return tierActual;
    }

    return null;
  } catch (err) {
    console.error("[RolesProgresion] Error sincronizando:", err);
    return null;
  }
}
