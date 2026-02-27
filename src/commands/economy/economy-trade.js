import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { registrarBitacora } from "../../features/progreso.js";

const tradesPendientes = new Map();
const TRADE_TIMEOUT = 5 * 60 * 1000;

export const data = new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Propone un intercambio de ítems con otro vecino del pueblito.")
    .addUserOption(o => o.setName("vecino").setDescription("El vecino con quien intercambiar").setRequired(true))
    .addStringOption(o => o.setName("ofreces").setDescription("¿Qué ofreces? (ej: Pescado x3, Manzanas x5)").setRequired(true))
    .addStringOption(o => o.setName("pides").setDescription("¿Qué pides a cambio? (ej: Trucha Arcoíris x1)").setRequired(true));

function parsearItems(texto) {
    const partes = texto.split(",").map(s => s.trim());
    const resultado = [];
    for (const p of partes) {
        const match = p.match(/^(.+?)\s+x(\d+)$/i);
        if (match) resultado.push({ item: match[1].trim(), cantidad: parseInt(match[2]) });
        else resultado.push({ item: p, cantidad: 1 });
    }
    return resultado;
}

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser("vecino");
    const ofrecesStr = interaction.options.getString("ofreces");
    const pidesStr = interaction.options.getString("pides");

    if (targetUser.id === userId) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🤭 ¡Tontillo(a)!")
            .setDescription(`${bostezo}¡No puedes intercambiar contigo mismo! Busca un vecino real, corazón.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    if (targetUser.bot) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("🤖 Los bots no negocian")
            .setDescription(`${bostezo}Los bots no tienen mochila, no pueden intercambiar nada en el mercado de pulgas.`);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const ofreces = parsearItems(ofrecesStr);
    const pides = parsearItems(pidesStr);

    // Verificar inventario del ofertante
    for (const { item, cantidad } of ofreces) {
        const res = await db.execute({
            sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
            args: [userId, item]
        });
        const enInventario = Number(res.rows[0]?.cantidad || 0);
        if (enInventario < cantidad) {
            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("❌ ¡Inventario insuficiente!")
                .setDescription(`${bostezo}No tienes suficientes **${item}** en tu mochila.`)
                .addFields(
                    { name: "📦 Tienes", value: `**${enInventario}**`, inline: true },
                    { name: "📤 Ofreces", value: `**${cantidad}**`, inline: true }
                );
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }

    const tradeId = `trade_${userId}_${targetUser.id}_${Date.now()}`;
    tradesPendientes.set(tradeId, {
        de: userId, para: targetUser.id, ofreces, pides,
        ts: Date.now(), deUsername: interaction.user.username, paraUsername: targetUser.username
    });
    setTimeout(() => tradesPendientes.delete(tradeId), TRADE_TIMEOUT);

    const ofrecesTexto = ofreces.map(o => `**${o.item}** x${o.cantidad}`).join(", ");
    const pidesTexto = pides.map(p => `**${p.item}** x${p.cantidad}`).join(", ");

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`trade_accept_${tradeId}`).setLabel("✅ ¡Acepto el Trato!").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`trade_reject_${tradeId}`).setLabel("❌ Rechazar").setStyle(ButtonStyle.Danger)
    );

    const embedPropuesta = crearEmbed(CONFIG.COLORES.CIELO)
        .setTitle("🤝 ¡Propuesta de Mercado de Pulgas!")
        .setDescription(
            `<@${userId}> le propone un intercambio a <@${targetUser.id}>.\n\n` +
            `*<@${targetUser.id}>, tienes **5 minutos** para aceptar o rechazar el trato.*`
        )
        .addFields(
            { name: "📤 Ellos ofrecen", value: ofrecesTexto, inline: false },
            { name: "📥 Piden a cambio", value: pidesTexto, inline: false }
        );

    await interaction.reply({ embeds: [embedPropuesta], components: [row] });

    const filter = i => (i.customId.startsWith("trade_accept_") || i.customId.startsWith("trade_reject_")) && i.user.id === targetUser.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: TRADE_TIMEOUT });

    collector.on("collect", async i => {
        collector.stop();
        const trade = tradesPendientes.get(tradeId);
        if (!trade) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("⏰ Propuesta expirada")
                .setDescription("Esta propuesta de intercambio ya expiró.");
            return i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (i.customId.startsWith("trade_reject_")) {
            tradesPendientes.delete(tradeId);
            const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle("❌ ¡Trato rechazado!")
                .setDescription(
                    `<@${targetUser.id}> rechazó el trato. ¡Quizás la próxima vez puedas llegar a un acuerdo mejor!`
                );
            return i.reply({ embeds: [embed] });
        }

        // Verificar que los ítems siguen disponibles
        for (const { item, cantidad } of trade.ofreces) {
            const res = await db.execute({ sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?", args: [trade.de, item] });
            if (Number(res.rows[0]?.cantidad || 0) < cantidad) {
                tradesPendientes.delete(tradeId);
                const embed = crearEmbed(CONFIG.COLORES.ROJO)
                    .setTitle("❌ ¡Trato inválido!")
                    .setDescription(`<@${trade.de}> ya no tiene suficientes **${item}**. ¡Que cumpla sus promesas!`);
                return i.reply({ embeds: [embed] });
            }
        }
        for (const { item, cantidad } of trade.pides) {
            const res = await db.execute({ sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?", args: [trade.para, item] });
            if (Number(res.rows[0]?.cantidad || 0) < cantidad) {
                tradesPendientes.delete(tradeId);
                const embed = crearEmbed(CONFIG.COLORES.ROJO)
                    .setTitle("❌ ¡Trato inválido!")
                    .setDescription(`<@${trade.para}> ya no tiene suficientes **${item}** para completar el trato.`);
                return i.reply({ embeds: [embed] });
            }
        }

        // Ejecutar el intercambio
        for (const { item, cantidad } of trade.ofreces) {
            await db.execute({ sql: "UPDATE inventario_economia SET cantidad = cantidad - ? WHERE user_id = ? AND item_id = ?", args: [cantidad, trade.de, item] });
            await db.execute({ sql: "INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?", args: [trade.para, item, cantidad, cantidad] });
        }
        for (const { item, cantidad } of trade.pides) {
            await db.execute({ sql: "UPDATE inventario_economia SET cantidad = cantidad - ? WHERE user_id = ? AND item_id = ?", args: [cantidad, trade.para, item] });
            await db.execute({ sql: "INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?", args: [trade.de, item, cantidad, cantidad] });
        }

        tradesPendientes.delete(tradeId);
        const ofrecesT2 = trade.ofreces.map(o => `${o.item} x${o.cantidad}`).join(", ");
        const pidesT2 = trade.pides.map(p => `${p.item} x${p.cantidad}`).join(", ");

        await registrarBitacora(trade.de, `Intercambio con ${trade.paraUsername}: entregó ${ofrecesT2}`);
        await registrarBitacora(trade.para, `Intercambio con ${trade.deUsername}: recibió ${ofrecesT2}`);

        const embedFin = crearEmbed(CONFIG.COLORES.VERDE)
            .setTitle("🤝 ¡¡TRATO CERRADO!!")
            .setDescription(`¡Un intercambio justo entre buenos vecinos del pueblito! *Annie aplaudió desde su ventanita.* ✨`)
            .addFields(
                { name: `📤 <@${trade.de}> entregó`, value: ofrecesT2, inline: false },
                { name: `📥 <@${trade.para}> entregó`, value: pidesT2, inline: false }
            );

        return i.reply({ embeds: [embedFin] });
    });

    collector.on("end", (_, reason) => {
        if (reason === "time") tradesPendientes.delete(tradeId);
    });
}
