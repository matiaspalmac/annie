import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { lanzarEstrellaFugaz } from "../../core/utils.js";
import { lanzarTriviaAleatoria } from "../../features/trivia.js";
import { db } from "../../services/db.js";
import { getProgresoEvento, TIPOS_EVENTO } from "../../features/eventos.js";

export const data = new SlashCommandBuilder()
    .setName("admin-evento")
    .setDescription("Lanza un evento especial en el pueblito (Admin).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
        option.setName("tipo")
            .setDescription("El tipo de evento a lanzar")
            .setRequired(true)
            .addChoices(
                { name: "\u{1F320} Estrella Fugaz", value: "estrella" },
                { name: "\u{1F9E0} Trivia del Pueblito", value: "trivia" },
                { name: "\u{1F3D8}\uFE0F Evento Comunitario", value: "comunitario" }
            )
    )
    .addStringOption(o =>
        o.setName("titulo")
            .setDescription("Titulo del evento comunitario")
            .setRequired(false))
    .addIntegerOption(o =>
        o.setName("meta")
            .setDescription("Meta en monedas o items")
            .setRequired(false)
            .setMinValue(1))
    .addStringOption(o =>
        o.setName("tipo_evento")
            .setDescription("Tipo: monedas / items / mixto")
            .setRequired(false)
            .addChoices(
                { name: "\u{1F4B0} Monedas", value: "monedas" },
                { name: "\u{1F4E6} Items", value: "items" },
                { name: "\u{1F3AF} Mixto (monedas + items por fases)", value: "mixto" }
            ))
    .addStringOption(o =>
        o.setName("item")
            .setDescription("Item requerido (si tipo_evento=items o mixto)")
            .setRequired(false))
    .addIntegerOption(o =>
        o.setName("dias")
            .setDescription("Dias de duracion (deadline)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(30))
    .addIntegerOption(o =>
        o.setName("fases")
            .setDescription("Numero de fases (1-3)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(3))
    .addIntegerOption(o =>
        o.setName("meta_items")
            .setDescription("Meta de items (si tipo=items o mixto)")
            .setRequired(false)
            .setMinValue(1))
    .addIntegerOption(o =>
        o.setName("recompensa_monedas")
            .setDescription("Monedas de recompensa por participante")
            .setRequired(false)
            .setMinValue(0))
    .addIntegerOption(o =>
        o.setName("recompensa_xp")
            .setDescription("XP de recompensa por participante")
            .setRequired(false)
            .setMinValue(0))
    .addStringOption(o =>
        o.setName("descripcion")
            .setDescription("Descripcion del evento comunitario")
            .setRequired(false));

export async function execute(interaction, bostezo) {
    const tipo = interaction.options.getString("tipo");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        if (tipo === "estrella") {
            lanzarEstrellaFugaz(interaction.client);
            const embed = crearEmbed(CONFIG.COLORES.DORADO)
                .setTitle("\u{1F320} Estrella Fugaz Lanzada!")
                .setDescription(
                    `${bostezo}Zuum! La estrella fugaz ya esta surcando el cielo del pueblito.\n\n` +
                    `Los vecinos tienen unos segundos para usar \`/deseo\` antes de que desaparezca. Que tengan suerte!`
                );
            return interaction.editReply({ embeds: [embed] });

        } else if (tipo === "trivia") {
            lanzarTriviaAleatoria(interaction.client);
            const embed = crearEmbed(CONFIG.COLORES.CIELO)
                .setTitle("\u{1F9E0} Trivia del Pueblito Lanzada!")
                .setDescription(
                    `${bostezo}Ding ding! La trivia ya aparecio en el canal correspondiente.\n\n` +
                    `Los vecinos mas listos del pueblito van a brillar!`
                );
            return interaction.editReply({ embeds: [embed] });

        } else if (tipo === "comunitario") {
            return await crearEventoComunitario(interaction, bostezo);
        }

    } catch (error) {
        console.error("Error al lanzar evento:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("\u274C Error al lanzar evento!")
            .setDescription("Hubo un problema al lanzar el evento. Revisa los logs, corazon.");
        return interaction.editReply({ embeds: [embed] });
    }
}

// ── Crear evento comunitario ─────────────────────────────────────
async function crearEventoComunitario(interaction, bostezo) {
    const titulo = interaction.options.getString("titulo");
    const meta = interaction.options.getInteger("meta");
    const tipoEvento = interaction.options.getString("tipo_evento") || "monedas";
    const itemRequerido = interaction.options.getString("item");
    const dias = interaction.options.getInteger("dias");
    const fases = interaction.options.getInteger("fases") || 1;
    const metaItems = interaction.options.getInteger("meta_items");
    const recompensaMonedas = interaction.options.getInteger("recompensa_monedas") || 0;
    const recompensaXP = interaction.options.getInteger("recompensa_xp") || 0;
    const descripcion = interaction.options.getString("descripcion") || "";

    // Validaciones
    if (!titulo) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("\u274C Falta el titulo!")
            .setDescription("Necesito un titulo para el evento. Usa la opcion `titulo`.");
        return interaction.editReply({ embeds: [embed] });
    }

    if (!meta && tipoEvento !== "items") {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("\u274C Falta la meta!")
            .setDescription("Necesito una meta de monedas para el evento. Usa la opcion `meta`.");
        return interaction.editReply({ embeds: [embed] });
    }

    if ((tipoEvento === "items" || tipoEvento === "mixto") && !itemRequerido) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("\u274C Falta el item!")
            .setDescription("Para eventos de items o mixtos necesito saber que item se requiere. Usa la opcion `item`.");
        return interaction.editReply({ embeds: [embed] });
    }

    if ((tipoEvento === "items" || tipoEvento === "mixto") && !metaItems) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("\u274C Falta la meta de items!")
            .setDescription("Para eventos de items o mixtos necesito la meta de items. Usa la opcion `meta_items`.");
        return interaction.editReply({ embeds: [embed] });
    }

    // Verificar que no haya otro evento activo
    const existente = await db.execute("SELECT id, titulo FROM eventos_globales WHERE activo = 1 LIMIT 1");
    if (existente.rows.length > 0) {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("\u{1F6A7} Ya hay un evento activo!")
            .setDescription(
                `El evento **${existente.rows[0].titulo}** (ID: ${existente.rows[0].id}) todavia esta activo.\n` +
                `Terminalo o desactivalo antes de crear uno nuevo.`
            );
        return interaction.editReply({ embeds: [embed] });
    }

    // Calcular fecha limite
    let fechaLimite = null;
    if (dias) {
        const limite = new Date();
        limite.setDate(limite.getDate() + dias);
        fechaLimite = limite.toISOString().split("T")[0];
    }

    // Crear el evento
    await db.execute({
        sql: `INSERT INTO eventos_globales
              (titulo, descripcion, meta_monedas, progreso_monedas, recompensa_rol_id, recompensa_item_id,
               activo, tipo, item_requerido, meta_items, progreso_items, fase, total_fases,
               fecha_limite, recompensa_monedas, recompensa_xp)
              VALUES (?, ?, ?, 0, NULL, NULL, 1, ?, ?, ?, 0, 1, ?, ?, ?, ?)`,
        args: [
            titulo,
            descripcion,
            meta || 0,
            tipoEvento,
            itemRequerido,
            metaItems || 0,
            fases,
            fechaLimite,
            recompensaMonedas,
            recompensaXP,
        ],
    });

    // Obtener el evento recien creado para mostrar detalles
    const nuevoEvento = await db.execute("SELECT * FROM eventos_globales WHERE activo = 1 ORDER BY id DESC LIMIT 1");
    const eventoCreado = nuevoEvento.rows[0];

    const tipoInfo = TIPOS_EVENTO[tipoEvento] || TIPOS_EVENTO.monedas;

    // Detalles del evento
    const detalles = [];
    detalles.push(`${tipoInfo.emoji} **Tipo:** ${tipoEvento}`);
    if (meta) detalles.push(`\u{1F4B0} **Meta monedas:** ${meta.toLocaleString()}`);
    if (metaItems) detalles.push(`\u{1F4E6} **Meta items:** ${metaItems.toLocaleString()} x ${itemRequerido}`);
    if (fases > 1) detalles.push(`\u{1F680} **Fases:** ${fases}`);
    if (fechaLimite) detalles.push(`\u23F0 **Deadline:** ${fechaLimite}`);
    if (recompensaMonedas) detalles.push(`\u{1F381} **Recompensa monedas:** ${recompensaMonedas.toLocaleString()}`);
    if (recompensaXP) detalles.push(`\u2728 **Recompensa XP:** ${recompensaXP.toLocaleString()}`);

    // Respuesta al admin
    const embedAdmin = crearEmbed(CONFIG.COLORES.VERDE)
        .setTitle("\u2705 Evento Comunitario Creado!")
        .setDescription(
            `${bostezo}El evento **${titulo}** esta listo para el pueblito!\n\n` +
            detalles.join("\n")
        );
    await interaction.editReply({ embeds: [embedAdmin] });

    // Anunciar en canal general
    const canal = await getCanalGeneralSafe(interaction.client);
    if (canal) {
        const embedAnuncio = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle(`\u{1F3D8}\uFE0F NUEVO EVENTO COMUNITARIO: ${titulo}`)
            .setDescription(
                `*Annie toca la campana de la oficinita con emocion!*\n\n` +
                (descripcion ? `${descripcion}\n\n` : "") +
                `Vecinos del pueblito! Tenemos un nuevo proyecto comunitario!\n` +
                `Necesitamos la ayuda de todos para sacarlo adelante!`
            )
            .addFields(
                { name: "\u{1F4CB} Detalles", value: detalles.join("\n") },
                { name: "\u{1F91D} Como participar", value: getInstrucciones(tipoEvento, itemRequerido) }
            )
            .setFooter({ text: "Juntos podemos con todo! | Annie" });

        await canal.send({ content: "@everyone", embeds: [embedAnuncio] }).catch(() => {});
    }
}

// ── Helpers ──────────────────────────────────────────────────────
function getInstrucciones(tipoEvento, itemRequerido) {
    switch (tipoEvento) {
        case "monedas":
            return "Usa `/aportar cantidad:X` para donar moneditas!";
        case "items":
            return `Usa \`/aportar cantidad:X item:${itemRequerido || "ITEM"}\` para donar items!`;
        case "mixto":
            return `Fase 1: \`/aportar cantidad:X\` (moneditas)\nFase 2: \`/aportar cantidad:X item:${itemRequerido || "ITEM"}\` (items)`;
        default:
            return "Usa `/aportar` para contribuir!";
    }
}

function getCanalGeneralSafe(client) {
    try {
        if (!client?.guilds?.cache) return null;
        const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
        if (!guild) return null;
        return guild.channels.cache.get(CONFIG.CANAL_GENERAL_ID) ?? null;
    } catch {
        return null;
    }
}
