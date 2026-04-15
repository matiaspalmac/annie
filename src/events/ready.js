/**
 * Evento: clientReady (se ejecuta una vez al conectar)
 * Inicializa DB, carga comandos, registra slash commands, inicia schedulers.
 */
import { REST, Routes, ActivityType, Events } from "discord.js";
import { joinVoiceChannel, getVoiceConnection } from "@discordjs/voice";

import { CONFIG } from "../core/config.js";
import { estaDurmiendo, setDurmiendo } from "../core/state.js";
import { setLastKnownLogId } from "../core/state.js";
import { crearEmbed, getHoraChile } from "../core/utils.js";
import { ACTIVIDADES } from "../core/personality.js";
import { setAutocompleteCache } from "../core/data.js";

import { initDB, loadConfig, buildAutocompleteCache, getLatestLogId } from "../services/db.js";
import { loadCommands, getCommandDefs } from "../handlers/commands.js";
import { logStartup } from "../core/logger.js";

import { registerInterval, registerTimeout } from "../schedulers/scheduler.js";
import { procesarSorteoRifa } from "../features/rifa.js";
import { chequearDoris } from "../features/doris.js";
import { anunciarClima, updateWeatherChannel } from "../features/clima.js";
// import { ejecutarRutinaDiaria, enviarFraseAmbient, mencionarVecinoRandom } from "../features/rutinas.js";
import { lanzarEstrellaFugaz } from "../core/utils.js";
import { lanzarTriviaAleatoria } from "../features/trivia.js";
import { refreshCache } from "../features/wiki-sync.js";
import { updateTimeChannel } from "../features/time-channel.js";
import { verificarDeadline } from "../features/eventos.js";

export const event = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console.log(`${CONFIG.APP_LABEL} conectada: ${client.user.tag}`);

  // ── Inicialización ──────────────────────────────────────────
  await initDB();
  await loadConfig();

  const logId = await getLatestLogId();
  setLastKnownLogId(logId);

  const cache = await buildAutocompleteCache();
  setAutocompleteCache(cache);
  console.log(`Cache de autocompletado cargada para ${Object.keys(cache).length} categorías.`);

  // ── Conectar al canal de voz ────────────────────────────────
  conectarOficina(client);

  // ── Actualizar estado ───────────────────────────────────────
  actualizarEstado(client);

  // ── Cachear mensaje de roles ────────────────────────────────
  if (CONFIG.MENSAJE_ROLES_ID) {
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (guild) {
      for (const channel of guild.channels.cache.values()) {
        if (channel.isTextBased()) {
          try { await channel.messages.fetch(CONFIG.MENSAJE_ROLES_ID); } catch { }
        }
      }
    }
  }

  // ── Registrar slash commands ────────────────────────────────
  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);
  try {
    await loadCommands();
    const commandDefs = getCommandDefs();
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
      { body: commandDefs },
    );
    console.log(`Slash commands registrados correctamente (${commandDefs.length} comandos)`);
    await logStartup(client);
  } catch (e) {
    console.error("Error registrando commands:", e);
  }

  // ── Gestión de sueño ────────────────────────────────────────
  gestionarSueno(client);

  // ── Programar tareas recurrentes ────────────────────────────
  registerInterval("gestion-sueno", () => gestionarSueno(client), 60_000);
  registerInterval("sorteo-rifa", () => procesarSorteoRifa(client), 60_000);
  registerInterval("actualizar-estado", () => actualizarEstado(client), 600_000);
  registerInterval("trivia", () => lanzarTriviaAleatoria(client), 8 * 3600_000);
  registerInterval("doris", () => chequearDoris(client), 90 * 60_000);
  registerInterval("cache-refresh", () => refreshCache(client), 30 * 60_000);
  registerInterval("anunciar-clima", () => anunciarClima(client), 3600_000);
  // registerInterval("frase-ambient", () => enviarFraseAmbient(client), 360 * 60_000);
  // registerInterval("rutina-diaria", () => ejecutarRutinaDiaria(client), 5 * 60_000);
  // registerInterval("vecino-random", () => mencionarVecinoRandom(client), 360 * 60_000);

  // Deadline de eventos comunitarios — cada 10 min
  registerInterval("evento-deadline", () => verificarDeadline(client), 10 * 60_000);

  // Canal de clima cada 15 min
  updateWeatherChannel(client);
  registerInterval("weather-channel", () => updateWeatherChannel(client), 15 * 60_000);

  // Canal de hora — alineado a cada 5 min
  updateTimeChannel(client);
  programarReloj(client);

  // Estrella fugaz — timeout recursivo
  programarEstrellaFugaz(client);
}

// ── Helpers internos ──────────────────────────────────────────────

function actualizarEstado(client) {
  try {
    if (!client?.user) return;
    const estado = estaDurmiendo()
      ? "Zzz... acurrucadita en la oficinita"
      : ACTIVIDADES[Math.floor(Math.random() * ACTIVIDADES.length)];
    client.user.setActivity(estado, { type: ActivityType.Custom });
  } catch (error) {
    console.error("[Estado] Error:", error.message);
  }
}

function gestionarSueno(client) {
  try {
    const hora = getHoraChile();
    const horaDormir = CONFIG.HORA_DORMIR || 23;
    const horaDespertar = CONFIG.HORA_DESPERTAR || 6;
    const deberiaDormir = hora >= horaDormir || hora < horaDespertar;

    if (deberiaDormir && !estaDurmiendo()) {
      setDurmiendo(true);
      actualizarEstado(client);
      console.log(`[Sueño] Annie se fue a dormir (hora: ${hora})`);
    } else if (!deberiaDormir && estaDurmiendo()) {
      setDurmiendo(false);
      actualizarEstado(client);
      console.log(`[Sueño] Annie despertó (hora: ${hora})`);
    }
  } catch (error) {
    console.error("[Sueño] Error:", error.message);
  }
}

export async function conectarOficina(client) {
  if (!CONFIG.CANAL_VOZ_DORMIR_ID) return;
  try {
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    if (!guild) return;
    const canal = await guild.channels.fetch(CONFIG.CANAL_VOZ_DORMIR_ID);
    if (!canal || canal.type !== 2) return;
    if (getVoiceConnection(CONFIG.GUILD_ID)) return;

    joinVoiceChannel({
      channelId: canal.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });
    console.log("[Voz] Annie entró a su oficinita de voz");
  } catch (error) {
    console.error("[Voz] Error:", error.message);
  }
}

function programarReloj(client) {
  const now = new Date();
  const ms = (5 - (now.getMinutes() % 5)) * 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
  registerTimeout("reloj-sync", () => {
    updateTimeChannel(client);
    programarReloj(client);
  }, ms + 2000);
}

function programarEstrellaFugaz(client) {
  const delayMin = (Math.floor(Math.random() * 120) + 240) * 60_000;
  registerTimeout("estrella-fugaz", () => {
    lanzarEstrellaFugaz(client);
    programarEstrellaFugaz(client);
  }, delayMin);
}
