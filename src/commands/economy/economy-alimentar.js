import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { registrarBitacora } from "../../features/progreso.js";
import { progresarMision } from "../../features/misiones.js";
import { calcularNivelMascota, xpParaNivel, getPetBonus, PET_BONUSES, MAX_NIVEL } from "../../features/mascota-bonus.js";

// Las frutas que acepta la mascota. Cuestan estas del inventario_economia.
const ALIMENTOS_VALIDOS = [
    { id: "Manzanas", emoji: "🍎", recupera: 30 },
    { id: "Duraznos", emoji: "🍑", recupera: 35 },
    { id: "Ciruelas", emoji: "🟣", recupera: 25 },
    { id: "Naranjas", emoji: "🍊", recupera: 30 },
    { id: "Peras", emoji: "🍐", recupera: 28 },
    { id: "Uvas Mágicas", emoji: "🍇", recupera: 50 }, // raro, recupera más
];

export const data = new SlashCommandBuilder()
    .setName("alimentar")
    .setDescription("Dale de comer a tu mascota activa para que no pase hambre.")
    .addStringOption(o => o
        .setName("fruta")
        .setDescription("¿Qué fruta le darás? (manzanas, duraznos, ciruelas, naranjas, peras, uvas mágicas)")
        .setRequired(false)
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const frutaInput = interaction.options.getString("fruta")?.toLowerCase().trim() || null;

    await interaction.deferReply();

    try {
        // Verificar mascota activa
        const resMascota = await db.execute({
            sql: "SELECT mascota_id FROM usuarios WHERE id = ?",
            args: [userId]
        });

        if (resMascota.rows.length === 0 || !resMascota.rows[0].mascota_id) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("🐾 Ay, no tienes mascota activa...")
                .setDescription(
                    `${bostezo}¡Todavía no tienes ninguna mascota activa, corazoncito!\n\n` +
                    `🛒 Compra una en la **\`/tienda\`** y actívala con **\`/equipar\`**.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const mascotaId = String(resMascota.rows[0].mascota_id);
        const nombreMascota = mascotaId.replace("mascota_", "").replace(/_/g, " ");
        const nombreCapital = nombreMascota.charAt(0).toUpperCase() + nombreMascota.slice(1);

        // Detectar qué fruta usar
        let alimento = null;
        if (frutaInput) {
            alimento = ALIMENTOS_VALIDOS.find(a => a.id.toLowerCase().includes(frutaInput) || frutaInput.includes(a.id.toLowerCase()));
        }

        if (!alimento) {
            for (const a of ALIMENTOS_VALIDOS) {
                const res = await db.execute({
                    sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ? AND cantidad > 0",
                    args: [userId, a.id]
                });
                if (res.rows.length > 0) { alimento = a; break; }
            }
        }

        if (!alimento) {
            const listaFrutas = ALIMENTOS_VALIDOS.map(a => `${a.emoji} **${a.id}**`).join("\n");
            const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle(`🍽️ ¡${nombreCapital} tiene hambre!`)
                .setDescription(
                    `${bostezo}No tienes frutas para darle a **${nombreCapital}**, pobrecita...\n\n` +
                    `🌳 Sal a recolectar o talar árboles para conseguir:\n${listaFrutas}`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // Verificar que tiene la fruta en inventario
        const resInv = await db.execute({
            sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ? AND cantidad > 0",
            args: [userId, alimento.id]
        });

        if (resInv.rows.length === 0) {
            const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle(`🍽️ ¡Sin ${alimento.id}!`)
                .setDescription(
                    `${bostezo}No tienes ${alimento.emoji} **${alimento.id}** en tu mochila, corazón.\n\n` +
                    `🌳 ¡Recuérdalas primero usando \`/talar\` o \`/mochila\` para revisar tus existencias!`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // Consumir 1 fruta del inventario
        await db.execute({
            sql: "UPDATE inventario_economia SET cantidad = cantidad - 1 WHERE user_id = ? AND item_id = ?",
            args: [userId, alimento.id]
        });

        // Crear/actualizar estado mascota (incluye xp de mascota)
        const ahora = Date.now();
        const xpGanada = Math.floor(Math.random() * 11) + 5; // 5-15 XP

        await db.execute({
            sql: `INSERT INTO mascotas_estado (user_id, mascota_id, felicidad, hambre, ultima_interaccion, nivel, xp)
                  VALUES (?, ?, 60, 20, ?, 1, ?)
                  ON CONFLICT(user_id) DO UPDATE SET
                    hambre = MAX(0, hambre - ?),
                    felicidad = MIN(100, felicidad + 5),
                    ultima_interaccion = ?,
                    xp = xp + ?`,
            args: [userId, mascotaId, ahora, xpGanada, alimento.recupera, ahora, xpGanada]
        });

        const resEstado = await db.execute({
            sql: "SELECT felicidad, hambre, nivel, xp FROM mascotas_estado WHERE user_id = ?",
            args: [userId]
        });

        const felicidad = Number(resEstado.rows[0]?.felicidad ?? 60);
        const hambre = Number(resEstado.rows[0]?.hambre ?? 20);
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

        // Barras visuales
        const barraFelicidad = "💗".repeat(Math.floor(felicidad / 20)) + "🤍".repeat(5 - Math.floor(felicidad / 20));
        const barraHambre = "🍖".repeat(5 - Math.floor(hambre / 20)) + "🩶".repeat(Math.floor(hambre / 20));

        // Reacciones de la mascota al comer
        const reacciones = [
            `se lo comió todo en segundos y pide más`,
            `se relamió los bigotes con satisfacción`,
            `dio un saltito de alegría antes de comer`,
            `te miró con ojos brillantes antes de devorar la fruta`,
            `ronroneó/movió la colita mientras comía`,
        ];
        const reaccion = reacciones[Math.floor(Math.random() * reacciones.length)];

        // Color según nivel de hambre actual
        const colorEmbed = hambre <= 20
            ? CONFIG.COLORES.MENTA || "#3EB489"
            : hambre <= 50
                ? CONFIG.COLORES.VERDE || "#4CAF50"
                : CONFIG.COLORES.NARANJA || "#F8961E";

        const embed = crearEmbed(colorEmbed)
            .setAuthor({
                name: `${interaction.user.username} alimentó a ${nombreCapital}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setTitle(`🍽️ ¡${nombreCapital} ha comido!`)
            .setDescription(
                `*Le ofreciste ${alimento.emoji} **${alimento.id}** a **${nombreCapital}**...*\n\n` +
                `¡Nam nam! **${nombreCapital}** ${reaccion}. 🥰`
            )
            .addFields(
                {
                    name: "🍖 Hambre",
                    value: `${barraHambre} \`${hambre}/100\``,
                    inline: true
                },
                {
                    name: "❤️ Felicidad",
                    value: `${barraFelicidad} \`${felicidad}/100\``,
                    inline: true
                },
                {
                    name: "🍎 Alimento consumido",
                    value: `${alimento.emoji} **${alimento.id}** *(−${alimento.recupera} hambre)*`,
                    inline: false
                },
                {
                    name: "⭐ Nivel de mascota",
                    value: nivelNuevo >= MAX_NIVEL
                        ? `**Nv. ${nivelNuevo}** (MAX) — XP: \`${xpTotal}\` | +${xpGanada} XP`
                        : `**Nv. ${nivelNuevo}** — XP: \`${progresoXP}/${xpNecesaria}\` | +${xpGanada} XP`,
                    inline: false
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 128 }));

        // Estado del buff con bonus especifico de la mascota
        if (bonusInfo && tieneBuff) {
            const bonusPorNivel = nivelNuevo * 0.5;
            const porcentajeBase = Math.round(bonusInfo.baseMultiplicador * 100);
            const porcentajeTotal = porcentajeBase + bonusPorNivel;
            embed.addFields({
                name: `${bonusInfo.emoji} ¡BONUS DE MASCOTA ACTIVO!`,
                value: `**${bonusInfo.label}** — ${bonusInfo.descripcion.replace("{pct}", porcentajeTotal.toString())}\n*(Nv. ${nivelNuevo} agrega +${bonusPorNivel}% extra)*`,
                inline: false
            });
        } else if (felicidad < 50) {
            embed.addFields({
                name: "💔 Tu mascota está triste...",
                value: `**${nombreCapital}** necesita más mimos. ¡Recuerda usar \`/mimar\` también!`,
                inline: false
            });
        } else if (!tieneBuff) {
            embed.addFields({
                name: "🌸 ¡Casi llegas!",
                value: `Necesitas **felicidad >= 60** y **hambre <= 50** para activar el bonus de **${nombreCapital}**.`,
                inline: false
            });
        }

        await registrarBitacora(userId, `Alimentó a ${nombreCapital} con ${alimento.id}`);

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
        console.error("Error en /alimentar:", e);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ Ay, algo salió mal...")
            .setDescription(`${bostezo}Algo salió mal al intentar alimentar a tu mascota... ¡Inténtalo de nuevo en un ratito!`);
        return interaction.editReply({ embeds: [embed] });
    }
}
