/**
 * Feature: highlights semanales
 *
 * Cada domingo a las 11am Chile, Annie recorre los canales configurados, busca
 * los mensajes de los últimos 7 días con más reacciones y publica un top 5 en
 * CONFIG.CANAL_HIGHLIGHTS_ID. Idempotente vía CONFIG.HIGHLIGHTS_ULTIMA_FECHA.
 */
import { db } from "../services/db.js";
import { CONFIG } from "../core/config.js";
import { crearEmbed, getHoraChile, getFechaChile } from "../core/utils.js";

const HORA_POST = 11;
const DIA_DOMINGO = 0;
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_REACCIONES = 3;
const TOP_N = 5;

const CANALES_SCAN_FALLBACK = [
  "1495527885476200569", // 🌎 general
  "1495552158236541070", // 💭 offtopic
  "1463660849653874853", // 🎞️ multimedia
  "1467326699707564187", // 🐈 mascotas
  "1495556559185383564", // 📸 foto-del-dia
  "1495556566521352213", // 🎨 arte-original
];

export async function checkHighlights(client) {
  try {
    if (new Date().getDay() !== DIA_DOMINGO) return;

    const hoyFecha = getFechaChile();
    const ultima = String(CONFIG.HIGHLIGHTS_ULTIMA_FECHA || "");
    if (ultima === hoyFecha) return;
    if (getHoraChile() < HORA_POST) return;

    const canalDestinoId = CONFIG.CANAL_HIGHLIGHTS_ID;
    if (!canalDestinoId) return;
    const canalDestino = await client.channels.fetch(canalDestinoId).catch(() => null);
    if (!canalDestino || !canalDestino.isTextBased()) return;

    const canalesScan = Array.isArray(CONFIG.CANALES_HIGHLIGHTS_SCAN) && CONFIG.CANALES_HIGHLIGHTS_SCAN.length > 0
      ? CONFIG.CANALES_HIGHLIGHTS_SCAN
      : CANALES_SCAN_FALLBACK;

    const cutoffMs = Date.now() - SEMANA_MS;
    const candidatos = [];

    for (const chId of canalesScan) {
      try {
        const ch = await client.channels.fetch(chId).catch(() => null);
        if (!ch || !ch.messages) continue;
        const batch = await ch.messages.fetch({ limit: 100 });
        for (const msg of batch.values()) {
          if (msg.author?.bot) continue;
          if (msg.createdTimestamp < cutoffMs) continue;
          let reacciones = 0;
          for (const r of msg.reactions.cache.values()) reacciones += r.count;
          if (reacciones >= MIN_REACCIONES) {
            candidatos.push({ msg, reacciones });
          }
        }
      } catch (e) {
        console.error(`[Highlights] Error en canal ${chId}:`, e.message);
      }
    }

    candidatos.sort((a, b) => b.reacciones - a.reacciones);
    const top = candidatos.slice(0, TOP_N);

    let embed;
    if (top.length === 0) {
      embed = crearEmbed("#FFD5E5")
        .setTitle("🌟 Highlights de la Aldea — semana tranquilita")
        .setDescription("Esta semana fue de las calmaditas ✿ nadie destacó con muchas reacciones — pero la próxima va a brillar más 🪷");
    } else {
      const lines = top.map((h, i) => {
        const link = `https://discord.com/channels/${CONFIG.GUILD_ID}/${h.msg.channel.id}/${h.msg.id}`;
        const previewRaw = h.msg.content || "[mensaje con imagen/embed]";
        const preview = previewRaw.slice(0, 140).replace(/\n/g, " ");
        return `**${i + 1}.** <@${h.msg.author.id}> en <#${h.msg.channel.id}> — ${h.reacciones} reacciones\n> ${preview}\n[Ver mensaje](${link})`;
      });
      embed = crearEmbed("#FFD5E5")
        .setTitle("🌟 Highlights de la Aldea — esta semana")
        .setDescription(`Los momentos más queridos de la semana ✿\n\n${lines.join("\n\n")}`);
    }

    await canalDestino.send({ embeds: [embed] });
    await db.execute({
      sql: "INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)",
      args: ["HIGHLIGHTS_ULTIMA_FECHA", hoyFecha],
    });
    CONFIG.HIGHLIGHTS_ULTIMA_FECHA = hoyFecha;
    console.log(`[Highlights] Publicado top ${top.length}.`);
  } catch (err) {
    console.error("[Highlights] Error:", err.message);
  }
}
