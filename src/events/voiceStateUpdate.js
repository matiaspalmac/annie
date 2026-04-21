/**
 * Evento: voiceStateUpdate
 * - Auto-reconecta a Annie cuando la desconectan de su oficinita.
 * - Temp rooms: al entrar al canal "Crear Sala" crea un canal de voz
 *   propio para el usuario y lo mueve ahí. Se elimina al quedar vacío.
 */
import { Events, ChannelType, PermissionFlagsBits } from "discord.js";
import { CONFIG } from "../core/config.js";
import { conectarOficina } from "./ready.js";

/** Canal trigger "join to create". Al entrar se genera una sala temporal. */
const TEMP_ROOM_TRIGGER_ID = "1463659720207372465";

/** Prefijo de nombre usado para identificar salas temporales tras un restart. */
const TEMP_ROOM_PREFIX = "Salita de ";

/** IDs de canales temporales creados por este handler (se limpian al vaciarse). */
const tempRooms = new Set();

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

  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  // ── Crear sala temporal al entrar al trigger ─────────────────────
  if (newState.channelId === TEMP_ROOM_TRIGGER_ID) {
    await crearSalaTemporal(newState).catch((e) =>
      console.error("[TempRoom] Error creando sala:", e.message)
    );
  }

  // ── Limpiar sala temporal al quedar vacía ────────────────────────
  if (
    oldState.channelId &&
    oldState.channelId !== newState.channelId &&
    tempRooms.has(oldState.channelId)
  ) {
    await limpiarSalaTemporal(oldState).catch((e) =>
      console.error("[TempRoom] Error limpiando sala:", e.message)
    );
  }
}

async function crearSalaTemporal(state) {
  const guild = state.guild;
  const member = state.member;
  const trigger = guild.channels.cache.get(TEMP_ROOM_TRIGGER_ID);
  if (!trigger) return;

  const nombre = `${TEMP_ROOM_PREFIX}${member.displayName}`;
  const canal = await guild.channels.create({
    name: nombre,
    type: ChannelType.GuildVoice,
    parent: trigger.parentId ?? undefined,
    permissionOverwrites: [
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.MuteMembers,
          PermissionFlagsBits.DeafenMembers,
          PermissionFlagsBits.Connect,
        ],
      },
    ],
    reason: `Sala temporal para ${member.user.tag}`,
  });

  tempRooms.add(canal.id);

  try {
    await member.voice.setChannel(canal);
  } catch (e) {
    // Si no se pudo mover (p.ej. salió del voz antes), eliminar canal recién creado
    tempRooms.delete(canal.id);
    await canal.delete("Fallo mover al miembro a la sala temporal").catch(() => {});
  }
}

async function limpiarSalaTemporal(state) {
  const canal = state.guild.channels.cache.get(state.channelId);
  if (!canal) {
    tempRooms.delete(state.channelId);
    return;
  }
  if (canal.members.size === 0) {
    tempRooms.delete(canal.id);
    await canal.delete("Sala temporal vacía").catch(() => {});
  }
}

/**
 * Barre salas temporales huérfanas al arrancar el bot.
 * Elimina solo las que están vacías; las que tienen gente las registra
 * en memoria para que se auto-limpien al vaciarse.
 */
export async function limpiarSalasHuerfanas(client) {
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    if (!guild) return;

    const trigger = await guild.channels.fetch(TEMP_ROOM_TRIGGER_ID).catch(() => null);
    if (!trigger) return;

    const canales = await guild.channels.fetch();
    let eliminadas = 0;
    let adoptadas = 0;

    for (const canal of canales.values()) {
      if (!canal) continue;
      if (canal.type !== ChannelType.GuildVoice) continue;
      if (canal.id === TEMP_ROOM_TRIGGER_ID) continue;
      if (canal.parentId !== trigger.parentId) continue;
      if (!canal.name.startsWith(TEMP_ROOM_PREFIX)) continue;

      if (canal.members.size === 0) {
        await canal.delete("Sala temporal huérfana (bot reinició)").catch(() => {});
        eliminadas++;
      } else {
        tempRooms.add(canal.id);
        adoptadas++;
      }
    }

    if (eliminadas || adoptadas) {
      console.log(`[TempRoom] Limpieza inicial: ${eliminadas} eliminadas, ${adoptadas} adoptadas`);
    }
  } catch (e) {
    console.error("[TempRoom] Error en limpieza inicial:", e.message);
  }
}
