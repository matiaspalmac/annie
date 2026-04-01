import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedCooldown, crearEmbedDrop } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { ganarXP, registrarEstadistica, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";
import { verificarCooldown, setCooldown, detectarMacro } from "../../features/cooldown.js";
import { degradarHerramienta } from "../../services/db-helpers.js";
import { progresarMision } from "../../features/misiones.js";

const COOLDOWN_BICHOS = 300000; // 5 minutos

const RED_META = {
    herr_red_seda: { bonusRare: 12, nombre: "Red de Seda", maxDurabilidad: 130 },
    herr_red_fina: { bonusRare: 7, nombre: "Red Fina", maxDurabilidad: 90 },
};

async function getEquippedNet(userId) {
    const res = await db.execute({
        sql: `SELECT item_id, durabilidad, max_durabilidad
              FROM herramientas_durabilidad
              WHERE user_id = ? AND equipado = 1 AND item_id LIKE 'herr_red_%'
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
              VALUES (?, 'herr_red_basica', 60, 60, 1)`,
        args: [userId]
    });

    return { itemId: "herr_red_basica", durabilidad: 60, maxDurabilidad: 60 };
}

export const data = new SlashCommandBuilder()
    .setName("capturar")
    .setDescription("Toma tu red y busca bichitos entre los arbustos del pueblito.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const cd = await verificarCooldown(userId, "capturar", COOLDOWN_BICHOS, bostezo);
        if (!cd.ok) return interaction.editReply({ embeds: [cd.embed] });

        // 2. Validar herramienta
        const red = await getEquippedNet(userId);
        if (red.durabilidad <= 0) {
            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("🕸️ ¡Red rota!")
                .setDescription(
                    `${bostezo}Tu red equipada está en pedazos, corazón. No puedes capturar así.\n\n` +
                    `🛒 Consigue una nueva en la \`/tienda\` o equipa otra con \`/equipar\`.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // 3. Establecer cooldown
        await setCooldown(userId, "capturar", COOLDOWN_BICHOS);

        // XP de Caza
        const xpGanada = Math.floor(Math.random() * 16) + 15;
        const nivelCaza = await ganarXP(userId, "caza", xpGanada, interaction);

        // Anti-macro
        const penalizacionMacro = await detectarMacro(userId, "capturar", COOLDOWN_BICHOS);

        // Datos de clima y hora
        const horaChile = Number(new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", hour12: false }).format(new Date()));
        const bonusHora = (horaChile >= 19 || horaChile < 6) ? 4 : 0;
        let mensajeClima = "";
        let bonusClima = 0;
        try {
            const resClima = await db.execute("SELECT tipo FROM clima WHERE id = 'hoy' LIMIT 1");
            const climaTipo = String(resClima.rows[0]?.tipo || "").toLowerCase();
            if (climaTipo.includes("lluv")) { bonusClima = 6; mensajeClima = "🌧️ *La lluvia hace que los bichos salgan de sus escondrijos. +6% de suerte.*"; }
            else if (climaTipo.includes("viento")) { bonusClima = 3; mensajeClima = "💨 *El viento revuelve los arbustos y aparecen más bichitos. +3% de suerte.*"; }
        } catch { /* ignorar */ }

        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 10 : 0;
        const bonusRed = RED_META[red.itemId]?.bonusRare || 0;

        const chanceMitico = Math.min((0.8 + (nivelCaza * 0.15) + bonusSuerte + bonusRed) * penalizacionMacro, 10);
        const chanceLegendario = Math.min((3 + (nivelCaza * 0.3) + bonusSuerte + bonusHora + bonusClima + bonusRed) * penalizacionMacro, 20);
        const chanceEpico = Math.min((8 + (nivelCaza * 0.5) + bonusSuerte + bonusHora + bonusClima + bonusRed) * penalizacionMacro, 32);
        const chanceRaro = Math.min((15 + (nivelCaza * 0.8) + bonusSuerte + bonusHora + bonusClima + bonusRed) * penalizacionMacro, 48);
        const chancePocoComun = Math.min((25 + (nivelCaza * 1.0) + bonusSuerte + bonusHora + bonusRed) * penalizacionMacro, 65);

        // Desgastar red
        await degradarHerramienta(userId, red.itemId);
        const resRedAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, red.itemId]
        });
        const durRestante = Number(resRedAfter.rows[0]?.durabilidad || 0);

        const nombreRed = RED_META[red.itemId]?.nombre || "Red Básica";
        const resComboCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'combo_caza' AND extra_id = 'global'",
            args: [userId]
        });
        const comboActivo = Number(resComboCd.rows[0]?.fecha_limite || 0) > ahora;
        const cantidad = comboActivo ? 2 : 1;

        const camposBase = [
            { name: "🕸️ Red usada", value: `**${nombreRed}** — \`${durRestante}/${red.maxDurabilidad} dur.\``, inline: true },
            { name: "📊 Nv. Caza", value: `\`${nivelCaza}\``, inline: true },
            ...(bonusHora > 0 ? [{ name: "🌙 Bonus nocturno", value: `+${bonusHora}% de suerte`, inline: true }] : []),
            ...(mensajeClima ? [{ name: "🌤️ Clima", value: mensajeClima, inline: false }] : []),
            ...(comboActivo ? [{ name: "⚡ Combo activo", value: "¡Capturaste **2x** en vez de 1!", inline: true }] : []),
            ...(penalizacionMacro < 1 ? [{ name: "⚠️ Anti-macro", value: "Se detectó un patrón repetitivo. Juega más natural para drops óptimos.", inline: false }] : []),
        ];

        const rand = Math.random() * 100;
        let encontrado = null;
        let rareza = "comun";

        if (rand <= chanceMitico) {
            rareza = "mitico";
            const bichosMiticos = [
                { id: "Escarabajo Divino", emoji: "🐞", texto: "¡¡UN ESCARABAJO QUE BRILLA CON LUZ CELESTIAL!! ¡Naniwa no lo va a creer!" },
                { id: "Fénix Polilla", emoji: "🦋", texto: "¡¡IMPOSIBLE!! ¡Una polilla que arde sin quemarse! ¡Eso es magia pura!" },
                { id: "Libélula Arcoiris", emoji: "🪰", texto: "¡¡INCREÍBLE!! ¡Sus alas tienen todos los colores del universo! Un milagro." },
            ];
            encontrado = bichosMiticos[Math.floor(Math.random() * bichosMiticos.length)];
            await registrarBitacora(userId, `¡¡CAPTURÓ UN ${encontrado.id.toUpperCase()} MÍTICO!!`);

        } else if (rand <= chanceLegendario) {
            rareza = "legendario";
            const bichosLegendarios = [
                { id: "Tarántula", emoji: "🕷️", texto: "¡Ay mamita! ¡Un monstruo peludo saltó directo a tu red!" },
                { id: "Escorpión Dorado", emoji: "🦂", texto: "Brilla como el oro más puro. ¡Qué peligro tan hermoso!" },
                { id: "Cicada Gigante", emoji: "🦗", texto: "Cantó tan fuerte que casi te ensordece antes de caer en la red." },
                { id: "Luciérnaga Estelar", emoji: "✨", texto: "Ilumina como una pequeña estrella turquesa en la palma de tu mano." },
                { id: "Abeja Reina", emoji: "🐝", texto: "¡La reina del panal en persona! Qué honor tan peligroso..." },
            ];
            encontrado = bichosLegendarios[Math.floor(Math.random() * bichosLegendarios.length)];
            await registrarBitacora(userId, `Capturó un legendario ${encontrado.id}!`);

        } else if (rand <= chanceEpico) {
            rareza = "epico";
            const bichosEpicos = [
                { id: "Mariposa Emperador", emoji: "🦋", texto: "¡Qué belleza! Sus alas son majestuosas e imponentes." },
                { id: "Oruga Tornasol", emoji: "🐛", texto: "Cambia de color lentamente mientras la observas. Hipnótico." },
                { id: "Grillo Dorado", emoji: "🦗", texto: "Canta melodías tan preciosas que casi no quieres guardarlo." },
                { id: "Saltamontes Esmeralda", emoji: "🦗", texto: "Verde brillante como una gema, te saltó sorpresivamente." },
                { id: "Escarabajo Rinoceronte", emoji: "🪲", texto: "¡Qué cuernito tan imponente! Se resistió con orgullo." },
            ];
            encontrado = bichosEpicos[Math.floor(Math.random() * bichosEpicos.length)];

        } else if (rand <= chanceRaro) {
            rareza = "raro";
            const bichosRaros = [
                { id: "Abeja Mielera", emoji: "🐝", texto: "¡Zumba feliz mientras te mira desde la red!" },
                { id: "Mariposa Nocturna", emoji: "🦋", texto: "Vuela en la oscuridad con elegancia misteriosa." },
                { id: "Libélula Azul", emoji: "🦗", texto: "Planeaba sobre el agua cuando la atrapaste." },
                { id: "Crisopa Verde", emoji: "🐛", texto: "Sus alas parecen encaje de seda verde." },
                { id: "Chinche Soldado", emoji: "🐞", texto: "Vestida elegante de rojo y negro." },
                { id: "Mosca Dragón", emoji: "🦗", texto: "Voló a toda velocidad pero no te ganó." },
            ];
            encontrado = bichosRaros[Math.floor(Math.random() * bichosRaros.length)];

        } else if (rand <= chancePocoComun) {
            rareza = "poco_comun";
            const bichosPocosComunes = [
                { id: "Mantis Religiosa", emoji: "🦗", texto: "Zaz, un golpe rápido de su brazo y ¡cayó en la red!" },
                { id: "Mariquita", emoji: "🐞", texto: "Roja con puntitos blancos. Muyyyy simpática." },
                { id: "Catarina", emoji: "🐞", texto: "Preciosa y redondita, se quedó tranquilita." },
                { id: "Hormiga Roja", emoji: "🐜", texto: "Trabajadora incansable, se opuso con todo." },
                { id: "Mosca Verde", emoji: "🪰", texto: "Brilla con tonos metálicos verdosos." },
                { id: "Caracolito", emoji: "🐌", texto: "Arrastrándose lentito... fácil de atrapar." },
            ];
            encontrado = bichosPocosComunes[Math.floor(Math.random() * bichosPocosComunes.length)];

        } else if (rand <= 85) {
            rareza = "comun";
            const bichosComunes = [
                { id: "Hormiga", emoji: "🐜", texto: "Chiquitita pero fuerte. No se rendía." },
                { id: "Mosca", emoji: "🪰", texto: "Zumbaba por ahí tranquilamente." },
                { id: "Mosquito", emoji: "🫰", texto: "¡Ese pica! Pero ya lo tienes tú." },
                { id: "Polilla", emoji: "🦋", texto: "Buscaba la luz y encontró tu red." },
                { id: "Escarabajo", emoji: "🪲", texto: "Caminaba lentamente por la tierra." },
                { id: "Gusano", emoji: "🪱", texto: "Se retorcía en la tierra mojada." },
                { id: "Araña Pequeña", emoji: "🕷️", texto: "Tejía su telarañita y te la encontraste." },
                { id: "Tijereta", emoji: "🦗", texto: "Con sus pinzas en la colita intentó escapar." },
            ];
            encontrado = bichosComunes[Math.floor(Math.random() * bichosComunes.length)];

        } else {
            // Fallo - no atrapó nada
            await registrarEstadistica(userId, "bichos_fallados", 1, interaction);

            const embed = crearEmbed(CONFIG.COLORES.NARANJA)
                .setTitle("🍃 ¡Nada esta vez!")
                .setDescription(
                    `🐛 *Swish, swish...*\n\n` +
                    `${bostezo}¡Ups! Viste algo moverse entre las hojas, pero cuando bajaste la red solo atrapaste aire y hojas secas...\n\n` +
                    `¡Mejor suerte a la próxima, corazón! 🌿`
                )
                .addFields(
                    { name: "🕸️ Red usada", value: `**${nombreRed}** — \`${durRestante}/${red.maxDurabilidad} dur.\``, inline: true },
                    { name: "📊 Nv. Caza", value: `\`${nivelCaza}\``, inline: true }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // Guardar en inventario
        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
            args: [userId, encontrado.id, cantidad]
        });

        // Renovar combo
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite)
                  VALUES (?, 'combo_caza', 'global', ?)
                  ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, ahora + (20 * 60 * 1000)]
        });

        const mensajesCaptura = [
            "Empiezas a buscar entre las plantitas...",
            "Observas cuidadosamente el follaje...",
            "Acechas silenciosamente entre los matorrales...",
            "Mueves la red con mucha delicadeza...",
            "Escuchas un zumbidito cerca...",
        ];
        const mensajeAleatorio = mensajesCaptura[Math.floor(Math.random() * mensajesCaptura.length)];

        const embed = crearEmbedDrop({
            emoji: encontrado.emoji,
            nombre: cantidad > 1 ? `${cantidad}x ${encontrado.id}` : encontrado.id,
            rareza,
            narrativa: `🐛 *${mensajeAleatorio}*\n\n${encontrado.texto}`,
            extras: [
                { name: "📦 Obtenido", value: `**${cantidad}x ${encontrado.emoji} ${encontrado.id}**`, inline: true },
                ...camposBase
            ]
        });

        progresarMision(interaction.user.id, "capturar").catch(() => {});
        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /capturar:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡La red tiene un agujerito!")
            .setDescription(`${bostezo}La red tiene un problemita, mi amor. Vamos a tejerla de nuevo y probar después.`);
        return interaction.editReply({ embeds: [embed] });
    }
}
