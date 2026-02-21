import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { crearEmbed } from "../utils.js";

function getMsFor24Hours() {
    return 24 * 60 * 60 * 1000;
}

export const data = new SlashCommandBuilder()
    .setName("diario")
    .setDescription("Recibe tu regalito diario de moneditas y XP del pueblito");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    // Buscar cuándo fue la última vez que reclamó
    const resDb = await db.execute({
        sql: "SELECT ultimo_diario FROM usuarios WHERE id = ?",
        args: [userId]
    });

    if (resDb.rows.length === 0) {
        return interaction.reply({
            content: `${bostezo} Aún no sales a pasear por el pueblito... escribe unos cuantos mensajitos en el chat y vuelve a pedir tu regalito.`,
            flags: MessageFlags.Ephemeral
        });
    }

    const userData = resDb.rows[0];
    const ahora = new Date();

    // Validar tiempo
    if (userData.ultimo_diario) {
        const ultimoDiario = new Date(String(userData.ultimo_diario));
        const diffMs = ahora.getTime() - ultimoDiario.getTime();

        if (diffMs < getMsFor24Hours()) {
            const horasRestantes = Math.ceil((getMsFor24Hours() - diffMs) / (1000 * 60 * 60));
            return interaction.reply({
                content: `¡Tranquilidad, tesoro! Ya te di tu regalito de hoy. Vuelve en **${horasRestantes} horas** para pedir más.`,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    // Calcular recompensa aleatoria
    const rewardMonedas = Math.floor(Math.random() * (80 - 20 + 1)) + 20; // 20 a 80
    const rewardXP = Math.floor(Math.random() * (30 - 10 + 1)) + 10;   // 10 a 30

    try {
        await db.execute({
            sql: "UPDATE usuarios SET monedas = monedas + ?, xp = xp + ?, ultimo_diario = ? WHERE id = ?",
            args: [rewardMonedas, rewardXP, ahora.toISOString(), userId]
        });

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("🎁 ¡Regalito Diario Entregado!")
            .setDescription(`Annie ha sacado esto de su bolsillo para ti:\n\n**+${rewardMonedas}** 💰 Moneditas\n**+${rewardXP}** ✨ Experiencia\n\n*¡Disfrútalo y gástalo con sabiduría! Vuelve mañana para más.*`)
            .setThumbnail(interaction.client.user.displayAvatarURL());

        await interaction.reply({ content: `¡Aquí tienes, **${interaction.user.username}**!`, embeds: [embed] });

    } catch (e) {
        console.error("Error comando diario:", e.message);
        return interaction.reply({ content: "Parece que se me rompieron las libretas, inténtalo más tarde.", flags: MessageFlags.Ephemeral });
    }
}
