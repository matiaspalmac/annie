/**
 * Estado centralizado del bot.
 * Reemplaza las variables sueltas que estaban en utils.js e index.js.
 */

// ── Sueño ──────────────────────────────────────────────────────
let _estaDurmiendo = false;
export function estaDurmiendo() { return _estaDurmiendo; }
export function setDurmiendo(val) { _estaDurmiendo = !!val; }

// ── Estrella Fugaz ─────────────────────────────────────────────
let _estrellaActiva = false;
let _estrellaMensaje = null;

export function isEstrellaActiva() { return _estrellaActiva; }
export function setEstrellaActiva(val) { _estrellaActiva = !!val; }
export function getEstrellaMensaje() { return _estrellaMensaje; }
export function setEstrellaMensaje(msg) { _estrellaMensaje = msg; }

// ── Mercader Doris ─────────────────────────────────────────────
let _itemEnDemanda = null;
let _demandaActivaHasta = 0;

/**
 * Obtiene el item actualmente en demanda, o null si expiró.
 * @returns {string|null}
 */
export function getItemEnDemanda() {
  const ahora = Date.now();
  if (_itemEnDemanda && ahora < _demandaActivaHasta) return _itemEnDemanda;
  if (_itemEnDemanda) {
    _itemEnDemanda = null;
    _demandaActivaHasta = 0;
  }
  return null;
}

/**
 * Establece un item en demanda por duración específica.
 * @param {string} item
 * @param {number} duracionMs
 */
export function setItemEnDemanda(item, duracionMs) {
  if (!item || typeof item !== "string" || !duracionMs || duracionMs <= 0) return;
  _itemEnDemanda = item;
  _demandaActivaHasta = Date.now() + duracionMs;
}

// ── Historial de mensajes (chisme) ─────────────────────────────
let _historialMensajes = [];
let _ultimoChisme = 0;

export function getHistorialMensajes() { return _historialMensajes; }
export function setHistorialMensajes(arr) { _historialMensajes = arr; }
export function getUltimoChisme() { return _ultimoChisme; }
export function setUltimoChisme(ts) { _ultimoChisme = ts; }

// ── Rifa ───────────────────────────────────────────────────────
let _rifaSorteadaHoy = false;
export function isRifaSorteadaHoy() { return _rifaSorteadaHoy; }
export function setRifaSorteadaHoy(val) { _rifaSorteadaHoy = !!val; }

// ── Rutinas ────────────────────────────────────────────────────
let _ultimaRutina = null;
export function getUltimaRutina() { return _ultimaRutina; }
export function setUltimaRutina(hora) { _ultimaRutina = hora; }

// ── Wiki logs ──────────────────────────────────────────────────
let _lastKnownLogId = 0;
export function getLastKnownLogId() { return _lastKnownLogId; }
export function setLastKnownLogId(id) { _lastKnownLogId = id; }
