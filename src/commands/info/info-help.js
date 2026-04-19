import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { estaDurmiendo, crearEmbed } from "../../core/utils.js";
import { getTrato } from "../../core/personality.js";

export const data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Muestra la cartita de ayuda y todos los comandos de Annie");

export async function execute(interaction, bostezo) {
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
        .setThumbnail(CONFIG.ANNIE_IMG_BIG || CONFIG.ANNIE_IMG)
        .setTitle("🌸 Libretita de la Oficinita de Annie 🌸")
        .setDescription(
            estaDurmiendo()
                ? "*(Bosteza suave y se frota los ojitos)*\nZzz... Hola corazoncito, soy Annie. Aunque esté medio dormidita, aquí tienes mi libretita mágica con mucho cariño."
                : `¡Wena, ${getTrato()}!\nSoy **Annie**, la carterita del pueblito. Entre repartos y vueltas, aquí te dejo mis cositas para ayudarte en tu aventura.`
        )
        .addFields(
            {
                name: "💰 Economía y Progreso",
                value:
                    "🛒 `/tienda`, `/comprar`, `/vender` — Tiendita y compras del pueblito.\n" +
                    "🎁 `/diario`, `/regalar`, `/robar`, `/rifa`, `/aportar` — Movimiento de moneditas.\n" +
                    "🧰 `/minar`, `/talar`, `/pescar`, `/capturar` — Farmeo y recursos.\n" +
                    "🎒 `/mochila`, `/equipar` — Inventario y herramientas activas.\n" +
                    "✨ `/abrirsobre`, `/destacar`, `/perfil` — Colecciones, vitrina y progreso.",
                inline: false,
            },
            {
                name: "🎰 Juegos y Casino",
                value:
                    "🎰 `/casino` — Menú, stats y top del casino.\n" +
                    "🪙 `/coinflip`, `/ruleta`, `/slots`, `/blackjack` — Minijuegos de apuesta.\n" +
                    "📊 `/casino stats` — Tus estadísticas.\n" +
                    "🏆 `/casino top` — Top 10 ganadores.\n" +
                    "💵 **Apuestas:** 50 - 50,000 monedas | ⏱️ **Cooldown:** 8s",
                inline: false,
            },
            {
                name: "📖 Enciclopedia e Info",
                value:
                    "📌 *Busca cualquier ítem usando su nombre o escribe `todos` para ver la lista completa.*\n\n" +
                    "```\n/peces       /insectos    /aves\n/animales    /cultivos    /recolectables\n/recetas     /habitantes  /logros\n/codigos```",
                inline: false,
            },
            {
                name: "🧩 Perfil y Comunidad",
                value:
                    "🎨 `/tema`, `/banner`, `/color`, `/mascota`, `/renombrar`, `/titulos` — Personaliza tu perfil.\n" +
                    "🌦️ `/clima`, `/wiki`, `/id`, `/annie` — Utilidades e info rápida.\n" +
                    "🎭 **Roles:** Reacciona en el canal de roles para obtener insignias.",
                inline: false,
            },
            {
                name: "🛡️ Comandos Staff",
                value:
                    "**Admin:** `/evento`, `/roles`, `/linkid`, `/resetear`\n" +
                    "**Moderación:** `/lock`, `/unlock`\n" +
                    "**Owner:** `/dar`, `/quitar`",
                inline: false,
            },
            {
                name: "⏰ Horarios de Annie",
                value:
                    "💤 **Sueño:** 23:00 - 08:00 (Chile)\n",
                inline: false,
            }
        )
        .setFooter({
            text: `${CONFIG.APP_LABEL} | ${estaDurmiendo() ? "💤 Zzz... sueñen bonito" : "🌸 Hecho con amor para la Aldea Luciérnaga"}`,
            iconURL: interaction.guild?.iconURL() ?? undefined,
        })
        .setTimestamp();

    return interaction.reply({ content: bostezo, embeds: [embed] });
}
