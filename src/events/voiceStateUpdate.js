/**
 * Evento: voiceStateUpdate
 * Auto-reconecta a Annie y anuncia cuando alguien entra al canal de voz.
 */
import { Events } from "discord.js";
import { CONFIG } from "../core/config.js";
import { estaDurmiendo } from "../core/state.js";
import { getTrato } from "../core/personality.js";
import { conectarOficina } from "./ready.js";

export const event = Events.VoiceStateUpdate;
export const once = false;

export async function execute(oldState, newState, client) {
  // Auto-reconexión si Annie fue desconectada
  if (
    oldState.member?.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    console.log("Annie se desconecto del voice, reconectando...");
    return setTimeout(() => conectarOficina(client), 5000);
  }

  // Anunciar cuando alguien entra a un canal de voz
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    const canalTexto = newState.guild.channels.cache.get(CONFIG.CANAL_GENERAL_ID);
    if (!canalTexto) return;

    const trato = getTrato();
    const username = newState.member.user.username;

    const frasesDia = [
      `*Annie asoma la cabecita:* Oiga ${trato}... parece que **${username}** llego a mi oficinita.`,
      `Atencion, pueblito lindo! **${username}** anda dando vueltitas por aqui... que alegria.`,
      `Ay... **${username}** entro a mi oficinita... ¿vendra a tomarse un tecito conmigo?`,
      `*Annie saluda con la mano:* ¡Wena wena **${username}**! Pasa nomás, ponte cómodo.`,
      `Miren quién llegó... **${username}** anda de chismoso por aquí, jeje. ¡Bienvenido, corazón!`,
    ];
    const frasesNoche = [
      `*(Annie susurra bajito)* Shhh... ${trato}... **${username}** entro a la oficinita... que no se despierte nadie.`,
      `*(voz suave)* Ay... creo que **${username}** anda de búho todavía... ven a acurrucarte un ratito.`,
      `*(susurro dulce)* Entro alguien a mi oficinita... es **${username}**... abrigate bien que hace frío.`,
      `*(bostezando)* Buenas noches, **${username}**... pasa calladito nomás, corazón.`,
    ];

    const pool = estaDurmiendo() ? frasesNoche : frasesDia;
    canalTexto.send(pool[Math.floor(Math.random() * pool.length)]).catch(() => {});
  }
}
