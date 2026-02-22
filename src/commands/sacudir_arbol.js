import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { getBostezo } from "../utils.js";
import { ganarXP, registrarEstadistica, registrarBitacora } from "../progreso.js";

// Cooldown de 3 minutos = 180000 ms
const COOLDOWN_ARBOL = 180000;

export const data = new SlashCommandBuilder()
    .setName("sacudir_arbol")
    .setDescription("Mueve las ramas de un árbol frutal a ver qué cae (¡Cuidado con las abejas!).");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'sacudir_arbol' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Uy tesoro, ya sacudiste todos los frutales cercanos. Sientate a descansar **${faltanMinutos} minutos** antes de volver a intentarlo.`);
            }
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_ARBOL;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'sacudir_arbol', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        // Ganar XP de Recolección (10 a 20 xp por intento)
        const xpGanada = Math.floor(Math.random() * 11) + 10;
        const nivelRecoleccion = await ganarXP(userId, "recoleccion", xpGanada, interaction);

        // Registrar estadística de árboles sacudidos para el título "Manos de Tijera"
        await registrarEstadistica(userId, "arboles_sacudidos", 1, interaction);

        // 3. Lógica de drops
        // A mayor nivel, menos chance de abejas y más chance de lluvia de monedas
        const bonoNivel = (nivelRecoleccion - 1) * 0.5;
        const chanceAbejas = Math.max(10 - bonoNivel, 2); // Mínimo 2% de abejas
        const chanceMonedas = Math.min(20 + bonoNivel, 45); // Máximo 45% de lluvia

        const rand = Math.random() * 100;

        if (rand <= chanceAbejas) {
            // Panal de abejas - pierde 5 a 15 monedas
            const monedasPerdidas = Math.floor(Math.random() * 11) + 5;

            await db.execute({
                sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?",
                args: [monedasPerdidas, userId]
            });

            await registrarBitacora(userId, `Huyó despavorido/a de un enjambre de Abejas.`);

            return interaction.followUp(`🌳 *Shake, shake...* \n\n🐝 **¡BZZZ! ¡UN PANAL DE ABEJAS!** 🐝\n\nSaliste corriendo pero te picaron igual. En el escándalo, se te cayeron **${monedasPerdidas} moneditas**. ¡Pobrecito mi niño! *(Nv. Recolección: ${nivelRecoleccion})*`);
        } else if (rand <= chanceAbejas + chanceMonedas) {
            // Lluvia de monedas - gana 10 a 30 monedas + bono
            const monedasGanadas = Math.floor(Math.random() * 21) + 10 + (nivelRecoleccion * 2);

            await db.execute({
                sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
              VALUES (?, ?, 0, 1) 
              ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
                args: [userId, monedasGanadas]
            });

            await registrarBitacora(userId, `¡Encontró una bolsa mágica de moneditas en un árbol!`);

            return interaction.followUp(`🌳 *Shake, shake...* \n\n💰 **¡CLINK CLINK!** \n\n¡En vez de frutas, te llovieron del cielo **${monedasGanadas} moneditas**! A veces la magia del pueblito te sorprende. *(Nv. Recolección: ${nivelRecoleccion})*`);
        } else {
            // Frutas normales - 3 manzanas
            const itemId = "Manzanas";
            const emoji = "🍎";

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
              VALUES (?, ?, 3) 
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 3`,
                args: [userId, itemId]
            });

            return interaction.followUp(`🌳 *Shake, shake... thump!* \n\n¡Cayeron unos frutos deliciosos! Has recogido **3x ${emoji} ${itemId}**.\nGuárdalas en la canasta para venderlas después. *(Nv. Recolección: ${nivelRecoleccion})*`);
        }

    } catch (error) {
        console.error("Error en comando /sacudir_arbol:", error);
        return interaction.followUp(`${bostezo}La rama estaba muy alta y no pude sacudir el arbolito. Perdón, mi cielo.`);
    }
}
