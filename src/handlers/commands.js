import fs from "node:fs";
import path from "node:path";
import { URL, pathToFileURL } from "node:url";
import { MessageFlags } from "discord.js";
import { logError, logCommand } from "../core/logger.js";
import { getBostezo } from "../core/utils.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Fix pathing on Windows (remove leading slash)
const commandsPath = path.join(__dirname.replace(/^\/([A-Z]:)/, "$1"), "..", "commands");

// Almacenamiento de comandos y autocompletados
export const commands = new Map();
export const autoCompletes = new Map();

// Constantes
const MAX_COMMAND_EXECUTION_TIME = 30000; // 30 segundos

/**
 * Obtiene recursivamente todos los archivos .js de comandos
 * @param {string} dirPath - Ruta del directorio a escanear
 * @returns {string[]} Array de rutas absolutas a archivos de comandos
 */
function getCommandFilesRecursively(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      // Ignorar archivos/carpetas que empiezan con _ (templates)
      if (entry.name.startsWith('_')) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...getCommandFilesRecursively(fullPath));
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(fullPath);
      }
    }

    return files;
  } catch (error) {
    console.error(`Error al escanear directorio ${dirPath}:`, error);
    return [];
  }
}

/**
 * Carga dinámicamente todos los comandos desde el directorio de comandos
 * @returns {Promise<void>}
 */
export async function loadCommands() {
  const commandFiles = getCommandFilesRecursively(commandsPath);
  
  if (commandFiles.length === 0) {
    console.warn('[WARN] No se encontraron archivos de comandos');
    return;
  }

  let cargados = 0;
  let errores = 0;

  for (const filePath of commandFiles) {
    const fileUrl = pathToFileURL(filePath).href;
    const relativeFile = path.relative(commandsPath, filePath);

    try {
      const commandModule = await import(fileUrl);

      // Validar estructura del módulo
      if (!commandModule.data || !commandModule.execute) {
        console.warn(`[WARNING] ${relativeFile} no exporta 'data' o 'execute' - ignorado`);
        continue;
      }

      // Validar que data tenga nombre
      if (!commandModule.data.name) {
        console.warn(`[WARNING] ${relativeFile} no tiene nombre de comando - ignorado`);
        continue;
      }

      // Validar que execute sea función
      if (typeof commandModule.execute !== 'function') {
        console.warn(`[WARNING] ${relativeFile} export 'execute' no es función - ignorado`);
        continue;
      }

      commands.set(commandModule.data.name, commandModule);
      cargados++;

      if ("autocomplete" in commandModule && typeof commandModule.autocomplete === 'function') {
        autoCompletes.set(commandModule.data.name, commandModule);
      }
    } catch (err) {
      console.error(`[ERROR] Falló la carga del comando ${relativeFile}:`, err.message);
      errores++;
    }
  }

  console.log(`[COMMANDS] ${cargados} comandos cargados, ${errores} errores`);
}

/**
 * Obtiene las definiciones de todos los comandos en formato JSON
 * @returns {Object[]} Array de definiciones de comandos
 */
export function getCommandDefs() {
  try {
    return Array.from(commands.values()).map(cmd => cmd.data.toJSON());
  } catch (error) {
    console.error('[ERROR] Error al obtener definiciones de comandos:', error);
    return [];
  }
}

/**
 * Maneja las interacciones de autocompletado
 * @param {import("discord.js").AutocompleteInteraction} interaction - Interacción de autocompletado
 * @returns {Promise<void>}
 */
export async function handleAutocomplete(interaction) {
  const cmd = interaction.commandName;
  
  if (!cmd || typeof cmd !== 'string') {
    console.warn('[Autocomplete] commandName inválido');
    return;
  }

  const command = autoCompletes.get(cmd) || commands.get(cmd);

  if (!command) {
    console.warn(`[Autocomplete] Comando /${cmd} no encontrado`);
    return;
  }

  try {
    if (typeof command.autocomplete === "function") {
      await command.autocomplete(interaction);
    }
  } catch (err) {
    console.error(`[Autocomplete] /${cmd} error:`, err.message);
    await interaction.respond([]).catch(() => { });
  }
}

/**
 * Maneja la ejecución de comandos slash
 * @param {import("discord.js").Client} client - Cliente de Discord
 * @param {import("discord.js").CommandInteraction} interaction - Interacción del comando
 * @returns {Promise<void>}
 */
export async function handleCommand(client, interaction) {
  const cmdName = interaction.commandName;
  
  // Validación de seguridad
  if (!cmdName || typeof cmdName !== 'string') {
    console.error('[Command] commandName inválido:', cmdName);
    return;
  }

  const command = commands.get(cmdName);

  if (!command) {
    console.error(`[Command] No se encontró /${cmdName}`);
    return;
  }

  const bostezo = getBostezo();
  const startTime = Date.now();

  try {
    // Log asíncrono (no bloqueante)
    logCommand(interaction).catch(err => {
      console.error('[Command] Error en logCommand:', err.message);
    });

    // Ejecutar comando con timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Comando timeout')), MAX_COMMAND_EXECUTION_TIME);
    });

    await Promise.race([
      command.execute(interaction, bostezo),
      timeoutPromise
    ]);

    const executionTime = Date.now() - startTime;
    if (executionTime > 5000) {
      console.warn(`[Command] /${cmdName} tomó ${executionTime}ms`);
    }
  } catch (err) {
    const executionTime = Date.now() - startTime;
    console.error(`[Command] /${cmdName} falló (${executionTime}ms):`, err.message);
    
    // Log error asíncrono
    logError(client, err, `Comando /${cmdName}`).catch(() => {});

    // Notificar al usuario si la interacción sigue viva
    const msg = "Ay, se me enredaron los papelitos... inténtalo otra vez, corazón.";
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    } catch (replyErr) {
      console.error(`[Command] No se pudo notificar error al usuario:`, replyErr.message);
    }
  }
}
