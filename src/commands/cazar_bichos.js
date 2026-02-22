import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { getBostezo } from "../utils.js";
import { ganarXP, registrarEstadistica } from "../progreso.js";

// Cooldown de 45 minutos = 2700000 ms
const COOLDOWN_BICHOS = 2700000;

export const data = new SlashCommandBuilder()
    .setName("cazar_bichos")
    .setDescription("Toma tu red y busca bichitos entre los arbustos del pueblito.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'cazar_bichos' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Shhh... los bichitos tienen buen oído, si haces mucho ruido no saldrán. Relájate **${faltanMinutos} minutos** antes de volver a mover los matorrales.`);
            }
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_BICHOS;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'cazar_bichos', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        // Ganar XP de Caza (15 a 30 xp por intento)
        const xpGanada = Math.floor(Math.random() * 16) + 15;
        const nivelCaza = await ganarXP(userId, "caza", xpGanada, interaction);

        // 3. Lógica de drops
        const bonoNivel = (nivelCaza - 1) * 0.4;
        const rand = Math.random() * 100;
        let itemId = "";
        let emoji = "";
        let mensajeObtencion = "";

        // Tarántula (Mortal) - 5% + bonoNivel
        const chanceTarantula = Math.min(5 + bonoNivel, 20);
        // Mariposa Morfo (Rara) - 20% + bonoNivel
        const chanceMariposa = Math.min(25 + (bonoNivel * 1.5), 50);

        if (rand <= chanceTarantula) {
            itemId = "Tarántula";
            emoji = "🕷️";
            mensajeObtencion = `¡Ay mamita! ¡Un monstruo peludo saltó a tu red! Te dio un susto tremendo, pero... eh, ¡atrapaste una **🕷️ Tarántula**! *(Nv. Caza: ${nivelCaza})*`;
        } else if (rand <= chanceMariposa) {
            itemId = "Mariposa Emperador";
            emoji = "🦋";
            mensajeObtencion = `¡Qué belleza! Una vibrante **🦋 Mariposa Emperador** se posó solita en tu red. *(Nv. Caza: ${nivelCaza})*`;
        } else if (rand <= 65) {
            itemId = "Mantis Religiosa";
            emoji = "🦗";
            mensajeObtencion = `Zaz, un manotazo rápido y ¡listo! Tienes una **🦗 Mantis Religiosa**. *(Nv. Caza: ${nivelCaza})*`;
        } else {
            // Fallo
            await registrarEstadistica(userId, "bichos_fallados", 1, interaction);
            return interaction.followUp(`🍃 *Swish, swish...* \n\n¡Ups! Viste algo moverse, pero cuando bajaste la red solo atrapaste aire y hojas secas. ¡Mejor suerte a la próxima! *(Nv. Caza: ${nivelCaza})*`);
        }

        // 4. Guardar en inventario de economía si atrapó algo
        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
            VALUES (?, ?, 1) 
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
            args: [userId, itemId]
        });

        // 5. Mensaje de éxito
        return interaction.followUp(`🐛 *Empiezas a buscar entre las plantitas...* \n\n${mensajeObtencion}`);

    } catch (error) {
        console.error("Error en comando /cazar_bichos:", error);
        return interaction.followUp(`${bostezo}La red tiene un agujerito, mi amor. Vamos a tener que tejerla de nuevo y probar después.`);
    }
}
