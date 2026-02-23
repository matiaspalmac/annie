import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";

const TOOL_NAME = {
    herr_pico_basico: "Pico Básico",
    herr_pico_hierro: "Pico de Hierro",
    herr_pico_acero: "Pico de Acero",
    herr_hacha_basica: "Hacha Básica",
    herr_hacha_hierro: "Hacha de Hierro",
    herr_hacha_titanio: "Hacha de Titanio",
    herr_cana_basica: "Caña Básica",
    herr_cana_fibra: "Caña de Fibra",
    herr_cana_lunar: "Caña Lunar",
    herr_red_basica: "Red Básica",
    herr_red_fina: "Red Fina",
    herr_red_seda: "Red de Seda",
};

function prettyToolName(itemId) {
    return TOOL_NAME[itemId] || itemId;
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
            return interaction.editReply(
                `${bostezo}Tu mochila está vacía por ahora. Prueba con **/minar**, **/pescar**, **/capturar** o **/talar** y vuelve a mirar.`
            );
        }

        const objetosTxt = objetos.length > 0
            ? objetos
                .slice(0, 30)
                .map((r) => `• **${Number(r.cantidad)}x** ${String(r.item_id)}`)
                .join("\n")
                + (objetos.length > 30 ? `\n• *(+${objetos.length - 30} más...)*` : "")
            : "• (Sin objetos guardados)";

        const herramientasTxt = herramientas.length > 0
            ? herramientas
                .map((r) => {
                    const itemId = String(r.item_id);
                    const equipada = Number(r.equipado) === 1 ? " ✅ equipada" : "";
                    return `• ${prettyToolName(itemId)} — **${Number(r.durabilidad)}/${Number(r.max_durabilidad)}**${equipada}`;
                })
                .join("\n")
            : "• (Sin herramientas registradas aún)";

        const bostezito = getBostezo();
        return interaction.editReply(
            `${bostezito}🎒 **Tu Mochila del Pueblito**\n\n` +
            `**Objetos Farmeados**\n${objetosTxt}\n\n` +
            `**Herramientas Equipables**\n${herramientasTxt}\n\n` +
            `💡 Usa **/equipar** para cambiar tu pico/hacha/caña/red cuando gustes, corazón.`
        );
    } catch (error) {
        console.error("Error en comando /mochila:", error);
        return interaction.editReply(`${bostezo}Se me enredó la mochila y no pude revisarla ahora.`);
    }
}
