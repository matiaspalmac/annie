import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";

const TYPE_META = {
    pico: {
        like: "herr_pico_%",
        defaultId: "herr_pico_basico",
        defaultDur: 50,
        nombre: "pico",
    },
    hacha: {
        like: "herr_hacha_%",
        defaultId: "herr_hacha_basica",
        defaultDur: 55,
        nombre: "hacha",
    },
    cana: {
        like: "herr_cana_%",
        defaultId: "herr_cana_basica",
        defaultDur: 60,
        nombre: "caña",
    },
    red: {
        like: "herr_red_%",
        defaultId: "herr_red_basica",
        defaultDur: 60,
        nombre: "red",
    },
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

export const data = new SlashCommandBuilder()
    .setName("equipar")
    .setDescription("Equipa la herramienta que prefieras (pico, hacha, caña o red).")
    .addStringOption((option) =>
        option
            .setName("tipo")
            .setDescription("Familia de herramienta a equipar")
            .setRequired(true)
            .addChoices(
                { name: "Pico", value: "pico" },
                { name: "Hacha", value: "hacha" },
                { name: "Caña", value: "cana" },
                { name: "Red", value: "red" },
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
        if (!tipo) {
            await interaction.respond([]);
            return;
        }

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
            return interaction.editReply(`${bostezo}Ese tipo de herramienta no existe.`);
        }

        if (!/^herr_[a-z_]+$/i.test(herramienta)) {
            return interaction.editReply(`${bostezo}Ese identificador de herramienta no es válido.`);
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
            return interaction.editReply(`${bostezo}No tienes esa ${meta.nombre} en tu mochila o no corresponde al tipo elegido.`);
        }

        const durabilidad = Number(toolRes.rows[0].durabilidad || 0);
        const maxDurabilidad = Number(toolRes.rows[0].max_durabilidad || 0);
        if (durabilidad <= 0) {
            return interaction.editReply(`${bostezo}Esa herramienta está rota. Equipa otra o compra una nueva en **/tienda**.`);
        }

        await db.execute({
            sql: `UPDATE herramientas_durabilidad
                  SET equipado = CASE WHEN item_id = ? THEN 1 ELSE 0 END
                  WHERE user_id = ? AND item_id LIKE ?`,
            args: [herramienta, userId, meta.like],
        });

        const nombre = String(toolRes.rows[0].nombre || herramienta);
        const bostezito = getBostezo();
        return interaction.editReply(
            `${bostezito}🧰 ¡Listo, mi cielo! Equipaste **${nombre}** como tu ${meta.nombre} activa.\n` +
            `🛠️ Durabilidad actual: **${durabilidad}/${maxDurabilidad}**\n` +
            `Quedará guardada hasta que la cambies o se rompa. ¡A trabajar con cariño!`
        );
    } catch (error) {
        console.error("Error en comando /equipar:", error);
        return interaction.editReply(`${bostezo}No pude ajustar tu equipo ahora mismito.`);
    }
}
