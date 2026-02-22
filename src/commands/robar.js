import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { getBostezo } from "../utils.js";
import { registrarEstadistica } from "../progreso.js";

// Cooldown de 2 horas por objetivo = 7200000 ms
const COOLDOWN_ROBAR = 7200000;
const MULTA_FAIL_EPICO = 5;

export const data = new SlashCommandBuilder()
    .setName("robar")
    .setDescription("Intenta robarle moneditas a un vecino (¡Cuidado, Annie vigila!).")
    .addUserOption(option =>
        option.setName("objetivo")
            .setDescription("El vecino al que intentarás robarle")
            .setRequired(true)
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser("objetivo");
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        if (targetUser.bot) {
            return interaction.followUp(`${bostezo}Ay mi niño... las máquinas no tienen bolsillos, no puedes robarle a un bot.`);
        }

        if (targetUser.id === userId) {
            return interaction.followUp(`*(Annie te mira raro)* ¿Robarte a ti mismo? Eso no tiene mucho sentido, tesoro.`);
        }

        // 1. Revisar cooldown por objetivo
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'robar' AND extra_id = ?",
            args: [userId, targetUser.id]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`*(Annie te susurra)* Shh... no puedes volver a intentar robarle a **${targetUser.username}** tan pronto. Espera **${faltanMinutos} minutos** para que se calme la cosa.`);
            }
        }

        // Verificar que el objetivo tenga al menos algunas monedas para robar
        const targetRes = await db.execute({
            sql: "SELECT monedas FROM usuarios WHERE id = ?",
            args: [targetUser.id]
        });

        if (targetRes.rows.length === 0 || Number(targetRes.rows[0].monedas) <= 0) {
            return interaction.followUp(`Ay pobre... acercaste la mano a los bolsillos de **${targetUser.username}** y solo encontraste pelusas. ¡No tiene monedas!`);
        }

        const monedasTarget = Number(targetRes.rows[0].monedas);

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_ROBAR;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'robar', ?, ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, targetUser.id, nuevoLimite]
        });

        // 3. Lógica de robo
        // 60% éxito: robas 1–3
        // 30% fallo normal: no pasa nada
        // 10% fail épico: lo descubren y lo multan
        const rand = Math.random() * 100;

        if (rand <= 10) {
            // Fail épico (10%)
            await db.execute({
                sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?",
                args: [MULTA_FAIL_EPICO, userId]
            });
            return interaction.followUp(`🚨 **¡FALLO Y MULTA!** \n\n¡Gendarmería te vio intentando meterle la mano en los bolsillos a **${targetUser.username}**! \nAnnie te quitó **${MULTA_FAIL_EPICO} moneditas** de multa por portarte mal. ¡Qué vergüenza!`);
        } else if (rand <= 40) {
            // Fallo normal (30%)
            return interaction.followUp(`👀 **Fallo**\n\nTe acercaste a **${targetUser.username}** pero se dio cuenta y te miró feo. Te fuiste silbando con las manos vacías.`);
        } else {
            // Éxito (60%)
            const montoRobado = Math.min(Math.floor(Math.random() * 3) + 1, monedasTarget); // Roba 1 a 3, max lo que tenga

            // Quitar al target
            await db.execute({
                sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
                args: [montoRobado, targetUser.id]
            });

            // Dar al ladrón
            await db.execute({
                sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
              VALUES (?, ?, 0, 1) 
              ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
                args: [userId, montoRobado]
            });

            if (monedasTarget >= 10000) {
                await registrarEstadistica(userId, "robar_rico", 1, interaction);
            }

            return interaction.followUp(`🥷 **¡Robo Exitoso!** \n\nCon mucha destreza, le sacaste **${montoRobado} moneditas** 💰 a **${targetUser.username}** sin que se diera cuenta. ¡A correr!`);
        }

    } catch (error) {
        console.error("Error en comando /robar:", error);
        return interaction.followUp(`${bostezo}La policía me está mirando fiero, así que mejor dejamos esto pa' otro rato... hubo un errorcillo.`);
    }
}
