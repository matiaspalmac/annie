/**
 * Rutinas diarias, frases ambient y menciones de vecinos.
 */
import { CONFIG } from "../core/config.js";
import { estaDurmiendo } from "../core/state.js";
import { getUltimaRutina, setUltimaRutina } from "../core/state.js";
import { getCanalGeneral, getHoraChile } from "../core/utils.js";
import { getTrato, RUTINAS, FRASES_AMBIENT } from "../core/personality.js";

/**
 * Ejecuta rutinas horarias de Annie (mensajes automáticos).
 */
export function ejecutarRutinaDiaria(client) {
  try {
    if (estaDurmiendo()) return;

    const hora = getHoraChile();
    const rutina = RUTINAS.find(r => r.hora === hora);
    if (!rutina || getUltimaRutina() === hora) return;

    setUltimaRutina(hora);
    const canal = getCanalGeneral(client);
    if (!canal) return;

    canal.send(rutina.mensaje)
      .then(() => console.log(`[Rutina] Ejecutada para hora ${hora}`))
      .catch(err => console.error("[Rutina] Error:", err.message));
  } catch (error) {
    console.error("[Rutina] Error:", error.message);
  }
}

/**
 * Envía una frase ambient aleatoria al canal general.
 */
export function enviarFraseAmbient(client) {
  if (estaDurmiendo()) return;
  const canal = getCanalGeneral(client);
  if (!canal) return;
  const frase = FRASES_AMBIENT[Math.floor(Math.random() * FRASES_AMBIENT.length)];
  canal.send(`*Annie comenta con cariño:* ${frase}`).catch(() => {});
}

/**
 * Menciona a un vecino random con una frase cariñosa.
 */
export async function mencionarVecinoRandom(client) {
  if (estaDurmiendo()) return;

  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  const canal = getCanalGeneral(client);
  if (!guild || !canal) return;

  const miembros = guild.members.cache.filter(m => !m.user.bot);
  if (miembros.size === 0) return;

  const vecino = miembros.random();
  const trato = getTrato();
  const frase = FRASES_AMBIENT[Math.floor(Math.random() * FRASES_AMBIENT.length)];

  const intros = [
    `*Annie le hace señitas a ${vecino} desde lejos:*`,
    `*Annie le deja una cartita perfumada a ${vecino}:*`,
    `*Annie sonríe al ver pasar a ${vecino}:*`,
    `*Annie se acerca despacito a ${vecino}:*`,
  ];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  canal.send(`${intro} "${frase.replace("corazón", trato).replace("vecin@", trato)}"`).catch(() => {});
}
