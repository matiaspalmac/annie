import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { getBostezo } from "../utils.js";
import { ganarXP, obtenerNivelHabilidad } from "../progreso.js";

// Cooldown de 30 minutos = 1800000 ms
const COOLDOWN_PESCAR = 1800000;

export const data = new SlashCommandBuilder()
    .setName("pescar")
    .setDescription("Lanza tu caña en el río del pueblito a ver qué pica.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'pescar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Ay pescadito... los peces se asustaron y se fueron al fondo. Espera **${faltanMinutos} minutos** para volver a tirar la caña.`);
            }
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_PESCAR;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'pescar', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        // Ganar XP de Pesca (10 a 25 xp por intento)
        const xpGanada = Math.floor(Math.random() * 16) + 10;
        const nivelPesca = await ganarXP(userId, "pesca", xpGanada, interaction);

        // 3. Lógica de drops (mejorada por nivel)
        // Chance base 5%. Cada nivel da +0.5% extra (máximo +25% en Nivel 50)
        const bonoNivel = (nivelPesca - 1) * 0.5;
        const chanceBotella = Math.min(5 + bonoNivel, 30); // Tope de 30%
        const rand = Math.random() * 100;

        if (rand <= chanceBotella) {
            // Botella con mensaje - da 10 a 50 monedas + bono por nivel
            const monedasGanadas = Math.floor(Math.random() * 41) + 10 + (nivelPesca * 2);

            await db.execute({
                sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
              VALUES (?, ?, 0, 1) 
              ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
                args: [userId, monedasGanadas]
            });

            return interaction.followUp(`🎣 *Sientes un tirón extraño en la caña...* \n\n¡Atrapaste una **📜 Botella con mensaje**!\nAdentro del vidrio había **${monedasGanadas} moneditas**. ¡Qué suerte! *(Nv. Pesca: ${nivelPesca})*`);
        } else {
            // Pescado normal
            const itemId = "Pescado";
            const emoji = "🐟";

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
              VALUES (?, ?, 1) 
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, itemId]
            });

            return interaction.followUp(`🎣 *Splash...* \n\n¡Ha picado algo! Has pescado **1x ${emoji} ${itemId}**. ¡Directo a la canasta! *(Nv. Pesca: ${nivelPesca})*`);
        }

    } catch (error) {
        console.error("Error en comando /pescar:", error);
        return interaction.followUp(`${bostezo}Pucha, se me enredó el hilo de la caña. Intentemos de nuevo después.`);
    }
}
