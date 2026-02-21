import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { getGameId } from "../db.js";

export const data = new SlashCommandBuilder()
    .setName("id")
    .setDescription("Muestra el Game ID vinculado de un usuario")
    .addUserOption(o => o.setName("usuario").setDescription("El usuario a consultar").setRequired(true));

export async function execute(interaction, bostezo) {
    const usuario = interaction.options.getUser("usuario");

    try {
        const gameId = await getGameId(usuario.id);

        if (!gameId) {
            return interaction.reply({ content: `Ay no... no tengo ningún Game ID anotado para ${usuario} en mi libretita.`, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
            content: `El game ID de ${usuario} es **${gameId}**.`,
            flags: MessageFlags.Ephemeral
        });
    } catch (err) {
        throw err;
    }
}
