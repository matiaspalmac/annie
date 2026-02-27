import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";

// ID del creador/owner autorizado para usar el comando
const OWNER_ID = "457299957955821569";

export const data = new SlashCommandBuilder()
    .setName("dar")
    .setDescription("Otorga XP y/o Moneditas a un vecino desde la bóveda celestial (Solo Owner)")
    .addUserOption(o => o.setName("vecino").setDescription("El vecinito afortunado").setRequired(true))
    .addIntegerOption(o => o.setName("monedas").setDescription("Cantidad de moneditas a regalar").setMinValue(1))
    .addIntegerOption(o => o.setName("xp").setDescription("Cantidad de experiencia a regalar").setMinValue(1));

export async function execute(interaction) {
    // 1. Verificación dura de permisos por ID
    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({
            content: "❌ ¡Oye! Solo el Creador Supremo del Pueblito puede abrir la bóveda mágica.",
            flags: MessageFlags.Ephemeral
        });
    }

    const targetUser = interaction.options.getUser("vecino");
    const monedasOpcionales = interaction.options.getInteger("monedas") || 0;
    const xpOpcional = interaction.options.getInteger("xp") || 0;

    // 2. Comprobar que al menos insertó un premio
    if (monedasOpcionales === 0 && xpOpcional === 0) {
        return interaction.reply({
            content: "❌ Tienes que escribir al menos un valor de monedas o XP para regalar.",
            flags: MessageFlags.Ephemeral
        });
    }

    try {
        // 3. Crear el usuario destino si no existe, o actualizar si existe
        await db.execute({
            sql: `INSERT INTO usuarios (id, username, monedas, xp, nivel) 
                  VALUES (?, ?, ?, ?, 1)
                  ON CONFLICT(id) DO UPDATE SET 
                  monedas = usuarios.monedas + ?,
                  xp = usuarios.xp + ?`,
            args: [
                targetUser.id, targetUser.username, monedasOpcionales, xpOpcional, // INSERT parameters
                monedasOpcionales, xpOpcional // UPDATE parameters
            ]
        });

        // 4. Formatear la nota de entrega
        let mensajeRegalo = `✅ ¡Bóveda abierta! Le has regalado a **${targetUser.username}**:`;
        if (monedasOpcionales > 0) mensajeRegalo += `\n🪙 **${monedasOpcionales} moneditas**`;
        if (xpOpcional > 0) mensajeRegalo += `\n✨ **${xpOpcional} puntos de experiencia**`;

        return interaction.reply({ content: mensajeRegalo, flags: MessageFlags.Ephemeral });

    } catch (e) {
        console.error("Error en comando /dar:", e);
        return interaction.reply({ content: "❌ Ocurrió un error al intentar repartir los regalos divinos.", flags: MessageFlags.Ephemeral });
    }
}
