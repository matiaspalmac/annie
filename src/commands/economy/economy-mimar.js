import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedCooldown } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { registrarBitacora } from "../../features/progreso.js";

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

        // Crear o actualizar estado de mascota
        await db.execute({
            sql: `INSERT INTO mascotas_estado (user_id, mascota_id, felicidad, hambre, ultima_interaccion)
                  VALUES (?, ?, 80, 50, ?)
                  ON CONFLICT(user_id) DO UPDATE SET
                    felicidad = MIN(100, felicidad + 20),
                    ultima_interaccion = ?`,
            args: [userId, mascotaId, ahora, ahora]
        });

        // Leer estado actualizado
        const resEstado = await db.execute({
            sql: "SELECT felicidad, hambre FROM mascotas_estado WHERE user_id = ?",
            args: [userId]
        });

        const felicidad = Number(resEstado.rows[0]?.felicidad ?? 80);
        const hambre = Number(resEstado.rows[0]?.hambre ?? 50);
        const tieneBuff = felicidad >= 80 && hambre <= 30;

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
                }
            );

        // Estado del buff
        if (tieneBuff) {
            embed.addFields({
                name: "✨ ¡BUFF ACTIVO!",
                value: "**Compañero Feliz** — Tu mascota feliz te da **+5% de drops** en tus próximas aventuras.",
                inline: false
            });
        } else if (hambre > 60) {
            embed.addFields({
                name: "⚠️ Tiene un poco de hambre...",
                value: `**${nombreCapital}** tiene pancita vacía. Usa \`/alimentar\` para darle algo rico.`,
                inline: false
            });
        } else {
            embed.addFields({
                name: "💫 ¡Sigue así!",
                value: `Con más mimos y comidita llegarás al buff del Compañero Feliz. ¡Ánimo!`,
                inline: false
            });
        }

        embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 128 }));

        await registrarBitacora(userId, `Mimó a su mascota ${nombreCapital}`);

        return interaction.editReply({ embeds: [embed] });

    } catch (e) {
        console.error("Error en /mimar:", e);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ Ay, algo salió mal...")
            .setDescription(`${bostezo}Algo salió mal al intentar mimar a tu mascota, corazoncito. ¡Intentémoslo de nuevo!`);
        return interaction.editReply({ embeds: [embed] });
    }
}
