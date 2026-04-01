/**
 * Registro centralizado de tareas programadas (intervals/timeouts).
 * Permite limpiar todo al apagar el bot y evita timers duplicados.
 */

/** @type {Map<string, {type: string, ref: ReturnType<typeof setInterval>}>} */
const registry = new Map();

/**
 * Registra un interval con nombre. Si ya existe uno con el mismo nombre, lo reemplaza.
 * @param {string} name - Nombre único del interval
 * @param {Function} fn - Función a ejecutar
 * @param {number} ms - Intervalo en milisegundos
 */
export function registerInterval(name, fn, ms) {
  clearScheduled(name);
  const ref = setInterval(async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[Scheduler] Error en '${name}':`, err.message);
    }
  }, ms);
  registry.set(name, { type: "interval", ref });
}

/**
 * Registra un timeout con nombre. Se auto-limpia al ejecutarse.
 * @param {string} name - Nombre único del timeout
 * @param {Function} fn - Función a ejecutar
 * @param {number} ms - Delay en milisegundos
 */
export function registerTimeout(name, fn, ms) {
  clearScheduled(name);
  const ref = setTimeout(async () => {
    registry.delete(name);
    try {
      await fn();
    } catch (err) {
      console.error(`[Scheduler] Error en timeout '${name}':`, err.message);
    }
  }, ms);
  registry.set(name, { type: "timeout", ref });
}

/**
 * Limpia una tarea programada por nombre.
 * @param {string} name - Nombre de la tarea
 */
export function clearScheduled(name) {
  const entry = registry.get(name);
  if (!entry) return;
  if (entry.type === "interval") clearInterval(entry.ref);
  else clearTimeout(entry.ref);
  registry.delete(name);
}

/**
 * Detiene TODAS las tareas programadas. Llamar en shutdown.
 */
export function stopAllSchedulers() {
  for (const [name] of registry) {
    clearScheduled(name);
  }
  console.log(`[Scheduler] ${registry.size === 0 ? "Todas las tareas detenidas." : ""}`);
}
