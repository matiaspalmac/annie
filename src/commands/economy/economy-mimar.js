import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
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
            return interaction.followUp(`${bostezo}¡No tienes ninguna mascota activa! Compra una en la **/tienda** y equípala con **/equipar**.`);
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
                return interaction.followUp(`${bostezo}Tu mascota ya está super contenta ahorita. Vuelve en **${faltanMin} minutos** a mimarla de nuevo.`);
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
        const barraFelicidad = "💗".repeat(Math.floor(felicidad / 20)) + "🤍".repeat(5 - Math.floor(felicidad / 20));

        const mensajes = [
            `le rascaste la barriguita`,
            `le diste una sesión de mimos dobles`,
            `le cantaste su canción favorita`,
            `le dijiste que es la mascota más bonita del pueblo`,
            `le hiciste cosquillas en las orejas`
        ];
        const mensaje = mensajes[Math.floor(Math.random() * mensajes.length)];

        await registrarBitacora(userId, `Mimó a su mascota ${nombreCapital}`);

        return interaction.followUp(
            `🐾 *${bostezo} ${nombreCapital} parece muy feliz contigo...*\n\n` +
            `¡${mensaje}! **${nombreCapital}** está radiante de felicidad.\n\n` +
            `❤️ Felicidad: ${barraFelicidad} (${felicidad}/100)\n` +
            `🍖 Hambre: ${hambre}/100\n\n` +
            (tieneBuff ? `✨ ***¡BUFF ACTIVO!*** Tu compañero feliz te da **+5% de drops** en tus próximas aventuras!` :
                hambre > 60 ? `⚠️ *${nombreCapital} tiene un poquito de hambre... usa /alimentar para darle algo rico.*` :
                    `💫 ¡Sigue mimándola para activar el buff del Compañero Feliz!`)
        );
    } catch (e) {
        console.error("Error en /mimar:", e);
        return interaction.followUp(`${bostezo}Ay, algo salió mal al intentar mimar a tu mascota...`);
    }
}
