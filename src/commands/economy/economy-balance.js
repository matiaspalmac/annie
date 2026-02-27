import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { db } from "../../services/db.js";
import { crearEmbed, getBostezo } from "../../core/utils.js";

/**
 * Comando /balance - Consulta el saldo de monedas de un usuario
 * Permite ver monedas propias o de otro usuario
 */

export const data = new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Revisa cuántas moneditas tienes en tu bolsillo")
    .addUserOption(option =>
        option
            .setName("vecino")
            .setDescription("Mira las moneditas de otro vecinito")
            .setRequired(false)
    );

/**
 * Formatea números grandes de forma compacta
 * @param {number} value - Valor a formatear
 * @returns {string} Valor formateado (ej: 1.2K, 3.5M)
 */
function formatCompact(value) {
    return new Intl.NumberFormat("es-CL", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(Number(value || 0));
}

/**
 * Formatea números con separadores de miles
 * @param {number} value - Valor a formatear
 * @returns {string} Valor formateado (ej: 1.234.567)
 */
function formatNumber(value) {
    return new Intl.NumberFormat("es-CL").format(Number(value || 0));
}

export async function execute(interaction, bostezo) {
    await interaction.deferReply();

    // 1. Validación de seguridad - determinar usuario objetivo
    const reqUser = interaction.options.getUser("vecino");
    const targetUser = reqUser?.bot ? interaction.user : (reqUser || interaction.user);
    const esPropioBalance = targetUser.id === interaction.user.id;

    try {
        // 2. Consulta optimizada a base de datos
        const [userResult, rankingResult, bancoResult] = await Promise.all([
            db.execute({
                sql: "SELECT monedas, xp, nivel FROM usuarios WHERE id = ?",
                args: [targetUser.id]
            }),
            db.execute({
                sql: `SELECT COUNT(*) + 1 as posicion 
                      FROM usuarios 
                      WHERE monedas > (SELECT monedas FROM usuarios WHERE id = ?)`,
                args: [targetUser.id]
            }),
            db.execute({
                sql: "SELECT monedas, ultimo_interes FROM banco WHERE user_id = ?",
                args: [targetUser.id]
            })
        ]);

        // Aplicar intereses del banco silenciosamente (solo al propio usuario)
        let monedas_banco = Number(bancoResult.rows[0]?.monedas ?? 0);
        if (esPropioBalance && monedas_banco > 0 && bancoResult.rows.length > 0) {
            const ultimoInteres = Number(bancoResult.rows[0].ultimo_interes || 0);
            const diasPasados = Math.floor((Date.now() - ultimoInteres) / (24 * 60 * 60 * 1000));
            if (diasPasados > 0) {
                monedas_banco = Math.floor(monedas_banco * Math.pow(1.02, diasPasados));
                await db.execute({
                    sql: "UPDATE banco SET monedas = ?, ultimo_interes = ? WHERE user_id = ?",
                    args: [monedas_banco, Date.now(), targetUser.id]
                });
            }
        }

        // 3. Validar existencia del usuario en la base de datos
        if (userResult.rows.length === 0) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("💰 Ay, corazoncito!")
                .setDescription(
                    esPropioBalance
                        ? `${bostezo}Todavía no tienes registradas moneditas... ¡Sal a pasear por el pueblito escribiendo unos mensajitos en el chat!`
                        : `Parece que **${targetUser.username}** no ha salido de su casita todavía y no tiene moneditas registradas.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // 4. Procesar datos del usuario
        const userData = userResult.rows[0];
        const monedas = Number(userData.monedas || 0);
        const nivel = Number(userData.nivel || 1);
        const xp = Number(userData.xp || 0);
        const posicionRanking = Number(rankingResult.rows[0]?.posicion || 0);

        // 5. Construir embed con información clara
        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setAuthor({
                name: esPropioBalance ? "Tu Balance" : `Balance de ${targetUser.username}`,
                iconURL: targetUser.displayAvatarURL({ dynamic: true })
            })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }));

        // Información principal
        embed.addFields(
            {
                name: "💰 Bolsillo",
                value: `\`\`\`diff\n+ ${formatNumber(monedas)} 🪙\`\`\``,
                inline: true
            },
            {
                name: "🏦 Banco",
                value: `\`\`\`diff\n+ ${formatNumber(monedas_banco)} 🪙\`\`\``,
                inline: true
            },
            {
                name: "📊 Ranking",
                value: `\`\`\`yaml\n#${posicionRanking}\`\`\``,
                inline: true
            },
            {
                name: "⭐ Nivel",
                value: `\`\`\`fix\nNivel ${nivel}\`\`\``,
                inline: true
            },
            {
                name: "💎 Total",
                value: `\`\`\`diff\n+ ${formatNumber(monedas + monedas_banco)} 🪙\`\`\``,
                inline: true
            }
        );

        // Título económico (igual que en /perfil)
        let tituloEconomico = "Mendigo del Pueblito";
        if (monedas >= 10000) tituloEconomico = "Mente Maestra de Wall Street";
        else if (monedas >= 5000) tituloEconomico = "Magnate Comercial";
        else if (monedas >= 1000) tituloEconomico = "Comerciante Local";
        else if (monedas >= 200) tituloEconomico = "Ahorrador Acérrimo";

        embed.addFields({
            name: "💼 Título Económico",
            value: `*${tituloEconomico}*`,
            inline: false
        });

        // Sugerencias personalizadas de Annie
        const sugerencias = [];
        if (esPropioBalance) {
            if (monedas < 100) {
                sugerencias.push("💡 Usa `/minar`, `/pescar` o `/talar` para ganar moneditas");
            } else if (monedas >= 500) {
                sugerencias.push("🛒 Visita la `/tienda` para comprar cositas lindas");
            }
        }

        if (sugerencias.length > 0) {
            embed.setDescription(sugerencias.join("\n"));
        }

        return interaction.editReply({
            content: bostezo,
            embeds: [embed]
        });

    } catch (error) {
        console.error("Error en comando balance:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ Ay no!")
            .setDescription(
                "Annie se enredó con los números y no pudo revisar las moneditas. " +
                "Intenta de nuevo en un ratito, tesoro."
            );
        return interaction.editReply({ embeds: [embed] });
    }
}
