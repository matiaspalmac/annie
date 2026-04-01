/**
 * Sincronización de caché de autocompletado y detección de cambios en admin_logs.
 */
import { CONFIG } from "../core/config.js";
import { getLastKnownLogId, setLastKnownLogId } from "../core/state.js";
import { crearEmbed } from "../core/utils.js";
import { setAutocompleteCache } from "../core/data.js";
import { buildAutocompleteCache, getLatestLogId, getLogsSince } from "../services/db.js";

/**
 * Refresca caché de autocompletado y notifica cambios en la wiki.
 * @param {import("discord.js").Client} client
 */
export async function refreshCache(client) {
  try {
    const nuevaCache = await buildAutocompleteCache();
    setAutocompleteCache(nuevaCache);
    console.log(`[Cache] Autocompletado refrescado (${Object.keys(nuevaCache).length} categorías).`);

    // Detectar cambios nuevos en admin_logs
    const latestId = await getLatestLogId();
    const lastKnown = getLastKnownLogId();

    if (latestId > lastKnown) {
      const logs = await getLogsSince(lastKnown);
      setLastKnownLogId(latestId);

      if (logs.length > 0 && CONFIG.LOG_CHANNEL_ID) {
        const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
          const resumen = logs.map(l => {
            const iconos = { agregar: "✅", editar: "✏️", eliminar: "🗑️" };
            const icono = iconos[l.accion] ?? "•";
            return `${icono} **${l.admin}** ${l.accion} en \`${l.tabla ?? "??"}\` — \`${l.item_id ?? ""}\``;
          }).join("\n").slice(0, 1900);

          const embed = crearEmbed(CONFIG.COLORES.AZUL)
            .setTitle("📋 Cambios en la Wiki")
            .setDescription(resumen)
            .setFooter({ text: `${logs.length} cambio(s) detectado(s)` });

          logChannel.send({ embeds: [embed] }).catch(console.error);
        }
      }
    }
  } catch (e) {
    console.error("[Cache] Error en refresh:", e.message);
  }
}
