import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { getBostezo, crearEmbed } from "../utils.js";
import { CONFIG } from "../config.js";

// Regex simple para validar URLs de imagen razonables
const IMAGE_URL_REGEX = /^https?:\/\/.*\.(jpeg|jpg|png|gif|webp)$/i;

export const data = new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Personaliza el fondo de cabecera de tu perfil en la Wiki Web.")
    .addStringOption(option =>
        option.setName("url")
            .setDescription("Enlace directo a una imagen (jpg, png, gif) o escribe 'default' para quitar el banner.")
            .setRequired(true)
    );

export async function execute(interaction, bostezo) {
    const inputUrl = interaction.options.getString("url").trim();
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
        // Verificar si el usuario ya existe en la base de datos (y tiene perfil)
        const checkUser = await db.execute({
            sql: "SELECT id FROM usuarios WHERE id = ?",
            args: [userId]
        });

        if (checkUser.rows.length === 0) {
            return interaction.followUp(`${bostezo}Todavía no tienes una libretita de vecino habilitada. Empieza a hablar en el chat para obtener algo de XP primero.`);
        }

        // Caso: Restablecer al diseño original del tema
        if (inputUrl.toLowerCase() === "default") {
            await db.execute({
                sql: "UPDATE usuarios SET banner_url = NULL WHERE id = ?",
                args: [userId]
            });

            return interaction.followUp(`✅ ¡Hecho! El banner de tu perfil web volverá a ser el gradiente mágico original de tu tema actual.`);
        }

        // Caso: Asignar nueva URL (Validación)
        if (!IMAGE_URL_REGEX.test(inputUrl) && !inputUrl.includes("imgur.com") && !inputUrl.includes("discordapp.net")) {
            return interaction.followUp(`${bostezo}La dirección que me diste no parece ser una imagen válida. ¡Asegúrate de que termine en .png, .jpg, .gif o .webp!`);
        }

        // Límite de seguridad
        if (inputUrl.length > 500) {
            return interaction.followUp(`${bostezo}¡Uy! Ese enlace es demasiado largo, busca uno más cortito por favor.`);
        }

        // Actualizar base de datos
        await db.execute({
            sql: "UPDATE usuarios SET banner_url = ? WHERE id = ?",
            args: [inputUrl, userId]
        });

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle(`🖼️ Nueva Obra de Arte Colgada`)
            .setDescription(`Se ha actualizado el encabezado de tu perfil web exitosamente. ¡Se verá genial!\n\n**Haz clic [AQUÍ](${CONFIG.WIKI_URL}perfil/${userId}) para ver cómo luce en la Wiki.**`)
            .setImage(inputUrl);

        return interaction.followUp({ content: `✅ Banner actualizado.`, embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /banner:", error);
        return interaction.followUp(`${bostezo}Ups... se me cayó el cuadrito intentando colgarlo. Vuelve a intentarlo.`);
    }
}
