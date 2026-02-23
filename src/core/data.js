export let AUTOCOMPLETE_CACHE = {};

export function setAutocompleteCache(cache) {
  AUTOCOMPLETE_CACHE = cache;
}

export function esTodos(input) {
  return /^\s*(\*|todos?|all)\s*$/i.test(input);
}

// Global Autocomplete Handler adapted from old commands.js
const CMDS_CON_TODOS = new Set(["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "recetas", "habitantes", "logros"]);

export async function handleAutocompleteGlobal(interaction) {
  const start = Date.now();
  const cmd = interaction.commandName;

  try {
    const cache = AUTOCOMPLETE_CACHE[cmd];
    if (!cache) {
      await interaction.respond([]).catch(() => { });
      return;
    }

    const focused = interaction.options.getFocused(true).value.trim();
    const norm = focused
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    let matches;
    if (norm === "") {
      matches = cache.slice(0, 25);
    } else {
      matches = [];
      for (let i = 0; i < cache.length && matches.length < 25; i++) {
        if (cache[i].normalized.includes(norm)) {
          matches.push(cache[i]);
        }
      }
    }

    const opciones = matches.map(m => ({ name: m.original, value: m.original }));

    if (opciones.length < 25 && CMDS_CON_TODOS.has(cmd)) {
      opciones.unshift({ name: "Todos los items (* / todos)", value: "todos" });
    }
    if (opciones.length > 25) opciones.length = 25;

    await interaction.respond(opciones).catch(err => {
      const code = err?.code ?? err?.rawError?.code;
      if (code === 10062) {
        console.warn(`[Autocomplete] /${cmd} expirado (10062) tras ${Date.now() - start}ms`);
      } else {
        console.error(`[Autocomplete] /${cmd} error en respond:`, err);
      }
    });
  } catch (err) {
    console.error(`[Autocomplete] /${cmd} error general tras ${Date.now() - start}ms:`, err);
    await interaction.respond([]).catch(() => { });
  }
}