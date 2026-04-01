import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed, barraProgreso } from "../../core/utils.js";
import {
    getEventoActivo,
    aportarItems,
    verificarFaseEvento,
    getProgresoEvento,
    getTopContribuidores,
    completarEvento,
    anunciarFase,
    TIPOS_EVENTO,
} from "../../features/eventos.js";

export const data = new SlashCommandBuilder()
    .setName("aportar")
    .setDescription("Donar moneditas o items para el Evento Comunitario actual del Pueblito")
    .addIntegerOption(option =>
        option.setName("cantidad")
            .setDescription("Cantidad a donar")
            .setRequired(true)
            .setMinValue(1)
    )
    .addStringOption(option =>
        option.setName("item")
            .setDescription("Item a donar (si el evento pide items)")
            .setRequired(false));

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const cantidad = interaction.options.getInteger("cantidad");
    const itemDonado = interaction.options.getString("item");

    if (cantidad <= 0) {
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("? Cantidad invalida")
            .setDescription("Eso no parece una cantidad valida, tesoro. Ingresa un numero mayor a 0.");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    try {
        // 1. Obtener evento activo
        const evento = await getEventoActivo();

        if (!evento) {
            const embed = crearEmbed(CONFIG.COLORES.CIELO)
                .setTitle("\u{1F3D8}\uFE0F Sin evento activo")
                .setDescription(
                    `${bostezo} En este momento no hay ningun proyecto o junta vecinal activa, corazoncito.

Guarda tus cositas para mas tarde cuando el pueblito necesite tu ayuda!`
                );
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const eventoId = evento.id;
        const titulo = evento.titulo;
        const tipo = evento.tipo || "monedas";
        const tipoInfo = TIPOS_EVENTO[tipo] || TIPOS_EVENTO.monedas;

        // ── Decidir si es donacion de items o monedas ─────────────
        const esDonarItems = itemDonado && (tipo === "items" || tipo === "mixto");

        if (esDonarItems) {
            // ── DONACION DE ITEMS ─────────────────────────────────
            return await procesarDonacionItems(interaction, {
                evento, eventoId, titulo, tipo, tipoInfo,
                userId, username, cantidad, itemDonado, bostezo,
            });
        } else if (itemDonado && tipo === "monedas") {
            // El evento solo acepta monedas pero el usuario intento donar items
            const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle("\u{1F4E6} Este evento solo acepta moneditas")
                .setDescription(
                    `Ay tesoro, **${titulo}** es un evento de moneditas nomas!\n` +
                    `Usa \`/aportar cantidad:X\` sin el parametro de item.`
                );
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
            // ── DONACION DE MONEDAS ───────────────────────────────
            return await procesarDonacionMonedas(interaction, {
                evento, eventoId, titulo, tipo, tipoInfo,
                userId, username, cantidad, bostezo,
            });
        }

    } catch (e) {
        console.error("Error comando aportar:", e.message, e.stack);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("\u274C Error en la caja fuerte!")
            .setDescription("Parece que se me trabo la cajita fuerte... intentalo en un ratito.");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}

// ── Donacion de monedas ──────────────────────────────────────────
async function procesarDonacionMonedas(interaction, ctx) {
    const { evento, eventoId, titulo, tipo, userId, username, cantidad } = ctx;
    const meta = evento.meta_monedas;
    const progreso = evento.progreso_monedas;

    // Verificar que la fase actual acepta monedas
    if (tipo === "mixto" && evento.fase % 2 === 0) {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("\u{1F4E6} Esta fase necesita items!")
            .setDescription(
                `Ahora mismo estamos en la **Fase ${evento.fase}** y necesitamos **${evento.item_requerido || "items"}**.\n` +
                `Usa \`/aportar cantidad:X item:NOMBRE\` para donar items!`
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (tipo === "items") {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("\u{1F4E6} Este evento necesita items!")
            .setDescription(
                `**${titulo}** necesita **${evento.item_requerido || "items"}**, no moneditas.\n` +
                `Usa \`/aportar cantidad:X item:NOMBRE\` para donar!`
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (progreso >= meta) {
        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("\u{1F389} Meta de moneditas ya alcanzada!")
            .setDescription(
                `Llegaste tarde, tesoro! Ya logramos la meta de moneditas de **${titulo}**.\n` +
                `El pueblito esta de fiesta celebrando! \u{1F338}`
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Verificar balance del usuario
    const resUser = await db.execute({
        sql: "SELECT monedas FROM usuarios WHERE id = ?",
        args: [userId]
    });

    if (resUser.rows.length === 0 || Number(resUser.rows[0].monedas) < cantidad) {
        const tieneMon = resUser.rows.length ? Number(resUser.rows[0].monedas) : 0;
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("\u{1F4B8} Sin suficientes moneditas!")
            .setDescription(`Ay! Me parece que no tienes tantas moneditas en los bolsillos.`)
            .addFields(
                { name: "\u{1F4B0} Tienes", value: `**${tieneMon.toLocaleString()} \u{1FA99}**`, inline: true },
                { name: "\u{1F91D} Quieres donar", value: `**${cantidad.toLocaleString()} \u{1FA99}**`, inline: true }
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Procesar donacion
    const cantidadRestante = meta - progreso;
    const donacionReal = Math.min(cantidad, cantidadRestante);

    // Descontar del usuario
    await db.execute({
        sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
        args: [donacionReal, userId]
    });

    // Sumar al evento
    await db.execute({
        sql: "UPDATE eventos_globales SET progreso_monedas = progreso_monedas + ? WHERE id = ?",
        args: [donacionReal, eventoId]
    });

    // Registrar donacion
    await db.execute({
        sql: `INSERT INTO evento_donaciones (evento_id, user_id, cantidad)
              VALUES (?, ?, ?)
              ON CONFLICT(evento_id, user_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
        args: [eventoId, userId, donacionReal]
    });

    // Refrescar evento
    const eventoActualizado = await getEventoActivo();

    // Verificar fase/completado
    const resultado = await verificarFaseEvento(eventoId);

    if (resultado.eventoCompletado) {
        await completarEvento(interaction.client, eventoActualizado || evento);

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("\u{1F389} META DEL PUEBLITO ALCANZADA! \u{1F389}")
            .setDescription(`*Annie sale corriendo de la oficinita emocionada!*`)
            .addFields(
                { name: "\u{1F31F} Proyecto Completado", value: `**${titulo}**` },
                { name: "\u{1F4B0} Recaudacion Total", value: `${meta.toLocaleString()} / ${meta.toLocaleString()} moneditas` },
                { name: "\u{1F451} Heroe del Momento", value: `**${username}** acaba de dar el golpe final donando **${donacionReal.toLocaleString()}** moneditas!` },
            )
            .setFooter({ text: "El servidor entero festeja! | Annie" });

        return interaction.reply({ content: `ATENCION PUEBLITO! @everyone`, embeds: [embed] });
    }

    if (resultado.faseCompletada && resultado.nuevaFase) {
        await anunciarFase(interaction.client, evento, resultado.nuevaFase);
    }

    // Respuesta normal
    const top = await getTopContribuidores(eventoId, 3);
    const medallas = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
    const topTexto = top.length > 0
        ? top.map((r, i) => `${medallas[i]} **${r.username}** \u2014 ${r.total.toLocaleString()}\u{1F4B0}`).join("\n")
        : "Aun no hay donadores.";

    const nuevoProgreso = progreso + donacionReal;
    const porcentaje = meta > 0 ? Math.min(100, Math.floor((nuevoProgreso / meta) * 100)) : 0;
    const barra = barraProgreso(porcentaje, "\u{1F7E9}", "\u2B1C", 10);

    // Milestone check
    const milestones = [25, 50, 75, 100];
    const prevPct = meta > 0 ? (progreso / meta) * 100 : 0;
    const newPct = meta > 0 ? (nuevoProgreso / meta) * 100 : 0;
    const hitMilestone = milestones.find(m => prevPct < m && newPct >= m);

    const embed = crearEmbed(CONFIG.COLORES.VERDE)
        .setTitle("\u{1F496} Gracias por tu aporte!")
        .setDescription(`**${username}** acaba de donar **${donacionReal.toLocaleString()}** moneditas de todo corazon.`)
        .addFields(
            { name: "Causa", value: `*${titulo}*` },
            { name: "Progreso Total", value: `${nuevoProgreso.toLocaleString()} / ${meta.toLocaleString()} \u{1F4B0}` },
            { name: "Barra de Progreso", value: barra },
            { name: "\u{1F3C6} Top Donadores", value: topTexto }
        )
        .setFooter({ text: "Cada granito de arena cuenta! | Annie" });

    if (hitMilestone) {
        embed.addFields({ name: "\u{1F3AF} Milestone alcanzado", value: `Se supero el **${hitMilestone}%** de la meta!` });
    }

    await interaction.reply({ embeds: [embed] });
}

// ── Donacion de items ────────────────────────────────────────────
async function procesarDonacionItems(interaction, ctx) {
    const { evento, eventoId, titulo, tipo, userId, username, cantidad, itemDonado } = ctx;

    // Verificar que la fase actual acepta items
    if (tipo === "mixto" && evento.fase % 2 === 1) {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("\u{1F4B0} Esta fase necesita moneditas!")
            .setDescription(
                `Ahora mismo estamos en la **Fase ${evento.fase}** y necesitamos **moneditas**.\n` +
                `Usa \`/aportar cantidad:X\` sin el parametro de item!`
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Verificar que el item coincide con el requerido
    const itemRequerido = evento.item_requerido;
    if (itemRequerido && itemDonado.toLowerCase() !== itemRequerido.toLowerCase()) {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("\u{1F4E6} Item incorrecto")
            .setDescription(
                `El evento **${titulo}** necesita **${itemRequerido}**, no *${itemDonado}*.\n` +
                `Revisa tu inventario con \`/inventario\` y busca el item correcto!`
            );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const itemId = itemDonado.toLowerCase().replace(/\s+/g, "_");

    // Procesar la donacion de items
    const resultado = await aportarItems(userId, eventoId, itemId, cantidad);

    if (!resultado.ok) {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("\u274C No se pudo donar")
            .setDescription(resultado.error);
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const donacionReal = resultado.donacionReal;

    // Refrescar evento
    const eventoActualizado = await getEventoActivo();

    // Verificar fase/completado
    const faseResult = await verificarFaseEvento(eventoId);

    if (faseResult.eventoCompletado) {
        await completarEvento(interaction.client, eventoActualizado || evento);

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("\u{1F389} META DEL PUEBLITO ALCANZADA! \u{1F389}")
            .setDescription(`*Annie hace sonar la campanita con toda la fuerza!*`)
            .addFields(
                { name: "\u{1F31F} Proyecto Completado", value: `**${titulo}**` },
                { name: "\u{1F4E6} Donacion Final", value: `**${username}** dono las ultimas **${donacionReal}** unidades de **${itemRequerido || itemDonado}**!` },
            )
            .setFooter({ text: "El pueblito se lo merece todo! | Annie" });

        return interaction.reply({ content: `ATENCION PUEBLITO! @everyone`, embeds: [embed] });
    }

    if (faseResult.faseCompletada && faseResult.nuevaFase) {
        await anunciarFase(interaction.client, evento, faseResult.nuevaFase);
    }

    // Respuesta normal
    const top = await getTopContribuidores(eventoId, 3);
    const medallas = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
    const topTexto = top.length > 0
        ? top.map((r, i) => `${medallas[i]} **${r.username}** \u2014 ${r.total.toLocaleString()} aportes`).join("\n")
        : "Aun no hay donadores.";

    const nuevoProgreso = evento.progreso_items + donacionReal;
    const metaItems = evento.meta_items;
    const porcentaje = metaItems > 0 ? Math.min(100, Math.floor((nuevoProgreso / metaItems) * 100)) : 0;
    const barra = barraProgreso(porcentaje, "\u{1F7E6}", "\u2B1C", 10);

    const embed = crearEmbed(CONFIG.COLORES.VERDE)
        .setTitle("\u{1F4E6} Gracias por tu aporte!")
        .setDescription(`**${username}** dono **${donacionReal}x ${itemRequerido || itemDonado}** con mucho cariño.`)
        .addFields(
            { name: "Causa", value: `*${titulo}*` },
            { name: "Progreso Items", value: `${nuevoProgreso.toLocaleString()} / ${metaItems.toLocaleString()} \u{1F4E6}` },
            { name: "Barra de Progreso", value: barra },
            { name: "\u{1F3C6} Top Donadores", value: topTexto }
        )
        .setFooter({ text: "Cada cosita que donas ayuda al pueblito! | Annie" });

    await interaction.reply({ embeds: [embed] });
}
