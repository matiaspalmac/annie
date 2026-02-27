import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedCooldown, crearEmbedDrop } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { ganarXP, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";

const COOLDOWN_MINAR = 300000; // 5 minutos

const PICK_META = {
    herr_pico_acero: { bonusRare: 14, nombre: "Pico de Acero", maxDurabilidad: 120 },
    herr_pico_hierro: { bonusRare: 8, nombre: "Pico de Hierro", maxDurabilidad: 80 },
};

function getSeasonBonus() {
    const month = new Date().getMonth() + 1;
    if ([6, 7, 8].includes(month)) return 1.15;   // Invierno austral
    if ([12, 1, 2].includes(month)) return 0.95;   // Verano austral
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
                const embed = crearEmbedCooldown(faltanMinutos, bostezo.trim(), "minar")
                    .setDescription(
                        `*${bostezo.trim()}*\n\n` +
                        `⛏️ Ay mi tesoro, tienes los bracitos cansados. ¡Descansa un poco!\n` +
                        `⌛ Vuelve a picar piedritas en **${faltanMinutos} minutos**.`
                    );
                return interaction.editReply({ embeds: [embed] });
            }
        }

        // 2. Establecer nuevo cooldown
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite)
            VALUES (?, 'minar', 'global', ?)
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, ahora + COOLDOWN_MINAR]
        });

        const pick = await getEquippedPick(userId);
        if (pick.durabilidad <= 0) {
            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("⛏️ ¡Pico roto!")
                .setDescription(
                    `${bostezo}Tu pico equipado está en pedacitos, corazón. No puedes minar así.\n\n` +
                    `🛒 Consigue una herramienta nueva en la \`/tienda\` o equipa otra con \`/equipar\`.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // Ganar XP de Minería
        const xpGanada = Math.floor(Math.random() * 11) + 10;
        const nivelMineria = await ganarXP(userId, "mineria", xpGanada, interaction);

        // 3. Lógica de drops
        const bonoNivel = (nivelMineria - 1) * 0.5;
        const rand = Math.random() * 100;
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 10 : 0;
        const bonusPick = PICK_META[pick.itemId]?.bonusRare || 0;

        const chanceDiamante = Math.min(1 + (bonoNivel * 0.15) + bonusSuerte + bonusPick, 8);
        const chanceEsmeralda = Math.min(2 + (bonoNivel * 0.2) + bonusSuerte + bonusPick, 12);
        const chanceRubi = Math.min(3 + (bonoNivel * 0.25) + bonusSuerte + bonusPick, 18);
        const chanceZafiro = Math.min(4 + (bonoNivel * 0.3) + bonusSuerte + bonusPick, 22);
        const chanceAmatista = Math.min(6 + (bonoNivel * 0.4) + bonusSuerte + bonusPick, 30);
        const chanceFluorita = Math.min(8 + bonoNivel + bonusSuerte + bonusPick, 38);
        const chanceTopacio = Math.min(12 + bonoNivel + bonusSuerte, 45);
        const chanceCuarzo = Math.min(20 + (bonoNivel * 1.2) + bonusSuerte, 60);
        const chanceMineral = Math.min(35 + (bonoNivel * 1.5) + bonusSuerte, 75);

        // Desgastar herramienta
        await db.execute({
            sql: "UPDATE herramientas_durabilidad SET durabilidad = MAX(0, durabilidad - 1) WHERE user_id = ? AND item_id = ?",
            args: [userId, pick.itemId]
        });
        const resPickAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, pick.itemId]
        });
        const durRestante = Number(resPickAfter.rows[0]?.durabilidad || 0);

        const nombrePick = PICK_META[pick.itemId]?.nombre || "Pico Básico";
        const camposBase = [
            { name: "⛏️ Pico usado", value: `**${nombrePick}** — \`${durRestante}/${pick.maxDurabilidad} dur.\``, inline: true },
            { name: "📊 Nv. Minería", value: `\`${nivelMineria}\``, inline: true },
        ];

        // Evento raro de minería
        const chanceEventoRaro = Math.min(4 + (nivelMineria * 0.15) + bonusPick, 25);
        if (Math.random() * 100 <= chanceEventoRaro) {
            const evento = Math.random() < 0.5 ? "veta" : "caverna";
            const recompensa = evento === "veta" ? 2 : 1;
            const itemEvento = evento === "veta" ? "Mineral" : "Fluorita impecable";
            const emojiEvento = evento === "veta" ? "⛰️" : "🟢";

            await db.execute({
                sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                      VALUES (?, ?, ?)
                      ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
                args: [userId, itemEvento, recompensa]
            });

            const embed = crearEmbedDrop({
                emoji: emojiEvento,
                nombre: itemEvento,
                rareza: "raro",
                narrativa:
                    `⛏️ *¡Evento raro de minería!*\n\n` +
                    (evento === "veta"
                        ? `¡Encontraste una veta rica escondida detrás de la roca! Salieron **${recompensa}x Mineral** de ahí.`
                        : `¡Diste con una mini-caverna cristalina! La Fluorita brillaba en la oscuridad.`),
                extras: [
                    { name: "📦 Obtenido", value: `**${recompensa}x ${emojiEvento} ${itemEvento}**`, inline: true },
                    ...camposBase
                ]
            });

            return interaction.editReply({ embeds: [embed] });
        }

        // Resolver el drop principal
        let itemId = "", emoji = "", rareza = "", narrativa = "";
        let cantidadDrop = 1;

        if (rand <= chanceDiamante) {
            itemId = "Diamante puro"; emoji = "💎"; rareza = "mitico";
            narrativa = "¡¡DIAMANTE!! Las rocas se abrieron y dentro brillaba un diamante puro. ¡Eso vale una FORTUNA, corazón!";
            await registrarBitacora(userId, `¡Encontró un DIAMANTE PURO!`);
        } else if (rand <= chanceEsmeralda) {
            itemId = "Esmeralda brillante"; emoji = "💚"; rareza = "epico";
            narrativa = "¡Santo cielo! Una esmeralda verde como el bosque chileno brilló entre las piedras.";
            await registrarBitacora(userId, `Desenterró una Esmeralda brillante.`);
        } else if (rand <= chanceRubi) {
            itemId = "Rubí carmesí"; emoji = "❤️"; rareza = "epico";
            narrativa = "¡Qué maravilla! Un rubí rojo sangre que brilla como fuego en tus manos.";
        } else if (rand <= chanceZafiro) {
            itemId = "Zafiro estelar"; emoji = "💙"; rareza = "epico";
            narrativa = "¡Precioso! Un zafiro azul profundo como el cielo nocturno del pueblito.";
        } else if (rand <= chanceAmatista) {
            itemId = "Amatista cristalina"; emoji = "💜"; rareza = "raro";
            narrativa = "¡Qué lindura! Una amatista púrpura que refleja la luz en mil destellos.";
        } else if (rand <= chanceFluorita) {
            itemId = "Fluorita impecable"; emoji = "🟢"; rareza = "raro";
            narrativa = "¡Excelente! Fluorita de calidad premium. ¡Perfecta para coleccionar!";
        } else if (rand <= chanceTopacio) {
            itemId = "Topacio dorado"; emoji = "🟡"; rareza = "poco_comun";
            narrativa = "¡Qué descubrimiento! Un topacio que brilla como el sol del pueblito.";
        } else if (rand <= chanceCuarzo) {
            itemId = "Cuarzo rosa"; emoji = "🩷"; rareza = "poco_comun";
            narrativa = "¡Bonito! Cuarzo rosa suavecito, con un brillo tenue y relajante.";
        } else if (rand <= chanceMineral) {
            const mineralesComunes = [
                { id: "Hierro", emoji: "⚙️", texto: "Mineral de hierro útil para herramientas." },
                { id: "Cobre", emoji: "🟠", texto: "Cobre brillante y maleable, siempre necesario." },
                { id: "Obsidiana", emoji: "⬛", texto: "Obsidiana negra y filosa como espejo." },
                { id: "Jade", emoji: "🟩", texto: "Jade verdecito y suave al tacto." },
                { id: "Ópalo", emoji: "🌈", texto: "Ópalo que cambia de color con la luz." },
            ];
            const elegido = mineralesComunes[Math.floor(Math.random() * mineralesComunes.length)];
            itemId = elegido.id; emoji = elegido.emoji; rareza = "comun";
            narrativa = `⛏️ *Clink, clink... clank!*\n\n${elegido.texto}`;
        } else {
            const piedrasComunes = [
                { id: "Piedra", emoji: "🪨", texto: "Piedrecilla sólida y rústica. Sirve para algo!" },
                { id: "Grava", emoji: "🔸", texto: "Grava simple. No es lo más emocionante, pero aquí está." },
                { id: "Roca común", emoji: "🗿", texto: "Roca común y corriente. Siguiente vez mejor, tesoro." },
            ];
            const elegida = piedrasComunes[Math.floor(Math.random() * piedrasComunes.length)];
            itemId = elegida.id; emoji = elegida.emoji; rareza = "comun";
            narrativa = `⛏️ *Clink... clink...*\n\n${elegida.texto}`;
        }

        // Guardar en inventario (ajuste estacional)
        const seasonFactor = getSeasonBonus();
        cantidadDrop = (itemId === "Piedra" || seasonFactor < 1) ? 1 : Math.random() < (seasonFactor - 1) ? 2 : 1;

        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
            args: [userId, itemId, cantidadDrop]
        });

        const embed = crearEmbedDrop({
            emoji,
            nombre: cantidadDrop > 1 ? `${cantidadDrop}x ${itemId}` : itemId,
            rareza,
            narrativa,
            extras: [
                { name: "📦 Obtenido", value: `**${cantidadDrop}x ${emoji} ${itemId}**`, inline: true },
                ...camposBase,
                ...(amuletoActivo ? [{ name: "🍀 Amuleto activo", value: "Suerte aumentada +10%", inline: true }] : []),
            ]
        });

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /minar:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Algo falló en la mina!")
            .setDescription(`${bostezo}Uy... la pala se me resbaló y no pude picar nada. ¡Inténtalo de nuevo en un ratito!`);
        return interaction.editReply({ embeds: [embed] });
    }
}
