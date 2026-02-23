import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";
import { ganarXP, registrarEstadistica, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";

// Cooldown de 5 minutos = 300000 ms
const COOLDOWN_ARBOL = 300000;

const AXE_META = {
    herr_hacha_titanio: { bonusRare: 12, nombre: "Hacha de Titanio", maxDurabilidad: 125 },
    herr_hacha_hierro: { bonusRare: 7, nombre: "Hacha de Hierro", maxDurabilidad: 85 },
};

async function getEquippedAxe(userId) {
    const res = await db.execute({
        sql: `SELECT item_id, durabilidad, max_durabilidad
              FROM herramientas_durabilidad
              WHERE user_id = ? AND equipado = 1 AND item_id LIKE 'herr_hacha_%'
              LIMIT 1`,
        args: [userId]
    });

    if (res.rows.length > 0) {
        return {
            itemId: String(res.rows[0].item_id),
            durabilidad: Number(res.rows[0].durabilidad || 0),
            maxDurabilidad: Number(res.rows[0].max_durabilidad || 0),
        };
    }

    await db.execute({
        sql: `INSERT OR IGNORE INTO herramientas_durabilidad (user_id, item_id, durabilidad, max_durabilidad, equipado)
              VALUES (?, 'herr_hacha_basica', 55, 55, 1)`,
        args: [userId]
    });

    return { itemId: "herr_hacha_basica", durabilidad: 55, maxDurabilidad: 55 };
}

export const data = new SlashCommandBuilder()
    .setName("talar")
    .setDescription("Mueve las ramas de un árbol frutal a ver qué cae (¡Cuidado con las abejas!).");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'talar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Uy tesoro, ya sacudiste todos los frutales cercanos. Sientate a descansar **${faltanMinutos} minutos** antes de volver a intentarlo.`);
            }
        }

        // 2. Validar herramienta ANTES de consumir cooldown
        const axe = await getEquippedAxe(userId);
        if (axe.durabilidad <= 0) {
            return interaction.followUp(`${bostezo}Tu hacha equipada está rota. Pásate por **/tienda** o equipa otra con **/equipar**.`);
        }

        // 3. Establecer cooldown (herramienta validada)
        const nuevoLimite = ahora + COOLDOWN_ARBOL;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'talar', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        // Ganar XP de Recolección (10 a 20 xp por intento)
        const xpGanada = Math.floor(Math.random() * 11) + 10;
        const nivelRecoleccion = await ganarXP(userId, "recoleccion", xpGanada, interaction);

        // Registrar estadística de árboles sacudidos para el título "Manos de Tijera"
        await registrarEstadistica(userId, "arboles_sacudidos", 1, interaction);

        // 3. Lógica de drops (clima + estación + eventos raros)
        // A mayor nivel, menos chance de abejas y más chance de lluvia de monedas
        const bonoNivel = (nivelRecoleccion - 1) * 0.5;
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 10 : 0;
        const bonusHacha = AXE_META[axe.itemId]?.bonusRare || 0;

        const resClima = await db.execute("SELECT tipo FROM clima WHERE id = 'hoy' LIMIT 1");
        const climaTipo = String(resClima.rows[0]?.tipo || "").toLowerCase();
        const climaAbejas = climaTipo.includes("soleado") ? 2 : (climaTipo.includes("lluv") ? -2 : 0);
        const climaMonedas = climaTipo.includes("viento") ? 5 : 0;

        const month = new Date().getMonth() + 1;
        const bonusEstacion = [3, 4, 5].includes(month) ? 4 : 0; // otoño con más frutos/objetos

        const chanceAbejas = Math.max((10 - bonoNivel + climaAbejas) - (amuletoActivo ? 4 : 0), 1); // Mínimo 1% de abejas
        const chanceMonedas = Math.min(20 + bonoNivel + bonusSuerte + climaMonedas + (bonusHacha / 2), 55); // Máximo 55% de lluvia
        const chanceEventoRaro = Math.min(8 + bonusEstacion + (bonusSuerte / 2) + bonusHacha, 28);

        const rand = Math.random() * 100;

        await db.execute({
            sql: "UPDATE herramientas_durabilidad SET durabilidad = MAX(0, durabilidad - 1) WHERE user_id = ? AND item_id = ?",
            args: [userId, axe.itemId]
        });

        const resAxeAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, axe.itemId]
        });
        const durRestante = Number(resAxeAfter.rows[0]?.durabilidad || 0);
        const textoDurabilidad = `\n🛠️ Durabilidad de ${AXE_META[axe.itemId]?.nombre || "Hacha básica"}: **${durRestante}/${axe.maxDurabilidad}**`;

        if (rand <= chanceEventoRaro) {
            const subRand = Math.random() * 100;

            if (subRand <= 33) {
                await db.execute({
                    sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                          VALUES (?, 'Pluma brillante', 1)
                          ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                    args: [userId]
                });

                return interaction.followUp(
                    `🌳 **¡Evento raro: nido escondido!**\n` +
                    `Entre las ramas apareció un nido suavecito y encontraste **1x 🪶 Pluma brillante**.\n` +
                    `📊 Tabla de drops base: Abejas ${chanceAbejas.toFixed(1)}% • Monedas ${chanceMonedas.toFixed(1)}% • Frutas resto` +
                    textoDurabilidad
                );
            }

            if (subRand <= 66) {
                const perdida = Math.floor(Math.random() * 9) + 7;
                await db.execute({
                    sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?",
                    args: [perdida, userId]
                });
                return interaction.followUp(
                    `🐝 **¡Evento raro: colmena enojada!**\n` +
                    `Te persiguieron abejitas furiosas y perdiste **${perdida} moneditas** en la huida.\n` +
                    `📊 Tabla de drops base: Abejas ${chanceAbejas.toFixed(1)}% • Monedas ${chanceMonedas.toFixed(1)}% • Frutas resto` +
                    textoDurabilidad
                );
            }

            const monedasDorado = Math.floor(Math.random() * 31) + 25;
            await db.execute({
                sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?",
                args: [monedasDorado, userId]
            });

            return interaction.followUp(
                `🍎 **¡Evento raro: fruto dorado!**\n` +
                `Cayó un fruto dorado mágico y lo cambiaste por **${monedasDorado} moneditas**.\n` +
                `📊 Tabla de drops base: Abejas ${chanceAbejas.toFixed(1)}% • Monedas ${chanceMonedas.toFixed(1)}% • Frutas resto` +
                textoDurabilidad
            );
        }

        if (rand <= chanceAbejas) {
            // Panal de abejas - pierde 5 a 15 monedas
            const monedasPerdidas = Math.floor(Math.random() * 11) + 5;

            await db.execute({
                sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?",
                args: [monedasPerdidas, userId]
            });

            await registrarBitacora(userId, `Huyó despavorido/a de un enjambre de Abejas.`);

            return interaction.followUp(
                `🌳 *Shake, shake...* \n\n🐝 **¡BZZZ! ¡UN PANAL DE ABEJAS!** 🐝\n\n` +
                `Saliste corriendo pero te picaron igual. En el escándalo, se te cayeron **${monedasPerdidas} moneditas**. ¡Pobrecito mi niño! *(Nv. Recolección: ${nivelRecoleccion})*` +
                textoDurabilidad
            );
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

            return interaction.followUp(
                `🌳 *Shake, shake...* \n\n💰 **¡CLINK CLINK!** \n\n` +
                `¡En vez de frutas, te llovieron del cielo **${monedasGanadas} moneditas**! A veces la magia del pueblito te sorprende. *(Nv. Recolección: ${nivelRecoleccion})*` +
                textoDurabilidad
            );
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

            return interaction.followUp(
                `🌳 *Shake, shake... thump!* \n\n` +
                `¡Cayeron unos frutos deliciosos, tesoro! Has recogido **3x ${emoji} ${itemId}**.\n` +
                `Guárdalas en la canasta para venderlas después, ¿ya? *(Nv. Recolección: ${nivelRecoleccion})*\n\n` +
                `📊 Tabla de drops base: Abejas ${chanceAbejas.toFixed(1)}% • Monedas ${chanceMonedas.toFixed(1)}% • Frutas resto` +
                textoDurabilidad
            );
        }

    } catch (error) {
        console.error("Error en comando /talar:", error);
        return interaction.followUp(`${bostezo}La rama estaba muy alta y no pude sacudir el arbolito. Perdón, mi cielo.`);
    }
}
