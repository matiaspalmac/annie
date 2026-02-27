import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { registrarBitacora } from "../../features/progreso.js";

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

        // Crear/actualizar estado mascota
        const ahora = Date.now();
        await db.execute({
            sql: `INSERT INTO mascotas_estado (user_id, mascota_id, felicidad, hambre, ultima_interaccion)
                  VALUES (?, ?, 60, 20, ?)
                  ON CONFLICT(user_id) DO UPDATE SET
                    hambre = MAX(0, hambre - ?),
                    felicidad = MIN(100, felicidad + 5),
                    ultima_interaccion = ?`,
            args: [userId, mascotaId, ahora, alimento.recupera, ahora]
        });

        const resEstado = await db.execute({
            sql: "SELECT felicidad, hambre FROM mascotas_estado WHERE user_id = ?",
            args: [userId]
        });

        const felicidad = Number(resEstado.rows[0]?.felicidad ?? 60);
        const hambre = Number(resEstado.rows[0]?.hambre ?? 20);
        const tieneBuff = felicidad >= 80 && hambre <= 30;

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
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 128 }));

        // Estado del buff o sugerencia
        if (tieneBuff) {
            embed.addFields({
                name: "✨ ¡COMPAÑERO FELIZ ACTIVO!",
                value: "Tu mascota satisfecha y feliz te da **+5% de drops** en tus aventuras. ¡Cuídala bien!",
                inline: false
            });
        } else if (felicidad < 50) {
            embed.addFields({
                name: "💔 Tu mascota está triste...",
                value: `**${nombreCapital}** necesita más mimos. ¡Recuerda usar \`/mimar\` también!`,
                inline: false
            });
        } else {
            embed.addFields({
                name: "🌸 ¡Vas bien!",
                value: `Sigue alimentando y mimando a **${nombreCapital}** para activar el **buff Compañero Feliz**.`,
                inline: false
            });
        }

        await registrarBitacora(userId, `Alimentó a ${nombreCapital} con ${alimento.id}`);

        return interaction.editReply({ embeds: [embed] });

    } catch (e) {
        console.error("Error en /alimentar:", e);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ Ay, algo salió mal...")
            .setDescription(`${bostezo}Algo salió mal al intentar alimentar a tu mascota... ¡Inténtalo de nuevo en un ratito!`);
        return interaction.editReply({ embeds: [embed] });
    }
}
