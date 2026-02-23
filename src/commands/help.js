import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { estaDurmiendo, crearEmbed } from "../utils.js";
import { getTrato } from "../personality.js";

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
                name: "💰 Economía y Perfil (¡NUEVO!)",
                value:
                    "✨ `/perfil` — Mira tu nivel, experiencia y moneditas acumuladas.\n" +
                    "🛠️ `/accion [actividad]` — Minar, pescar, sacudir árbol o cazar bichos desde un solo comando.\n" +
                    "🛒 `/tienda [pagina]` — Revisa el catálogo por páginas.\n" +
                    "🧾 `/comprar [item]` — Compra directo con sugerencias automáticas.\n" +
                    "🖌️ `/color [hex]` — Aplica tu Pincel Mágico personalizado.",
                inline: false,
            },
            {
                name: "🎰 Casino (¡NUEVO!)",
                value:
                    "🎰 `/casino menu` — Menú principal del casino.\n" +
                    "🎰 `/slots [apuesta]` — Máquina tragamonedas (x2 a x50).\n" +
                    "🎡 `/ruleta [apuesta] [tipo]` — Ruleta europea.\n" +
                    "🪙 `/coinflip [apuesta] [lado]` — Cara o cruz simple.\n" +
                    "🃏 `/blackjack [apuesta]` — 21 contra la casa.\n" +
                    "📊 `/casino stats` — Tus estadísticas.\n" +
                    "🏆 `/casino top` — Top 10 ganadores.\n" +
                    "💵 **Apuestas:** 50 - 50,000 monedas | ⏱️ **Cooldown:** 8s",
                inline: false,
            },
            {
                name: "📖 Enciclopedia del Pueblo",
                value:
                    "📌 *Busca cualquier ítem usando su nombre o escribe `todos` para ver la lista completa.*\n\n" +
                    "```\n/peces       /insectos    /aves\n/animales    /cultivos    /recolectables\n/recetas     /habitantes  /logros\n/codigos```",
                inline: false,
            },
            {
                name: "💖 Comunidad y Utilidad",
                value:
                    "🔗 `/wiki` — Enlace oficial a la Heartopia Wiki.\n" +
                    "🔔 `/recordar` — Pídeme que te avise de algo más tardecito.\n" +
                    "🎭 **Roles:** Reacciona en el canal de roles para obtener insignias.",
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
            text: `Annie v2.0 | ${estaDurmiendo() ? "💤 Zzz... sueñen bonito" : "🌸 Hecho con amor para Heartopia"}`,
            iconURL: interaction.guild?.iconURL() ?? undefined,
        })
        .setTimestamp();

    return interaction.reply({ content: bostezo, embeds: [embed] });
}
