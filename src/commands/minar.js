import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { getBostezo } from "../utils.js";
import { ganarXP, registrarBitacora } from "../progreso.js";

// Cooldown de 1 minuto = 60000 ms
const COOLDOWN_MINAR = 60000;

export const data = new SlashCommandBuilder()
    .setName("minar")
    .setDescription("Golpea las rocas cerca del pueblito para obtener materiales.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'minar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanSegundos = Math.ceil((limite - ahora) / 1000);
                return interaction.followUp(`${bostezo}Ay mi tesoro, tienes los bracitos cansados. Espera **${faltanSegundos} segundos** antes de volver a picar piedritas.`);
            }
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_MINAR;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'minar', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        // Ganar XP de Minería (10 a 20 xp por intento)
        const xpGanada = Math.floor(Math.random() * 11) + 10;
        const nivelMineria = await ganarXP(userId, "mineria", xpGanada, interaction);

        // 3. Lógica de drops
        const bonoNivel = (nivelMineria - 1) * 0.5;
        const rand = Math.random() * 100;
        let itemId = "";
        let emoji = "";
        let rarezaTexto = "";

        const chanceFluorita = Math.min(5 + bonoNivel, 25);
        const chanceMineral = Math.min(30 + (bonoNivel * 1.5), 60);

        if (rand <= chanceFluorita) {
            itemId = "Fluorita impecable";
            emoji = "💎";
            rarezaTexto = "¡Cielo santo! ¡Qué brillo tan hermoso!";
            await registrarBitacora(userId, `Desenterró una codiciada Fluorita impecable.`);
        } else if (rand <= chanceMineral) {
            itemId = "Mineral";
            emoji = "🪨✨"; // Mineral genérico
            rarezaTexto = "¡Conseguiste algo de mineral brillante!";
        } else {
            itemId = "Piedra";
            emoji = "🪨";
            rarezaTexto = "¡Pura piedrecilla sólida y rústica!";
        }

        // 4. Guardar en inventario
        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
            VALUES (?, ?, 1) 
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
            args: [userId, itemId]
        });

        // 5. Mensaje de éxito
        return interaction.followUp(`⛏️ *Clink, clink... clank!* \n\n${rarezaTexto} \nHas obtenido **1x ${emoji} ${itemId}**. ¡Guárdalo bien en tus bolsillitos! *(Nv. Minería: ${nivelMineria})*`);

    } catch (error) {
        console.error("Error en comando /minar:", error);
        return interaction.followUp(`${bostezo}Uy... la pala se me resbaló y no pude picar nada. ¡Inténtalo de nuevo más ratito!`);
    }
}
