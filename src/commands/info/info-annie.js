import { SlashCommandBuilder } from "discord.js";
import { execute as cmdHelpExecute } from "./info-help.js";

// Alias de /help
export const data = new SlashCommandBuilder()
    .setName("annie")
    .setDescription("Alias de /help para ver la cartita de comandos");

export async function execute(interaction, bostezo) {
    return await cmdHelpExecute(interaction, bostezo);
}
