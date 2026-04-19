/**
 * Actualización del canal de clima (el anuncio automático fue removido).
 */
import { CONFIG } from "../core/config.js";
import { getHoraChile } from "../core/utils.js";
import { db } from "../services/db.js";

/**
 * Actualiza el nombre del canal de clima con el estado actual.
 * @param {import("discord.js").Client} client
 */
export async function updateWeatherChannel(client) {
  if (!CONFIG.CANAL_CLIMA_ID) return;
  try {
    const canal = await client.channels.fetch(CONFIG.CANAL_CLIMA_ID);
    if (!canal) return;

    const result = await db.execute("SELECT * FROM clima WHERE id = 'hoy'");
    if (result.rows.length === 0) return;

    const hoy = result.rows[0];
    const timeline = JSON.parse(hoy.timeline || "[]");

    const horaActual = getHoraChile();
    const estadosPasados = timeline.filter(t => t.hora <= horaActual);
    const climaAhora = estadosPasados.length > 0
      ? estadosPasados[estadosPasados.length - 1]
      : timeline[timeline.length - 1];

    if (!climaAhora) return;
    const nombreCanal = `Clima: ${climaAhora.texto}`;
    if (canal.name !== nombreCanal) {
      await canal.setName(nombreCanal);
    }
  } catch (e) {
    if (e.status !== 429 && e.code !== 10003) {
      console.error("Error actualizando canal de clima:", e.message);
    }
  }
}
