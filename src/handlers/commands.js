import fs from "node:fs";
import path from "node:path";
import { URL, pathToFileURL } from "node:url";
import { MessageFlags } from "discord.js";
import { logError, logCommand } from "../core/logger.js";
import { getBostezo } from "../core/utils.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Fix pathing on Windows (remove leading slash)
const commandsPath = path.join(__dirname.replace(/^\/([A-Z]:)/, "$1"), "..", "commands");

export const commands = new Map();
export const autoCompletes = new Map();

function getCommandFilesRecursively(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
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
}

// Helper to load all commands dynamically
export async function loadCommands() {
  const commandFiles = getCommandFilesRecursively(commandsPath);

  for (const filePath of commandFiles) {
    const fileUrl = pathToFileURL(filePath).href;
    const relativeFile = path.relative(commandsPath, filePath);

    try {
      const commandModule = await import(fileUrl);

      if ("data" in commandModule && "execute" in commandModule) {
        commands.set(commandModule.data.name, commandModule);
        if ("autocomplete" in commandModule) {
          autoCompletes.set(commandModule.data.name, commandModule);
        }
      } else {
        console.log(`[WARNING] El comando en ${relativeFile} no exporta 'data' o 'execute'.`);
      }
    } catch (err) {
      console.error(`[ERROR] Falló la carga del comando ${relativeFile}:`, err);
    }
  }
}

export function getCommandDefs() {
  return Array.from(commands.values()).map(cmd => cmd.data.toJSON());
}

export async function handleAutocomplete(interaction) {
  const cmd = interaction.commandName;
  const command = autoCompletes.get(cmd) || commands.get(cmd); // fallback

  if (!command) return;

  try {
    // If the command explicitly defines an autocomplete method, use it
    if (typeof command.autocomplete === "function") {
      await command.autocomplete(interaction);
      return;
    }
  } catch (err) {
    console.error(`[Autocomplete] /${cmd} error general:`, err);
    await interaction.respond([]).catch(() => { });
  }
}

export async function handleCommand(client, interaction) {
  const cmdName = interaction.commandName;
  const command = commands.get(cmdName);

  if (!command) {
    console.error(`No match for command /${cmdName}.`);
    return;
  }

  const bostezo = getBostezo();

  try {
    await logCommand(interaction);
    await command.execute(interaction, bostezo);
  } catch (err) {
    await logError(client, err, `Comando /${cmdName}`);

    // Notify user if interaction is still alive
    const msg = "Ay, se me enredaron los papelitos... inténtalo otra vez, corazón.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => { });
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => { });
    }
  }
}
