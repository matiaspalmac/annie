import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { registrarBitacora } from "../../features/progreso.js";

const TASA_INTERES_DIARIA = 0.02; // 2% diario
const MS_DIA = 24 * 60 * 60 * 1000;
const MAX_DEPOSITO_DIA = 50_000; // límite de depósito por día

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

    // Interés compuesto: (1 + 0.02)^días × capital
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
        // Asegurar que el usuario tiene cuenta bancaria
        await db.execute({
            sql: `INSERT OR IGNORE INTO banco (user_id, monedas, ultimo_interes) VALUES (?, 0, ?)`,
            args: [userId, Date.now()]
        });

        if (subcomando === "balance") {
            const { monedas, interesGanado, diasPasados } = await aplicarIntereses(userId);

            const resWallet = await db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [userId] });
            const monedaWallet = Number(resWallet.rows[0]?.monedas ?? 0);

            let interesTexto = "";
            if (interesGanado > 0) {
                interesTexto = `\n\n✨ *¡Mientras dormías, tus moneditas trabajaron por ti! Ganaste **+${interesGanado} moneditas** de interés en ${diasPasados} día(s).*`;
            }

            return interaction.followUp(
                `🏦 **Tu Cuenta en el Banco del Pueblito**\n\n` +
                `💰 En tu bolsillo: **${monedaWallet.toLocaleString()} moneditas**\n` +
                `🏛️ En el banco: **${monedas.toLocaleString()} moneditas**\n` +
                `📈 Tasa de interés: **2% diario** (compuesto)\n` +
                interesTexto
            );
        }

        if (subcomando === "depositar") {
            const cantidad = interaction.options.getInteger("cantidad");

            const resWallet = await db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [userId] });
            const monedaWallet = Number(resWallet.rows[0]?.monedas ?? 0);

            if (monedaWallet < cantidad) {
                return interaction.followUp(`${bostezo}No tienes **${cantidad} moneditas** en el bolsillo (solo tienes ${monedaWallet}).`);
            }

            // Aplicar intereses antes de depositar
            await aplicarIntereses(userId);

            // Transferir
            await db.execute({ sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?", args: [cantidad, userId] });
            await db.execute({ sql: "UPDATE banco SET monedas = monedas + ?, ultimo_interes = COALESCE(NULLIF(ultimo_interes, 0), ?) WHERE user_id = ?", args: [cantidad, Date.now(), userId] });

            const resBanco = await db.execute({ sql: "SELECT monedas FROM banco WHERE user_id = ?", args: [userId] });
            const nuevoSaldo = Number(resBanco.rows[0]?.monedas ?? 0);

            await registrarBitacora(userId, `Depositó ${cantidad} moneditas en el banco`);

            return interaction.followUp(
                `🏦 **¡Depósito exitoso!**\n\n` +
                `📥 Depositaste: **${cantidad.toLocaleString()} moneditas**\n` +
                `🏛️ Nuevo saldo bancario: **${nuevoSaldo.toLocaleString()} moneditas**\n\n` +
                `📈 *Tu dinero ya está generando **2% de interés diario**. ¡Ahorra más para ganar más!*`
            );
        }

        if (subcomando === "retirar") {
            const cantidad = interaction.options.getInteger("cantidad");

            // Aplicar intereses antes de retirar
            const { monedas: saldoConInteres } = await aplicarIntereses(userId);

            if (saldoConInteres < cantidad) {
                return interaction.followUp(`${bostezo}Solo tienes **${saldoConInteres.toLocaleString()} moneditas** en el banco.`);
            }

            await db.execute({ sql: "UPDATE banco SET monedas = monedas - ? WHERE user_id = ?", args: [cantidad, userId] });
            await db.execute({ sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?", args: [cantidad, userId] });

            const resBanco = await db.execute({ sql: "SELECT monedas FROM banco WHERE user_id = ?", args: [userId] });
            const saldoRestante = Number(resBanco.rows[0]?.monedas ?? 0);

            await registrarBitacora(userId, `Retiró ${cantidad} moneditas del banco`);

            return interaction.followUp(
                `🏦 **¡Retiro exitoso!**\n\n` +
                `📤 Retiraste: **${cantidad.toLocaleString()} moneditas** a tu bolsillo\n` +
                `🏛️ Saldo restante en banco: **${saldoRestante.toLocaleString()} moneditas**`
            );
        }

    } catch (e) {
        console.error("Error en /banco:", e);
        return interaction.followUp(`${bostezo}El banco tuvo un problemita técnico. ¡Tus moneditas están seguras, no te preocupes!`);
    }
}
