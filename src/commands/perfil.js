import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Consulta tu progreso, nivel y moneditas en el Pueblito")
    .addUserOption(o => o.setName("vecino").setDescription("Mira el perfil de otro vecinito"));

export async function execute(interaction, bostezo) {
    await interaction.deferReply();

    const reqUser = interaction.options.getUser("vecino") || interaction.user;
    const targetUser = reqUser.bot ? interaction.user : reqUser;

    const resDb = await db.execute({
        sql: "SELECT monedas, xp, nivel, color_rol_id, tema_perfil, mascota_activa, banner_url, marco_perfil FROM usuarios WHERE id = ?",
        args: [targetUser.id]
    });

    const userData = resDb.rows.length > 0 ? resDb.rows[0] : { monedas: 0, xp: 0, nivel: 1, color_rol_id: null, tema_perfil: "default", mascota_activa: null, banner_url: null, marco_perfil: "default" };
    const xp = Number(userData.xp);
    const nivel = Number(userData.nivel);
    const monedas = Number(userData.monedas);

    const formatCompact = (value) => new Intl.NumberFormat("es-CL", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(Number(value || 0));

    // If user not found in DB and it's the current user, prompt them to play
    if (resDb.rows.length === 0) {
        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({ content: `${bostezo} Aún no sales a pasear por el pueblito... ¡escribe unos cuantos mensajitos en el chat y vuelve a preguntar!` });
        } else {
            return interaction.editReply({ content: `Parece que **${targetUser.username}** no ha salido de su casita todavía.` });
        }
    }

    // Fetch collections from DB
    const colResult = await db.execute({
        sql: "SELECT categoria, COUNT(*) as total FROM colecciones WHERE user_id = ? GROUP BY categoria",
        args: [targetUser.id]
    });

    // Get total items in the game
    const totalResult = await db.execute("SELECT 'peces' as cat, COUNT(*) as c FROM peces UNION ALL SELECT 'insectos', COUNT(*) FROM insectos UNION ALL SELECT 'aves', COUNT(*) FROM aves UNION ALL SELECT 'animales', COUNT(*) FROM animales UNION ALL SELECT 'cultivos', COUNT(*) FROM cultivos UNION ALL SELECT 'recolectables', COUNT(*) FROM recolectables UNION ALL SELECT 'recetas', COUNT(*) FROM recetas UNION ALL SELECT 'logros', COUNT(*) FROM logros");

    const maxItems = {};
    for (const r of totalResult.rows) maxItems[r.cat] = Number(r.c);

    let coleccionesStr = "";
    const opcionesMenu = [];
    const categoriasBase = ["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "recetas", "logros"];
    const coleccionesMap = {};

    if (colResult.rows.length > 0) {
        const emojisArr = {
            "peces": "🐟", "insectos": "🦋", "aves": "🕊️", "animales": "🐾",
            "cultivos": "🌱", "recolectables": "🍄", "recetas": "🍰", "logros": "🏆"
        };
        const itemsList = colResult.rows.map(r => {
            const owned = Number(r.total);
            const total = maxItems[r.categoria] || 0;
            coleccionesMap[r.categoria] = owned;
            opcionesMenu.push({
                label: `Ver ${r.categoria.charAt(0).toUpperCase() + r.categoria.slice(1)}`,
                description: `Progreso: ${owned}/${total} registrados`,
                emoji: emojisArr[r.categoria],
                value: `vt_${r.categoria}_${targetUser.id}` // View target {categoria} {user_id}
            });
            return `${emojisArr[r.categoria] || "📌"} **${owned}**/${total} ${r.categoria}`;
        });
        coleccionesStr = itemsList.join("  |  ");
    } else {
        coleccionesStr = "Todavía no ha registrado nada en su libretita.";
    }

    // Calculate XP for next level
    // Reverse math from the level up formula: nivelNuevo = Math.floor(0.1 * Math.sqrt(xp)) + 1;
    // (nivelActual - 1) / 0.1 = sqrt(xp) => xp base for current level
    const xpBaseNivelDesc = Math.pow((nivel - 1) * 10, 2);
    const xpSigNivel = Math.pow(nivel * 10, 2);

    const progresoBarra = generarBarraProgreso(xp - xpBaseNivelDesc, xpSigNivel - xpBaseNivelDesc);
    const xpRestante = Math.max(0, xpSigNivel - xp);

    // Objetivo siguiente inteligente (colección más cercana)
    let objetivoColeccion = "Completa una categoría nueva en tu libretita";
    let menorFaltante = Number.MAX_SAFE_INTEGER;
    for (const cat of categoriasBase) {
        const owned = Number(coleccionesMap[cat] || 0);
        const total = Number(maxItems[cat] || 0);
        if (total <= 0 || owned >= total) continue;
        const faltan = total - owned;
        if (faltan < menorFaltante) {
            menorFaltante = faltan;
            objetivoColeccion = `${cat}: te faltan ${faltan} para completar (${owned}/${total})`;
        }
    }

    const resActividadMes = await db.execute({
        sql: `SELECT 
              COALESCE(SUM(xp_ganado), 0) as xp_mes,
              COALESCE(SUM(monedas_ganadas), 0) as monedas_mes,
              COUNT(*) as dias_activos_mes
              FROM actividad_diaria
              WHERE user_id = ?
                            AND fecha >= date(
                                'now',
                                COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours'),
                                'start of month'
                            )
              AND (acciones > 0 OR xp_ganado > 0 OR monedas_ganadas > 0)`,
        args: [targetUser.id]
    });
    const xpMes = Number(resActividadMes.rows[0]?.xp_mes || 0);
    const monedasMes = Number(resActividadMes.rows[0]?.monedas_mes || 0);
    const diasActivosMes = Number(resActividadMes.rows[0]?.dias_activos_mes || 0);

    const resDiasActivos = await db.execute({
        sql: `SELECT fecha FROM actividad_diaria
              WHERE user_id = ?
              AND (acciones > 0 OR xp_ganado > 0 OR monedas_ganadas > 0)
              ORDER BY fecha DESC LIMIT 180`,
        args: [targetUser.id]
    });
    const resHoyChile = await db.execute({
        sql: `SELECT date(
              'now',
              COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours')
            ) as hoy`,
    });
    const diasActivos = new Set(resDiasActivos.rows.map(r => String(r.fecha)));
    const prevDateKey = (key) => {
        const d = new Date(`${key}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().slice(0, 10);
    };
    let rachaActiva = 0;
    let cursorKey = String(resHoyChile.rows[0]?.hoy || new Date().toISOString().slice(0, 10));
    while (true) {
        if (!diasActivos.has(cursorKey)) break;
        rachaActiva += 1;
        cursorKey = prevDateKey(cursorKey);
    }

    // ====== (F8.5 Color de Perfil Dinámico) ======
    const THEME_COLORS = {
        default: 0xFFD700,
        tema_bosque: 0x2E7D32,
        tema_playa: 0x0288D1,
        tema_noche: 0x5E35B1,
    };

    let customColor = THEME_COLORS[userData.tema_perfil] || THEME_COLORS.default;
    if (!userData.tema_perfil || userData.tema_perfil === "default") {
        if (userData.color_rol_id) {
            const ROLE_COLORS = {
                "color_rosa": 0xFF69B4,
                "color_celeste": 0x87CEEB,
                "color_dorado": 0xFFD700
            };
            if (ROLE_COLORS[userData.color_rol_id]) {
                customColor = ROLE_COLORS[userData.color_rol_id];
            } else if (typeof userData.color_rol_id === "string" && userData.color_rol_id.startsWith("#")) {
                customColor = parseInt(userData.color_rol_id.replace("#", ""), 16);
            }
        }
    }

    //====== Titulo Equipado ======
    const resTitulosTotales = await db.execute({
        sql: "SELECT titulo, equipado FROM titulos WHERE user_id = ?",
        args: [targetUser.id]
    });

    let tituloEquipado = "";
    for (const row of resTitulosTotales.rows) {
        if (row.equipado === 1) tituloEquipado = `✨ **${row.titulo}** ✨\n\n`;
    }

    //====== Ranking Global ======
    const resRanking = await db.execute({
        sql: "SELECT COUNT(*) as rank FROM usuarios WHERE monedas > ?",
        args: [monedas]
    });
    const puestoRanking = Number(resRanking.rows[0].rank) + 1; // +1 porque 0 personas con más monedas significa top 1

    const resTotalUsers = await db.execute("SELECT COUNT(*) as total FROM usuarios");
    const totalUsers = Number(resTotalUsers.rows[0].total);

    // Ranking coleccionista
    const totalColeccionUsuario = colResult.rows.reduce((acc, row) => acc + Number(row.total), 0);
    const resRankingColeccion = await db.execute({
        sql: "SELECT COUNT(*) as rank FROM (SELECT user_id, COUNT(*) as total_items FROM colecciones GROUP BY user_id) t WHERE t.total_items > ?",
        args: [totalColeccionUsuario]
    });
    const puestoColeccion = Number(resRankingColeccion.rows[0]?.rank || 0) + 1;
    const resTotalColeccionistas = await db.execute("SELECT COUNT(DISTINCT user_id) as total FROM colecciones");
    const totalColeccionistas = Math.max(1, Number(resTotalColeccionistas.rows[0]?.total || 1));

    const topEconomicoPercent = Math.min(100, Math.max(1, Math.ceil((puestoRanking / Math.max(1, totalUsers)) * 100)));
    const topColeccionPercent = Math.min(100, Math.max(1, Math.ceil((puestoColeccion / totalColeccionistas) * 100)));

    let mascotaActivaText = "";
    if (userData.mascota_activa && userData.mascota_activa !== "default") {
        mascotaActivaText = `\n🐕 **Mascota Acompañante:** ${userData.mascota_activa.replace('mascota_', '')}`;
    }

    let temaActivoText = "";
    if (userData.tema_perfil && userData.tema_perfil !== "default") {
        temaActivoText = `\n🖼️ **Tema de Perfil:** ${userData.tema_perfil.replace('tema_', '')}`;
    }

    let marcoActivoText = "";
    if (userData.marco_perfil && userData.marco_perfil !== "default") {
        marcoActivoText = `\n🪞 **Marco de Perfil:** ${String(userData.marco_perfil).replace('marco_perfil_', '')}`;
    }

    const resBoosts = await db.execute({
        sql: "SELECT boost_id, fecha_expira FROM boosts_activos WHERE user_id = ?",
        args: [targetUser.id]
    });
    const ahora = Date.now();
    const boostsActivos = resBoosts.rows
        .filter(r => Number(r.fecha_expira || 0) > ahora)
        .map(r => {
            const id = String(r.boost_id || "");
            const minutos = Math.max(1, Math.ceil((Number(r.fecha_expira) - ahora) / 60000));
            if (id === "booster_xp_30m") return `⚗️ Booster XP (${minutos}m)`;
            if (id === "amuleto_suerte_15m") return `🍀 Amuleto Suerte (${minutos}m)`;
            return `${id} (${minutos}m)`;
        });

    const resComprasEspeciales = await db.execute({
        sql: "SELECT item_id, cantidad FROM inventario_economia WHERE user_id = ? AND item_id IN ('booster_xp_30m','amuleto_suerte_15m','reset_racha_perdon') AND cantidad > 0",
        args: [targetUser.id]
    });
    const comprasEspeciales = resComprasEspeciales.rows.map(r => `${String(r.item_id)} x${Number(r.cantidad || 0)}`);

    //====== Titulo Economico ======
    let tituloEconomico = "Mendigo del Pueblito";
    if (monedas >= 10000) tituloEconomico = "Mente Maestra de Wall Street";
    else if (monedas >= 5000) tituloEconomico = "Magnate Comercial";
    else if (monedas >= 1000) tituloEconomico = "Comerciante Local";
    else if (monedas >= 200) tituloEconomico = "Ahorrador Acérrimo";

    //====== Insignias Dinámicas Compartidas ======
    const resPesca = await db.execute({
        sql: "SELECT nivel FROM habilidades WHERE user_id = ? AND habilidad = 'pesca' LIMIT 1",
        args: [targetUser.id]
    });
    const pescaNivel = Number(resPesca.rows[0]?.nivel || 0);
    const insignias = [];
    if (topEconomicoPercent <= 10) insignias.push("💸 Top 10% económico");
    if (monedas >= 10000) insignias.push("💰 Millonario");
    if (pescaNivel >= 10) insignias.push("🎣 Maestro de pesca");
    if (totalColeccionUsuario >= 100) insignias.push("📚 Coleccionista experto");
    if (rachaActiva >= 7) insignias.push("🔥 Constancia 7d");

    const objetivoXpMensual = Math.max(1000, nivel * 300);
    const progresoXpMensual = Math.min(100, Math.round((xpMes / objetivoXpMensual) * 100));

    const embed = crearEmbed(customColor)
        .setTitle(`📌 Libretita de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(
            `${tituloEquipado}` +
            `💼 **Título Económico**\n${tituloEconomico}\n` +
            `🏆 **Puesto Ranking**\n#${puestoRanking} de ${totalUsers} vecinitos (Top ${topEconomicoPercent}%)\n\n` +
            `Nivel: **${formatCompact(nivel)}** | XP: **${formatCompact(xp)}** | Moneditas: **${formatCompact(monedas)}**` +
            `${mascotaActivaText}${temaActivoText}${marcoActivoText}`
        )
        .addFields(
            { name: "🎯 Objetivo Siguiente", value: `Te faltan **${formatCompact(xpRestante)} XP** para subir a nivel ${nivel + 1}.\n${objetivoColeccion}`, inline: false },
            { name: "📈 Progreso al sig. Nivel", value: progresoBarra, inline: false },
            { name: "🔥 Actividad Mensual", value: `Racha activa: **${rachaActiva}** días | Días activos: **${diasActivosMes}**\nXP: **${formatCompact(xpMes)}** / ${formatCompact(objetivoXpMensual)} (${progresoXpMensual}%)\nMonedas: **${formatCompact(monedasMes)}**`, inline: false },
            { name: "🧭 Comparativa", value: `💸 Top ${topEconomicoPercent}% económico\n📚 Top ${topColeccionPercent}% coleccionista`, inline: true },
            { name: "🏅 Insignias", value: insignias.length ? insignias.slice(0, 3).join("\n") : "Sin insignias", inline: true },
            { name: "✨ Efectos Activos", value: boostsActivos.length ? boostsActivos.join("\n") : "Ninguno", inline: false },
            { name: "🧪 Compras Especiales", value: comprasEspeciales.length ? comprasEspeciales.join("\n") : "Ninguna", inline: false }
        );

    if (userData.banner_url && /^https?:\/\//i.test(String(userData.banner_url))) {
        embed.setImage(String(userData.banner_url));
    } else {
        try {
            const fullTarget = await targetUser.fetch();
            const discordBanner = fullTarget.bannerURL({ size: 1024, extension: "png" });
            if (discordBanner) embed.setImage(discordBanner);
        } catch {
            // noop
        }
    }

    const payload = { content: bostezo, embeds: [embed] };

    // Attach ActionRow if they have collections + WEB LINK
    const optionsRow = new ActionRowBuilder();
    let hasComponents = false;

    if (opcionesMenu.length > 0) {
        optionsRow.addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("perfil_ver_coleccion")
                .setPlaceholder("Explorar Libretita de Colecciones...")
                .addOptions(opcionesMenu)
        );
        payload.components = [optionsRow];
        hasComponents = true;
    }

    const pageRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("perfil_ver_mas")
            .setPlaceholder("Ver más detalles del perfil...")
            .addOptions([
                { label: "Objetivo siguiente", description: "Meta de XP y colección más cercana", value: `pv_objetivo_${targetUser.id}`, emoji: "🎯" },
                { label: "Racha y actividad", description: "Resumen mensual de XP y monedas", value: `pv_actividad_${targetUser.id}`, emoji: "🔥" },
                { label: "Comparativa vecinal", description: "Top % económico y coleccionista", value: `pv_comparativa_${targetUser.id}`, emoji: "🧭" },
                { label: "Insignias", description: "Logros dinámicos desbloqueados", value: `pv_insignias_${targetUser.id}`, emoji: "🏅" },
                { label: "Progreso detallado", description: "Habilidades, colecciones y bitácora", value: `pv_progreso_${targetUser.id}`, emoji: "📊" },
                { label: "Inventario y logros", description: "Mascotas, temas y títulos", value: `pv_inventario_${targetUser.id}`, emoji: "🎒" },
            ])
    );

    // Add row for the Web Link button
    const linkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Ver libretita completa (Web)")
            .setURL(`${CONFIG.WIKI_URL}perfil/${targetUser.id}`)
            .setStyle(5) // ButtonStyle.Link = 5
    );

    if (hasComponents) {
        payload.components.push(pageRow);
        payload.components.push(linkRow);
    } else {
        payload.components = [pageRow, linkRow];
    }

    return interaction.editReply(payload);
}

function generarBarraProgreso(current, max, length = 10) {
    const fillChar = "🟩";
    const emptyChar = "⬜";
    const safeCurrent = Math.max(0, Math.min(current, max));
    const safeMax = Math.max(1, max);

    let fillCount = Math.round((safeCurrent / safeMax) * length);
    // Extra safety boundary clamping
    fillCount = Math.max(0, Math.min(fillCount, length));

    const emptyCount = length - fillCount;
    const percent = Math.round((safeCurrent / safeMax) * 100);

    return fillChar.repeat(fillCount) + emptyChar.repeat(emptyCount) + ` (${percent}%)`;
}
