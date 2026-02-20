import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { estaDurmiendo, crearEmbed } from "../utils.js";
import { getTrato } from "../personality.js";
import { execute as cmdHelpExecute } from "./help.js";

// Alias de /help
export const data = new SlashCommandBuilder()
    .setName("annie")
    .setDescription("Conoce a Annie, la carterita del pueblito");

export async function execute(interaction, bostezo) {
    return await cmdHelpExecute(interaction, bostezo);
}
