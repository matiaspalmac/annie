import { db } from "../services/db.js";
import { crearEmbed } from "../core/utils.js";
import { CONFIG } from "../core/config.js";
import { obtenerNivelMaximo, sincronizarRolesProgresion } from "./roles-progresion.js";

// ── Constantes ────────────────────────────────────────────────────────────
/** Multiplicador de XP cuando el booster está activo (25% extra) */
const XP_BOOST_MULTIPLIER = 1.25;

/** Factor de XP necesaria por nivel (nivel * FACTOR) */
const XP_POR_NIVEL_FACTOR = 50;

/** Límite de registros a mantener en bitácora por usuario */
const MAX_BITACORA_REGISTROS = 10;

// ── Funciones de Progreso ────────────────────────────────────────────────

/**
 * Otorga XP a un usuario en una habilidad específica y maneja subidas de nivel.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {string} habilidad - Nombre de la habilidad (pesca, minería, etc.)
 * @param {number} cantidad - Cantidad de XP a otorgar
 * @param {Object} [interaction] - Interacción de Discord para notificaciones
 * @returns {Promise<number>} Nivel actual del usuario en la habilidad
 */
export async function ganarXP(userId, habilidad, cantidad, interaction) {
    try {
        if (!userId || !habilidad) return 1;
        const ahora = Date.now();
        let cantidadFinal = Math.max(0, Number(cantidad) || 0);

        // Verificar boost activo
        try {
            const resBoost = await db.execute({
                sql: "SELECT fecha_expira FROM boosts_activos WHERE user_id = ? AND boost_id = 'booster_xp_30m' LIMIT 1",
                args: [String(userId)]
            });
            const expira = Number(resBoost?.rows?.[0]?.fecha_expira ?? 0);
            if (expira > ahora) {
                cantidadFinal = Math.max(1, Math.round(cantidadFinal * XP_BOOST_MULTIPLIER));
            }
        } catch (errBoost) {
            // Si falla la lectura de boost, seguimos con XP normal
        }

        // 1. Obtener datos actuales
        let nivelActual = 1;
        let xpActual = 0;

        const res = await db.execute({
            sql: "SELECT nivel, xp FROM habilidades WHERE user_id = ? AND habilidad = ?",
            args: [String(userId), String(habilidad)]
        });

        if (res?.rows?.length > 0) {
            nivelActual = Number(res.rows[0]?.nivel ?? 1);
            xpActual = Number(res.rows[0]?.xp ?? 0);
        } else {
            // Crear si no existe
            await db.execute({
                sql: "INSERT INTO habilidades (user_id, habilidad, nivel, xp) VALUES (?, ?, 1, 0)",
                args: [String(userId), String(habilidad)]
            });
        }

        // 2. Sumar XP
        xpActual += cantidadFinal;
        let xpNecesaria = nivelActual * XP_POR_NIVEL_FACTOR;
        let subioNivel = false;

        // 3. Chequear Nivel
        while (xpActual >= xpNecesaria) {
            xpActual -= xpNecesaria;
            nivelActual++;
            subioNivel = true;
            xpNecesaria = nivelActual * XP_POR_NIVEL_FACTOR;
        }

        // 4. Guardar
        await db.execute({
            sql: "UPDATE habilidades SET nivel = ?, xp = ? WHERE user_id = ? AND habilidad = ?",
            args: [nivelActual, xpActual, String(userId), String(habilidad)]
        });

        // 5. Notificar si aplica
        if (subioNivel && interaction) {
            const nombreHabilidad = habilidad.charAt(0).toUpperCase() + habilidad.slice(1);
            interaction.followUp(`🌟 *¡Tatachán!* Has subido al **Nivel ${nivelActual}** de \`${nombreHabilidad.toUpperCase()}\`.`).catch(() => { });
            await registrarBitacora(userId, `Alcanzó el Nivel ${nivelActual} de ${nombreHabilidad}`);

            // 6. Sincronizar roles de progresión de la aldea (según nivel máximo)
            try {
                const nivelMax = await obtenerNivelMaximo(userId);
                const guild = interaction.guild;
                const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
                if (member) {
                    const tierNuevo = await sincronizarRolesProgresion(member, nivelMax);
                    if (tierNuevo) {
                        interaction.followUp(
                            `🏡 *¡Las luciérnagas te rodean!* En la aldea ahora eres **${tierNuevo.nombre}**.`
                        ).catch(() => { });
                        await registrarBitacora(userId, `Ascendió al rango ${tierNuevo.nombre}`);
                    }
                }
            } catch (errRoles) {
                console.error("[Progreso] Error sincronizando roles:", errRoles.message);
            }
        }

        return nivelActual;
    } catch (err) {
        console.error("[Progreso] Error en ganarXP:", err);
        return 1;
    }
}

/**
 * Verifica si un usuario tiene un boost activo.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {string} boostId - ID del boost a verificar
 * @returns {Promise<boolean>} True si el boost está activo
 */
export async function tieneBoostActivo(userId, boostId) {
    try {
        if (!userId || !boostId) return false;
        const res = await db.execute({
            sql: "SELECT fecha_expira FROM boosts_activos WHERE user_id = ? AND boost_id = ? LIMIT 1",
            args: [String(userId), String(boostId)]
        });
        const expira = Number(res?.rows?.[0]?.fecha_expira ?? 0);
        return expira > Date.now();
    } catch (err) {
        console.error("[Progreso] Error verificando boost:", err);
        return false;
    }
}

/**
 * Obtiene el nivel de una habilidad específica de un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {string} habilidad - Nombre de la habilidad
 * @returns {Promise<number>} Nivel de la habilidad (1 por defecto)
 */
export async function obtenerNivelHabilidad(userId, habilidad) {
    try {
        if (!userId || !habilidad) return 1;
        const res = await db.execute({
            sql: "SELECT nivel FROM habilidades WHERE user_id = ? AND habilidad = ?",
            args: [String(userId), String(habilidad)]
        });
        if (res?.rows?.length > 0) {
            return Number(res.rows[0]?.nivel ?? 1);
        }
    } catch (err) {
        console.error("[Progreso] Error obteniendo nivel habilidad:", err);
    }
    return 1;
}

/**
 * Registra una estadística para un usuario y verifica títulos desbloqueables.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {string} accion - Nombre de la acción/estadística
 * @param {number} cantidad - Cantidad a sumar
 * @param {Object} [interaction] - Interacción de Discord para notificaciones
 * @returns {Promise<void>}
 */
export async function registrarEstadistica(userId, accion, cantidad, interaction) {
    try {
        if (!userId || !accion) return;
        const cantidadFinal = Math.max(0, Number(cantidad) || 0);

        await db.execute({
            sql: `INSERT INTO estadisticas (user_id, accion, cantidad) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id, accion) DO UPDATE SET cantidad = estadisticas.cantidad + excluded.cantidad`,
            args: [String(userId), String(accion), cantidadFinal]
        });

        // Siempre al registrar estadística revisamos si destraba algún título
        await verificarTitulos(userId, interaction);
    } catch (err) {
        console.error("[Progreso] Error en registrarEstadistica:", err);
    }
}

/**
 * Verifica y desbloquea títulos para un usuario según sus estadísticas.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {Object} [interaction] - Interacción de Discord para notificaciones
 * @returns {Promise<void>}
 */
async function verificarTitulos(userId, interaction) {
    try {
        if (!userId) return;

        // Obtenemos todas las estadisticas del usuario
        const resStats = await db.execute({
            sql: "SELECT accion, cantidad FROM estadisticas WHERE user_id = ?",
            args: [String(userId)]
        });

        const statsMap = {};
        (resStats?.rows ?? []).forEach(r => {
            statsMap[String(r?.accion ?? "")] = Number(r?.cantidad ?? 0);
        });

        // Desbloqueos de títulos
        const titulosParaDesbloquear = [];

        // 🍂 Fallas
        if (statsMap["bichos_fallados"] >= 10) titulosParaDesbloquear.push("El/La Torpe con la Red");
        if (statsMap["bichos_fallados"] >= 50) titulosParaDesbloquear.push("El/La Desplumado(a)");
        if (statsMap["bichos_fallados"] >= 200) titulosParaDesbloquear.push("Enemigo de los Bichos");

        // 🎣 Pesca
        if (statsMap["peces_pescados"] >= 10) titulosParaDesbloquear.push("Pescador/a de Domingo");
        if (statsMap["peces_pescados"] >= 100) titulosParaDesbloquear.push("El/La Pescador(a) Paciente");
        if (statsMap["peces_pescados"] >= 500) titulosParaDesbloquear.push("Maestro/a de los Mares");
        if (statsMap["peces_pescados"] >= 1500) titulosParaDesbloquear.push("Leyenda del Río");

        // 🪲 Bichos
        if (statsMap["bichos_capturados"] >= 10) titulosParaDesbloquear.push("Cazainsectos Amateur");
        if (statsMap["bichos_capturados"] >= 100) titulosParaDesbloquear.push("Guardián del Bosque");
        if (statsMap["bichos_capturados"] >= 500) titulosParaDesbloquear.push("El/La Gran Bichero(a)");

        // ⛏️ Minería
        if (statsMap["minerales_minados"] >= 10) titulosParaDesbloquear.push("Aprendiz Minero/a");
        if (statsMap["minerales_minados"] >= 100) titulosParaDesbloquear.push("Excavador/a Dedicado(a)");
        if (statsMap["minerales_minados"] >= 500) titulosParaDesbloquear.push("El/La Buscadiamantes");

        // 📸 Fotografía
        if (statsMap["fotos_tomadas"] >= 1) titulosParaDesbloquear.push("Fotógrafo/a del Pueblito");
        if (statsMap["fotos_tomadas"] >= 25) titulosParaDesbloquear.push("Naturalista del Pueblo");
        if (statsMap["fotos_tomadas"] >= 100) titulosParaDesbloquear.push("El/La Paparazzi de Aves");

        // 🌲 Árboles
        if (statsMap["arboles_sacudidos"] >= 50) titulosParaDesbloquear.push("Amigo/a de los Árboles");
        if (statsMap["arboles_sacudidos"] >= 100) titulosParaDesbloquear.push("Manos de Tijera");

        // 🥷 Robo
        if (statsMap["robar_rico"] >= 1) titulosParaDesbloquear.push("Robin Hood");
        if (statsMap["robar_rico"] >= 10) titulosParaDesbloquear.push("Ladrón(a) Empedernido(a)");

        for (const t of titulosParaDesbloquear) {
            // Intentar Insertarlo. Si ya existe (ya lo tiene), ignorar con DO NOTHING
            const insertRes = await db.execute({
                sql: `INSERT INTO titulos (user_id, titulo, equipado) VALUES (?, ?, 0) ON CONFLICT DO NOTHING`,
                args: [String(userId), t]
            });
            // Si rowsAffected > 0, es primera vez
            if (insertRes?.rowsAffected > 0 && interaction) {
                const embed = crearEmbed(CONFIG?.COLORES?.DORADO ?? "#FFD700")
                    .setTitle("🏆 ¡Nuevo Título Desbloqueado!")
                    .setDescription(`¡Felicidades, <@${userId}>!\nPor tus hazañas en el pueblito, te has ganado el derecho a llamarte:\n\n**✨ ${t} ✨**\n\n*(Puedes equiparlo luego usando \`/titulos\` para que aparezca en tu perfil)*`);
                interaction.followUp({ embeds: [embed] }).catch(() => { });
                await registrarBitacora(userId, `Desbloqueó el título: ${t}`);
            }
        }

    } catch (err) {
        console.error("[Progreso] Error en verificarTitulos:", err);
    }
}

/**
 * Registra una acción en la bitácora del usuario y limpia registros antiguos.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {string} accion - Descripción de la acción
 * @returns {Promise<void>}
 */
export async function registrarBitacora(userId, accion) {
    try {
        if (!userId || !accion) return;

        const fecha = new Date().toISOString();
        await db.execute({
            sql: "INSERT INTO bitacora (user_id, accion, fecha) VALUES (?, ?, ?)",
            args: [String(userId), String(accion), fecha]
        });

        // Limpiar registros antiguos del usuario (mantener solo los MAX_BITACORA_REGISTROS más recientes)
        await db.execute({
            sql: `DELETE FROM bitacora 
                  WHERE user_id = ? 
                  AND id NOT IN (
                      SELECT id FROM bitacora WHERE user_id = ? ORDER BY id DESC LIMIT ?
                  )`,
            args: [String(userId), String(userId), MAX_BITACORA_REGISTROS]
        });
    } catch (err) {
        console.error("[Progreso] Error en registrarBitacora:", err);
    }
}
