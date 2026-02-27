import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

const TYPE_META = {
    pico: { like: "herr_pico_%", defaultId: "herr_pico_basico", defaultDur: 50, nombre: "pico", emoji: "⛏️" },
    hacha: { like: "herr_hacha_%", defaultId: "herr_hacha_basica", defaultDur: 55, nombre: "hacha", emoji: "🪓" },
    cana: { like: "herr_cana_%", defaultId: "herr_cana_basica", defaultDur: 60, nombre: "caña", emoji: "🎣" },
    red: { like: "herr_red_%", defaultId: "herr_red_basica", defaultDur: 60, nombre: "red", emoji: "🕸️" },
};

async function ensureDefaultTool(userId, typeKey) {
    const meta = TYPE_META[typeKey];
    if (!meta) return;
    await db.execute({
        sql: `INSERT OR IGNORE INTO herramientas_durabilidad (user_id, item_id, durabilidad, max_durabilidad, equipado)
              VALUES (?, ?, ?, ?, 0)`,
        args: [userId, meta.defaultId, meta.defaultDur, meta.defaultDur],
    });
}

function normalizeTipo(value) {
    const tipo = String(value || "").toLowerCase();
    return TYPE_META[tipo] ? tipo : null;
}

function durColor(dur, max) {
    const pct = max > 0 ? dur / max : 0;
    if (pct >= 0.75) return "🟩";
    if (pct >= 0.4) return "🟨";
    if (pct > 0) return "🟥";
    return "⬛";
}

export const data = new SlashCommandBuilder()
    .setName("equipar")
    .setDescription("Equipa la herramienta que prefieras (pico, hacha, caña o red).")
    .addStringOption((option) =>
        option
            .setName("tipo")
            .setDescription("Familia de herramienta a equipar")
            .setRequired(true)
            .addChoices(
                { name: "⛏️ Pico", value: "pico" },
                { name: "🪓 Hacha", value: "hacha" },
                { name: "🎣 Caña", value: "cana" },
                { name: "🕸️ Red", value: "red" },
            )
    )
    .addStringOption((option) =>
        option
            .setName("herramienta")
            .setDescription("Herramienta específica que quieres equipar")
            .setRequired(true)
            .setAutocomplete(true)
    );

export async function autocomplete(interaction) {
    try {
        const userId = interaction.user.id;
        const focused = interaction.options.getFocused(true).value?.trim().toLowerCase() || "";
        const tipo = normalizeTipo(interaction.options.getString("tipo"));
        if (!tipo) { await interaction.respond([]); return; }

        const likePattern = TYPE_META[tipo].like;
        const term = `%${focused}%`;

        const res = await db.execute({
            sql: `SELECT hd.item_id, hd.durabilidad, hd.max_durabilidad, COALESCE(ti.nombre, hd.item_id) AS nombre
                  FROM herramientas_durabilidad hd
                  LEFT JOIN tienda_items ti ON ti.id = hd.item_id
                  WHERE hd.user_id = ?
                    AND hd.item_id LIKE ?
                    AND hd.durabilidad > 0
                    AND (LOWER(hd.item_id) LIKE ? OR LOWER(COALESCE(ti.nombre, hd.item_id)) LIKE ?)
                  ORDER BY hd.equipado DESC, hd.durabilidad DESC, hd.item_id ASC
                  LIMIT 25`,
            args: [userId, likePattern, term, term],
        });

        const options = res.rows.map((row) => ({
            name: `${String(row.nombre).slice(0, 70)} · ${Number(row.durabilidad)}/${Number(row.max_durabilidad)}`,
            value: String(row.item_id),
        }));

        await interaction.respond(options);
    } catch (error) {
        console.error("Error autocomplete /equipar", error);
        await interaction.respond([]).catch(() => { });
    }
}

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const tipo = normalizeTipo(interaction.options.getString("tipo", true));
    const herramienta = interaction.options.getString("herramienta", true).trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        if (!tipo) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("❓ Tipo inválido")
                .setDescription(`${bostezo}Ese tipo de herramienta no existe. Elige entre pico, hacha, caña o red.`);
            return interaction.editReply({ embeds: [embed] });
        }

        if (!/^herr_[a-z_]+$/i.test(herramienta)) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("❓ Herramienta inválida")
                .setDescription(`${bostezo}Ese identificador no es válido. Usa el autocompletado para elegir correctamente.`);
            return interaction.editReply({ embeds: [embed] });
        }

        const meta = TYPE_META[tipo];
        await ensureDefaultTool(userId, tipo);

        const toolRes = await db.execute({
            sql: `SELECT hd.item_id, hd.durabilidad, hd.max_durabilidad, COALESCE(ti.nombre, hd.item_id) AS nombre
                  FROM herramientas_durabilidad hd
                  LEFT JOIN tienda_items ti ON ti.id = hd.item_id
                  WHERE hd.user_id = ?
                    AND hd.item_id = ?
                    AND hd.item_id LIKE ?
                  LIMIT 1`,
            args: [userId, herramienta, meta.like],
        });

        if (toolRes.rows.length === 0) {
            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("❌ No encontrada")
                .setDescription(`${bostezo}No tienes esa ${meta.nombre} en tu mochila o no corresponde al tipo elegido.`);
            return interaction.editReply({ embeds: [embed] });
        }

        const durabilidad = Number(toolRes.rows[0].durabilidad || 0);
        const maxDurabilidad = Number(toolRes.rows[0].max_durabilidad || 0);

        if (durabilidad <= 0) {
            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("💔 ¡Herramienta rota!")
                .setDescription(`${bostezo}Esa herramienta está rota. Equipa otra o compra una nueva en \`/tienda\`.`);
            return interaction.editReply({ embeds: [embed] });
        }

        await db.execute({
            sql: `UPDATE herramientas_durabilidad
                  SET equipado = CASE WHEN item_id = ? THEN 1 ELSE 0 END
                  WHERE user_id = ? AND item_id LIKE ?`,
            args: [herramienta, userId, meta.like],
        });

        const nombre = String(toolRes.rows[0].nombre || herramienta);
        const dc = durColor(durabilidad, maxDurabilidad);

        const embed = crearEmbed(CONFIG.COLORES.VERDE)
            .setTitle(`${meta.emoji} ¡Herramienta equipada!`)
            .setDescription(
                `${bostezo}¡Listo, mi cielo! Equipaste **${nombre}** como tu ${meta.nombre} activa. ¡A trabajar con cariño!`
            )
            .addFields(
                { name: `${meta.emoji} Herramienta`, value: `**${nombre}**`, inline: true },
                { name: "🔋 Durabilidad", value: `${dc} \`${durabilidad}/${maxDurabilidad}\``, inline: true }
            );

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /equipar:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ Error al equipar")
            .setDescription(`${bostezo}No pude ajustar tu equipo ahora mismito. Inténtalo de nuevo.`);
        return interaction.editReply({ embeds: [embed] });
    }
}
