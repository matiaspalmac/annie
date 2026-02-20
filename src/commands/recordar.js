import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { estaDurmiendo, crearEmbed, getHoraChile } from "../utils.js";
import { getTrato } from "../personality.js";

export const data = new SlashCommandBuilder()
    .setName("recordar")
    .setDescription("Annie te recuerda algo en unos minutitos")
    .addIntegerOption(o => o.setName("minutos").setDescription("En cuántos minutos te recuerdo").setRequired(true))
    .addStringOption(o => o.setName("mensaje").setDescription("Qué necesitas recordar").setRequired(true));

export async function execute(interaction, bostezo) {
    const min = interaction.options.getInteger("minutos");
    const mensaje = interaction.options.getString("mensaje");
    const color = estaDurmiendo() ? CONFIG.COLORES.AZUL : CONFIG.COLORES.ROSA;

    const embed = crearEmbed(color)
        .setTitle(estaDurmiendo() ? "💤 Notita anotada... Zzz" : "📝 ¡Recadito guardado con cariño!")
        .setDescription(
            estaDurmiendo()
                ? "*(Annie escribe suave con ojitos cerrados)* Zzz... ya está en mi libretita, no me despiertes mucho, ¿ya?"
                : `¡Listo, ${getTrato()}! Te guardo tu recadito y te doy el alcance en **${min}** minutitos. No se te olvide, corazón.`
        )
        .addFields({ name: "📨 Tu mensajito guardado", value: `**${mensaje}**` });

    await interaction.reply({ embeds: [embed], ephemeral: true });

    setTimeout(() => {
        const embedRecordatorio = crearEmbed(color)
            .setTitle(estaDurmiendo() ? "💤 Shhh... ¡recadito nocturno!" : "⏰ ¡Oiga, corazoncito! Hora de recordar")
            .setDescription(
                estaDurmiendo()
                    ? `*(Annie se despierta suave y busca su libretita)* ¡Uy! Casi se me olvida... pero aquí está, ${interaction.user}:`
                    : `¡Despierta po, ${getTrato()}! Aquí te traigo tu recadito dulce con mucho cariño.`
            )
            .addFields({ name: "📌 Lo que tenías que recordar", value: `**${mensaje}**` });

        interaction.channel.send({ content: `${interaction.user}`, embeds: [embedRecordatorio] }).catch(console.error);
    }, min * 60000);
}
