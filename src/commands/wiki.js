import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { crearEmbed, agregarNarrativa } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("wiki")
    .setDescription("Enlace directo a la wiki de Heartopia");

export async function execute(interaction, bostezo) {
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
        .setTitle("📖 Wiki de Heartopia ❤️")
        .setDescription(`Aquí tienes el enlace a la wiki completa del pueblito, corazón.\n\n**${CONFIG.WIKI_URL}**\n\nToda la información está ahí, organizada con cariño por Annie y los vecinos.`);

    agregarNarrativa(embed, "general");
    return interaction.reply({ content: bostezo, embeds: [embed] });
}
