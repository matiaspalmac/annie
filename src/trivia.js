import { db } from "./db.js";
import { CONFIG } from "./config.js";
import { getCanalGeneral, estaDurmiendo, crearEmbed } from "./utils.js";

export async function lanzarTriviaAleatoria(client) {
    if (estaDurmiendo()) return;

    // Tiempo en milisegundos para que los jugadores respondan a la trivia
    const tiempoTriviaMs = Number(CONFIG.TRIVIA_DURACION_MS) || 60000;

    const canal = getCanalGeneral(client);
    if (!canal) return;

    try {
        const resHabitantes = await db.execute("SELECT id, regalos_favoritos FROM habitantes WHERE regalos_favoritos IS NOT NULL ORDER BY RANDOM() LIMIT 1");

        if (resHabitantes.rows.length === 0) return;

        const habitanteStr = resHabitantes.rows[0].id;
        const nombreHabitante = String(habitanteStr);
        const regalosRaw = resHabitantes.rows[0].regalos_favoritos;
        const regalosObj = JSON.parse(String(regalosRaw));

        // Agarramos uno de los regalos de la lista "Aman" o "Gustan" (Depende del formato que guardamos)
        // Por simplicidad, buscaremos si podemos extraer un objeto que diga "Aman" o agarraremos el primer value
        let regaloSeleccionado = "";

        for (const [key, value] of Object.entries(regalosObj)) {
            if (Array.isArray(value) && value.length > 0) {
                // Agarramos un item al azar de ese array
                regaloSeleccionado = value[Math.floor(Math.random() * value.length)];
                break; // Usamos la primera categoría preferida que encontremos
            }
        }

        if (!regaloSeleccionado) return; // Fallback si no había info parseable

        const embedTrivia = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("🧠 ¡Trivias del Pueblito!")
            .setDescription(`*Annie saca su libretita de secretos...*\n\n¿A qué **Habitante** del pueblito le vuelve loco/a el siguiente regalo?\n🎁 **"${regaloSeleccionado}"**\n\n*(Escribe el nombre correcto en el chat rápido. Tienes 1 minuto)*`);

        await canal.send({ embeds: [embedTrivia] });

        // Registrar la trivia en la DB para las estadísticas (F7)
        let triviaId = 0;
        try {
            const resStats = await db.execute({
                sql: "INSERT INTO trivia_stats (habitante) VALUES (?) RETURNING id",
                args: [nombreHabitante]
            });
            triviaId = Number(resStats.rows[0].id);
        } catch (e) {
            console.error("Error guardando trivia stat inicio:", e.message);
        }

        // Activamos un recolector de mensajes en el canal
        const filter = m => !m.author.bot;
        const collector = canal.createMessageCollector({ filter, time: tiempoTriviaMs, max: 20 });
        let ganador = null;

        collector.on("collect", m => {
            const intento = m.content.trim().toLowerCase();
            const habitanteFormat = nombreHabitante.toLowerCase();

            if (intento === habitanteFormat || intento.includes(habitanteFormat)) {
                ganador = m.author;
                collector.stop("ganador");
            }
        });

        collector.on("end", async (collected, reason) => {
            if (reason === "ganador" && ganador) {
                // Darle recompensa
                const xpGanada = Number(CONFIG.TRIVIA_RECOMPENSA_XP) || 100;
                const moneditas = Number(CONFIG.TRIVIA_RECOMPENSA_MONEDAS) || 10;
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
        });

    } catch (e) {
        console.error("Error lanzando trivia:", e);
    }
}
