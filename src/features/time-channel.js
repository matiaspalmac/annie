/**
 * Actualización del canal de hora del pueblito.
 */
import { CONFIG } from "../core/config.js";

/**
 * Actualiza el nombre del canal de hora con la hora actual.
 * @param {import("discord.js").Client} client
 */
export async function updateTimeChannel(client) {
  if (!CONFIG.CANAL_HORA_ID) return;
  try {
    const channel = await client.channels.fetch(CONFIG.CANAL_HORA_ID);
    if (!channel) return;

    const ahora = new Date();
    const time = ahora.toLocaleTimeString("es-ES", {
      timeZone: CONFIG.TIMEZONE_VOZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const newName = `${time} Pueblito`;
    if (channel.name !== newName) {
      await channel.setName(newName);
    }
  } catch (e) {
    if (e.status !== 429) console.error("Error reloj:", e.message);
  }
}
