import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

const TOOL_EMOJI = {
    herr_pico_basico: "⛏️",
    herr_pico_hierro: "⛏️",
    herr_pico_acero: "⛏️",
    herr_hacha_basica: "🪓",
    herr_hacha_hierro: "🪓",
    herr_hacha_titanio: "🪓",
    herr_cana_basica: "🎣",
    herr_cana_fibra: "🎣",
    herr_cana_lunar: "🎣",
    herr_red_basica: "🕸️",
    herr_red_fina: "🕸️",
    herr_red_seda: "🕸️",
};

const TOOL_NAME = {
    herr_pico_basico: "Pico Básico",
    herr_pico_hierro: "Pico de Hierro",
    herr_pico_acero: "Pico de Acero",
    herr_hacha_basica: "Hacha Básica",
    herr_hacha_hierro: "Hacha de Hierro",
    herr_hacha_titanio: "Hacha de Titanio",
    herr_cana_basica: "Caña Básica",
    herr_cana_fibra: "Caña de Fibra de Vidrio",
    herr_cana_lunar: "Caña Lunar",
    herr_red_basica: "Red Básica",
    herr_red_fina: "Red Fina",
    herr_red_seda: "Red de Seda",
};

function prettyToolName(itemId) { return TOOL_NAME[itemId] || itemId; }
function toolEmoji(itemId) { return TOOL_EMOJI[itemId] || "🛠️"; }

function durabilidadBarra(dur, max) {
    const pct = max > 0 ? dur / max : 0;
    if (pct >= 0.75) return `🟩 \`${dur}/${max}\``;
    if (pct >= 0.4) return `🟨 \`${dur}/${max}\``;
    if (pct > 0) return `🟥 \`${dur}/${max}\``;
    return `⬛ \`0/${max}\` *(rota)*`;
}

// Categoría de item por nombre
function clasificarItem(itemId) {
    const id = itemId.toLowerCase();
    if (["diamante puro", "esmeralda brillante", "rubí carmesí", "zafiro estelar", "amatista cristalina", "fluorita impecable", "topacio dorado", "cuarzo rosa"].some(g => id.includes(g.split(" ")[0]))) return "💎";
    if (["vela", "pez", "bagre", "carpa", "trucha", "salmón", "barracuda", "tiburón", "raya", "kraken"].some(g => id.includes(g))) return "🐟";
    if (["manzana", "pera", "ciruela", "naranja", "limón", "sandía", "melón", "uva", "cereza", "plátano", "durazno", "coco", "fresa", "fruta"].some(g => id.includes(g))) return "🍒";
    if (["hormiga", "mosca", "mariposa", "escarabajo", "grillo", "libélula", "tarántula", "oruga", "polilla", "mantis", "catarina", "mariquita", "abeja", "araña", "caracol", "cicada", "escorpión"].some(g => id.includes(g))) return "🐛";
    if (["foto", "imagen"].some(g => id.includes(g))) return "📸";
    if (["pluma", "huevo", "nido", "rama dorada"].some(g => id.includes(g))) return "🪶";
    if (["mineral", "hierro", "cobre", "jade", "ópalo", "obsidiana", "piedra", "grava", "roca"].some(g => id.includes(g))) return "🪨";
    return "📦";
}

export const data = new SlashCommandBuilder()
    .setName("mochila")
    .setDescription("Muestra tu inventario y herramientas equipables del pueblito.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
        const [invRes, toolsRes] = await Promise.all([
            db.execute({
                sql: `SELECT item_id, cantidad
                      FROM inventario_economia
                      WHERE user_id = ? AND cantidad > 0
                      ORDER BY cantidad DESC, item_id ASC
                      LIMIT 50`,
                args: [userId],
            }),
            db.execute({
                sql: `SELECT item_id, durabilidad, max_durabilidad, equipado
                      FROM herramientas_durabilidad
                      WHERE user_id = ?
                      ORDER BY equipado DESC, durabilidad DESC, item_id ASC`,
                args: [userId],
            }),
        ]);

        const objetos = invRes.rows;
        const herramientas = toolsRes.rows;

        if (objetos.length === 0 && herramientas.length === 0) {
            const embed = crearEmbed(CONFIG.COLORES.ROSA)
                .setTitle("🎒 ¡Mochila vacía!")
                .setDescription(
                    `${bostezo}Tu mochila está vacía por ahora, corazón.\n\n` +
                    `Prueba con \`/minar\`, \`/pescar\`, \`/capturar\` o \`/talar\` ¡y vuelve a mirar!`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const embed = crearEmbed(CONFIG.COLORES.VIOLETA)
            .setTitle("🎒 Mochila del Pueblito")
            .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

        // Herramientas
        if (herramientas.length > 0) {
            const toolLines = herramientas.map(r => {
                const id = String(r.item_id);
                const equipada = Number(r.equipado) === 1 ? " ✅" : "";
                const emo = toolEmoji(id);
                const dur = durabilidadBarra(Number(r.durabilidad), Number(r.max_durabilidad));
                return `${emo} **${prettyToolName(id)}**${equipada} — ${dur}`;
            }).join("\n");

            embed.addFields({ name: "🛠️ Herramientas", value: toolLines, inline: false });
        }

        // Inventario agrupado por categoría
        if (objetos.length > 0) {
            // Agrupar por categoría emoji
            const grupos = {};
            for (const r of objetos.slice(0, 30)) {
                const cat = clasificarItem(String(r.item_id));
                if (!grupos[cat]) grupos[cat] = [];
                grupos[cat].push(`**${Number(r.cantidad)}x** ${String(r.item_id)}`);
            }

            const catNombres = {
                "💎": "Gemas & Minerales",
                "🐟": "Peces",
                "🍒": "Frutas",
                "🐛": "Insectos & Criaturas",
                "📸": "Fotografías",
                "🪶": "Naturaleza",
                "🪨": "Rocas & Minerales Comunes",
                "📦": "Objetos Varios",
            };

            for (const [emoji, items] of Object.entries(grupos)) {
                embed.addFields({
                    name: `${emoji} ${catNombres[emoji] || "Objetos"}`,
                    value: items.join(", "),
                    inline: false
                });
            }

            if (objetos.length > 30) {
                embed.addFields({ name: "...", value: `*(+${objetos.length - 30} objetos más)*`, inline: false });
            }
        }

        embed.addFields({
            name: "💡 Consejo",
            value: "Usa `/equipar` para cambiar tu pico/hacha/caña/red cuando gustes.",
            inline: false
        });

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /mochila:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Mochila enredada!")
            .setDescription(`${bostezo}Se me enredó la mochila y no pude revisarla ahora. ¡Intentemos de nuevo!`);
        return interaction.editReply({ embeds: [embed] });
    }
}
