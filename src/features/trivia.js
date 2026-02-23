import { db } from "../services/db.js";
import { CONFIG } from "../core/config.js";
import { getCanalGeneral, estaDurmiendo, crearEmbed } from "../core/utils.js";

// ── Constantes ────────────────────────────────────────────────────────────
/** Duración por defecto de trivia (1 minuto) */
const TRIVIA_DURACION_DEFAULT_MS = 60000;

/** Recompensa de XP por defecto */
const TRIVIA_XP_DEFAULT = 100;

/** Recompensa de monedas por defecto */
const TRIVIA_MONEDAS_DEFAULT = 10;

/** Límite de mensajes a recolectar en la trivia */
const TRIVIA_MAX_MESSAGES = 20;

/**
 * Lanza una trivia aleatoria en el canal general.
 * @async
 * @param {Object} client - Cliente de Discord
 * @returns {Promise<void>}
 */
export async function lanzarTriviaAleatoria(client) {
    if (estaDurmiendo()) return;

    const canal = getCanalGeneral(client);
    if (!canal) {
        console.warn("[Trivia] No se pudo obtener el canal general");
        return;
    }

    try {
        // Tiempo en milisegundos para que los jugadores respondan a la trivia
        const tiempoTriviaMs = Number(CONFIG?.TRIVIA_DURACION_MS ?? TRIVIA_DURACION_DEFAULT_MS) || TRIVIA_DURACION_DEFAULT_MS;

        const resHabitantes = await db.execute("SELECT id, regalos_favoritos FROM habitantes WHERE regalos_favoritos IS NOT NULL ORDER BY RANDOM() LIMIT 1");

        if (!resHabitantes?.rows?.length) {
            console.log("[Trivia] No hay habitantes con regalos favoritos disponibles");
            return;
        }

        const habitanteStr = String(resHabitantes.rows[0]?.id ?? "");
        const nombreHabitante = habitanteStr;
        const regalosRaw = resHabitantes.rows[0]?.regalos_favoritos;

        if (!regalosRaw) return;

        let regalosObj;
        try {
            regalosObj = JSON.parse(String(regalosRaw));
        } catch (err) {
            console.error("[Trivia] Error parseando regalos favoritos:", err);
            return;
        }

        // Agarramos uno de los regalos de la lista "Aman" o "Gustan"
        let regaloSeleccionado = "";

        for (const [, value] of Object.entries(regalosObj)) {
            if (Array.isArray(value) && value.length > 0) {
                // Agarramos un item al azar de ese array
                regaloSeleccionado = value[Math.floor(Math.random() * value.length)];
                break; // Usamos la primera categoría preferida que encontremos
            }
        }

        if (!regaloSeleccionado) {
            console.log("[Trivia] No se encontró regalo seleccionado");
            return;
        }

        const embedTrivia = crearEmbed(CONFIG?.COLORES?.DORADO ?? "#FFD700")
            .setTitle("🧠 ¡Trivias del Pueblito!")
            .setDescription(`*Annie saca su libretita de secretos...*\n\n¿A qué **Habitante** del pueblito le vuelve loco/a el siguiente regalo?\n🎁 **"${regaloSeleccionado}"**\n\n*(Escribe el nombre correcto en el chat rápido. Tienes 1 minuto)*`);

        await canal.send({ embeds: [embedTrivia] });

        // Registrar la trivia en la DB para las estadísticas
        let triviaId = 0;
        try {
            const resStats = await db.execute({
                sql: "INSERT INTO trivia_stats (habitante) VALUES (?) RETURNING id",
                args: [nombreHabitante]
            });
            triviaId = Number(resStats?.rows?.[0]?.id ?? 0);
        } catch (e) {
            console.error("[Trivia] Error guardando trivia stat inicio:", e.message);
        }

        // Activamos un recolector de mensajes en el canal
        const filter = m => !m?.author?.bot;
        const collector = canal.createMessageCollector({ filter, time: tiempoTriviaMs, max: TRIVIA_MAX_MESSAGES });
        let ganador = null;

        collector.on("collect", m => {
            const intento = String(m?.content ?? "").trim().toLowerCase();
            const habitanteFormat = nombreHabitante.toLowerCase();

            if (intento === habitanteFormat || intento.includes(habitanteFormat)) {
                ganador = m.author;
                collector.stop("ganador");
            }
        });

        collector.on("end", async (collected, reason) => {
            try {
                if (reason === "ganador" && ganador) {
                    // Darle recompensa
                    const xpGanada = Number(CONFIG?.TRIVIA_RECOMPENSA_XP ?? TRIVIA_XP_DEFAULT) || TRIVIA_XP_DEFAULT;
                    const moneditas = Number(CONFIG?.TRIVIA_RECOMPENSA_MONEDAS ?? TRIVIA_MONEDAS_DEFAULT) || TRIVIA_MONEDAS_DEFAULT;

                    await db.execute({
                        sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
                              VALUES (?, ?, ?, 1) 
                              ON CONFLICT(id) DO UPDATE SET 
                                xp = usuarios.xp + excluded.xp, 
                                monedas = usuarios.monedas + excluded.monedas`,
                        args: [ganador.id, moneditas, xpGanada]
                    });

                    if (triviaId > 0) {
                        db.execute({
                            sql: "UPDATE trivia_stats SET ganador_id = ?, fue_respondida = 1 WHERE id = ?",
                            args: [ganador.id, triviaId]
                        }).catch(() => { });
                    }

                    canal.send(`🎉 ¡Correcto <@${ganador.id}>! Era **${nombreHabitante}**. ¡Ganaste **${xpGanada} XP** y **${moneditas} moneditas**!`);
                } else {
                    if (triviaId > 0) {
                        db.execute({
                            sql: "UPDATE trivia_stats SET fue_respondida = 0 WHERE id = ?",
                            args: [triviaId]
                        }).catch(() => { });
                    }
                    canal.send(`⏰ ¡Se acabó el tiempo vecinitos! La respuesta correcta era **${nombreHabitante}**. ¡Para la próxima será!`);
                }
            } catch (err) {
                console.error("[Trivia] Error al finalizar trivia:", err);
            }
        });

    } catch (e) {
        console.error("[Trivia] Error lanzando trivia:", e);
    }
}
