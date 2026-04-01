import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedCooldown } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { registrarBitacora } from "../../features/progreso.js";
import { progresarMision } from "../../features/misiones.js";
import { calcularNivelMascota, xpParaNivel, PET_BONUSES, MAX_NIVEL } from "../../features/mascota-bonus.js";

const COOLDOWN_MIMAR = 60 * 60 * 1000; // 1 hora

export const data = new SlashCommandBuilder()
    .setName("mimar")
    .setDescription("Dale amor a tu mascota activa y aumenta su felicidad. ¡Te dará buffs si está muy contenta!");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // Obtener mascota activa del usuario
        const resMascota = await db.execute({
            sql: "SELECT mascota_id FROM usuarios WHERE id = ?",
            args: [userId]
        });

        if (resMascota.rows.length === 0 || !resMascota.rows[0].mascota_id) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("🐾 Ay, no tienes mascota activa...")
                .setDescription(
                    `${bostezo}¡Todavía no tienes ninguna mascota activa, corazoncito!\n\n` +
                    `🛒 Compra una en la **\`/tienda\`** y actívala con **\`/equipar\`** para poder mimarla.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const mascotaId = String(resMascota.rows[0].mascota_id);
        const nombreMascota = mascotaId.replace("mascota_", "").replace(/_/g, " ");
        const nombreCapital = nombreMascota.charAt(0).toUpperCase() + nombreMascota.slice(1);

        // Revisar cooldown de mimar
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'mimar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMin = Math.ceil((limite - ahora) / 60000);
                const embed = crearEmbedCooldown(faltanMin, bostezo.trim(), "mimar")
                    .setDescription(
                        `*${bostezo.trim()}*\n\n` +
                        `🐾 **${nombreCapital}** ya está super contenta ahoritita.\n` +
                        `⌛ Vuelve a mimarla en **${faltanMin} minutos**... ¡te esperará con la colita moviéndose!`
                    );
                return interaction.editReply({ embeds: [embed] });
            }
        }

        // Establecer nuevo cooldown
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) VALUES (?, 'mimar', 'global', ?)
                  ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, ahora + COOLDOWN_MIMAR]
        });

        // Crear o actualizar estado de mascota (incluye xp de mascota)
        const xpGanada = Math.floor(Math.random() * 6) + 3; // 3-8 XP

        await db.execute({
            sql: `INSERT INTO mascotas_estado (user_id, mascota_id, felicidad, hambre, ultima_interaccion, nivel, xp)
                  VALUES (?, ?, 80, 50, ?, 1, ?)
                  ON CONFLICT(user_id) DO UPDATE SET
                    felicidad = MIN(100, felicidad + 20),
                    ultima_interaccion = ?,
                    xp = xp + ?`,
            args: [userId, mascotaId, ahora, xpGanada, ahora, xpGanada]
        });

        // Leer estado actualizado
        const resEstado = await db.execute({
            sql: "SELECT felicidad, hambre, nivel, xp FROM mascotas_estado WHERE user_id = ?",
            args: [userId]
        });

        const felicidad = Number(resEstado.rows[0]?.felicidad ?? 80);
        const hambre = Number(resEstado.rows[0]?.hambre ?? 50);
        const xpTotal = Number(resEstado.rows[0]?.xp ?? 0);
        const nivelAnterior = Number(resEstado.rows[0]?.nivel ?? 1);
        const nivelNuevo = calcularNivelMascota(xpTotal);
        const subioNivel = nivelNuevo > nivelAnterior;

        // Actualizar nivel si cambio
        if (nivelNuevo !== nivelAnterior) {
            await db.execute({
                sql: "UPDATE mascotas_estado SET nivel = ? WHERE user_id = ?",
                args: [nivelNuevo, userId]
            });
        }

        const tieneBuff = felicidad >= 60 && hambre <= 50;
        const bonusInfo = PET_BONUSES[mascotaId];
        const xpSiguienteNivel = xpParaNivel(nivelNuevo + 1);
        const xpNivelActual = xpParaNivel(nivelNuevo);
        const progresoXP = xpTotal - xpNivelActual;
        const xpNecesaria = xpSiguienteNivel - xpNivelActual;

        // Barras visuales de progreso
        const llenos = Math.floor(felicidad / 10);
        const vacios = 10 - llenos;
        const barraFelicidad = "💗".repeat(Math.floor(felicidad / 20)) + "🤍".repeat(5 - Math.floor(felicidad / 20));
        const barraHambre = "🍖".repeat(5 - Math.floor(hambre / 20)) + "🩶".repeat(Math.floor(hambre / 20));

        const mensajes = [
            `le rascaste la barriguita con mucho amor`,
            `le diste una sesión de mimos dobles`,
            `le cantaste su canción favorita al oído`,
            `le dijiste que es la mascota más bonita del pueblo`,
            `le hiciste cosquillitas en las orejas`,
            `le diste un abrazo apretado con cariño`,
            `la peinaste con mucho estilo y ternura`,
        ];
        const mensaje = mensajes[Math.floor(Math.random() * mensajes.length)];

        // Determinar color según felicidad
        const colorEmbed = felicidad >= 80
            ? CONFIG.COLORES.MENTA || "#3EB489"
            : felicidad >= 50
                ? CONFIG.COLORES.VERDE || "#4CAF50"
                : CONFIG.COLORES.NARANJA || "#F8961E";

        const embed = crearEmbed(colorEmbed)
            .setAuthor({
                name: `${interaction.user.username} mimó a ${nombreCapital}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setTitle(`🐾 ¡${nombreCapital} está feliz!`)
            .setDescription(
                `*Tú ${mensaje}...*\n\n` +
                `**${nombreCapital}** ronronea/mueve la colita de la emoción. 🥹`
            )
            .addFields(
                {
                    name: "❤️ Felicidad",
                    value: `${barraFelicidad} \`${felicidad}/100\``,
                    inline: true
                },
                {
                    name: "🍖 Hambre",
                    value: `${barraHambre} \`${hambre}/100\``,
                    inline: true
                },
                {
                    name: "⭐ Nivel de mascota",
                    value: nivelNuevo >= MAX_NIVEL
                        ? `**Nv. ${nivelNuevo}** (MAX) — XP: \`${xpTotal}\` | +${xpGanada} XP`
                        : `**Nv. ${nivelNuevo}** — XP: \`${progresoXP}/${xpNecesaria}\` | +${xpGanada} XP`,
                    inline: false
                }
            );

        // Estado del buff con bonus especifico
        if (bonusInfo && tieneBuff) {
            const bonusPorNivel = nivelNuevo * 0.5;
            const porcentajeBase = Math.round(bonusInfo.baseMultiplicador * 100);
            const porcentajeTotal = porcentajeBase + bonusPorNivel;
            embed.addFields({
                name: `${bonusInfo.emoji} ¡BONUS DE MASCOTA ACTIVO!`,
                value: `**${bonusInfo.label}** — ${bonusInfo.descripcion.replace("{pct}", porcentajeTotal.toString())}\n*(Nv. ${nivelNuevo} agrega +${bonusPorNivel}% extra)*`,
                inline: false
            });
        } else if (hambre > 60) {
            embed.addFields({
                name: "⚠️ Tiene un poco de hambre...",
                value: `**${nombreCapital}** tiene pancita vacía. Usa \`/alimentar\` para darle algo rico.`,
                inline: false
            });
        } else if (!tieneBuff) {
            embed.addFields({
                name: "🌸 ¡Casi llegas!",
                value: `Necesitas **felicidad >= 60** y **hambre <= 50** para activar el bonus de **${nombreCapital}**.`,
                inline: false
            });
        }

        embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 128 }));

        await registrarBitacora(userId, `Mimó a su mascota ${nombreCapital}`);

        // Progreso de misión diaria
        progresarMision(interaction.user.id, "mascota").catch(() => {});

        const embeds = [embed];

        // Notificar subida de nivel con embed especial
        if (subioNivel) {
            const bonusPorNivel = nivelNuevo * 0.5;
            const porcentajeBase = bonusInfo ? Math.round(bonusInfo.baseMultiplicador * 100) : 0;
            const porcentajeTotal = porcentajeBase + bonusPorNivel;
            const embedNivel = crearEmbed(CONFIG.COLORES.DORADO)
                .setTitle(`🎉 ¡${nombreCapital} subió al Nivel ${nivelNuevo}!`)
                .setDescription(
                    `¡Felicidades! Tu mascota **${nombreCapital}** ha crecido y ahora es **Nivel ${nivelNuevo}**.\n\n` +
                    (bonusInfo
                        ? `${bonusInfo.emoji} Su bonus ha mejorado: **${bonusInfo.descripcion.replace("{pct}", porcentajeTotal.toString())}**`
                        : `¡Sigue cuidándola para que se haga más fuerte!`)
                );
            embeds.push(embedNivel);
            await registrarBitacora(userId, `La mascota ${nombreCapital} subió al nivel ${nivelNuevo}`);
        }

        return interaction.editReply({ embeds });

    } catch (e) {
        console.error("Error en /mimar:", e);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ Ay, algo salió mal...")
            .setDescription(`${bostezo}Algo salió mal al intentar mimar a tu mascota, corazoncito. ¡Intentémoslo de nuevo!`);
        return interaction.editReply({ embeds: [embed] });
    }
}
