import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
    .setName("codigos")
    .setDescription("Muestra los códigos de recompensa activos");

export async function execute(interaction, bostezo) {
    await interaction.deferReply();

    const result = await db.execute("SELECT * FROM codigos WHERE status = 'active' ORDER BY id ASC");

    const embed = crearEmbed(CONFIG.COLORES.MAGENTA)
        .setTitle("🎟️ Cartitas con Regalos — Códigos Activos")
        .setThumbnail(CONFIG.ANNIE_IMG_BIG || CONFIG.ANNIE_IMG)
        .setDescription(
            `${bostezo}¡Wena, corazones! Les traigo los códigos que siguen funcionando hoy en HearTopia.\n\n` +
            `¡Anoten en sus libretitas y reclámenlos rapidito antes que venzan!`
        );

    if (result.rows.length === 0) {
        embed.addFields({
            name: "😢 ¡Pucha, vecinitos!",
            value: "No tengo códigos nuevitos para repartir ahora mismo. ¡Ojalá lleguen pronto cartitas con regalos!",
        });
        return interaction.editReply({ embeds: [embed] });
    }

    result.rows.forEach(row => {
        const info = {
            rewards: JSON.parse(row.rewards || "[]"),
            expirationDate: row.expirationDate,
        };

        const expiraTexto = info.expirationDate ? `⏳ Vence: **${info.expirationDate}**` : "⏳ Sin fecha de vencimiento conocida";
        const recompensas = info.rewards.length > 0
            ? info.rewards.map(r => `• ${r}`).join("\n")
            : "Sin recompensas registradas";

        embed.addFields({
            name: `🗝️ \`${row.id}\``,
            value: `**🎁 Recompensas:**\n${recompensas}\n${expiraTexto}`,
            inline: false,
        });
    });

    embed.addFields({
        name: "📲 ¿Cómo canjear?",
        value: "Ve a **Configuración › Código de Regalo** en la app de Discord.",
        inline: false
    });

    return interaction.editReply({ embeds: [embed] });
}
