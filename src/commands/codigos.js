import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed, agregarNarrativa, EMOJI_CATEGORIA } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("codigos")
    .setDescription("Muestra los códigos de recompensa activos");

export async function execute(interaction, bostezo) {
    const result = await db.execute("SELECT * FROM codigos WHERE status = 'active' ORDER BY id ASC");

    const embed = new EmbedBuilder()
        .setTitle("🎟️ Cartitas con Regalos (Códigos Activos) 🎟️")
        .setColor(CONFIG.COLORES.ROSA)
        .setDescription("¡Wena, corazones! Les traigo los códigos que siguen funcionando hoy en HearTopia. ¡Anoten en sus libretitas y reclámenlos rapidito!")
        .setThumbnail(CONFIG.ANNIE_IMG_BIG || CONFIG.ANNIE_IMG)
        .setTimestamp()
        .setFooter({
            text: "Reclama los premios en Configuración > Código de Regalo",
        });

    if (result.rows.length === 0) {
        embed.addFields([{
            name: "¡Pucha, vecinitos!",
            value: "No tengo códigos nuevitos para repartir ahora. Ojalá lleguen pronto cartitas con regalos.",
        }]);
        return interaction.reply({ embeds: [embed] });
    }

    result.rows.forEach(row => {
        const code = row.id;
        const info = {
            rewards: JSON.parse(row.rewards || "[]"),
            expirationDate: row.expirationDate,
        };

        const expiraTexto = info.expirationDate ? `Vence: ${info.expirationDate}` : "Sin fecha de vencimiento conocida";
        const recompensas = info.rewards.map(r => `• ${r}`).join("\n");
        embed.addFields([{
            name: `🗝️ Código: \`${code}\``,
            value: `**🎁 Recompensas:**\n${recompensas}\n*⏳ ${expiraTexto}*`,
            inline: false,
        }]);
    });

    agregarNarrativa(embed, "codigos");
    return interaction.reply({ content: bostezo, embeds: [embed] });
}
