import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, getFechaChile } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

const COSTO_BOLETO = 10;

export const data = new SlashCommandBuilder()
    .setName("rifa")
    .setDescription("Participa en la rifa diaria del pueblito.")
    .addSubcommand(subcmd =>
        subcmd.setName("ver")
            .setDescription("Mira de cuánto es el pozo acumulado actual de la rifa.")
    )
    .addSubcommand(subcmd =>
        subcmd.setName("comprar")
            .setDescription(`Compra un boleto para la rifa por ${COSTO_BOLETO} moneditas.`)
    );

export async function execute(interaction, bostezo) {
    const subcomando = interaction.options.getSubcommand();
    const hoyStr = getFechaChile();

    await interaction.deferReply();

    try {
        if (subcomando === "ver") {
            const countRes = await db.execute({
                sql: "SELECT COUNT(*) as total FROM rifa_boletos WHERE fecha = ?",
                args: [hoyStr]
            });

            const totalBoletos = Number(countRes.rows[0]?.total || 0);
            const pozoMonedas = totalBoletos * COSTO_BOLETO;

            const misBoletosRes = await db.execute({
                sql: "SELECT COUNT(*) as mis FROM rifa_boletos WHERE fecha = ? AND user_id = ?",
                args: [hoyStr, interaction.user.id]
            });
            const misBoletos = Number(misBoletosRes.rows[0]?.mis || 0);
            const miChance = totalBoletos > 0 ? ((misBoletos / totalBoletos) * 100).toFixed(1) : "0";

            const embed = crearEmbed(CONFIG.COLORES.DORADO)
                .setTitle("🎟️ La Rifa Diaria de Annie")
                .setDescription(
                    `${bostezo}*A ver, a ver... veamos cómo va la cajita de los boletos...*\n\n` +
                    `¡El sorteo es esta noche a las **23:59**! ¿Ya tienes tu boleto? 🌸`
                )
                .addFields(
                    { name: "💰 Pozo Acumulado", value: `**${pozoMonedas.toLocaleString()} 🪙**`, inline: true },
                    { name: "🎫 Boletos Vendidos", value: `**${totalBoletos}**`, inline: true },
                    {
                        name: "🎯 Tu Participación", value: misBoletos > 0
                            ? `**${misBoletos} boleto(s)** — ${miChance}% de ganar`
                            : `*Aún no tienes boleto. Usa \`/rifa comprar\` para participar!*`,
                        inline: false
                    }
                )
                .setFooter({ text: "La rifa se sortea hoy a las 23:59. ¡Suerte!" });

            return interaction.followUp({ embeds: [embed] });

        } else if (subcomando === "comprar") {
            const userRes = await db.execute({
                sql: "SELECT monedas FROM usuarios WHERE id = ?",
                args: [interaction.user.id]
            });

            if (userRes.rows.length === 0) {
                const embed = crearEmbed(CONFIG.COLORES.ROSA)
                    .setTitle("📋 ¡Aún no estás registrado!")
                    .setDescription(
                        `${bostezo}Ay corazón, todavía no te tengo anotado en mi libretita de vecinos. ` +
                        `¡Habla un poquito más por el chat general primero!`
                    );
                return interaction.followUp({ embeds: [embed] });
            }

            const monedasCurrent = Number(userRes.rows[0].monedas);
            if (monedasCurrent < COSTO_BOLETO) {
                const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                    .setTitle("💸 ¡Sin fondos para el boleto!")
                    .setDescription(`${bostezo}Pucha mi tesoro... necesitas **${COSTO_BOLETO} 🪙** para un boleto.`)
                    .addFields(
                        { name: "💰 Tienes", value: `**${monedasCurrent} 🪙**`, inline: true },
                        { name: "❌ Faltan", value: `**${COSTO_BOLETO - monedasCurrent} 🪙**`, inline: true }
                    );
                return interaction.followUp({ embeds: [embed] });
            }

            await db.execute({
                sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
                args: [COSTO_BOLETO, interaction.user.id]
            });

            await db.execute({
                sql: "INSERT INTO rifa_boletos (user_id, fecha) VALUES (?, ?)",
                args: [interaction.user.id, hoyStr]
            });

            // Contar cuántos boletos tiene ahora
            const boletosRes = await db.execute({
                sql: "SELECT COUNT(*) as mis FROM rifa_boletos WHERE fecha = ? AND user_id = ?",
                args: [hoyStr, interaction.user.id]
            });
            const totalMios = Number(boletosRes.rows[0]?.mis || 1);

            const embed = crearEmbed(CONFIG.COLORES.MAGENTA)
                .setTitle("🎟️ ¡Boleto Comprado!")
                .setDescription(
                    `${bostezo}¡Te acabo de anotar en la libretita de la rifa, <@${interaction.user.id}>!\n\n` +
                    `*Annie firma el boleto con su mejor pluma y te lo entrega con una sonrisa.*`
                )
                .addFields(
                    { name: "🎟️ Tus boletos hoy", value: `**${totalMios}**`, inline: true },
                    { name: "💸 Costo", value: `**${COSTO_BOLETO} 🪙** descontados`, inline: true },
                    { name: "⏰ Sorteo", value: "Esta noche a las **23:59**", inline: true }
                );

            return interaction.followUp({ embeds: [embed] });
        }

    } catch (error) {
        console.error("Error en comando /rifa:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Los boletos se enredaron!")
            .setDescription(`${bostezo}Uy... se me enredaron los boletos y no pude procesar eso. ¿Intentamos de nuevo más ratito?`);
        return interaction.followUp({ embeds: [embed] });
    }
}
