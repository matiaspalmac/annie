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
        const chanceFrutaEpica = Math.min(5 + bonusEstacion + bonusSuerte + (bonusHacha / 2), 25);
        const chanceFrutaRara = Math.min(12 + bonusEstacion + bonusSuerte + bonusHacha, 40);
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

            if (subRand <= 20) {
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

            if (subRand <= 40) {
                const nidoTipo = Math.floor(Math.random() * 3);
                if (nidoTipo === 0) {
                    await db.execute({
                        sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                              VALUES (?, 'Huevo de Pájaro', 1)
                              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                        args: [userId]
                    });
                    return interaction.followUp(
                        `🥚 **¡Evento: nido con huevito!**\n` +
                        `¡Qué ternura! Encontraste **1x 🥚 Huevo de Pájaro** en un nido oculto.` +
                        textoDurabilidad
                    );
                } else if (nidoTipo === 1) {
                    const pajaritos = Math.floor(Math.random() * 5) + 3;
                    await db.execute({
                        sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?",
                        args: [pajaritos, userId]
                    });
                    return interaction.followUp(
                        `🐦 **¡Evento: nido de pajaritos!**\n` +
                        `Los pichoncitos pió pió y su mamá te dio **${pajaritos} moneditas** de agradecimiento.` +
                        textoDurabilidad
                    );
                } else {
                    await db.execute({
                        sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                              VALUES (?, 'Rama Dorada', 1)
                              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                        args: [userId]
                    });
                    return interaction.followUp(
                        `✨ **¡Evento: rama mágica!**\n` +
                        `¡Una rama del árbol brillaba en dorado! Recogiste **1x 🌿 Rama Dorada**.` +
                        textoDurabilidad
                    );
                }
            }

            if (subRand <= 60) {
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

            if (subRand <= 80) {
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

            // Nuevo evento: ardilla traviesa
            const ardillaLoot = Math.floor(Math.random() * 15) + 10;
            await db.execute({
                sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?",
                args: [ardillaLoot, userId]
            });
            return interaction.followUp(
                `🐿️ **¡Evento: ardilla traviesa!**\n` +
                `¡Una ardillita dejó caer su tesoro escondido! Ganaste **${ardillaLoot} moneditas**.` +
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
        } else if (rand <= chanceAbejas + chanceMonedas + chanceFrutaEpica) {
            // Frutas EPICAS
            const frutasEpicas = [
                { id: "Manzana Dorada", emoji: "🍎", cantidad: 1, texto: "¡Brilla como el sol!" },
                { id: "Duraz no Plateado", emoji: "🍒", cantidad: 1, texto: "Su piel parece metal precioso" },
                { id: "Pera Cristalina", emoji: "🍐", texto: "¡Casi transparente y brillante!" },
                { id: "Ciruela Mágica", emoji: "🫐", cantidad: 1, texto: "Emana un aura mística" }
            ];
            
            const elegida = frutasEpicas[Math.floor(Math.random() * frutasEpicas.length)];
            
            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
              VALUES (?, ?, ?) 
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?`,
                args: [userId, elegida.id, elegida.cantidad || 1, elegida.cantidad || 1]
            });

            await registrarBitacora(userId, `¡Sacó una ${elegida.id} épica del árbol!`);

            return interaction.followUp(
                `🌳 *El árbol brilla...* \n\n✨ **¡FRUTA ÉPICA!** \n` +
                `${elegida.texto} Has recogido **${elegida.cantidad}x ${elegida.emoji} ${elegida.id}**. *(Nv. Recolección: ${nivelRecoleccion})*` +
                textoDurabilidad
            );
        } else if (rand <= chanceAbejas + chanceMonedas + chanceFrutaEpica + chanceFrutaRara) {
            // Frutas RARAS
            const frutasRaras = [
                { id: "Naranjas", emoji: "🍊", cantidad: 4, texto: "¡Muy jugosas!" },
                { id: "Peras", emoji: "🍐", cantidad: 3, texto: "¡Dulces y maduras!" },
                { id: "Duraznos", emoji: "🍑", cantidad: 3, texto: "¡Suavecitos y fragantes!" },
                { id: "Ciruelas", emoji: "🫐", cantidad: 4, texto: "Moraditas perfectas" },
                { id: "Cerezas", emoji: "🍒", cantidad: 5, texto: "Rojitas y brillantes" },
                { id: "Lim ones", emoji: "🍋", cantidad: 4, texto: "¡Ac iditos!" }
            ];
            
            const elegida = frutasRaras[Math.floor(Math.random() * frutasRaras.length)];
            
            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
              VALUES (?, ?, ?) 
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?`,
                args: [userId, elegida.id, elegida.cantidad, elegida.cantidad]
            });

            return interaction.followUp(
                `🌳 *Shake, shake... thump!* \n\n` +
                `${elegida.texto} Has recogido **${elegida.cantidad}x ${elegida.emoji} ${elegida.id}**. *(Nv. Recolección: ${nivelRecoleccion})*` +
                textoDurabilidad
            );
        } else {
            // Frutas COMUNES
            const frutasComunes = [
                { id: "Manzanas", emoji: "🍎", cantidad: 3 },
                { id: "Coco", emoji: "🥥", cantidad: 2 },
                { id: "Plátanos", emoji: "🍌", cantidad: 4 },
                { id: "Fresas", emoji: "🍓", cantidad: 5 },
                { id: "Uvas", emoji: "🍇", cantidad: 6 },
                { id: "Sandía", emoji: "🍉", cantidad: 1 },
                { id: "Melón", emoji: "🍈", cantidad: 1 }
            ];
            
            const elegida = frutasComunes[Math.floor(Math.random() * frutasComunes.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
              VALUES (?, ?, ?) 
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?`,
                args: [userId, elegida.id, elegida.cantidad, elegida.cantidad]
            });

            const mensajesSacudir = [
                "¡Cayeron unos frutos deliciosos, tesoro!",
                "*Thump thump!* ¡Mira cuántas frutas!",
                "¡Qué lindo! El árbol estaba cargadito.",
                "*Plop!* Ca yeron frutas maduritas.",
                "¡Excelente cosecha, mi cielo!"
            ];
            const mensajeAleatorio = mensajesSacudir[Math.floor(Math.random() * mensajesSacudir.length)];

            return interaction.followUp(
                `🌳 *Shake, shake... thump!* \n\n` +
                `${mensajeAleatorio} Has recogido **${elegida.cantidad}x ${elegida.emoji} ${elegida.id}**.\n` +
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
