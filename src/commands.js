import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { logError, logCommand } from "./logger.js";
import { getBostezo } from "./utils.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Fix pathing on Windows (remove leading slash)
const commandsPath = path.join(__dirname.replace(/^\/([A-Z]:)/, "$1"), "commands");

export const commands = new Map();
export const autoCompletes = new Map();

// Helper to load all commands dynamically
export async function loadCommands() {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = `file:///${path.join(commandsPath, file).replace(/\\/g, "/")}`;

    try {
      const commandModule = await import(filePath);

      if ("data" in commandModule && "execute" in commandModule) {
        commands.set(commandModule.data.name, commandModule);
        if ("autocomplete" in commandModule) {
          autoCompletes.set(commandModule.data.name, commandModule);
        }
      } else {
        console.log(`[WARNING] El comando en ${file} no exporta 'data' o 'execute'.`);
      }
    } catch (err) {
      console.error(`[ERROR] Falló la carga del comando ${file}:`, err);
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
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => { });
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => { });
    }
  }
}
