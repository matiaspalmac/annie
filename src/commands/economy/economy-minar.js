import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";
import { ganarXP, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";

// Cooldown de 5 minutos = 300000 ms
const COOLDOWN_MINAR = 300000;

const PICK_META = {
    herr_pico_acero: { bonusRare: 14, nombre: "Pico de Acero", maxDurabilidad: 120 },
    herr_pico_hierro: { bonusRare: 8, nombre: "Pico de Hierro", maxDurabilidad: 80 },
};

function getSeasonBonus() {
    const month = new Date().getMonth() + 1;
    // Invierno austral: junio-agosto
    if ([6, 7, 8].includes(month)) return 1.15;
    // Verano austral: diciembre-febrero
    if ([12, 1, 2].includes(month)) return 0.95;
    return 1;
}

async function getEquippedPick(userId) {
    const res = await db.execute({
        sql: `SELECT item_id, durabilidad, max_durabilidad
              FROM herramientas_durabilidad
              WHERE user_id = ? AND equipado = 1 AND item_id LIKE 'herr_pico_%'
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
              VALUES (?, 'herr_pico_basico', 50, 50, 1)`,
        args: [userId]
    });

    return { itemId: "herr_pico_basico", durabilidad: 50, maxDurabilidad: 50 };
}

export const data = new SlashCommandBuilder()
    .setName("minar")
    .setDescription("Golpea las rocas cerca del pueblito para obtener materiales.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'minar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Ay mi tesoro, tienes los bracitos cansados. Espera **${faltanMinutos} minutos** antes de volver a picar piedritas.`);
            }
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_MINAR;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'minar', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        const pick = await getEquippedPick(userId);
        if (pick.durabilidad <= 0) {
            return interaction.followUp(`${bostezo}Tu pico equipado está roto, corazón. Necesitas repararlo o comprar una herramienta en **/tienda**.`);
        }

        // Ganar XP de Minería (10 a 20 xp por intento)
        const xpGanada = Math.floor(Math.random() * 11) + 10;
        const nivelMineria = await ganarXP(userId, "mineria", xpGanada, interaction);

        // 3. Lógica de drops
        const bonoNivel = (nivelMineria - 1) * 0.5;
        const rand = Math.random() * 100;
        let itemId = "";
        let emoji = "";
        let rarezaTexto = "";

        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 10 : 0;
        const bonusPick = PICK_META[pick.itemId]?.bonusRare || 0;
        
        // Estructura de drops mejorada con más variedad
        const chanceDiamante = Math.min(1 + (bonoNivel * 0.15) + bonusSuerte + bonusPick, 8);
        const chanceEsmeralda = Math.min(2 + (bonoNivel * 0.2) + bonusSuerte + bonusPick, 12);
        const chanceRubi = Math.min(3 + (bonoNivel * 0.25) + bonusSuerte + bonusPick, 18);
        const chanceZafiro = Math.min(4 + (bonoNivel * 0.3) + bonusSuerte + bonusPick, 22);
        const chanceAmatista = Math.min(6 + (bonoNivel * 0.4) + bonusSuerte + bonusPick, 30);
        const chanceFluorita = Math.min(8 + bonoNivel + bonusSuerte + bonusPick, 38);
        const chanceTopacio = Math.min(12 + bonoNivel + bonusSuerte, 45);
        const chanceCuarzo = Math.min(20 + (bonoNivel * 1.2) + bonusSuerte, 60);
        const chanceMineral = Math.min(35 + (bonoNivel * 1.5) + bonusSuerte, 75);

        await db.execute({
            sql: "UPDATE herramientas_durabilidad SET durabilidad = MAX(0, durabilidad - 1) WHERE user_id = ? AND item_id = ?",
            args: [userId, pick.itemId]
        });

        const resPickAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, pick.itemId]
        });
        const durRestante = Number(resPickAfter.rows[0]?.durabilidad || 0);

        // Evento raro de minería
        const chanceEventoRaro = Math.min(4 + (nivelMineria * 0.15) + bonusPick, 25);
        if (Math.random() * 100 <= chanceEventoRaro) {
            const evento = Math.random() < 0.5 ? "veta" : "caverna";
            const recompensa = evento === "veta" ? 2 : 1;
            const itemEvento = evento === "veta" ? "Mineral" : "Fluorita impecable";

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                      VALUES (?, ?, ?)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
                args: [userId, itemEvento, recompensa]
            });

            return interaction.followUp(
                `⛏️ **¡Evento raro de minería!**\n` +
                `${evento === "veta" ? "Encontraste una veta rica escondida." : "Diste con una mini-caverna cristalina."}\n` +
                `Ganaste **${recompensa}x ${itemEvento}**.\n` +
                `🛠️ Durabilidad de ${PICK_META[pick.itemId]?.nombre || "Pico básico"}: **${durRestante}/${pick.maxDurabilidad}** *(Nv. Minería: ${nivelMineria})*`
            );
        }

        if (rand <= chanceDiamante) {
            itemId = "Diamante puro";
            emoji = "💎";
            rarezaTexto = "¡¡DIAMANTE!! ¡Ay por Dios, esto vale una fortuna! ¡Te vas a hacer rico/a!";
            await registrarBitacora(userId, `¡Encontró un DIAMANTE PURO de valor incalculable!`);
        } else if (rand <= chanceEsmeralda) {
            itemId = "Esmeralda brillante";
            emoji = "💚";
            rarezaTexto = "¡Santo cielo! ¡Una esmeralda verde como el bosque chileno!";
            await registrarBitacora(userId, `Desenterró una preciosa Esmeralda brillante.`);
        } else if (rand <= chanceRubi) {
            itemId = "Rubí carmesí";
            emoji = "❤️";
            rarezaTexto = "¡Qué maravilla! Un rubí rojo sangre que brilla como fuego.";
            await registrarBitacora(userId, `Extrajo un valioso Rubí carmesí.`);
        } else if (rand <= chanceZafiro) {
            itemId = "Zafiro estelar";
            emoji = "💙";
            rarezaTexto = "¡Precioso! Un zafiro azul profundo como el cielo nocturno.";
            await registrarBitacora(userId, `Halló un hermoso Zafiro estelar.`);
        } else if (rand <= chanceAmatista) {
            itemId = "Amatista cristalina";
            emoji = "💜";
            rarezaTexto = "¡Qué linda! Una amatista púrpura que refleja la luz.";
            await registrarBitacora(userId, `Descubrió una Amatista cristalina reluciente.`);
        } else if (rand <= chanceFluorita) {
            itemId = "Fluorita impecable";
            emoji = "🟢";
            rarezaTexto = "¡Excelente! Fluorita de calidad premium, perfecta para coleccionar.";
            await registrarBitacora(userId, `Desenterró una codiciada Fluorita impecable.`);
        } else if (rand <= chanceTopacio) {
            itemId = "Topacio dorado";
            emoji = "🟡";
            rarezaTexto = "¡Qué descubrimiento! Un topacio que brilla como el sol.";
        } else if (rand <= chanceCuarzo) {
            itemId = "Cuarzo rosa";
            emoji = "🩷";
            rarezaTexto = "¡Bonito! Cuarzo rosa suavecito, perfecto para decorar.";
        } else if (rand <= chanceMineral) {
            const mineralesComunes = [
                { id: "Hierro", emoji: "⚙️", texto: "Mineral de hierro útil para herramientas." },
                { id: "Cobre", emoji: "🟠", texto: "Cobre brillante, siempre necesario." },
                { id: "Obsidiana", emoji: "⬛", texto: "Obsidiana negra y filosa como espejo." },
                { id: "Jade", emoji: "🟩", texto: "Jade verdecito, suave al tacto." },
                { id: "Ópalo", emoji: "🌈", texto: "Ópalo que cambia de color con la luz." }
            ];
            const elegido = mineralesComunes[Math.floor(Math.random() * mineralesComunes.length)];
            itemId = elegido.id;
            emoji = elegido.emoji;
            rarezaTexto = `¡Conseguiste ${elegido.texto}!`;
        } else {
            const piedrasComunes = [
                { id: "Piedra", emoji: "🪨", texto: "Piedrecilla sólida y rústica." },
                { id: "Grava", emoji: "🔸", texto: "Grava simple, nada especial." },
                { id: "Roca común", emoji: "🗿", texto: "Roca común y corriente." }
            ];
            const elegida = piedrasComunes[Math.floor(Math.random() * piedrasComunes.length)];
            itemId = elegida.id;
            emoji = elegida.emoji;
            rarezaTexto = `${elegida.texto}`;
        }

        // 4. Guardar en inventario (ajuste económico estacional)
        const seasonFactor = getSeasonBonus();
        const cantidadDrop = (itemId === "Piedra" || seasonFactor < 1) ? 1 : Math.random() < (seasonFactor - 1) ? 2 : 1;

        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
            args: [userId, itemId, cantidadDrop]
        });

        // 5. Mensaje de éxito
        return interaction.followUp(
            `⛏️ *Clink, clink... clank!*\n\n${rarezaTexto}\n` +
            `Has obtenido **${cantidadDrop}x ${emoji} ${itemId}**.\n` +
            `📈 Ajuste estacional: **x${seasonFactor.toFixed(2)}**\n` +
            `🛠️ Durabilidad de ${PICK_META[pick.itemId]?.nombre || "Pico básico"}: **${durRestante}/${pick.maxDurabilidad}** *(Nv. Minería: ${nivelMineria})*`
        );

    } catch (error) {
        console.error("Error en comando /minar:", error);
        return interaction.followUp(`${bostezo}Uy... la pala se me resbaló y no pude picar nada. ¡Inténtalo de nuevo más ratito!`);
    }
}
