import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedCooldown } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { registrarEstadistica, registrarBitacora } from "../../features/progreso.js";

const COOLDOWN_ROBAR = 7200000; // 2 horas por objetivo
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
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("🤖 ¡Los robots no tienen bolsillos!")
                .setDescription(`${bostezo}Ay mi niño... las máquinas no tienen bolsillos llenos de monedas. ¡Elige a otro vecino!`);
            return interaction.editReply({ embeds: [embed] });
        }

        if (targetUser.id === userId) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("🤨 ¿Robarte a ti mismo?")
                .setDescription(`*(Annie te mira raro)* ¿Robarte a ti mismo? Eso no tiene mucho sentido, tesoro...`);
            return interaction.editReply({ embeds: [embed] });
        }

        const resSelf = await db.execute({
            sql: "SELECT reputacion_pillo FROM usuarios WHERE id = ?",
            args: [userId]
        });
        const repActual = Number(resSelf.rows[0]?.reputacion_pillo || 0);
        const extraCooldownRep = Math.min(repActual * 30000, 3600000);

        // Revisar cooldown por objetivo
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'robar' AND extra_id = ?",
            args: [userId, targetUser.id]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                const embed = crearEmbedCooldown(faltanMinutos, bostezo.trim(), "robar")
                    .setDescription(
                        `*${bostezo.trim()}*\n\n` +
                        `🤫 Shh... no puedes volver a intentar robarle a **${targetUser.username}** tan pronto.\n` +
                        `⌛ Espera **${faltanMinutos} minutos** para que se calme la cosa.`
                    );
                return interaction.editReply({ embeds: [embed] });
            }
        }

        // Verificar monedas del objetivo
        const targetRes = await db.execute({
            sql: "SELECT monedas, seguro_antirobo_hasta FROM usuarios WHERE id = ?",
            args: [targetUser.id]
        });

        if (targetRes.rows.length === 0 || Number(targetRes.rows[0].monedas) <= 0) {
            const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle("🫙 ¡Bolsillos vacíos!")
                .setDescription(
                    `Ay pobre... metiste la mano en los bolsillos de **${targetUser.username}** y solo encontraste...\n\n` +
                    `**Pelusa. Solo pelusa.** ¡No tiene monedas que llevarte!`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const monedasTarget = Number(targetRes.rows[0].monedas);
        const seguroHasta = Number(targetRes.rows[0].seguro_antirobo_hasta || 0);

        // Seguro anti-robo
        if (seguroHasta > ahora) {
            const minsSeguro = Math.ceil((seguroHasta - ahora) / 60000);
            const multaSeguro = 8;

            await db.execute({
                sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?), reputacion_pillo = COALESCE(reputacion_pillo, 0) + 2 WHERE id = ?",
                args: [multaSeguro, userId]
            });

            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("🛡️ ¡Rebotaste con un Seguro Anti-Robo!")
                .setDescription(
                    `**${targetUser.username}** está protegido por un seguro activo. ¡El sistema te detectó y te sancionó!\n\n` +
                    `🛡️ La protección dura **${minsSeguro} minutos** más.`
                )
                .addFields(
                    { name: "💸 Multa recibida", value: `**-${multaSeguro} 🪙**`, inline: true },
                    { name: "😈 Rep. pillo", value: `**${repActual + 2}** *(${getNivelPillo(repActual + 2)})*`, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // Establecer cooldown
        const nuevoLimite = ahora + COOLDOWN_ROBAR + extraCooldownRep;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite)
            VALUES (?, 'robar', ?, ?)
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, targetUser.id, nuevoLimite]
        });

        // Lógica de robo
        const extraFailEpico = Math.min(repActual * 0.15, 20);
        const chanceFailEpico = 10 + extraFailEpico;
        const chanceExito = Math.max(60 - Math.min(repActual * 0.1, 15), 40);
        const rand = Math.random() * 100;

        // FALLO ÉPICO — arrestado
        if (rand <= chanceFailEpico) {
            const multaReal = MULTA_FAIL_EPICO + (repActual >= 60 ? 5 : 0);
            await db.execute({
                sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?), reputacion_pillo = COALESCE(reputacion_pillo, 0) + 4 WHERE id = ?",
                args: [multaReal, userId]
            });
            await registrarBitacora(userId, `¡Fue arrestado por Annie intentando robarle a un vecino!`);
            const repNueva = repActual + 4;

            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("🚨 ¡MULTADO! ¡ANNIE TE VIO!")
                .setDescription(
                    `¡Gendarmería te vio metiéndole la mano en los bolsillos a **${targetUser.username}**!\n\n` +
                    `*Annie anotó tu nombre en el libro negro del pueblito. 📖*`
                )
                .addFields(
                    { name: "💸 Multa pagada", value: `**-${multaReal} 🪙**`, inline: true },
                    { name: "😈 Rep. de pillo", value: `**${repNueva}** *(${getNivelPillo(repNueva)})*`, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // FALLO NORMAL — te pillaron
        if (rand <= (100 - chanceExito)) {
            await db.execute({
                sql: "UPDATE usuarios SET reputacion_pillo = COALESCE(reputacion_pillo, 0) + 1 WHERE id = ?",
                args: [userId]
            });
            const repNueva = repActual + 1;

            const mensajesFallo = [
                `Te acercaste a **${targetUser.username}** pero se dio cuenta y te miró feo. Te fuiste silbando con las manos vacías.`,
                `¡Casi! Pero **${targetUser.username}** movió su bolsillo justo a tiempo.`,
                `Intentaste hacerte el despistado cerca de **${targetUser.username}**, pero te cachó al tiro.`,
                `**${targetUser.username}** te pescó con la mano en la masa. Te hiciste el tonto y saliste corriendo.`,
            ];
            const mensajeFallo = mensajesFallo[Math.floor(Math.random() * mensajesFallo.length)];

            const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle("👀 ¡Te pillaron!")
                .setDescription(mensajeFallo)
                .addFields(
                    { name: "😈 Rep. de pillo", value: `**${repNueva}** *(${getNivelPillo(repNueva)})*`, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // ÉXITO
        let montoBase = Math.floor(Math.random() * 20) + 5;
        const bonusRep = Math.floor(repActual * 0.3);
        const esGolpeMaestro = Math.random() < 0.15;
        const bonusMaestro = esGolpeMaestro ? Math.floor(Math.random() * 30) + 20 : 0;
        const montoRobado = Math.min(Math.max(montoBase + bonusRep + bonusMaestro, 5), Math.min(monedasTarget, 100));

        await db.execute({ sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?", args: [montoRobado, targetUser.id] });
        await db.execute({
            sql: `INSERT INTO usuarios (id, monedas, xp, nivel)
              VALUES (?, ?, 0, 1)
              ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
            args: [userId, montoRobado]
        });
        await db.execute({ sql: "UPDATE usuarios SET reputacion_pillo = COALESCE(reputacion_pillo, 0) + 2 WHERE id = ?", args: [userId] });

        if (monedasTarget >= 10000) {
            await registrarEstadistica(userId, "robar_rico", 1, interaction);
            await registrarBitacora(userId, `Asestó un golpe maestro al robarle a un millonario.`);
        }

        const repNueva = repActual + 2;

        const mensajesExito = [
            `Con mucha destreza, le sacaste moneditas a **${targetUser.username}** sin que se diera cuenta.`,
            `¡Zas! Manos rápidas. **${targetUser.username}** aún no sabe lo que pasó.`,
            `Como ninja en la noche, le quitaste moneditas a **${targetUser.username}** sin hacer ruido.`,
            `Trabajo limpio y profesional. **${targetUser.username}** ni sintió nada.`,
        ];

        const mensajesMaestro = [
            `¡¡GOLPE MAESTRO!! Esto fue digno de las leyendas del hampa del pueblito.`,
            `🔥 ¡ROBO PERFECTO! Con técnica impecable. ¡Obra maestra de pillo!`,
            `✨ ¡ATRACO LEGENDARIO! Nadie vio nada. ¡Increíble destreza!`,
        ];

        const descripcion = esGolpeMaestro
            ? mensajesMaestro[Math.floor(Math.random() * mensajesMaestro.length)]
            : mensajesExito[Math.floor(Math.random() * mensajesExito.length)];

        const colorExito = esGolpeMaestro ? CONFIG.COLORES.DORADO : CONFIG.COLORES.VERDE;

        const embed = crearEmbed(colorExito)
            .setTitle(esGolpeMaestro ? "🏆 ¡GOLPE MAESTRO!" : "🥷 ¡Robo Exitoso!")
            .setDescription(descripcion)
            .addFields(
                { name: "💰 Robado", value: `**+${montoRobado} 🪙**`, inline: true },
                { name: "🎯 Víctima", value: `**${targetUser.username}**`, inline: true },
                { name: "😈 Rep. de pillo", value: `**${repNueva}** *(${getNivelPillo(repNueva)})*`, inline: true }
            );

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /robar:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Algo salió mal!")
            .setDescription(`${bostezo}La policía me está mirando fiero, así que mejor dejamos esto pa' otro rato... hubo un errorcillo.`);
        return interaction.editReply({ embeds: [embed] });
    }
}
