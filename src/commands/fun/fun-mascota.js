import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { calcularNivelMascota, xpParaNivel, PET_BONUSES, MAX_NIVEL } from "../../features/mascota-bonus.js";

export const data = new SlashCommandBuilder()
    .setName("mascota")
    .setDescription("Elige qué mascota del inventario te acompañará en tu perfil.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
        // 1. Obtener mascotas compradas
        const resMascotas = await db.execute({
            sql: `SELECT ie.item_id, mn.nombre
                                    FROM inventario_economia ie
                                    LEFT JOIN mascota_nombres mn
                                        ON mn.user_id = ie.user_id
                                     AND mn.mascota_id = ie.item_id
                                    WHERE ie.user_id = ?
                                        AND ie.item_id LIKE 'mascota_%'
                                        AND ie.cantidad > 0`,
            args: [userId]
        });

        if (resMascotas.rows.length === 0) {
            return interaction.followUp(`${bostezo}Ay mi cielo, todavía no has adoptado ninguna mascota. Pásate por la tienda cuando tengas moneditas.`);
        }

        // 2. Obtener la mascota activa actual
        const resUsuario = await db.execute({
            sql: "SELECT mascota_activa FROM usuarios WHERE id = ?",
            args: [userId]
        });

        const nombresMap = new Map();
        for (const row of resMascotas.rows) {
            nombresMap.set(String(row.item_id), String(row.nombre || "").trim());
        }

        const nombreVisibleMascota = (itemId) => {
            const base = String(itemId || "").replace("mascota_", "");
            const custom = String(nombresMap.get(String(itemId)) || "").trim();
            return custom || base;
        };

        let mascotaActiva = "Ninguna";
        if (resUsuario.rows.length > 0 && resUsuario.rows[0].mascota_activa !== "default") {
            mascotaActiva = nombreVisibleMascota(resUsuario.rows[0].mascota_activa);
        }

        const opcionesMascotas = [];

        // Agregar la opción de desequipar
        opcionesMascotas.push(
            new StringSelectMenuOptionBuilder()
                .setLabel("Ninguna")
                .setDescription("Guardar tu mascota actual en la casita")
                .setValue("default")
        );

        resMascotas.rows.forEach(r => {
            const rawId = String(r.item_id);
            const nombreMascota = nombreVisibleMascota(rawId);

            opcionesMascotas.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(nombreMascota.slice(0, 100))
                    .setDescription(`Equipar a ${nombreMascota}`)
                    .setValue(rawId)
            );
        });

        // Obtener estado de mascota activa para mostrar perfil
        let perfilMascota = "";
        const mascotaActivaId = resUsuario.rows.length > 0 ? String(resUsuario.rows[0].mascota_activa || "default") : "default";

        if (mascotaActivaId !== "default") {
            const resEstado = await db.execute({
                sql: "SELECT felicidad, hambre, nivel, xp FROM mascotas_estado WHERE user_id = ?",
                args: [userId]
            });

            if (resEstado?.rows?.length > 0) {
                const felicidad = Number(resEstado.rows[0].felicidad ?? 50);
                const hambre = Number(resEstado.rows[0].hambre ?? 50);
                const xpTotal = Number(resEstado.rows[0].xp ?? 0);
                const nivel = calcularNivelMascota(xpTotal);
                const bonusInfo = PET_BONUSES[mascotaActivaId];

                const barraFelicidad = "💗".repeat(Math.floor(felicidad / 20)) + "🤍".repeat(5 - Math.floor(felicidad / 20));
                const barraHambre = "🍖".repeat(5 - Math.floor(hambre / 20)) + "🩶".repeat(Math.floor(hambre / 20));

                // Barra de XP
                const xpNivelActual = xpParaNivel(nivel);
                const xpSiguienteNivel = xpParaNivel(nivel + 1);
                const progresoXP = xpTotal - xpNivelActual;
                const xpNecesaria = xpSiguienteNivel - xpNivelActual;
                const porcentajeXP = nivel >= MAX_NIVEL ? 100 : Math.floor((progresoXP / xpNecesaria) * 100);
                const barraXPLlenos = Math.floor(porcentajeXP / 10);
                const barraXP = "▰".repeat(barraXPLlenos) + "▱".repeat(10 - barraXPLlenos);

                const bonusActivo = felicidad >= 60 && hambre <= 50;

                perfilMascota += `\n\n📊 **Estado de ${mascotaActiva}:**\n`;
                perfilMascota += `❤️ Felicidad: ${barraFelicidad} \`${felicidad}/100\`\n`;
                perfilMascota += `🍖 Hambre: ${barraHambre} \`${hambre}/100\`\n`;
                perfilMascota += nivel >= MAX_NIVEL
                    ? `⭐ Nivel: **${nivel}** (MAX) — XP: \`${xpTotal}\`\n`
                    : `⭐ Nivel: **${nivel}** — XP: ${barraXP} \`${progresoXP}/${xpNecesaria}\`\n`;

                if (bonusInfo) {
                    const bonusPorNivel = nivel * 0.5;
                    const porcentajeBase = Math.round(bonusInfo.baseMultiplicador * 100);
                    const porcentajeTotal = porcentajeBase + bonusPorNivel;
                    const estadoBonus = bonusActivo ? "**ACTIVO**" : "~~inactivo~~ *(necesita felicidad >= 60 y hambre <= 50)*";
                    perfilMascota += `\n${bonusInfo.emoji} **Bonus:** ${bonusInfo.descripcion.replace("{pct}", porcentajeTotal.toString())} — ${estadoBonus}`;
                }
            }
        }

        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle(`🐾 Refugio de Mascotas de ${interaction.user.username}`)
            .setDescription(`Tienes **${resMascotas.rows.length}** amiguito(s) esperándote.\n\n🐕 **Acompañante Actual:**\n${mascotaActiva}${perfilMascota}\n\nUsa el menú de abajo para elegir quién paseará contigo por el pueblito hoy.`);

        // Armar el menú selector
        const select = new StringSelectMenuBuilder()
            .setCustomId('seleccionar_mascota')
            .setPlaceholder('Elige una mascota para que te acompañe...')
            .addOptions(opcionesMascotas);

        const row = new ActionRowBuilder().addComponents(select);

        const mensaje = await interaction.followUp({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        // Colector del dropdown
        const collector = mensaje.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000 // 1 minuto
        });

        collector.on('collect', async i => {
            const eleccion = i.values[0];

            await i.deferUpdate();

            try {
                // Actualizar mascota_activa en la tabla de usuarios
                await db.execute({
                    sql: "UPDATE usuarios SET mascota_activa = ? WHERE id = ?",
                    args: [eleccion, userId]
                });

                if (eleccion !== "default") {
                    const embedMascota = crearEmbed(CONFIG.COLORES.MENTA)
                        .setTitle("🐾 ¡Mascota equipada!")
                        .setDescription(
                            `¡**${nombreVisibleMascota(eleccion)}** está saltando de alegría! Ahora te acompañará en todas tus aventuras por el pueblito. 🐾`
                        )
                        .addFields({ name: "🐾 Compañero activo", value: `**${nombreVisibleMascota(eleccion)}**`, inline: true });
                    await i.editReply({ embeds: [embedMascota], components: [] });
                } else {
                    const embedMascota = crearEmbed(CONFIG.COLORES.ROSA)
                        .setTitle("💭 Mascota descansando")
                        .setDescription(`Tu amiguito se fue a descansar a su casita. ¡Vuelve cuando quieras llamarlo de nuevo! 🏠`);
                    await i.editReply({ embeds: [embedMascota], components: [] });
                }

            } catch (err) {
                console.error("Error cambiando mascota:", err);
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    components: [],
                    content: `${bostezo}La puerta del refugio se cerró. Usa el comando \`/mascota\` otra vez si quieres cambiar a tu amiguito.`
                }).catch(() => { });
            }
        });

    } catch (error) {
        console.error("Error en comando /mascota:", error);
        const embedErr = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Refugio cerrado!")
            .setDescription(`${bostezo}Las llaves del refugio se me perdieron... Intenta llamar a tu mascota de nuevo porfi.`);
        return interaction.followUp({ embeds: [embedErr] });
    }
}
