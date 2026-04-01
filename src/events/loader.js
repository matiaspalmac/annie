/**
 * Carga dinámica de eventos desde archivos en este directorio.
 * Cada archivo exporta: { event, once?, execute }
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(new URL(import.meta.url).pathname)
  .replace(/^\/([A-Z]:)/, "$1"); // Fix Windows paths

/**
 * Registra todos los event handlers encontrados en src/events/.
 * @param {import("discord.js").Client} client
 */
export async function registerEvents(client) {
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith(".js") && f !== "loader.js");

  let loaded = 0;

  for (const file of files) {
    const filePath = path.join(__dirname, file);
    const mod = await import(pathToFileURL(filePath).href);

    if (!mod.event || !mod.execute) {
      console.warn(`[Events] ${file} no exporta 'event' o 'execute' — ignorado`);
      continue;
    }

    if (mod.once) {
      client.once(mod.event, (...args) => mod.execute(...args, client));
    } else {
      client.on(mod.event, (...args) => mod.execute(...args, client));
    }

    loaded++;
  }

  console.log(`[Events] ${loaded} eventos cargados`);
}
