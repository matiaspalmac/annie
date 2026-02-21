import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Consulta tu progreso, nivel y moneditas en el Pueblito")
    .addUserOption(o => o.setName("vecino").setDescription("Mira el perfil de otro vecinito"));

export async function execute(interaction, bostezo) {
    const reqUser = interaction.options.getUser("vecino") || interaction.user;
    const targetUser = reqUser.bot ? interaction.user : reqUser;

    const resDb = await db.execute({
        sql: "SELECT monedas, xp, nivel, color_rol_id FROM usuarios WHERE id = ?",
        args: [targetUser.id]
    });

    const userData = resDb.rows.length > 0 ? resDb.rows[0] : { monedas: 0, xp: 0, nivel: 1, color_rol_id: null };
    const xp = Number(userData.xp);
    const nivel = Number(userData.nivel);

    // If user not found in DB and it's the current user, prompt them to play
    if (resDb.rows.length === 0) {
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: `${bostezo} Aún no sales a pasear por el pueblito... ¡escribe unos cuantos mensajitos en el chat y vuelve a preguntar!`, flags: MessageFlags.Ephemeral });
        } else {
            return interaction.reply({ content: `Parece que **${targetUser.username}** no ha salido de su casita todavía.`, flags: MessageFlags.Ephemeral });
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

    if (colResult.rows.length > 0) {
        const emojisArr = {
            "peces": "🐟", "insectos": "🦋", "aves": "🕊️", "animales": "🐾",
            "cultivos": "🌱", "recolectables": "🍄", "recetas": "🍰", "logros": "🏆"
        };
        const itemsList = colResult.rows.map(r => {
            const owned = Number(r.total);
            const total = maxItems[r.categoria] || 0;
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

    // ====== (F8.5 Color de Perfil Dinámico) ======
    let customColor = CONFIG.COLORES.DORADO;
    if (userData.color_rol_id) {
        // En esta instancia usamos mapeo interno para los items de la tienda base, si fuera hexadecimal puro iría directo
        const ROLE_COLORS = {
            "color_rosa": 0xFF69B4,
            "color_celeste": 0x87CEEB,
            "color_dorado": 0xFFD700
        };

        if (ROLE_COLORS[userData.color_rol_id]) {
            customColor = ROLE_COLORS[userData.color_rol_id];
        } else if (userData.color_rol_id.startsWith("#")) {
            customColor = parseInt(userData.color_rol_id.replace("#", ""), 16);
        }
    }

    const embed = crearEmbed(customColor)
        .setTitle(`📌 Libretita de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(`Nivel: **${nivel}**\nXP Total: **${xp}**\n\nProgreso al próximo nivel:`)
        .addFields(
            { name: "Progreso al sig. Nivel", value: progresoBarra, inline: false },
            { name: "💰 Moneditas", value: `**${userData.monedas}**`, inline: true },
            { name: "📔 Libretita de Colecciones", value: coleccionesStr, inline: false }
        );

    // If they have a custom color role purchased
    if (userData.color_rol_id) {
        embed.setDescription("🎨 Este vecinito tiene un color personalizado en el chat.");
    } else {
        embed.setDescription("🌲 Un dulce habitante de nuestro pueblito.");
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

    // Add row for the Web Link button
    const linkRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Ver libretita completa (Web)")
            .setURL(`${CONFIG.WIKI_URL}perfil/${targetUser.id}`)
            .setStyle(5) // ButtonStyle.Link = 5
    );

    if (hasComponents) {
        payload.components.push(linkRow);
    } else {
        payload.components = [linkRow];
    }

    return interaction.reply(payload);
}

function generarBarraProgreso(current, max, length = 10) {
    const fillChar = "🟩";
    const emptyChar = "⬜";
    const fillCount = Math.round((current / max) * length);
    const emptyCount = length - fillCount;

    return fillChar.repeat(fillCount) + emptyChar.repeat(emptyCount) + ` (${Math.round((current / max) * 100)}%)`;
}
