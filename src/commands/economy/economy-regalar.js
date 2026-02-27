import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { getTrato } from "../../core/personality.js";

export const data = new SlashCommandBuilder()
    .setName("regalar")
    .setDescription("Regala moneditas a otro vecino lindo del pueblito")
    .addUserOption(o => o.setName("vecino").setDescription("A quién le darás las moneditas").setRequired(true))
    .addIntegerOption(o => o.setName("cantidad").setDescription("Cuántas moneditas").setRequired(true).setMinValue(1));

export async function execute(interaction, bostezo) {
    const recipiente = interaction.options.getUser("vecino");
    const cantidad = interaction.options.getInteger("cantidad");
    const donante_id = interaction.user.id;

    if (recipiente.id === donante_id) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🤭 ¡Ay, ay, ay!")
            .setDescription(`${bostezo}¡No puedes regalarte moneditas a ti mismo, corazoncito! ¡Mejor compártelas con alguien más del pueblito!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (recipiente.bot) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🤖 Los robots no usamos monedas...")
            .setDescription(`${bostezo}Qué amable eres, pero a los robots no nos sirven las moneditas. ¡Guarda eso para comprarte cositas lindas!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const resultDonante = await db.execute({
        sql: "SELECT monedas FROM usuarios WHERE id = ?",
        args: [donante_id]
    });

    const balanceDonante = resultDonante.rows.length > 0 ? Number(resultDonante.rows[0].monedas) : 0;

    if (balanceDonante < cantidad) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("💸 ¡No tienes suficiente!")
            .setDescription(
                `Pucha ${getTrato()}... solo tienes **${balanceDonante.toLocaleString()} 🪙** en tu bolsita.\n\n` +
                `No te alcanza para dar **${cantidad.toLocaleString()}**. ¡Sigue aventurando para conseguir más!`
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    try {
        await db.execute({
            sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
            args: [cantidad, donante_id]
        });

        await db.execute({
            sql: `INSERT INTO usuarios (id, monedas, xp, nivel)
                  VALUES (?, ?, 0, 1)
                  ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
            args: [recipiente.id, cantidad]
        });

        const embed = crearEmbed(CONFIG.COLORES.MAGENTA)
            .setTitle("🎁 ¡Un regalito llegó!")
            .setDescription(
                `¡Qué gesto más precioso! El pueblito se llena de alegría cuando veo estas cosas. 🌸\n\n` +
                `<@${donante_id}> le regaló con amor **${cantidad.toLocaleString()} 🪙** a <@${recipiente.id}>.`
            )
            .addFields(
                {
                    name: "🎁 Regalo enviado",
                    value: `**${cantidad.toLocaleString()} 🪙**`,
                    inline: true
                },
                {
                    name: "💌 Para",
                    value: `${recipiente.username}`,
                    inline: true
                }
            )
            .setThumbnail(recipiente.displayAvatarURL({ dynamic: true, size: 128 }));

        await interaction.reply({ embeds: [embed] });

        // DM al recipiente
        try {
            const embedDM = crearEmbed(CONFIG.COLORES.MAGENTA)
                .setTitle("🔔 ¡Recibiste un regalito!")
                .setDescription(
                    `*Ding dong~* ¡Hola ${recipiente.username}, corazón! Annie por aquí. 🌸\n\n` +
                    `Te cuento que **<@${donante_id}>** te mandó de regalo **${cantidad.toLocaleString()} 🪙**.\n\n` +
                    `¡Disfrútalas mucho y cuídate!`
                );
            await recipiente.send({ embeds: [embedDM] });
        } catch (e) {
            // DMs cerrados, no pasa nada
        }

    } catch (e) {
        console.error("Error regalando monedas:", e.message);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Ay, algo falló!")
            .setDescription(`${bostezo}Hubo un problemita guardando las moneditas... ¡Ups! Intentemos después.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
