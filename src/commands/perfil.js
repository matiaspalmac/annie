import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("perfil")
    .setDescription("Consulta tu progreso, nivel y moneditas en el Pueblito")
    .addUserOption(o => o.setName("vecino").setDescription("Mira el perfil de otro vecinito"));

export async function execute(interaction, bostezo) {
    const targetUser = interaction.options.getUser("vecino") || interaction.user;

    // Fetch user from DB
    const result = await db.execute({
        sql: "SELECT * FROM usuarios WHERE id = ?",
        args: [targetUser.id]
    });

    if (result.rows.length === 0) {
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: `${bostezo} Aún no sales a pasear por el pueblito... ¡escribe unos cuantos mensajitos en el chat y vuelve a preguntar!`, ephemeral: true });
        } else {
            return interaction.reply({ content: `Parece que **${targetUser.username}** no ha salido de su casita todavía.`, ephemeral: true });
        }
    }

    const userData = result.rows[0];

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
    const xpActual = Number(userData.xp);
    const nivelActual = Number(userData.nivel);

    // Reverse math from the level up formula: nivelNuevo = Math.floor(0.1 * Math.sqrt(xp)) + 1;
    // (nivelActual - 1) / 0.1 = sqrt(xp) => xp base for current level
    const xpBaseNivelDesc = Math.pow((nivelActual - 1) * 10, 2);
    const xpSigNivel = Math.pow(nivelActual * 10, 2);

    const progresoBarra = generarBarraProgreso(xpActual - xpBaseNivelDesc, xpSigNivel - xpBaseNivelDesc);

    const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setAuthor({
            name: `Perfil de ${targetUser.username}`,
            iconURL: targetUser.displayAvatarURL({ dynamic: true })
        })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: "⭐ Nivel", value: `**${nivelActual}**`, inline: true },
            { name: "💰 Moneditas", value: `**${userData.monedas}**`, inline: true },
            { name: "✨ Experiencia (XP)", value: `**${xpActual}** / ${xpSigNivel}`, inline: false },
            { name: "Progreso al sig. Nivel", value: progresoBarra, inline: false },
            { name: "📔 Libretita de Colecciones", value: coleccionesStr, inline: false }
        );

    // If they have a custom color role purchased
    if (userData.color_rol_id) {
        embed.setDescription("🎨 Este vecinito tiene un color personalizado en el chat.");
    } else {
        embed.setDescription("🌲 Un dulce habitante de nuestro pueblito.");
    }

    const payload = { content: bostezo, embeds: [embed] };

    // Attach ActionRow if they have collections
    if (opcionesMenu.length > 0) {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("perfil_ver_coleccion")
                .setPlaceholder("Explorar Libretita de Colecciones...")
                .addOptions(opcionesMenu)
        );
        payload.components = [row];
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
