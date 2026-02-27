import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
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
            return interaction.followUp(`${bostezo}¡No tienes ninguna mascota activa! Compra una en la **/tienda** y equípala.`);
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
            // Sin argumento o fruta no válida: buscar cualquiera que tenga en el inventario
            for (const a of ALIMENTOS_VALIDOS) {
                const res = await db.execute({
                    sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ? AND cantidad > 0",
                    args: [userId, a.id]
                });
                if (res.rows.length > 0) { alimento = a; break; }
            }
        }

        if (!alimento) {
            const listaFrutas = ALIMENTOS_VALIDOS.map(a => `${a.emoji} ${a.id}`).join(", ");
            return interaction.followUp(`${bostezo}No tienes frutas para darle a ${nombreCapital}. Consigue alguna: ${listaFrutas}`);
        }

        // Verificar que tiene la fruta en inventario
        const resInv = await db.execute({
            sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ? AND cantidad > 0",
            args: [userId, alimento.id]
        });

        if (resInv.rows.length === 0) {
            return interaction.followUp(`${bostezo}No tienes ${alimento.emoji} **${alimento.id}** en tu mochila. ¡Recoléctalas primero!`);
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
        const barraHambre = "🍖".repeat(5 - Math.floor(hambre / 20)) + "🩶".repeat(Math.floor(hambre / 20));

        await registrarBitacora(userId, `Alimentó a ${nombreCapital} con ${alimento.id}`);

        return interaction.followUp(
            `🍽️ *Le ofreciste ${alimento.emoji} ${alimento.id} a **${nombreCapital}**...*\n\n` +
            `¡Nam nam! ${nombreCapital} se lo comió todo en segundos.\n` +
            `🍖 Hambre: ${barraHambre} (${hambre}/100)\n` +
            `❤️ Felicidad: ${felicidad}/100\n\n` +
            (tieneBuff ? `✨ ***¡COMPAÑERO FELIZ!*** + 5% de drops en tus aventuras. ¡Cuídala bien!` :
                felicidad < 50 ? `💔 Tu mascota está un poco triste. ¡Recuerda también /mimar!` :
                    `🌸 ${nombreCapital} está satisfecha. Sigue cuidándola para activar el buff!`)
        );
    } catch (e) {
        console.error("Error en /alimentar:", e);
        return interaction.followUp(`${bostezo}Algo salió mal al intentar alimentar a tu mascota...`);
    }
}
