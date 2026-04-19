/**
 * Feature: cumpleaños de la aldea
 *
 * - checkCumpleanos(client): scheduler diario que saluda a los cumpleañeros en #cumpleaños.
 * - Usa CONFIG.CUMPLE_ULTIMA_REVISION (fecha YYYY-MM-DD) como idempotencia diaria.
 * - Saludo se envía a partir de las 9am Chile.
 */
import { db } from "../services/db.js";
import { CONFIG } from "../core/config.js";
import { crearEmbed, getHoraChile, getFechaChile } from "../core/utils.js";

const HORA_SALUDO = 9;

export async function checkCumpleanos(client) {
  try {
    const hoyFecha = getFechaChile();
    const mmdd = hoyFecha.slice(5);
    const ultima = String(CONFIG.CUMPLE_ULTIMA_REVISION || "");
    if (ultima === hoyFecha) return;
    if (getHoraChile() < HORA_SALUDO) return;

    const canalId = CONFIG.CANAL_CUMPLEANOS_ID;
    const guildId = CONFIG.GUILD_ID;
    if (!canalId || !guildId) return;

    const res = await db.execute({
      sql: "SELECT id FROM usuarios WHERE cumple = ?",
      args: [mmdd],
    });

    if (res.rows.length > 0) {
      const guild = await client.guilds.fetch(guildId);
      const canal = await guild.channels.fetch(canalId).catch(() => null);
      if (canal && canal.isTextBased()) {
        const mentions = res.rows.map(r => `<@${r.id}>`).join(" ");
        const embed = crearEmbed("#FFB7C5")
          .setTitle("🎂 ¡Feliz cumpleaños!")
          .setDescription(
            `Hoy la aldea se ilumina con velitas para ${mentions} 🪷\n\n` +
            `Que las luciérnagas canten bajito, que el té esté calentito, y que este nuevo añito te traiga muchas cosquillas al corazón ✨`
          );
        await canal.send({ content: `🎉 ${mentions}`, embeds: [embed] });
        console.log(`[Cumpleanos] Saludo enviado a ${res.rows.length} vecino(s).`);
      }
    }

    await db.execute({
      sql: "INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)",
      args: ["CUMPLE_ULTIMA_REVISION", hoyFecha],
    });
    CONFIG.CUMPLE_ULTIMA_REVISION = hoyFecha;
  } catch (err) {
    console.error("[Cumpleanos] Error:", err.message);
  }
}

export function parsearFechaCumple(texto) {
  if (!texto) return null;
  const t = String(texto).trim().replace(/\s+/g, "");
  const m = t.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return null;
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  if (!Number.isFinite(dia) || !Number.isFinite(mes)) return null;
  if (mes < 1 || mes > 12) return null;
  const diasPorMes = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (dia < 1 || dia > diasPorMes[mes - 1]) return null;
  return `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function formatearFechaCumple(mmdd) {
  if (!mmdd || typeof mmdd !== "string") return "no definido";
  const [m, d] = mmdd.split("-");
  if (!m || !d) return mmdd;
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const mesNom = meses[parseInt(m, 10) - 1] || m;
  return `${parseInt(d, 10)} de ${mesNom}`;
}
