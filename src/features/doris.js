/**
 * Evento Mercader Estelar (Doris) — paga triple por un item aleatorio.
 */
import { CONFIG } from "../core/config.js";
import { estaDurmiendo } from "../core/state.js";
import { getItemEnDemanda, setItemEnDemanda } from "../core/state.js";
import { crearEmbed, getCanalGeneral } from "../core/utils.js";

const ITEMS_GRANJABLES = [
  { id: "Piedra", emoji: "🪨" },
  { id: "Mineral", emoji: "🪨✨" },
  { id: "Fluorita impecable", emoji: "💎" },
  { id: "Pescado", emoji: "🐟" },
  { id: "Manzanas", emoji: "🍎" },
  { id: "Mantis Religiosa", emoji: "🦗" },
  { id: "Mariposa Emperador", emoji: "🦋" },
  { id: "Tarántula", emoji: "🕷️" },
];

const DURACION_OFERTA_MS = 3 * 60 * 60 * 1000; // 3 horas

export function chequearDoris(client) {
  if (estaDurmiendo() || getItemEnDemanda()) return;

  if (Math.random() > 0.15) return;

  const elegido = ITEMS_GRANJABLES[Math.floor(Math.random() * ITEMS_GRANJABLES.length)];
  setItemEnDemanda(elegido.id, DURACION_OFERTA_MS);

  const canal = getCanalGeneral(client);
  if (!canal) return;

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("🚀 ¡Doris ha aterrizado de emergencia!")
    .setDescription(
      `*Doris se baja corriendo de su nave espacial...*\n\n` +
      `"¡Oigan, pueblerinos terrícolas! Mi nave necesita combustible rápido y estoy pagando EL TRIPLE por un ítem específico en el mercado de Annie."\n\n` +
      `🎯 **Ítem en Alta Demanda:** ${elegido.emoji} **${elegido.id}**\n` +
      `⏱️ **Duración de la oferta:** 3 Horas\n\n` +
      `*(¡Vayan corriendo a usar \`/vender\` si tienen este ítem!)*`,
    )
    .setThumbnail("https://heartopiachile.vercel.app/npc/doris-rain.webp");

  canal.send({ embeds: [embed] }).catch(console.error);
}
