import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";
import { registrarEstadistica, registrarBitacora } from "../../features/progreso.js";

// Cooldown de 2 horas por objetivo = 7200000 ms
const COOLDOWN_ROBAR = 7200000;
const MULTA_FAIL_EPICO = 5;

function getNivelPillo(rep) {
    if (rep >= 60) return "🔥 Pillo Buscado";
    if (rep >= 30) return "⚠️ Pillo Conocido";
    if (rep >= 10) return "😼 Travieso";
    return "🙂 Vecino decente";
}

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

        const resSelf = await db.execute({
            sql: "SELECT reputacion_pillo FROM usuarios WHERE id = ?",
            args: [userId]
        });
        const repActual = Number(resSelf.rows[0]?.reputacion_pillo || 0);
        const extraCooldownRep = Math.min(repActual * 30000, 3600000);

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
            sql: "SELECT monedas, seguro_antirobo_hasta FROM usuarios WHERE id = ?",
            args: [targetUser.id]
        });

        if (targetRes.rows.length === 0 || Number(targetRes.rows[0].monedas) <= 0) {
            return interaction.followUp(`Ay pobre... acercaste la mano a los bolsillos de **${targetUser.username}** y solo encontraste pelusas. ¡No tiene monedas!`);
        }

        const monedasTarget = Number(targetRes.rows[0].monedas);
        const seguroHasta = Number(targetRes.rows[0].seguro_antirobo_hasta || 0);

        if (seguroHasta > ahora) {
            const minsSeguro = Math.ceil((seguroHasta - ahora) / 60000);
            const multaSeguro = 8;

            await db.execute({
                sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?), reputacion_pillo = COALESCE(reputacion_pillo, 0) + 2 WHERE id = ?",
                args: [multaSeguro, userId]
            });

            return interaction.followUp(
                `🛡️ **¡Rebotaste con un Seguro Anti-Robo!**\n\n` +
                `**${targetUser.username}** está protegido por seguro por **${minsSeguro} minutos** más.\n` +
                `Perdiste **${multaSeguro} moneditas** y tu reputación de pillo subió.`
            );
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_ROBAR + extraCooldownRep;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'robar', ?, ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, targetUser.id, nuevoLimite]
        });

        // 3. Lógica de robo
        // Las probabilidades se alteran por reputación pillo
        // más reputación => más chance de fail épico y menos éxito
        const extraFailEpico = Math.min(repActual * 0.15, 20);
        const chanceFailEpico = 10 + extraFailEpico;
        const chanceExito = Math.max(60 - Math.min(repActual * 0.1, 15), 40);
        const rand = Math.random() * 100;

        if (rand <= chanceFailEpico) {
            // Fail épico (10%)
            const multaReal = MULTA_FAIL_EPICO + (repActual >= 60 ? 5 : 0);
            await db.execute({
                sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?), reputacion_pillo = COALESCE(reputacion_pillo, 0) + 4 WHERE id = ?",
                args: [multaReal, userId]
            });
            await registrarBitacora(userId, `¡Fue arrestado por Annie intentando robarle a un vecino!`);
            const repNueva = repActual + 4;
            return interaction.followUp(`🚨 **¡FALLO Y MULTA!** \n\n¡Gendarmería te vio intentando meterle la mano en los bolsillos a **${targetUser.username}**! \nAnnie te quitó **${multaReal} moneditas** de multa por portarte mal.\nTu reputación quedó en **${repNueva}** (${getNivelPillo(repNueva)}).`);
        } else if (rand <= (100 - chanceExito)) {
            // Fallo normal (30%)
            await db.execute({
                sql: "UPDATE usuarios SET reputacion_pillo = COALESCE(reputacion_pillo, 0) + 1 WHERE id = ?",
                args: [userId]
            });
            const repNueva = repActual + 1;
            return interaction.followUp(`👀 **Fallo**\n\nTe acercaste a **${targetUser.username}** pero se dio cuenta y te miró feo. Te fuiste silbando con las manos vacías.\nReputación actual: **${repNueva}** (${getNivelPillo(repNueva)}).`);
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

            await db.execute({
                sql: "UPDATE usuarios SET reputacion_pillo = COALESCE(reputacion_pillo, 0) + 2 WHERE id = ?",
                args: [userId]
            });

            if (monedasTarget >= 10000) {
                await registrarEstadistica(userId, "robar_rico", 1, interaction);
                await registrarBitacora(userId, `Asestó un golpe maestro al robarle a un millonario.`);
            }

            const repNueva = repActual + 2;
            return interaction.followUp(`🥷 **¡Robo Exitoso!** \n\nCon mucha destreza, le sacaste **${montoRobado} moneditas** 💰 a **${targetUser.username}** sin que se diera cuenta.\nReputación pillo: **${repNueva}** (${getNivelPillo(repNueva)}). ¡A correr!`);
        }

    } catch (error) {
        console.error("Error en comando /robar:", error);
        return interaction.followUp(`${bostezo}La policía me está mirando fiero, así que mejor dejamos esto pa' otro rato... hubo un errorcillo.`);
    }
}
