import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { registrarBitacora } from "../../features/progreso.js";

const TASA_INTERES_DIARIA = 0.02; // 2% diario
const MS_DIA = 24 * 60 * 60 * 1000;

// Aplica el interés acumulado desde la última vez que se accedió al banco
async function aplicarIntereses(userId) {
    const res = await db.execute({
        sql: "SELECT monedas, ultimo_interes FROM banco WHERE user_id = ?",
        args: [userId]
    });

    if (res.rows.length === 0) return { monedas: 0, interesGanado: 0, diasPasados: 0 };

    const monedas = Number(res.rows[0].monedas);
    const ultimoInteres = Number(res.rows[0].ultimo_interes);
    const ahora = Date.now();

    if (monedas <= 0 || ultimoInteres === 0) {
        await db.execute({ sql: "UPDATE banco SET ultimo_interes = ? WHERE user_id = ?", args: [ahora, userId] });
        return { monedas, interesGanado: 0, diasPasados: 0 };
    }

    const msPasados = ahora - ultimoInteres;
    const diasPasados = Math.floor(msPasados / MS_DIA);

    if (diasPasados === 0) return { monedas, interesGanado: 0, diasPasados: 0 };

    const nuevoSaldo = Math.floor(monedas * Math.pow(1 + TASA_INTERES_DIARIA, diasPasados));
    const interesGanado = nuevoSaldo - monedas;

    await db.execute({
        sql: "UPDATE banco SET monedas = ?, ultimo_interes = ? WHERE user_id = ?",
        args: [nuevoSaldo, ahora, userId]
    });

    return { monedas: nuevoSaldo, interesGanado, diasPasados };
}

export const data = new SlashCommandBuilder()
    .setName("banco")
    .setDescription("Gestiona tus ahorros en el Banco del Pueblito. Ganás 2% de interés diario.")
    .addSubcommand(sub => sub
        .setName("depositar")
        .setDescription("Deposita moneditas en el banco (ganan 2% al día).")
        .addIntegerOption(o => o.setName("cantidad").setDescription("¿Cuántas moneditas depositar?").setMinValue(1).setRequired(true))
    )
    .addSubcommand(sub => sub
        .setName("retirar")
        .setDescription("Retira moneditas de tu cuenta bancaria.")
        .addIntegerOption(o => o.setName("cantidad").setDescription("¿Cuántas moneditas retirar?").setMinValue(1).setRequired(true))
    )
    .addSubcommand(sub => sub
        .setName("balance")
        .setDescription("Consulta el saldo de tu cuenta bancaria y los intereses acumulados.")
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const subcomando = interaction.options.getSubcommand();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        await db.execute({
            sql: `INSERT OR IGNORE INTO banco (user_id, monedas, ultimo_interes) VALUES (?, 0, ?)`,
            args: [userId, Date.now()]
        });

        if (subcomando === "balance") {
            const { monedas, interesGanado, diasPasados } = await aplicarIntereses(userId);
            const resWallet = await db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [userId] });
            const monedaWallet = Number(resWallet.rows[0]?.monedas ?? 0);

            const embed = crearEmbed(CONFIG.COLORES.AZUL)
                .setTitle("🏦 Banco del Pueblito")
                .setDescription(
                    `${bostezo}Aquí tienes el estado de tu cuenta bancaria, corazoncito. ¡Tus ahorros están seguridísimos!`
                )
                .addFields(
                    {
                        name: "💰 En tu bolsillo",
                        value: `**${monedaWallet.toLocaleString()} 🪙**`,
                        inline: true
                    },
                    {
                        name: "🏛️ En el banco",
                        value: `**${monedas.toLocaleString()} 🪙**`,
                        inline: true
                    },
                    {
                        name: "📈 Tasa de interés",
                        value: "**2% diario** (compuesto)",
                        inline: true
                    }
                );

            if (interesGanado > 0) {
                embed.addFields({
                    name: `✨ ¡Intereses ganados en ${diasPasados} día(s)!`,
                    value: `Mientras dormías, tus moneditas trabajaron solas. Ganaste **+${interesGanado.toLocaleString()} 🪙**.`,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: "💡 Consejo de Annie",
                    value: "¡Deposita más moneditas para que el interés trabaje por ti! El interés compuesto se aplica cada 24h.",
                    inline: false
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcomando === "depositar") {
            const cantidad = interaction.options.getInteger("cantidad");

            const resWallet = await db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [userId] });
            const monedaWallet = Number(resWallet.rows[0]?.monedas ?? 0);

            if (monedaWallet < cantidad) {
                const embed = crearEmbed(CONFIG.COLORES.ROJO)
                    .setTitle("❌ Sin fondos suficientes")
                    .setDescription(
                        `${bostezo}Solo tienes **${monedaWallet.toLocaleString()} moneditas** en el bolsillo. ¡No alcanza para depositar ${cantidad.toLocaleString()}!`
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            await aplicarIntereses(userId);

            await db.execute({ sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?", args: [cantidad, userId] });
            await db.execute({ sql: "UPDATE banco SET monedas = monedas + ?, ultimo_interes = COALESCE(NULLIF(ultimo_interes, 0), ?) WHERE user_id = ?", args: [cantidad, Date.now(), userId] });

            const resBanco = await db.execute({ sql: "SELECT monedas FROM banco WHERE user_id = ?", args: [userId] });
            const nuevoSaldo = Number(resBanco.rows[0]?.monedas ?? 0);

            await registrarBitacora(userId, `Depositó ${cantidad} moneditas en el banco`);

            const embed = crearEmbed(CONFIG.COLORES.AZUL)
                .setTitle("📥 ¡Depósito exitoso!")
                .setDescription(
                    `${bostezo}¡Listo, corazoncito! Tus moneditas ya están guardaditas y empezarán a crecer con el interés.`
                )
                .addFields(
                    {
                        name: "📥 Depositado",
                        value: `**+${cantidad.toLocaleString()} 🪙**`,
                        inline: true
                    },
                    {
                        name: "🏛️ Nuevo saldo en banco",
                        value: `**${nuevoSaldo.toLocaleString()} 🪙**`,
                        inline: true
                    },
                    {
                        name: "📈 Interés activo",
                        value: "**2% diario compuesto** — ¡tus monedas trabajarán solas!",
                        inline: false
                    }
                );

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcomando === "retirar") {
            const cantidad = interaction.options.getInteger("cantidad");

            const { monedas: saldoConInteres } = await aplicarIntereses(userId);

            if (saldoConInteres < cantidad) {
                const embed = crearEmbed(CONFIG.COLORES.ROJO)
                    .setTitle("❌ Saldo insuficiente")
                    .setDescription(
                        `${bostezo}Solo tienes **${saldoConInteres.toLocaleString()} moneditas** en el banco. No puedes retirar más de lo que tienes.`
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            await db.execute({ sql: "UPDATE banco SET monedas = monedas - ? WHERE user_id = ?", args: [cantidad, userId] });
            await db.execute({ sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?", args: [cantidad, userId] });

            const resBanco = await db.execute({ sql: "SELECT monedas FROM banco WHERE user_id = ?", args: [userId] });
            const saldoRestante = Number(resBanco.rows[0]?.monedas ?? 0);

            await registrarBitacora(userId, `Retiró ${cantidad} moneditas del banco`);

            const embed = crearEmbed(CONFIG.COLORES.VERDE)
                .setTitle("📤 ¡Retiro exitoso!")
                .setDescription(
                    `${bostezo}¡Aquí tienes tus moneditas, corazón! Recuerda guardar algo en el banco para que sigan creciendo. 😊`
                )
                .addFields(
                    {
                        name: "📤 Retirado al bolsillo",
                        value: `**+${cantidad.toLocaleString()} 🪙**`,
                        inline: true
                    },
                    {
                        name: "🏛️ Saldo restante en banco",
                        value: `**${saldoRestante.toLocaleString()} 🪙**`,
                        inline: true
                    }
                );

            return interaction.editReply({ embeds: [embed] });
        }

    } catch (e) {
        console.error("Error en /banco:", e);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Problemas en el banco!")
            .setDescription(`${bostezo}El banco tuvo un problemita técnico. ¡Tus moneditas están seguras, no te preocupes!`);
        return interaction.editReply({ embeds: [embed] });
    }
}
