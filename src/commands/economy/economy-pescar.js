import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";
import { ganarXP, obtenerNivelHabilidad, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";

// Cooldown de 5 minutos = 300000 ms
const COOLDOWN_PESCAR = 300000;

const ROD_META = {
    herr_cana_lunar: { bonusRare: 12, bonusLegend: 6, nombre: "Caña Lunar" },
    herr_cana_fibra: { bonusRare: 7, bonusLegend: 3, nombre: "Caña de Fibra" },
};

function getChileHour() {
    const formatter = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", hour12: false });
    return Number(formatter.format(new Date()));
}

function getFranja(hora) {
    if (hora >= 6 && hora < 12) return "manana";
    if (hora >= 12 && hora < 19) return "tarde";
    if (hora >= 19 && hora < 23) return "noche";
    return "madrugada";
}

async function getEquippedRod(userId) {
    const res = await db.execute({
        sql: `SELECT item_id, durabilidad, max_durabilidad
              FROM herramientas_durabilidad
              WHERE user_id = ? AND equipado = 1 AND item_id LIKE 'herr_cana_%'
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
              VALUES (?, 'herr_cana_basica', 60, 60, 1)`,
        args: [userId]
    });

    return { itemId: "herr_cana_basica", durabilidad: 60, maxDurabilidad: 60 };
}

export const data = new SlashCommandBuilder()
    .setName("pescar")
    .setDescription("Lanza tu caña en el río del pueblito a ver qué pica.")
    .addBooleanOption(option =>
        option
            .setName("usar_cebo")
            .setDescription("Usar automáticamente 1 cebo simple si tienes")
            .setRequired(false)
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();
    const usarCebo = interaction.options.getBoolean("usar_cebo") ?? true;

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'pescar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Ay pescadito... los peces se asustaron y se fueron al fondo. Espera **${faltanMinutos} minutos** para volver a tirar la caña.`);
            }
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_PESCAR;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'pescar', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        const rod = await getEquippedRod(userId);
        if (rod.durabilidad <= 0) {
            return interaction.followUp(`${bostezo}Tu caña equipada está rota, mi cielo. Pasa por **/tienda** a conseguir una nueva.`);
        }

        let bonusCebo = 0;
        let consumioCebo = false;

        if (usarCebo) {
            const resCebo = await db.execute({
                sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = 'cebo_simple'",
                args: [userId]
            });

            if (resCebo.rows.length > 0 && Number(resCebo.rows[0].cantidad) > 0) {
                await db.execute({
                    sql: "UPDATE inventario_economia SET cantidad = MAX(0, cantidad - 1) WHERE user_id = ? AND item_id = 'cebo_simple'",
                    args: [userId]
                });
                bonusCebo = 8;
                consumioCebo = true;
            }
        }

        // Ganar XP de Pesca (10 a 25 xp por intento)
        const xpGanada = Math.floor(Math.random() * 16) + 10;
        const nivelPesca = await ganarXP(userId, "pesca", xpGanada, interaction);

        // 3. Lógica de drops (franja horaria + caña + cebo + mini-evento legendario)
        const horaChile = getChileHour();
        const franja = getFranja(horaChile);
        const bonoNivel = (nivelPesca - 1) * 0.5;
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 8 : 0;
        const bonusRod = ROD_META[rod.itemId] || { bonusRare: 0, bonusLegend: 0, nombre: "Caña Básica" };

        // 🌦️ Bonos por Clima actual del pueblito
        let bonusClimaPeces = 0;
        let mensajeClima = "";
        try {
            const resClima = await db.execute("SELECT texto FROM clima WHERE id = 'hoy'");
            if (resClima.rows.length > 0) {
                const climaTexto = String(resClima.rows[0].texto || "").toLowerCase();
                if (climaTexto.includes("lluvia") || climaTexto.includes("tormenta") || climaTexto.includes("llovizna")) {
                    bonusClimaPeces = 6; // Lluvia: los peces suben a la superficie
                    mensajeClima = "☔ *La lluvia del pueblito hace que los peces suban a la superficie. +6% de suerte hoy!*\n";
                } else if (climaTexto.includes("sol")) {
                    bonusClimaPeces = 0; // Soleado: normal
                    mensajeClima = "☀️ *El sol calienta el río y los peces nadan tranquilos. Condiciones normales.*\n";
                } else if (climaTexto.includes("nieve") || climaTexto.includes("frio") || climaTexto.includes("frío")) {
                    bonusClimaPeces = -5; // Frío: los peces se van al fondo
                    mensajeClima = "❄️ *El frío del pueblito hace que los peces se escondan en el fondo. -5% de suerte hoy...*\n";
                } else if (climaTexto.includes("nublado") || climaTexto.includes("nube")) {
                    bonusClimaPeces = 2;
                    mensajeClima = "⛅ *El cielo nublado hace el ambiente perfecto para pescar. +2% de suerte!*\n";
                }
            }
        } catch { /* Si falla el clima, solo ignoramos el bono */ }

        const chanceMitico = Math.min(0.5 + (bonoNivel * 0.1) + bonusSuerte + bonusRod.bonusLegend + bonusCebo + bonusClimaPeces, 8);
        const chanceLegendaria = Math.min(3 + (bonoNivel * 0.25) + bonusSuerte + bonusRod.bonusLegend + bonusCebo + bonusClimaPeces, 18);
        const chanceEpica = Math.min(8 + (bonoNivel * 0.4) + bonusSuerte + bonusRod.bonusRare + bonusCebo + bonusClimaPeces, 30);
        const chanceRara = Math.min(15 + (bonoNivel * 0.6) + bonusSuerte + bonusRod.bonusRare + bonusCebo + bonusClimaPeces, 45);
        const chanceBotella = Math.min(20 + bonoNivel + bonusSuerte + bonusRod.bonusRare + bonusCebo, 60);
        const rand = Math.random() * 100;

        await db.execute({
            sql: "UPDATE herramientas_durabilidad SET durabilidad = MAX(0, durabilidad - 1) WHERE user_id = ? AND item_id = ?",
            args: [userId, rod.itemId]
        });

        const resRodAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, rod.itemId]
        });
        const durabilidadRestante = Number(resRodAfter.rows[0]?.durabilidad || 0);

        // MITICO - Super raro
        if (rand <= chanceMitico) {
            const pecesmiticos = [
                { id: "Dragón Marino", emoji: "🐉", texto: "¡¡IMPOSIBLE!! ¡Capturaste un mítico Dragón Marino! ¡Los pescadores hablan de esto por generaciones!" },
                { id: "Leviatán Bebé", emoji: "🐳", texto: "¡POR TODOS LOS CIELOS! ¡Un bebé Leviatán! ¡Esto es legendario!" },
                { id: "Sirena Escamosa", emoji: "🧜", texto: "¡NO PUEDE SER! ¿Una Sirena? ¡Esto desafía toda lógica!" }
            ];
            const elegido = pecesmiticos[Math.floor(Math.random() * pecesmiticos.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                      VALUES (?, ?, 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });

            await registrarBitacora(userId, `¡¡CAPTURÓ UN ${elegido.id.toUpperCase()} MÍTICO!!`);

            return interaction.followUp(
                `🌊 **¡¡EVENTO MÍTICO DE PESCA!!** 🌊\n` +
                `${elegido.texto}\n` +
                `Has capturado: **${elegido.emoji} ${elegido.id}**\n` +
                `${mensajeClima}` +
                `${consumioCebo ? "🎣 Se consumió 1x cebo_simple.\n" : ""}` +
                `🛠️ Durabilidad de caña: **${durabilidadRestante}/${rod.maxDurabilidad}** *(Nv. Pesca: ${nivelPesca})*`
            );
        }

        // LEGENDARIO
        if (rand <= chanceLegendaria) {
            const pecesLegendarios = [
                { id: "Anguila Astral", emoji: "⚡", texto: "Tu caña vibró con energía cósmica" },
                { id: "Koi Dorado", emoji: "🐟", texto: "Las aguas brillaron en dorado" },
                { id: "Tiburón Bebé", emoji: "🦈", texto: "¡Cuidado con esos dientecitos!" },
                { id: "Pez Espada Lunar", emoji: "🗡️", texto: "Su espada refleja la luz de la luna" },
                { id: "Manta Raya Celeste", emoji: "🫶", texto: "Planea suavemente bajo el agua" },
                { id: "Atún Gigante", emoji: "🐟", texto: "¡Qué fuerza! Casi te arrastra al agua" }
            ];

            const elegido = pecesLegendarios[Math.floor(Math.random() * pecesLegendarios.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                      VALUES (?, ?, 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });

            await registrarBitacora(userId, `Capturó un legendario ${elegido.id}!`);

            return interaction.followUp(
                `🌊 **¡Mini-evento legendario de pesca!**\n` +
                `${elegido.texto} y capturaste **${elegido.emoji} ${elegido.id}**.\n` +
                `${mensajeClima}` +
                `${consumioCebo ? "🎣 Se consumió 1x cebo_simple.\n" : ""}` +
                `🛠️ Durabilidad de caña: **${durabilidadRestante}/${rod.maxDurabilidad}** *(Nv. Pesca: ${nivelPesca})*`
            );
        }

        // EPICO
        if (rand <= chanceEpica) {
            const pecesEpicos = [
                { id: "Salmón Real", emoji: "🐟", texto: "Un salmón majestuoso" },
                { id: "Lubina Plateada", emoji: "🐠", texto: "Brilla como la plata pura" },
                { id: "Pez Globo Mágico", emoji: "🐡", texto: "Se infla cuando lo sacas del agua" },
                { id: "Caballito de Mar Dorado", emoji: "🫘", texto: "Diminuto pero valioso" },
                { id: "Medusa Luna", emoji: "🌙", texto: "Translucida y brillante" }
            ];

            const elegido = pecesEpicos[Math.floor(Math.random() * pecesEpicos.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                      VALUES (?, ?, 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });

            return interaction.followUp(
                `🎣 *¡Tirón fuerte!*\n\n` +
                `¡${elegido.texto}! Has pescado **${elegido.emoji} ${elegido.id}** (${franja}).\n` +
                `${mensajeClima}` +
                `${consumioCebo ? "🎣 Se consumió 1x cebo_simple.\n" : ""}` +
                `🛠️ Durabilidad de caña: **${durabilidadRestante}/${rod.maxDurabilidad}** *(Nv. Pesca: ${nivelPesca})*`
            );
        }

        // RARO
        if (rand <= chanceRara) {
            const pecesRaros = [
                { id: "Trucha Arcoiris", emoji: "🌈", texto: "Sus escamas tienen todos los colores" },
                { id: "Carpa Koi", emoji: "🐟", texto: "Naranja y blanca, muy bonita" },
                { id: "Pez Payaso", emoji: "🤡", texto: "Naranjita con rayas blancas" },
                { id: "Morena Verde", emoji: "🐍", texto: "Larga y resbaladiza" },
                { id: "Perca Dorada", emoji: "🟡", texto: "Brilla con tonos dorados" }
            ];

            const elegido = pecesRaros[Math.floor(Math.random() * pecesRaros.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                      VALUES (?, ?, 1)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });

            return interaction.followUp(
                `🎣 *Splash...*\n\n` +
                `¡${elegido.texto}! Has pescado **${elegido.emoji} ${elegido.id}** (${franja}).\n` +
                `${mensajeClima}` +
                `${consumioCebo ? "🎣 Se consumió 1x cebo_simple.\n" : ""}` +
                `🛠️ Durabilidad de caña: **${durabilidadRestante}/${rod.maxDurabilidad}** *(Nv. Pesca: ${nivelPesca})*`
            );
        }

        if (rand <= chanceBotella) {
            // Botella con mensaje - da 10 a 50 monedas + bono por nivel
            const monedasGanadas = Math.floor(Math.random() * 41) + 10 + (nivelPesca * 2);

            await db.execute({
                sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
              VALUES (?, ?, 0, 1) 
              ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
                args: [userId, monedasGanadas]
            });

            await registrarBitacora(userId, `¡Pescó una misteriosa Botella con mensaje!`);

            return interaction.followUp(
                `🎣 *Sientes un tirón extraño en la caña...*\n\n` +
                `¡Atrapaste una **📜 Botella con mensaje**!\n` +
                `Adentro del vidrio había **${monedasGanadas} moneditas**.\n` +
                `${consumioCebo ? "🎣 Se consumió 1x cebo_simple.\n" : ""}` +
                `🛠️ Durabilidad de caña: **${durabilidadRestante}/${rod.maxDurabilidad}** *(Nv. Pesca: ${nivelPesca})*`
            );
        } else {
            const tablaPorFranja = {
                manana: [
                    { id: "Pescado", emoji: "🐟" },
                    { id: "Trucha Clara", emoji: "🐠" },
                    { id: "Mojarra", emoji: "🐟" },
                    { id: "Bagre Joven", emoji: "🐟" }
                ],
                tarde: [
                    { id: "Pescado", emoji: "🐟" },
                    { id: "Carpa Soleada", emoji: "🐠" },
                    { id: "Róbalo", emoji: "🐟" },
                    { id: "Pejerrey", emoji: "🐠" }
                ],
                noche: [
                    { id: "Pescado", emoji: "🐟" },
                    { id: "Bagre Sombrío", emoji: "🐟" },
                    { id: "Anguila Común", emoji: "🐍" },
                    { id: "Pez Gato", emoji: "🐈" }
                ],
                madrugada: [
                    { id: "Pescado", emoji: "🐟" },
                    { id: "Sardina de Luna", emoji: "🌙" },
                    { id: "Anchoa Nocturna", emoji: "🐟" },
                    { id: "Boquerón", emoji: "🐠" }
                ],
            };
            const pool = tablaPorFranja[franja] || [{ id: "Pescado", emoji: "🐟" }];
            const elegido = pool[Math.floor(Math.random() * pool.length)];

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
              VALUES (?, ?, 1) 
              ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
                args: [userId, elegido.id]
            });

            const mensajesPesca = [
                "*Splash...*",
                "*Tirón en la caña...*",
                "*Algo picó...*",
                "*La caña se dobla...*",
                "*Burbujas en el agua...*"
            ];
            const mensajeAleatorio = mensajesPesca[Math.floor(Math.random() * mensajesPesca.length)];

            return interaction.followUp(
                `🎣 ${mensajeAleatorio}\n\n` +
                `¡Ha picado algo! Has pescado **${elegido.emoji} ${elegido.id}** (${franja}).\n` +
                `${mensajeClima}` +
                `${consumioCebo ? "🎣 Se consumió 1x cebo_simple.\n" : ""}` +
                `🛠️ Durabilidad de caña: **${durabilidadRestante}/${rod.maxDurabilidad}** *(Nv. Pesca: ${nivelPesca})*`
            );
        }

    } catch (error) {
        console.error("Error en comando /pescar:", error);
        return interaction.followUp(`${bostezo}Pucha, se me enredó el hilo de la caña. Intentemos de nuevo después.`);
    }
}
