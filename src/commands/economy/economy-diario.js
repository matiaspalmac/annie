import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed, barraProgreso } from "../../core/utils.js";

function getMsFor24Hours() { return 24 * 60 * 60 * 1000; }

function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function rachaEmoji(streak) {
    if (streak >= 30) return "🔥🔥🔥";
    if (streak >= 14) return "🔥🔥";
    if (streak >= 7) return "🔥";
    if (streak >= 3) return "✨";
    return "⭐";
}

export const data = new SlashCommandBuilder()
    .setName("diario")
    .setDescription("Recibe tu regalito diario de moneditas y XP del pueblito");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    await interaction.deferReply();

    const resDb = await db.execute({
        sql: "SELECT ultimo_diario, diario_racha FROM usuarios WHERE id = ?",
        args: [userId]
    });

    if (resDb.rows.length === 0) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🌸 ¡Aún no estás registrado!")
            .setDescription(`${bostezo} Todavía no te has paseado por el pueblito... Escribe unos cuantos mensajitos en el chat y vuelve a pedir tu regalito, corazón.`);
        return interaction.editReply({ embeds: [embed] });
    }

    const userData = resDb.rows[0];
    const ahora = new Date();

    let streak = Number(userData.diario_racha || 0);

    if (userData.ultimo_diario) {
        const ultimoDiario = new Date(String(userData.ultimo_diario));
        const diffMs = ahora.getTime() - ultimoDiario.getTime();

        if (diffMs < getMsFor24Hours()) {
            const faltante = getMsFor24Hours() - diffMs;
            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("⏳ ¡Ya recibiste tu regalito hoy!")
                .setDescription(
                    `${bostezo}¡Ya te di tu regalito de hoy, cielito! Vuelve más tardecito cuando el reloj avance un poco más. 🕰️`
                )
                .addFields(
                    { name: "⏳ Próximo diario en", value: `\`${formatRemaining(faltante)}\``, inline: true },
                    { name: `${rachaEmoji(streak)} Racha actual`, value: `**${streak} día(s)**`, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        if (diffMs <= getMsFor24Hours() * 2) { streak += 1; }
        else { streak = 1; }
    } else {
        streak = 1;
    }

    // Calcular recompensa
    const rewardMonedasBase = Math.floor(Math.random() * (80 - 20 + 1)) + 20; // 20–80
    const rewardXPBase = Math.floor(Math.random() * (30 - 10 + 1)) + 10;       // 10–30
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

        // Barra de racha semanal (7 días = cofre)
        const diasEnCiclo = ((streak - 1) % 7) + 1;
        const barraRacha = barraProgreso(diasEnCiclo, 7, "🟡", "⬜", 7);
        const diasParaCofre = 7 - diasEnCiclo;

        const color = weeklyChest ? CONFIG.COLORES.DORADO : (streak >= 7 ? CONFIG.COLORES.MAGENTA : CONFIG.COLORES.DORADO);

        const embed = crearEmbed(color)
            .setTitle(weeklyChest ? "🎊 ¡Cofre Semanal Desbloqueado!" : "🎁 ¡Regalito Diario Entregado!")
            .setDescription(
                weeklyChest
                    ? `¡${interaction.user.username}, mantuviste tu racha 7 días seguidos! Annie está muy orgullosa de ti. 🌸\n\n*Saca el cofre del estante más alto...*`
                    : `Annie sacó esto de su bolsillo con mucho cariño para ti, **${interaction.user.username}**. 💌`
            )
            .addFields(
                { name: "💰 Moneditas", value: `**+${rewardMonedas} 🪙**`, inline: true },
                { name: "✨ Experiencia", value: `**+${rewardXP} XP**`, inline: true },
                { name: `${rachaEmoji(streak)} Racha`, value: `**${streak} día(s)**`, inline: true },
                {
                    name: `🗓️ Ciclo semanal ${barraRacha}`,
                    value: weeklyChest
                        ? `¡Ciclo completado! 🎉 Nuevo ciclo comenzando...`
                        : `${diasParaCofre} día(s) para el cofre semanal`,
                    inline: false
                }
            );

        if (weeklyChest) {
            embed.addFields({
                name: "🧰 Cofre Semanal",
                value: `**+${cofreMonedas} 🪙** • **+${cofreXP} XP** • **+1x cofre_semanal** en tu mochila`,
                inline: false
            });
        }

        return interaction.editReply({ embeds: [embed] });

    } catch (e) {
        console.error("Error comando diario:", e.message);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Las libretas se rompieron!")
            .setDescription(`${bostezo}Parece que se me rompieron las libretas, tesoro. Intentémoslo más tarde, ¡prometo que no pierdes tu racha!`);
        return interaction.editReply({ embeds: [embed] });
    }
}
