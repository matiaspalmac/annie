import { db } from "./db.js";
import { crearEmbed } from "./utils.js";
import { CONFIG } from "./config.js";

// Funciones para manejar niveles, estadísticas y títulos

export async function ganarXP(userId, habilidad, cantidad, interaction) {
    try {
        // 1. Obtener datos actuales
        let nivelActual = 1;
        let xpActual = 0;

        const res = await db.execute({
            sql: "SELECT nivel, xp FROM habilidades WHERE user_id = ? AND habilidad = ?",
            args: [userId, habilidad]
        });

        if (res.rows.length > 0) {
            nivelActual = Number(res.rows[0].nivel);
            xpActual = Number(res.rows[0].xp);
        } else {
            // Crear si no existe
            await db.execute({
                sql: "INSERT INTO habilidades (user_id, habilidad, nivel, xp) VALUES (?, ?, 1, 0)",
                args: [userId, habilidad]
            });
        }

        // 2. Sumar XP
        xpActual += cantidad;
        let xpNecesaria = nivelActual * 50; // Fórmula simple: n * 50
        let subioNivel = false;

        // 3. Chequear Nivel
        while (xpActual >= xpNecesaria) {
            xpActual -= xpNecesaria;
            nivelActual++;
            subioNivel = true;
            xpNecesaria = nivelActual * 50;
        }

        // 4. Guardar
        await db.execute({
            sql: "UPDATE habilidades SET nivel = ?, xp = ? WHERE user_id = ? AND habilidad = ?",
            args: [nivelActual, xpActual, userId, habilidad]
        });

        // 5. Notificar si aplica
        if (subioNivel && interaction) {
            // Mensaje in-game sutil
            interaction.followUp(`🌟 *¡Tatachán!* Has subido al **Nivel ${nivelActual}** de \`${habilidad.toUpperCase()}\`.`).catch(console.error);
            await registrarBitacora(userId, `Alcanzó el Nivel ${nivelActual} de ${habilidad.charAt(0).toUpperCase() + habilidad.slice(1)}`);
        }

        return nivelActual;
    } catch (err) {
        console.error("Error en ganarXP:", err);
        return 1;
    }
}

export async function obtenerNivelHabilidad(userId, habilidad) {
    try {
        const res = await db.execute({
            sql: "SELECT nivel FROM habilidades WHERE user_id = ? AND habilidad = ?",
            args: [userId, habilidad]
        });
        if (res.rows.length > 0) {
            return Number(res.rows[0].nivel);
        }
    } catch { }
    return 1;
}

export async function registrarEstadistica(userId, accion, cantidad, interaction) {
    try {
        await db.execute({
            sql: `INSERT INTO estadisticas (user_id, accion, cantidad) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id, accion) DO UPDATE SET cantidad = estadisticas.cantidad + excluded.cantidad`,
            args: [userId, accion, cantidad]
        });

        // Siempre al registrar estadística revisamos si destraba algún título
        await verificarTitulos(userId, interaction);
    } catch (err) {
        console.error("Error en registrarEstadistica:", err);
    }
}

async function verificarTitulos(userId, interaction) {
    try {
        // Obtenemos todas las estadisticas del usuario
        const resStats = await db.execute({
            sql: "SELECT accion, cantidad FROM estadisticas WHERE user_id = ?",
            args: [userId]
        });

        const statsMap = {};
        resStats.rows.forEach(r => statsMap[String(r.accion)] = Number(r.cantidad));

        // Desbloqueos de títulos
        const titulosParaDesbloquear = [];

        // 1. "El/La Desplumado(a)": Al fallar 50 veces cazando bichos
        if (statsMap["bichos_fallados"] >= 50) titulosParaDesbloquear.push("El/La Desplumado(a)");

        // 2. "Robin Hood": Robarle a un perfil con más de 10,000 monedas 1 vez (acción: robar_rico)
        if (statsMap["robar_rico"] >= 1) titulosParaDesbloquear.push("Robin Hood");

        // 3. "Manos de Tijera": Sacudir árboles 100 veces
        if (statsMap["arboles_sacudidos"] >= 100) titulosParaDesbloquear.push("Manos de Tijera");

        for (const t of titulosParaDesbloquear) {
            // Intentar Insertarlo. Si ya existe (ya lo tiene), ignorar con DO NOTHING
            const insertRes = await db.execute({
                sql: `INSERT INTO titulos (user_id, titulo, equipado) VALUES (?, ?, 0) ON CONFLICT DO NOTHING`,
                args: [userId, t]
            });
            // Si rowsAffected > 0, es primera vez
            if (insertRes.rowsAffected > 0 && interaction) {
                const embed = crearEmbed(CONFIG.COLORES.DORADO)
                    .setTitle("🏆 ¡Nuevo Título Desbloqueado!")
                    .setDescription(`¡Felicidades, <@${userId}>!\nPor tus hazañas en el pueblito, te has ganado el derecho a llamarte:\n\n**✨ ${t} ✨**\n\n*(Puedes equiparlo luego usando \`/titulos\` para que aparezca en tu perfil)*`);
                interaction.followUp({ embeds: [embed] }).catch(console.error);
                await registrarBitacora(userId, `Desbloqueó el título: ${t}`);
            }
        }

    } catch (err) {
        console.error("Error en verificarTitulos:", err);
    }
}

export async function registrarBitacora(userId, accion) {
    try {
        const fecha = new Date().toISOString();
        await db.execute({
            sql: "INSERT INTO bitacora (user_id, accion, fecha) VALUES (?, ?, ?)",
            args: [userId, accion, fecha]
        });

        // Limpiar registros antiguos del usuario (mantener solo los 10 más recientes)
        await db.execute({
            sql: `DELETE FROM bitacora 
                  WHERE user_id = ? 
                  AND id NOT IN (
                      SELECT id FROM bitacora WHERE user_id = ? ORDER BY id DESC LIMIT 10
                  )`,
            args: [userId, userId]
        });
    } catch (err) {
        console.error("Error en registrarBitacora:", err);
    }
}
