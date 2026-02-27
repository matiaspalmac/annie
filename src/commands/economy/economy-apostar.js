import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { registrarBitacora, registrarEstadistica } from "../../features/progreso.js";

const COOLDOWN_APOSTAR = 5 * 60 * 1000; // 5 minutos
const duelos = new Map();  // duelId → challenge data

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

    if (target.id === userId) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🤭 ¡Tramposo!")
            .setDescription(`${bostezo}No puedes apostar contra ti mismo... ¡busca un rival de verdad en el pueblito!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (target.bot) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🤖 Los bots no apuestan")
            .setDescription(`${bostezo}Los bots no tienen bolsillos, corazón. ¡Reta a un vecino de carne y hueso!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Verificar cooldown
    const resCd = await db.execute({
        sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'apostar' AND extra_id = 'global'",
        args: [userId]
    });

    if (resCd.rows.length > 0 && Date.now() < Number(resCd.rows[0].fecha_limite)) {
        const min = Math.ceil((Number(resCd.rows[0].fecha_limite) - Date.now()) / 60000);
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("⏳ ¡Calma, retador!")
            .setDescription(`${bostezo}Espera **${min} minuto(s)** antes de volver a retar a alguien. ¡El casino necesita descanso!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Verificar saldo
    const [resA, resB] = await Promise.all([
        db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [userId] }),
        db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [target.id] }),
    ]);

    const monedasA = Number(resA.rows[0]?.monedas ?? 0);
    const monedasB = Number(resB.rows[0]?.monedas ?? 0);

    if (monedasA < apuesta) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("💸 ¡Sin fondos!")
            .setDescription(`${bostezo}Solo tienes **${monedasA.toLocaleString()} 🪙** y la apuesta es **${apuesta.toLocaleString()}**. ¡Necesitas más moneditas!`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (monedasB < apuesta) {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("💸 ¡Tu rival no tiene suficiente!")
            .setDescription(`${bostezo}<@${target.id}> solo tiene **${monedasB.toLocaleString()} 🪙** y no puede cubrir la apuesta de **${apuesta.toLocaleString()}**.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const duelId = `duel_${userId}_${target.id}_${Date.now()}`;
    const juegoLabel = juego === "ppt" ? "Piedra Papel Tijera ✂️" : "Cara o Cruz 🪙";
    const timeout = 3 * 60 * 1000;

    let row;
    if (juego === "moneda") {
        row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`apostar_accept_${duelId}`).setLabel("✅ ¡Acepto el duelo!").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`apostar_reject_${duelId}`).setLabel("❌ Soy cobarde, huyo").setStyle(ButtonStyle.Danger),
        );
    } else {
        row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`apostar_ppt_piedra_${duelId}`).setLabel("🪨 Piedra").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`apostar_ppt_papel_${duelId}`).setLabel("📄 Papel").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`apostar_ppt_tijera_${duelId}`).setLabel("✂️ Tijera").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`apostar_reject_${duelId}`).setLabel("❌ Rechazar").setStyle(ButtonStyle.Danger),
        );
    }

    duelos.set(duelId, { retador: userId, retado: target.id, apuesta, juego, retadorUsername: interaction.user.username, retadoUsername: target.username });
    setTimeout(() => duelos.delete(duelId), timeout);

    // Embed de invitación al duelo
    const embedInvitacion = crearEmbed(CONFIG.COLORES.CASINO)
        .setTitle(`⚔️ ¡DESAFÍO DE MONEDITAS!`)
        .setDescription(
            `<@${userId}> reta a <@${target.id}> a un duelo de **${juegoLabel}**.\n\n` +
            `*<@${target.id}>, tienes **3 minutos** para responder al desafío.*`
        )
        .addFields(
            { name: "💰 Apuesta", value: `**${apuesta.toLocaleString()} 🪙** cada uno`, inline: true },
            { name: "🏆 Premio total", value: `**${(apuesta * 2).toLocaleString()} 🪙** para el ganador`, inline: true },
            { name: "🎮 Juego", value: juegoLabel, inline: true }
        );

    await interaction.reply({ embeds: [embedInvitacion], components: [row] });

    const filter = i => i.customId.includes(duelId) && i.user.id === target.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: timeout, max: 1 });

    collector.on("collect", async i => {
        const duel = duelos.get(duelId);
        if (!duel) return i.reply({ content: "Este duelo ya expiró.", flags: MessageFlags.Ephemeral });
        duelos.delete(duelId);

        if (i.customId.includes("reject")) {
            const embedRechazado = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle("😤 ¡El cobarde huyó!")
                .setDescription(
                    `<@${target.id}> huyó del duelo con la cola entre las piernas...\n\n` +
                    `El honor de <@${userId}> prevalece sobre los campos del pueblito. 🏅`
                );
            return i.reply({ embeds: [embedRechazado] });
        }

        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) VALUES (?, 'apostar', 'global', ?)
                  ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, Date.now() + COOLDOWN_APOSTAR]
        });

        let ganadorId, perdedorId, resultadoTexto;

        if (juego === "moneda") {
            const retadorGana = Math.random() < 0.5;
            const resultado = retadorGana ? "Cara" : "Cruz";
            ganadorId = retadorGana ? duel.retador : duel.retado;
            perdedorId = retadorGana ? duel.retado : duel.retador;
            resultadoTexto = `🪙 La moneda cayó en **${resultado}**.`;
        } else {
            const opciones = ["piedra", "papel", "tijera"];
            const elegidoRetadoRaw = i.customId.includes("piedra") ? "piedra" : i.customId.includes("papel") ? "papel" : "tijera";
            const elegidoRetador = opciones[Math.floor(Math.random() * 3)];
            const emojis = { piedra: "🪨", papel: "📄", tijera: "✂️" };

            let resultado;
            if (elegidoRetador === elegidoRetadoRaw) resultado = "empate";
            else if (
                (elegidoRetador === "piedra" && elegidoRetadoRaw === "tijera") ||
                (elegidoRetador === "papel" && elegidoRetadoRaw === "piedra") ||
                (elegidoRetador === "tijera" && elegidoRetadoRaw === "papel")
            ) resultado = "retador";
            else resultado = "retado";

            if (resultado === "empate") {
                const embedEmpate = crearEmbed(CONFIG.COLORES.CIELO)
                    .setTitle("🤝 ¡¡EMPATE!!")
                    .setDescription(
                        `<@${duel.retador}> eligió ${emojis[elegidoRetador]} y <@${duel.retado}> eligió ${emojis[elegidoRetadoRaw]}.\n\n` +
                        `¡Nadie gana, nadie pierde! Las moneditas quedan en sus bolsillos. ¡Qué equilibrio tan dramático!`
                    )
                    .addFields(
                        { name: `${emojis[elegidoRetador]} <@${duel.retador}>`, value: `\`${elegidoRetador}\``, inline: true },
                        { name: `${emojis[elegidoRetadoRaw]} <@${duel.retado}>`, value: `\`${elegidoRetadoRaw}\``, inline: true },
                    );
                return i.reply({ embeds: [embedEmpate] });
            }

            ganadorId = resultado === "retador" ? duel.retador : duel.retado;
            perdedorId = resultado === "retador" ? duel.retado : duel.retador;
            resultadoTexto = `<@${duel.retador}> eligió ${emojis[elegidoRetador]}, <@${duel.retado}> eligió ${emojis[elegidoRetadoRaw]}.`;
        }

        await db.execute({ sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?", args: [apuesta, ganadorId] });
        await db.execute({ sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?", args: [apuesta, perdedorId] });

        await registrarBitacora(ganadorId, `Ganó un duelo de ${juegoLabel} y se llevó ${duel.apuesta * 2} moneditas`);
        await registrarBitacora(perdedorId, `Perdió un duelo de ${juegoLabel} y le quitaron ${duel.apuesta} moneditas`);
        await registrarEstadistica(ganadorId, "duelos_ganados", 1, i);
        await registrarEstadistica(perdedorId, "duelos_perdidos", 1, i);

        const embedFinal = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("⚔️ ¡¡DUELO TERMINADO!!")
            .setDescription(
                `${resultadoTexto}\n\n` +
                `🏆 <@${ganadorId}> **¡GANÓ EL DUELO!**\n` +
                `😢 <@${perdedorId}> perdió y se va con las manos vacías.\n\n` +
                `*¡Que no te lo tome personal, mi cielo! Todos los días hay una nueva oportunidad.*`
            )
            .addFields(
                { name: "🏆 Premio ganado", value: `**+${duel.apuesta.toLocaleString()} 🪙** → <@${ganadorId}>`, inline: false },
                { name: "📉 Monedas perdidas", value: `**-${duel.apuesta.toLocaleString()} 🪙** → <@${perdedorId}>`, inline: false },
            );

        return i.reply({ embeds: [embedFinal] });
    });

    collector.on("end", (_, reason) => {
        if (reason === "time") duelos.delete(duelId);
    });
}
