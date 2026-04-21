import { db } from "../services/db.js";
import { CONFIG } from "../core/config.js";
import { getCanalGeneral, estaDurmiendo, crearEmbed, getFechaChile, autoDeleteMsg } from "../core/utils.js";

// ── Constantes ────────────────────────────────────────────────────────────
/** Límite de mensajes a recolectar en la trivia */
const TRIVIA_MAX_MESSAGES = 30;

/** Tiempo por dificultad (ms) */
const TIEMPO_POR_DIFICULTAD = {
  facil: 60000,
  normal: 45000,
  dificil: 30000,
};

/** Indicador visual por dificultad */
const INDICADOR_DIFICULTAD = {
  facil: "🟢 Fácil",
  normal: "🟡 Normal",
  dificil: "🔴 Difícil",
};

// ── Preguntas fijas por categoría ─────────────────────────────────────────
const PREGUNTAS_FIJAS = {
  cultura: [
    { pregunta: "¿Cuál es la bebida típica que Annie toma en su oficinita?", respuestas: ["tecito", "te", "té"], dificultad: "facil", recompensa: { xp: 50, monedas: 5 } },
    { pregunta: "¿A qué hora se duerme Annie?", respuestas: ["23", "23:00", "11pm"], dificultad: "facil", recompensa: { xp: 50, monedas: 5 } },
    { pregunta: "¿Cómo se llama el Mercader Estelar que paga triple?", respuestas: ["doris"], dificultad: "normal", recompensa: { xp: 80, monedas: 10 } },
    { pregunta: "¿Qué comida chilena menciona Annie frecuentemente?", respuestas: ["sopaipilla", "sopaipillas", "empanada", "empanadas"], dificultad: "facil", recompensa: { xp: 50, monedas: 5 } },
    { pregunta: "¿Quién es el experto en pesca del pueblito?", respuestas: ["vanya"], dificultad: "normal", recompensa: { xp: 80, monedas: 10 } },
    { pregunta: "¿Quién cocina los mejores platos en Heartopia?", respuestas: ["massimo"], dificultad: "normal", recompensa: { xp: 80, monedas: 10 } },
    { pregunta: "¿Quién es la experta en insectos?", respuestas: ["naniwa"], dificultad: "normal", recompensa: { xp: 80, monedas: 10 } },
    { pregunta: "¿Quién madruga para observar aves?", respuestas: ["bailey j", "bailey"], dificultad: "normal", recompensa: { xp: 80, monedas: 10 } },
    { pregunta: "¿Quién cuida las plantas del pueblito?", respuestas: ["blanc"], dificultad: "facil", recompensa: { xp: 50, monedas: 5 } },
    { pregunta: "¿Cuál es el nombre del pueblo?", respuestas: ["heartopia"], dificultad: "facil", recompensa: { xp: 50, monedas: 5 } },
  ],
  economia: [
    { pregunta: "¿Cuánto cuesta un boleto de rifa?", respuestas: ["10"], dificultad: "facil", recompensa: { xp: 50, monedas: 5 } },
    { pregunta: "¿A qué hora se sortea la rifa?", respuestas: ["23:59", "2359"], dificultad: "facil", recompensa: { xp: 50, monedas: 5 } },
    { pregunta: "¿Cuántas monedas te quita el tarro de las chuchadas?", respuestas: ["5"], dificultad: "normal", recompensa: { xp: 80, monedas: 10 } },
    { pregunta: "¿Qué porcentaje de interés da el banco al día?", respuestas: ["0.5", "0.5%"], dificultad: "dificil", recompensa: { xp: 150, monedas: 20 } },
    { pregunta: "¿Cuánto paga Doris por un item en demanda? (multiplicador)", respuestas: ["3", "triple", "x3", "3x"], dificultad: "normal", recompensa: { xp: 80, monedas: 10 } },
  ],
  dificil: [
    { pregunta: "¿Cuál es la rareza más alta de un item?", respuestas: ["mitico", "mítico"], dificultad: "dificil", recompensa: { xp: 150, monedas: 20 } },
    { pregunta: "¿Qué animal se esconde en las ruinas según Annie?", respuestas: ["carpincho"], dificultad: "dificil", recompensa: { xp: 150, monedas: 20 } },
    { pregunta: "¿Cuántos minutos dura una Estrella Fugaz?", respuestas: ["5"], dificultad: "dificil", recompensa: { xp: 150, monedas: 20 } },
    { pregunta: "¿Qué pasa si escribes '11' en el chat?", respuestas: ["chupalo entonces", "chupalo"], dificultad: "dificil", recompensa: { xp: 200, monedas: 25 } },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Normaliza un texto para comparación: minúsculas, sin acentos, sin espacios extra.
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  return String(texto ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Selecciona una pregunta aleatoria del pool de PREGUNTAS_FIJAS.
 * @returns {{ pregunta: string, respuestas: string[], dificultad: string, recompensa: { xp: number, monedas: number }, categoria: string }}
 */
function obtenerPreguntaFija() {
  const categorias = Object.keys(PREGUNTAS_FIJAS);
  const categoriaRandom = categorias[Math.floor(Math.random() * categorias.length)];
  const preguntas = PREGUNTAS_FIJAS[categoriaRandom];
  const pregunta = preguntas[Math.floor(Math.random() * preguntas.length)];
  return { ...pregunta, categoria: categoriaRandom };
}

/**
 * Ejecuta una trivia de tipo pregunta fija en un canal dado.
 * @param {Object} canal - Canal de Discord
 * @param {{ pregunta: string, respuestas: string[], dificultad: string, recompensa: { xp: number, monedas: number }, categoria: string }} preguntaData
 * @returns {Promise<void>}
 */
async function ejecutarTriviaFija(canal, preguntaData) {
  const { pregunta, respuestas, dificultad, recompensa, categoria } = preguntaData;
  const tiempoMs = TIEMPO_POR_DIFICULTAD[dificultad] || TIEMPO_POR_DIFICULTAD.normal;
  const tiempoSegundos = Math.round(tiempoMs / 1000);
  const indicador = INDICADOR_DIFICULTAD[dificultad] || INDICADOR_DIFICULTAD.normal;

  const embedTrivia = crearEmbed(CONFIG?.COLORES?.DORADO ?? "#FFD700")
    .setTitle(`🧠 ¡Trivias del Pueblito! — ${indicador}`)
    .setDescription(
      `*Annie saca su libretita de secretos...*\n\n` +
      `📝 **${pregunta}**\n\n` +
      `🎁 **Recompensa:** ${recompensa.xp} XP + ${recompensa.monedas} moneditas\n` +
      `⏱️ *Tienes ${tiempoSegundos} segundos para responder en el chat.*`
    );

  const preguntaMsg = await canal.send({ embeds: [embedTrivia] });
  autoDeleteMsg(preguntaMsg);

  // Registrar la trivia en la DB
  let triviaId = 0;
  try {
    const resStats = await db.execute({
      sql: "INSERT INTO trivia_stats (habitante, fecha, categoria, dificultad) VALUES (?, ?, ?, ?) RETURNING id",
      args: [pregunta.substring(0, 100), getFechaChile(), categoria, dificultad],
    });
    triviaId = Number(resStats?.rows?.[0]?.id ?? 0);
  } catch (e) {
    console.error("[Trivia] Error guardando trivia stat inicio:", e.message);
  }

  // Recolector de mensajes
  const filter = (m) => !m?.author?.bot;
  const collector = canal.createMessageCollector({ filter, time: tiempoMs, max: TRIVIA_MAX_MESSAGES });
  let ganador = null;

  const respuestasNormalizadas = respuestas.map(normalizar);

  collector.on("collect", (m) => {
    const intento = normalizar(m?.content);
    if (respuestasNormalizadas.some((r) => intento === r || intento.includes(r))) {
      ganador = m.author;
      collector.stop("ganador");
    }
  });

  collector.on("end", async (_collected, reason) => {
    try {
      let resultadoMsg;
      if (reason === "ganador" && ganador) {
        await db.execute({
          sql: `INSERT INTO usuarios (id, monedas, xp, nivel)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(id) DO UPDATE SET
                  xp = usuarios.xp + excluded.xp,
                  monedas = usuarios.monedas + excluded.monedas`,
          args: [ganador.id, recompensa.monedas, recompensa.xp],
        });

        if (triviaId > 0) {
          db.execute({
            sql: "UPDATE trivia_stats SET ganador_id = ?, fue_respondida = 1 WHERE id = ?",
            args: [ganador.id, triviaId],
          }).catch(() => {});
        }

        const respuestaCorrecta = respuestas[0];
        resultadoMsg = await canal.send(
          `🎉 ¡Correcto <@${ganador.id}>! La respuesta era **${respuestaCorrecta}**. ` +
          `¡Ganaste **${recompensa.xp} XP** y **${recompensa.monedas} moneditas**! 🌸`
        ).catch(() => null);
      } else {
        if (triviaId > 0) {
          db.execute({
            sql: "UPDATE trivia_stats SET fue_respondida = 0 WHERE id = ?",
            args: [triviaId],
          }).catch(() => {});
        }
        const respuestaCorrecta = respuestas[0];
        resultadoMsg = await canal.send(
          `⏰ ¡Se acabó el tiempo vecinitos! La respuesta correcta era **${respuestaCorrecta}**. ¡Para la próxima será!`
        ).catch(() => null);
      }
      autoDeleteMsg(resultadoMsg);
    } catch (err) {
      console.error("[Trivia] Error al finalizar trivia fija:", err);
    }
  });
}

/**
 * Ejecuta una trivia de tipo NPC-regalo en un canal dado.
 * @param {Object} canal - Canal de Discord
 * @returns {Promise<void>}
 */
async function ejecutarTriviaNPC(canal) {
  const tiempoMs = TIEMPO_POR_DIFICULTAD.normal;
  const tiempoSegundos = Math.round(tiempoMs / 1000);
  const xpGanada = 100;
  const moneditas = 10;

  const resHabitantes = await db.execute(
    "SELECT id, regalos_favoritos FROM habitantes WHERE regalos_favoritos IS NOT NULL ORDER BY RANDOM() LIMIT 1"
  );

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

  let regaloSeleccionado = "";
  for (const [, value] of Object.entries(regalosObj)) {
    if (Array.isArray(value) && value.length > 0) {
      regaloSeleccionado = value[Math.floor(Math.random() * value.length)];
      break;
    }
  }

  if (!regaloSeleccionado) {
    console.log("[Trivia] No se encontró regalo seleccionado");
    return;
  }

  const embedTrivia = crearEmbed(CONFIG?.COLORES?.DORADO ?? "#FFD700")
    .setTitle(`🧠 ¡Trivias del Pueblito! — 🟡 Normal`)
    .setDescription(
      `*Annie saca su libretita de secretos...*\n\n` +
      `¿A qué **Habitante** del pueblito le vuelve loco/a el siguiente regalo?\n` +
      `🎁 **"${regaloSeleccionado}"**\n\n` +
      `🎁 **Recompensa:** ${xpGanada} XP + ${moneditas} moneditas\n` +
      `⏱️ *Tienes ${tiempoSegundos} segundos para responder en el chat.*`
    );

  const preguntaMsg = await canal.send({ embeds: [embedTrivia] });
  autoDeleteMsg(preguntaMsg);

  // Registrar en DB
  let triviaId = 0;
  try {
    const resStats = await db.execute({
      sql: "INSERT INTO trivia_stats (habitante, fecha, categoria, dificultad) VALUES (?, ?, ?, ?) RETURNING id",
      args: [nombreHabitante, getFechaChile(), "habitantes", "normal"],
    });
    triviaId = Number(resStats?.rows?.[0]?.id ?? 0);
  } catch (e) {
    console.error("[Trivia] Error guardando trivia stat inicio:", e.message);
  }

  const filter = (m) => !m?.author?.bot;
  const collector = canal.createMessageCollector({ filter, time: tiempoMs, max: TRIVIA_MAX_MESSAGES });
  let ganador = null;

  collector.on("collect", (m) => {
    const intento = normalizar(m?.content);
    const habitanteNorm = normalizar(nombreHabitante);
    if (intento === habitanteNorm || intento.includes(habitanteNorm)) {
      ganador = m.author;
      collector.stop("ganador");
    }
  });

  collector.on("end", async (_collected, reason) => {
    try {
      let resultadoMsg;
      if (reason === "ganador" && ganador) {
        await db.execute({
          sql: `INSERT INTO usuarios (id, monedas, xp, nivel)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(id) DO UPDATE SET
                  xp = usuarios.xp + excluded.xp,
                  monedas = usuarios.monedas + excluded.monedas`,
          args: [ganador.id, moneditas, xpGanada],
        });

        if (triviaId > 0) {
          db.execute({
            sql: "UPDATE trivia_stats SET ganador_id = ?, fue_respondida = 1 WHERE id = ?",
            args: [ganador.id, triviaId],
          }).catch(() => {});
        }

        resultadoMsg = await canal.send(
          `🎉 ¡Correcto <@${ganador.id}>! Era **${nombreHabitante}**. ¡Ganaste **${xpGanada} XP** y **${moneditas} moneditas**! 🌸`
        ).catch(() => null);
      } else {
        if (triviaId > 0) {
          db.execute({
            sql: "UPDATE trivia_stats SET fue_respondida = 0 WHERE id = ?",
            args: [triviaId],
          }).catch(() => {});
        }
        resultadoMsg = await canal.send(
          `⏰ ¡Se acabó el tiempo vecinitos! La respuesta correcta era **${nombreHabitante}**. ¡Para la próxima será!`
        ).catch(() => null);
      }
      autoDeleteMsg(resultadoMsg);
    } catch (err) {
      console.error("[Trivia] Error al finalizar trivia NPC:", err);
    }
  });
}

// ── API pública ───────────────────────────────────────────────────────────

/**
 * Lanza una trivia aleatoria en el canal general (llamada desde el scheduler).
 * 50% NPC-regalo, 50% pregunta fija.
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
    const usarPreguntaFija = Math.random() < 0.5;

    if (usarPreguntaFija) {
      const preguntaData = obtenerPreguntaFija();
      await ejecutarTriviaFija(canal, preguntaData);
    } else {
      await ejecutarTriviaNPC(canal);
    }
  } catch (e) {
    console.error("[Trivia] Error lanzando trivia:", e);
  }
}

/**
 * Lanza una trivia aleatoria en un canal específico (llamada desde el comando /trivia).
 * 50% NPC-regalo, 50% pregunta fija.
 * @async
 * @param {Object} canal - Canal de Discord donde lanzar la trivia
 * @returns {Promise<void>}
 */
export async function lanzarTriviaEnCanal(canal) {
  try {
    const usarPreguntaFija = Math.random() < 0.5;

    if (usarPreguntaFija) {
      const preguntaData = obtenerPreguntaFija();
      await ejecutarTriviaFija(canal, preguntaData);
    } else {
      await ejecutarTriviaNPC(canal);
    }
  } catch (e) {
    console.error("[Trivia] Error lanzando trivia en canal:", e);
  }
}

/**
 * Obtiene el top de ganadores de trivias.
 * @async
 * @param {number} [limit=10] - Cantidad de resultados
 * @returns {Promise<Array<{ ganador_id: string, correctas: number }>>}
 */
export async function getTopTrivia(limit = 10) {
  try {
    const res = await db.execute({
      sql: `SELECT ganador_id, COUNT(*) as correctas
            FROM trivia_stats
            WHERE fue_respondida = 1 AND ganador_id IS NOT NULL
            GROUP BY ganador_id
            ORDER BY correctas DESC
            LIMIT ?`,
      args: [limit],
    });
    return res.rows.map((r) => ({
      ganador_id: String(r.ganador_id),
      correctas: Number(r.correctas),
    }));
  } catch (e) {
    console.error("[Trivia] Error obteniendo top trivia:", e);
    return [];
  }
}
