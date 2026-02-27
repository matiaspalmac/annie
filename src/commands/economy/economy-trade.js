import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { registrarBitacora } from "../../features/progreso.js";

// Trades pendientes en memoria (userId => { con, ofreces, ellos_dan, ts })
const tradesPendientes = new Map();
const TRADE_TIMEOUT = 5 * 60 * 1000; // 5 minutos para confirmar

export const data = new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Propone un intercambio de ítems con otro vecino del pueblito.")
    .addUserOption(o => o.setName("vecino").setDescription("El vecino con quien intercambiar").setRequired(true))
    .addStringOption(o => o.setName("ofreces").setDescription("¿Qué ofreces? (ej: Pescado x3, Manzanas x5)").setRequired(true))
    .addStringOption(o => o.setName("pides").setDescription("¿Qué pides a cambio? (ej: Trucha Arcoíris x1)").setRequired(true));

// Parsear "Nombre x5, OtroNombre x2" → [{ item, cantidad }]
function parsearItems(texto) {
    const partes = texto.split(",").map(s => s.trim());
    const resultado = [];
    for (const p of partes) {
        const match = p.match(/^(.+?)\s+x(\d+)$/i);
        if (match) {
            resultado.push({ item: match[1].trim(), cantidad: parseInt(match[2]) });
        } else {
            resultado.push({ item: p, cantidad: 1 });
        }
    }
    return resultado;
}

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser("vecino");
    const ofrecesStr = interaction.options.getString("ofreces");
    const pidesStr = interaction.options.getString("pides");

    if (targetUser.id === userId) {
        return interaction.reply({ content: `${bostezo}¡No puedes intercambiar contigo mismo, tontillo(a)!`, flags: MessageFlags.Ephemeral });
    }
    if (targetUser.bot) {
        return interaction.reply({ content: `${bostezo}Los bots no negocian en el mercado de pulgas, ¡son máquinas!`, flags: MessageFlags.Ephemeral });
    }

    const ofreces = parsearItems(ofrecesStr);
    const pides = parsearItems(pidesStr);

    // Verificar que el ofertante tiene los ítems que ofrece
    for (const { item, cantidad } of ofreces) {
        const res = await db.execute({
            sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
            args: [userId, item]
        });
        const enInventario = Number(res.rows[0]?.cantidad || 0);
        if (enInventario < cantidad) {
            return interaction.reply({
                content: `${bostezo}No tienes suficientes **${item}** en tu mochila (tienes ${enInventario}, ofreces ${cantidad}).`,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    // Crear botones de aceptar/rechazar
    const tradeId = `trade_${userId}_${targetUser.id}_${Date.now()}`;
    tradesPendientes.set(tradeId, {
        de: userId, para: targetUser.id, ofreces, pides,
        ts: Date.now(), deUsername: interaction.user.username, paraUsername: targetUser.username
    });

    // Limpiar después del timeout
    setTimeout(() => tradesPendientes.delete(tradeId), TRADE_TIMEOUT);

    const ofrecesTexto = ofreces.map(o => `**${o.item}** x${o.cantidad}`).join(", ");
    const pidesTexto = pides.map(p => `**${p.item}** x${p.cantidad}`).join(", ");

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`trade_accept_${tradeId}`).setLabel("✅ ¡Acepto el Trato!").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`trade_reject_${tradeId}`).setLabel("❌ Rechazar").setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
        content: `🤝 **¡Propuesta de Mercado de Pulgas!**\n\n` +
            `<@${userId}> le propone a <@${targetUser.id}> el siguiente canje:\n\n` +
            `📤 **Ellos ofrecen:** ${ofrecesTexto}\n` +
            `📥 **Piden a cambio:** ${pidesTexto}\n\n` +
            `*<@${targetUser.id}>, tienes 5 minutos para aceptar o rechazar el trato.*`,
        components: [row]
    });

    // Manejar el botón de respuesta
    const filter = i => (i.customId.startsWith("trade_accept_") || i.customId.startsWith("trade_reject_")) && i.user.id === targetUser.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: TRADE_TIMEOUT });

    collector.on("collect", async i => {
        collector.stop();
        const trade = tradesPendientes.get(tradeId);
        if (!trade) {
            return i.reply({ content: "Esta propuesta ya expiró.", flags: MessageFlags.Ephemeral });
        }

        if (i.customId.startsWith("trade_reject_")) {
            tradesPendientes.delete(tradeId);
            return i.reply({ content: `❌ <@${targetUser.id}> rechazó el trato. Quizás la próxima vez...` });
        }

        // Aceptar: verificar que todos los ítems todavía existen en los inventarios
        for (const { item, cantidad } of trade.ofreces) {
            const res = await db.execute({ sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?", args: [trade.de, item] });
            if (Number(res.rows[0]?.cantidad || 0) < cantidad) {
                tradesPendientes.delete(tradeId);
                return i.reply({ content: `❌ El trato ya no es válido: <@${trade.de}> no tiene suficientes **${item}**. ¡Que aguante sus promesas!` });
            }
        }
        for (const { item, cantidad } of trade.pides) {
            const res = await db.execute({ sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?", args: [trade.para, item] });
            if (Number(res.rows[0]?.cantidad || 0) < cantidad) {
                tradesPendientes.delete(tradeId);
                return i.reply({ content: `❌ El trato ya no es válido: <@${trade.para}> no tiene suficientes **${item}**.` });
            }
        }

        // Ejecutar el intercambio: restar a uno y sumar al otro
        for (const { item, cantidad } of trade.ofreces) {
            await db.execute({ sql: "UPDATE inventario_economia SET cantidad = cantidad - ? WHERE user_id = ? AND item_id = ?", args: [cantidad, trade.de, item] });
            await db.execute({
                sql: "INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?",
                args: [trade.para, item, cantidad, cantidad]
            });
        }
        for (const { item, cantidad } of trade.pides) {
            await db.execute({ sql: "UPDATE inventario_economia SET cantidad = cantidad - ? WHERE user_id = ? AND item_id = ?", args: [cantidad, trade.para, item] });
            await db.execute({
                sql: "INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?",
                args: [trade.de, item, cantidad, cantidad]
            });
        }

        tradesPendientes.delete(tradeId);
        await registrarBitacora(trade.de, `Intercambio con ${trade.paraUsername}: entregó ${ofrecesTexto}`);
        await registrarBitacora(trade.para, `Intercambio con ${trade.deUsername}: recibió ${ofrecesTexto}`);

        const ofrecesTexto2 = trade.ofreces.map(o => `${o.item} x${o.cantidad}`).join(", ");
        const pidesTexto2 = trade.pides.map(p => `${p.item} x${p.cantidad}`).join(", ");
        return i.reply(
            `✅ **¡¡TRATO CERRADO!!** 🤝\n\n` +
            `📤 <@${trade.de}> le dio: **${ofrecesTexto2}**\n` +
            `📥 <@${trade.para}> le dio: **${pidesTexto2}**\n\n` +
            `*¡Un intercambio justo entre buenos vecinos del pueblito!* ✨`
        );
    });

    collector.on("end", (_, reason) => {
        if (reason === "time") tradesPendientes.delete(tradeId);
    });
}
