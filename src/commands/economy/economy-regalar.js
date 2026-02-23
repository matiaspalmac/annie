import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed, agregarNarrativa } from "../../core/utils.js";
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
        return interaction.reply({ content: `${bostezo}¡Ay, mi tesoro! No puedes regalarte moneditas a ti mismo... ¡mejor compártelas con alguien más!`, flags: MessageFlags.Ephemeral });
    }

    if (recipiente.bot) {
        return interaction.reply({ content: `${bostezo}Qué amable eres, pero a los robots no nos sirven las moneditas... guarda eso para comprarte cositas lindas.`, flags: MessageFlags.Ephemeral });
    }

    // Checking donor balance
    const resultDonante = await db.execute({
        sql: "SELECT monedas FROM usuarios WHERE id = ?",
        args: [donante_id]
    });

    const balanceDonante = resultDonante.rows.length > 0 ? Number(resultDonante.rows[0].monedas) : 0;

    if (balanceDonante < cantidad) {
        return interaction.reply({
            content: `Pucha ${getTrato()}... solo tienes **${balanceDonante}** moneditas en tu bolsita. No te alcanza para dar ${cantidad}. ¡Sigue paseando para encontrar más!`,
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        // Ejecutar transacción manualmente (SQLite no soporta transacciones nativas en la lib de esta de la misma forma, usamos 2 db.execute asíncronos rápidos)
        // Restar al donante
        await db.execute({
            sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
            args: [cantidad, donante_id]
        });

        // Sumar al recipiente
        await db.execute({
            sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
                  VALUES (?, ?, 0, 1) 
                  ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
            args: [recipiente.id, cantidad]
        });

        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🎁 ¡Un regalito llego!")
            .setDescription(`¡Qué gesto más precioso! <@${donante_id}> le ha regalado con amor **${cantidad} moneditas** a <@${recipiente.id}>.\n\nQué lindo es ver lo generosos que son en nuestro pueblito.`);

        agregarNarrativa(embed, "general");

        await interaction.reply({ content: bostezo, embeds: [embed] });

        // Intentar DM al recipiente
        try {
            await recipiente.send(`*Ding dong~* ¡Hola corazón! Annie por aquí. Te cuento que <@${donante_id}> te ha mandado de regalo **${cantidad} moneditas**. ¡Disfrútalas mucho!`);
        } catch (e) {
            // Usuario tiene los DMs cerrados, no pasa nada
        }

    } catch (e) {
        console.error("Error regalando monedas:", e.message);
        return interaction.reply({ content: `${bostezo}Hubo un problemita guardando las moneditas... ¡Ups! Intentemos después.`, flags: MessageFlags.Ephemeral });
    }
}
