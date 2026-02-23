import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed } from "../../core/utils.js";

function getMsFor24Hours() {
    return 24 * 60 * 60 * 1000;
}

function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const data = new SlashCommandBuilder()
    .setName("diario")
    .setDescription("Recibe tu regalito diario de moneditas y XP del pueblito");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    // Buscar cuándo fue la última vez que reclamó
    const resDb = await db.execute({
        sql: "SELECT ultimo_diario, diario_racha FROM usuarios WHERE id = ?",
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
    let streak = Number(userData.diario_racha || 0);

    if (userData.ultimo_diario) {
        const ultimoDiario = new Date(String(userData.ultimo_diario));
        const diffMs = ahora.getTime() - ultimoDiario.getTime();

        if (diffMs < getMsFor24Hours()) {
            const faltante = getMsFor24Hours() - diffMs;
            return interaction.reply({
                content: `¡Tranquilidad, tesoro! Ya te di tu regalito de hoy.\n` +
                    `⏳ Próximo diario en **${formatRemaining(faltante)}**.`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (diffMs <= getMsFor24Hours() * 2) {
            streak += 1;
        } else {
            streak = 1;
        }
    } else {
        streak = 1;
    }

    // Calcular recompensa aleatoria
    const rewardMonedasBase = Math.floor(Math.random() * (80 - 20 + 1)) + 20; // 20 a 80
    const rewardXPBase = Math.floor(Math.random() * (30 - 10 + 1)) + 10;   // 10 a 30
    const bonusStreakMonedas = Math.min(streak * 5, 100);
    const bonusStreakXP = Math.min(streak * 2, 40);
    const rewardMonedas = rewardMonedasBase + bonusStreakMonedas;
    const rewardXP = rewardXPBase + bonusStreakXP;

    const weeklyChest = streak % 7 === 0;
    const cofreMonedas = weeklyChest ? (Math.floor(Math.random() * 141) + 60) : 0;
    const cofreXP = weeklyChest ? (Math.floor(Math.random() * 61) + 30) : 0;

    try {
        await db.execute({
            sql: "UPDATE usuarios SET monedas = monedas + ?, xp = xp + ?, ultimo_diario = ?, diario_racha = ? WHERE id = ?",
            args: [rewardMonedas + cofreMonedas, rewardXP + cofreXP, ahora.toISOString(), streak, userId]
        });

        if (weeklyChest) {
            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                      VALUES (?, 'cofre_semanal', 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId]
            });
        }

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("🎁 ¡Regalito Diario Entregado!")
            .setDescription(
                `Annie ha sacado esto de su bolsillo para ti:\n\n` +
                `**+${rewardMonedas}** 💰 Moneditas *(incluye racha)*\n` +
                `**+${rewardXP}** ✨ Experiencia *(incluye racha)*\n` +
                `${weeklyChest ? `\n🧰 **Cofre semanal desbloqueado**: +${cofreMonedas} monedas, +${cofreXP} XP y 1x cofre_semanal\n` : ""}\n` +
                `🔥 Racha actual: **${streak} día(s)**\n` +
                `⏳ Próximo diario en: **24:00:00**`
            )
            .setThumbnail(interaction.client.user.displayAvatarURL());

        await interaction.reply({ content: `¡Aquí tienes, **${interaction.user.username}**!`, embeds: [embed] });

    } catch (e) {
        console.error("Error comando diario:", e.message);
        return interaction.reply({ content: `${bostezo}Parece que se me rompieron las libretas, tesoro. Intentémoslo más tarde.`, flags: MessageFlags.Ephemeral });
    }
}
