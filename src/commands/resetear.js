import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { db } from "../db.js";

export const data = new SlashCommandBuilder()
    .setName("resetear")
    .setDescription("Resetea los XP y Moneditas de un usuario a 0 (Solo Administradores)")
    .addUserOption(o => o.setName("vecino").setDescription("El vecinito a resetear").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, bostezo) {
    const targetUser = interaction.options.getUser("vecino");

    try {
        const resDb = await db.execute({
            sql: "SELECT id FROM usuarios WHERE id = ?",
            args: [targetUser.id]
        });

        if (resDb.rows.length === 0) {
            return interaction.reply({ content: `Ese vecinito (**${targetUser.username}**) aún no tiene cuenta en el pueblito.`, flags: MessageFlags.Ephemeral });
        }

        await db.execute({
            sql: "UPDATE usuarios SET xp = 0, monedas = 0, nivel = 1 WHERE id = ?",
            args: [targetUser.id]
        });

        return interaction.reply({ content: `✅ Limpieza hecha. He reseteado a 0 la experiencia, nivel y las moneditas de **${targetUser.username}**.`, flags: MessageFlags.Ephemeral });
    } catch (e) {
        console.error("Error al resetear usuario:", e);
        return interaction.reply({ content: "❌ Ocurrió un error al intentar resetear al usuario. Revisa los logs.", flags: MessageFlags.Ephemeral });
    }
}
