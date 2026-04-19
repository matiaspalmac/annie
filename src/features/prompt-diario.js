/**
 * Feature: prompt diario (día con dueño)
 *
 * Cada día de la semana a partir de las 10am Chile, Annie publica un prompt
 * temático en el canal asignado. Idempotente vía CONFIG.PROMPT_DIARIO_ULTIMA_FECHA.
 *
 * Los prompts son editables desde la tabla `configuracion` — clave PROMPTS_DIARIOS
 * (JSON array de objetos { dia: 0-6, canalId, titulo, mensaje }).
 * Día 0 = domingo (dejado a highlights), 1 = lunes, ..., 6 = sábado.
 */
import { db } from "../services/db.js";
import { CONFIG } from "../core/config.js";
import { crearEmbed, getHoraChile, getFechaChile } from "../core/utils.js";

const HORA_POST = 10;

const PROMPTS_FALLBACK = [
  { dia: 1, canalId: "1495552165551276205", titulo: "📚 Lunes de Recomendación", mensaje: "¿Qué serie, libro, anime, manga o juego estás consumiendo esta semana? Cuéntanos y comparte tu recomendación 💌" },
  { dia: 2, canalId: "1467326699707564187", titulo: "🐈 Martes de Mascotas", mensaje: "Muéstranos a tu pet cotidiano — perrito, gato, conejo, pececito, el que sea. ¡La aldea quiere conocerlo! 🪷" },
  { dia: 3, canalId: "1463659720207372464", titulo: "🎀 Miércoles de Heartopia", mensaje: "Comparte una captura tuya del juego — tu casa, tu mascota ingame, un momentito cute. ✨" },
  { dia: 4, canalId: "1495546967382818847", titulo: "🖼️ Jueves de Jardines", mensaje: "¿Qué cozy game estás jugando esta semana? Stardew, AC, Palia, Dreamlight, Hello Kitty Island... muéstranos 🌾" },
  { dia: 5, canalId: "1495552158236541070", titulo: "💭 Viernes de Mood", mensaje: "¿Cómo estás hoy? Usa una palabra, un emoji o una frase corta — nos leemos sin juicio 🌙" },
  { dia: 6, canalId: "1495527885476200569", titulo: "🎤 Sábado de Charla", mensaje: "Sábado en la aldea — esta noche podemos juntarnos en voz para chismecito. ¿Quién se apunta? ✨" },
];

export async function checkPromptDiario(client) {
  try {
    const hoyFecha = getFechaChile();
    const ultima = String(CONFIG.PROMPT_DIARIO_ULTIMA_FECHA || "");
    if (ultima === hoyFecha) return;
    if (getHoraChile() < HORA_POST) return;

    const diaSemana = new Date().getDay();

    const prompts = Array.isArray(CONFIG.PROMPTS_DIARIOS) && CONFIG.PROMPTS_DIARIOS.length > 0
      ? CONFIG.PROMPTS_DIARIOS
      : PROMPTS_FALLBACK;
    const prompt = prompts.find(p => Number(p.dia) === diaSemana);

    if (!prompt) {
      await marcarFecha(hoyFecha);
      return;
    }

    const canal = await client.channels.fetch(prompt.canalId).catch(() => null);
    if (canal && canal.isTextBased()) {
      const embed = crearEmbed("#FFD5E5")
        .setTitle(prompt.titulo)
        .setDescription(prompt.mensaje);
      await canal.send({ embeds: [embed] });
      console.log(`[PromptDiario] Posteado en ${canal.name}`);
    }

    await marcarFecha(hoyFecha);
  } catch (err) {
    console.error("[PromptDiario] Error:", err.message);
  }
}

async function marcarFecha(fecha) {
  await db.execute({
    sql: "INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)",
    args: ["PROMPT_DIARIO_ULTIMA_FECHA", fecha],
  });
  CONFIG.PROMPT_DIARIO_ULTIMA_FECHA = fecha;
}
