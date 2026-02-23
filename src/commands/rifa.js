import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { crearEmbed, getFechaChile } from "../utils.js";
import { CONFIG } from "../config.js";

// El costo fijo de cada boleto de rifa
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
    const hoyStr = getFechaChile(); // YYYY-MM-DD en horario Chile

    await interaction.deferReply();

    try {
        if (subcomando === "ver") {
            // Contar boletos totales de hoy
            const countRes = await db.execute({
                sql: "SELECT COUNT(*) as total FROM rifa_boletos WHERE fecha = ?",
                args: [hoyStr]
            });

            const totalBoletos = Number(countRes.rows[0]?.total || 0);
            const pozoMonedas = totalBoletos * COSTO_BOLETO;

            // Ver cuántos tiene este usuario
            const misBoletosRes = await db.execute({
                sql: "SELECT COUNT(*) as mis FROM rifa_boletos WHERE fecha = ? AND user_id = ?",
                args: [hoyStr, interaction.user.id]
            });
            const misBoletos = Number(misBoletosRes.rows[0]?.mis || 0);

            const embed = crearEmbed(CONFIG.COLORES.DORADO)
                .setTitle("🎟️ La Rifa Diaria de Annie")
                .setDescription("*A ver, a ver... veamos cómo va la cajita de los boletos...*")
                .addFields(
                    { name: "💰 Pozo Acumulado", value: `**${pozoMonedas}** Moneditas`, inline: true },
                    { name: "🎫 Boletos Vendidos", value: `${totalBoletos}`, inline: true },
                    { name: "Tu Participación", value: `Tienes **${misBoletos}** boleto(s).`, inline: false }
                )
                .setFooter({ text: "La rifa se sortea hoy a las 23:59. ¡Suerte!" });

            return interaction.followUp({ embeds: [embed] });

        } else if (subcomando === "comprar") {
            // Chequear si el usuario tiene moneditas suficientes
            const userRes = await db.execute({
                sql: "SELECT monedas FROM usuarios WHERE id = ?",
                args: [interaction.user.id]
            });

            if (userRes.rows.length === 0) {
                return interaction.followUp(`${bostezo}Ay corazón, todavía no te tengo anotado en mi libretita de vecinos. ¡Habla un poquito más por el chat general primero!`);
            }

            const monedasCurrent = Number(userRes.rows[0].monedas);
            if (monedasCurrent < COSTO_BOLETO) {
                return interaction.followUp(`${bostezo}Pucha mi tesoro... un boleto cuesta **${COSTO_BOLETO} moneditas**, pero a ti te faltan **${COSTO_BOLETO - monedasCurrent}**. ¡Prueba charlando más en el pueblito para juntar plata!`);
            }

            // Descontar monedas e insertar boleto
            await db.execute({
                sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
                args: [COSTO_BOLETO, interaction.user.id]
            });

            await db.execute({
                sql: "INSERT INTO rifa_boletos (user_id, fecha) VALUES (?, ?)",
                args: [interaction.user.id, hoyStr]
            });

            return interaction.followUp(`🎟️ ¡Listo! Te acabo de anotar en la libretita de la rifa, <@${interaction.user.id}>. Te desconté **${COSTO_BOLETO} moneditas**. \n\n¡Ojalá tengas mucha suerte esta noche a las 23:59! 🌸`);
        }
    } catch (error) {
        console.error("Error en comando /rifa:", error);
        return interaction.followUp(`${bostezo}Uy... se me enredaron los boletos y no pude procesar eso. ¿Intentamos de nuevo más ratito?`);
    }
}
