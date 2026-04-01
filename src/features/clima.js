/**
 * Anuncio de clima diario y actualización del canal de clima.
 */
import { CONFIG } from "../core/config.js";
import { crearEmbed, getCanalGeneral, getHoraChile } from "../core/utils.js";
import { db } from "../services/db.js";

/**
 * Anuncia el clima del día en el canal general.
 * @param {import("discord.js").Client} client
 * @param {boolean} [forzado=false]
 */
export async function anunciarClima(client, forzado = false) {
  try {
    const hora = getHoraChile();
    const horaAnuncio = CONFIG.HORA_ANUNCIO_CLIMA || 19;
    if (!forzado && hora !== horaAnuncio) return;

    const canal = getCanalGeneral(client);
    if (!canal) return;

    const result = await db.execute("SELECT * FROM clima WHERE id = 'hoy'");
    if (result.rows.length === 0) return;

    const hoy = result.rows[0];
    const timeline = JSON.parse(hoy.timeline || "[]");

    const embed = crearEmbed(CONFIG.COLORES.CIELO)
      .setTitle("☁️ Clima del Pueblito — Hoy")
      .setDescription(`**${hoy.tipo || "--"}**\n${hoy.descripcion || ""}`);

    if (Array.isArray(timeline) && timeline.length > 0) {
      const horariosTexto = timeline.map(h => `${h.hora}:00 — ${h.texto}`).join("\n");
      embed.addFields({ name: "Horarios con cariño", value: horariosTexto });
    }

    embed.setFooter({ text: "Pronóstico hecho con amor | Annie" });

    await canal.send({ content: "Annie les trae el clima con amor:", embeds: [embed] });
    console.log("[Clima] Clima anunciado exitosamente");
  } catch (error) {
    console.error("[Clima] Error:", error.message);
  }
}

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
