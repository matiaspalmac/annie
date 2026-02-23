import { SlashCommandBuilder } from "discord.js";
import { execute as executeBalance } from "./economy-balance.js";

/**
 * Comando /bal - Alias corto de /balance
 * Ejecuta la misma lógica del comando balance
 */

export const data = new SlashCommandBuilder()
    .setName("bal")
    .setDescription("Atajo para ver tus moneditas (igual que /balance)")
    .addUserOption(option =>
        option
            .setName("vecino")
            .setDescription("Mira las moneditas de otro vecinito")
            .setRequired(false)
    );

export async function execute(interaction, bostezo) {
    return executeBalance(interaction, bostezo);
}
