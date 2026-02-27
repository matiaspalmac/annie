import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { registrarBitacora, registrarEstadistica } from "../../features/progreso.js";

const COOLDOWN_APOSTAR = 5 * 60 * 1000; // 5 minutos
const duelos = new Map(); // duelId → challenge data

export const data = new SlashCommandBuilder()
    .setName("apostar")
    .setDescription("Desafía a un vecino a un duelo de azar por moneditas. ¡Que gane el más suertudo!")
    .addUserOption(o => o.setName("vecino").setDescription("Tu rival en este duelo épico").setRequired(true))
    .addIntegerOption(o => o.setName("apuesta").setDescription("¿Cuántas moneditas? (mín. 10)").setMinValue(10).setRequired(true))
    .addStringOption(o => o
        .setName("juego")
        .setDescription("¿A qué juegan?")
        .addChoices(
            { name: "🪙 Cara o Cruz", value: "moneda" },
            { name: "✂️ Piedra, Papel o Tijera", value: "ppt" },
        )
        .setRequired(false)
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const target = interaction.options.getUser("vecino");
    const apuesta = interaction.options.getInteger("apuesta");
    const juego = interaction.options.getString("juego") || "moneda";

    if (target.id === userId) return interaction.reply({ content: `${bostezo}No puedes apostar contra ti mismo, tramposo(a)!`, flags: MessageFlags.Ephemeral });
    if (target.bot) return interaction.reply({ content: `${bostezo}Los bots no apuestan. ¡No tienen bolsillos!`, flags: MessageFlags.Ephemeral });

    // Verificar cooldown
    const resCd = await db.execute({ sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'apostar' AND extra_id = 'global'", args: [userId] });
    if (resCd.rows.length > 0 && Date.now() < Number(resCd.rows[0].fecha_limite)) {
        const min = Math.ceil((Number(resCd.rows[0].fecha_limite) - Date.now()) / 60000);
        return interaction.reply({ content: `${bostezo}Espera **${min} minuto(s)** antes de volver a retar a alguien.`, flags: MessageFlags.Ephemeral });
    }

    // Verificar saldo de ambos
    const [resA, resB] = await Promise.all([
        db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [userId] }),
        db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [target.id] }),
    ]);

    const monedasA = Number(resA.rows[0]?.monedas ?? 0);
    const monedasB = Number(resB.rows[0]?.monedas ?? 0);

    if (monedasA < apuesta) return interaction.reply({ content: `${bostezo}No tienes suficientes moneditas (tienes **${monedasA}**, apuestas **${apuesta}**).`, flags: MessageFlags.Ephemeral });
    if (monedasB < apuesta) return interaction.reply({ content: `${bostezo}<@${target.id}> no tiene suficientes moneditas para aceptar este duelo (tiene **${monedasB}**).`, flags: MessageFlags.Ephemeral });

    const duelId = `duel_${userId}_${target.id}_${Date.now()}`;

    const juegoLabel = juego === "ppt" ? "Piedra Papel Tijera ✂️" : "Cara o Cruz 🪙";
    const timeout = 3 * 60 * 1000;

    let row;
    if (juego === "moneda") {
        row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`apostar_accept_${duelId}`).setLabel("✅ ¡Acepto el duelo!").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`apostar_reject_${duelId}`).setLabel("❌ Cobarde huyo").setStyle(ButtonStyle.Danger),
        );
    } else {
        row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`apostar_ppt_piedra_${duelId}`).setLabel("🪨 Piedra").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`apostar_ppt_papel_${duelId}`).setLabel("📄 Papel").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`apostar_ppt_tijera_${duelId}`).setLabel("✂️ Tijera").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`apostar_reject_${duelId}`).setLabel("Rechazar").setStyle(ButtonStyle.Danger),
        );
    }

    duelos.set(duelId, { retador: userId, retado: target.id, apuesta, juego, retadorUsername: interaction.user.username, retadoUsername: target.username });
    setTimeout(() => duelos.delete(duelId), timeout);

    await interaction.reply({
        content: `⚔️ **¡¡DUELO DE MONEDITAS!!**\n\n` +
            `<@${userId}> reta a <@${target.id}> a **${juegoLabel}**\n` +
            `💰 **En juego:** ${apuesta} moneditas de cada uno (¡el ganador se lleva ${apuesta * 2}!)\n\n` +
            `*<@${target.id}>, tienes 3 minutos para responder.*`,
        components: [row]
    });

    const filter = i => i.customId.includes(duelId) && i.user.id === target.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: timeout, max: 1 });

    collector.on("collect", async i => {
        const duel = duelos.get(duelId);
        if (!duel) return i.reply({ content: "Este duelo ya expiró.", flags: MessageFlags.Ephemeral });
        duelos.delete(duelId);

        if (i.customId.includes("reject")) {
            return i.reply(`😤 <@${target.id}> huyó del duelo como un cobardito. ¡El honor de <@${userId}> prevalece!`);
        }

        await db.execute({ sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) VALUES (?, 'apostar', 'global', ?) ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`, args: [userId, Date.now() + COOLDOWN_APOSTAR] });

        let ganadorId, perdedorId, resultadoTexto;

        if (juego === "moneda") {
            const resultado = Math.random() < 0.5 ? "cara" : "cruz";
            const retadorGana = Math.random() < 0.5; // el retador eligió al azar internamente
            ganadorId = retadorGana ? duel.retador : duel.retado;
            perdedorId = retadorGana ? duel.retado : duel.retador;
            resultadoTexto = `🪙 La moneda cayó en **${resultado}**. `;
        } else {
            // PPT: el retador ya apostó al azar al crear el duelo, el retado eligió
            const opciones = ["piedra", "papel", "tijera"];
            const elegidoRetadoRaw = i.customId.includes("piedra") ? "piedra" : i.customId.includes("papel") ? "papel" : "tijera";
            const elegidoRetadorIdx = Math.floor(Math.random() * 3);
            const elegidoRetador = opciones[elegidoRetadorIdx];
            const emojis = { piedra: "🪨", papel: "📄", tijera: "✂️" };

            let resultado;
            if (elegidoRetador === elegidoRetadoRaw) resultado = "empate";
            else if ((elegidoRetador === "piedra" && elegidoRetadoRaw === "tijera") ||
                (elegidoRetador === "papel" && elegidoRetadoRaw === "piedra") ||
                (elegidoRetador === "tijera" && elegidoRetadoRaw === "papel")) resultado = "retador";
            else resultado = "retado";

            if (resultado === "empate") {
                return i.reply(
                    `🤝 **¡¡EMPATE!!**\n\n` +
                    `<@${duel.retador}> eligió ${emojis[elegidoRetador]} y <@${duel.retado}> eligió ${emojis[elegidoRetadoRaw]}.\n` +
                    `¡Nadie gana, nadie pierde! Las moneditas quedan en sus bolsillos.`
                );
            }
            ganadorId = resultado === "retador" ? duel.retador : duel.retado;
            perdedorId = resultado === "retador" ? duel.retado : duel.retador;
            resultadoTexto = `✂️ <@${duel.retador}> eligió ${emojis[elegidoRetador]}, <@${duel.retado}> eligió ${emojis[elegidoRetadoRaw]}. `;
        }

        await db.execute({ sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?", args: [apuesta, ganadorId] });
        await db.execute({ sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?", args: [apuesta, perdedorId] });

        await registrarBitacora(ganadorId, `Ganó un duelo de ${juegoLabel} y se llevó ${duel.apuesta * 2} moneditas`);
        await registrarBitacora(perdedorId, `Perdió un duelo de ${juegoLabel} y le quitaron ${duel.apuesta} moneditas`);
        await registrarEstadistica(ganadorId, "duelos_ganados", 1, i);
        await registrarEstadistica(perdedorId, "duelos_perdidos", 1, i);

        return i.reply(
            `⚔️ **¡¡FIN DEL DUELO!!**\n\n` +
            resultadoTexto +
            `**🏆 <@${ganadorId}> gana ${duel.apuesta * 2} moneditas!**\n` +
            `😢 <@${perdedorId}> pierde ${duel.apuesta} moneditas.\n\n` +
            `*¡Que no te lo tome personal, mi cielo!*`
        );
    });

    collector.on("end", (_, reason) => {
        if (reason === "time") duelos.delete(duelId);
    });
}
