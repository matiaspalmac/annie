/**
 * Módulo de datos y caché de autocompletado
 */

// Constantes
const MAX_AUTOCOMPLETE_RESULTS = 25;
const AUTOCOMPLETE_TIMEOUT = 3000; // 3 segundos

// Caché de autocompletado global
export let AUTOCOMPLETE_CACHE = {};

/**
 * Actualiza el caché de autocompletado
 * @param {Object} cache - Nuevo caché a establecer
 */
export function setAutocompleteCache(cache) {
  if (!cache || typeof cache !== 'object') {
    console.warn('[Data] setAutocompleteCache recibido con valor inválido');
    return;
  }
  AUTOCOMPLETE_CACHE = cache;
}

/**
 * Verifica si el input es "todos" o equivalente
 * @param {string} input - Input del usuario
 * @returns {boolean} true si es "todos", "*", "all", etc.
 */
export function esTodos(input) {
  if (!input || typeof input !== 'string') return false;
  return /^\s*(\*|todos?|all)\s*$/i.test(input);
}

/**
 * Normaliza un string para búsqueda (minúsculas, sin acentos, sin espacios extra)
 * @param {string} str - String a normalizar
 * @returns {string} String normalizado
 */
function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Global Autocomplete Handler adapted from old commands.js
const CMDS_CON_TODOS = new Set(["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "recetas", "habitantes", "logros"]);

/**
 * Maneja autocompletado global para comandos de consulta
 * @param {import("discord.js").AutocompleteInteraction} interaction - Interacción de autocompletado
 * @returns {Promise<void>}
 */
export async function handleAutocompleteGlobal(interaction) {
  const start = Date.now();
  const cmd = interaction.commandName;

  try {
    // Validaciones
    if (!cmd || typeof cmd !== 'string') {
      console.warn('[Autocomplete] commandName inválido');
      await interaction.respond([]).catch(() => {});
      return;
    }

    const cache = AUTOCOMPLETE_CACHE[cmd];
    if (!cache || !Array.isArray(cache)) {
      await interaction.respond([]).catch(() => {});
      return;
    }

    // Obtener valor del campo enfocado
    let focused = '';
    try {
      const focusedOption = interaction.options.getFocused(true);
      focused = String(focusedOption?.value || '').trim();
    } catch (err) {
      console.warn('[Autocomplete] Error obteniendo focused:', err.message);
    }

    const norm = normalizeString(focused);

    // Buscar coincidencias
    let matches;
    if (norm === "") {
      matches = cache.slice(0, MAX_AUTOCOMPLETE_RESULTS);
    } else {
      matches = [];
      for (let i = 0; i < cache.length && matches.length < MAX_AUTOCOMPLETE_RESULTS; i++) {
        const item = cache[i];
        if (!item || !item.normalized) continue;
        
        if (item.normalized.includes(norm)) {
          matches.push(item);
        }
      }
    }

    // Construir opciones de respuesta
    const opciones = matches
      .filter(m => m && m.original)
      .map(m => ({ 
        name: String(m.original).substring(0, 100), 
        value: String(m.original).substring(0, 100) 
      }));

    // Agregar opción "todos" si aplica
    if (opciones.length < MAX_AUTOCOMPLETE_RESULTS && CMDS_CON_TODOS.has(cmd)) {
      opciones.unshift({ name: "Todos los items (* / todos)", value: "todos" });
    }
    
    // Limitar a 25 opciones máximo
    if (opciones.length > MAX_AUTOCOMPLETE_RESULTS) {
      opciones.length = MAX_AUTOCOMPLETE_RESULTS;
    }

    // Responder con timeout
    const responsePromise = interaction.respond(opciones);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Autocomplete timeout')), AUTOCOMPLETE_TIMEOUT);
    });

    await Promise.race([responsePromise, timeoutPromise]);

  } catch (err) {
    const elapsed = Date.now() - start;
    const code = err?.code ?? err?.rawError?.code;
    
    if (code === 10062) {
      console.warn(`[Autocomplete] /${cmd} expirado (10062) tras ${elapsed}ms`);
    } else if (err.message === 'Autocomplete timeout') {
      console.warn(`[Autocomplete] /${cmd} timeout tras ${elapsed}ms`);
    } else {
      console.error(`[Autocomplete] /${cmd} error tras ${elapsed}ms:`, err.message);
    }
    
    await interaction.respond([]).catch(() => {});
  }
}