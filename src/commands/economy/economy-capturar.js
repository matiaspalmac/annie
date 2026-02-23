import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";
import { ganarXP, registrarEstadistica, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";

// Cooldown de 5 minutos = 300000 ms
const COOLDOWN_BICHOS = 300000;

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
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'capturar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Shhh... los bichitos tienen buen oído, si haces mucho ruido no saldrán. Relájate **${faltanMinutos} minutos** antes de volver a mover los matorrales.`);
            }
        }

        // 2. Validar herramienta ANTES de consumir cooldown
        const red = await getEquippedNet(userId);
        if (red.durabilidad <= 0) {
            return interaction.followUp(`${bostezo}Tu red equipada está rota. Necesitas comprar una nueva en **/tienda**.`);
        }

        // 3. Establecer cooldown (herramienta validada)
        const nuevoLimite = ahora + COOLDOWN_BICHOS;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'capturar', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        // Ganar XP de Caza (15 a 30 xp por intento)
        const xpGanada = Math.floor(Math.random() * 16) + 15;
        const nivelCaza = await ganarXP(userId, "caza", xpGanada, interaction);

        // Anti-macro básico: detectar patrones repetidos milimétricos al acabar cooldown
        const resMacro = await db.execute({
            sql: "SELECT ultimo_ts, patron_count FROM macro_patrones WHERE user_id = ? AND comando = 'capturar'",
            args: [userId]
        });

        let patronCount = Number(resMacro.rows[0]?.patron_count || 0);
        const ultimoTs = Number(resMacro.rows[0]?.ultimo_ts || 0);
        const delta = ultimoTs > 0 ? (ahora - ultimoTs) : 0;
        if (delta > 0 && Math.abs(delta - COOLDOWN_BICHOS) <= 2500) patronCount += 1;
        else patronCount = Math.max(0, patronCount - 1);

        await db.execute({
            sql: `INSERT INTO macro_patrones (user_id, comando, ultimo_ts, patron_count)
                  VALUES (?, 'capturar', ?, ?)
                  ON CONFLICT(user_id, comando) DO UPDATE SET ultimo_ts = excluded.ultimo_ts, patron_count = excluded.patron_count`,
            args: [userId, ahora, patronCount]
        });

        const penalizacionMacro = patronCount >= 3 ? 0.8 : 1;

        // 3. Lógica de drops (dinámica por hora y clima)
        const bonoNivel = (nivelCaza - 1) * 0.4;
        const rand = Math.random() * 100;
        let itemId = "";
        let emoji = "";
        let mensajeObtencion = "";

        const horaChile = Number(new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", hour12: false }).format(new Date()));
        const bonusHora = (horaChile >= 19 || horaChile < 6) ? 4 : 0;

        const resClima = await db.execute("SELECT tipo FROM clima WHERE id = 'hoy' LIMIT 1");
        const climaTipo = String(resClima.rows[0]?.tipo || "").toLowerCase();
        const bonusClima = climaTipo.includes("lluv") ? 6 : (climaTipo.includes("viento") ? 3 : 0);

        // Tarántula (Mortal) - 5% + bonoNivel
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 10 : 0;
        const bonusRed = RED_META[red.itemId]?.bonusRare || 0;
        
        const chanceMitico = Math.min((0.8 + (nivelCaza * 0.15) + bonusSuerte + bonusRed) * penalizacionMacro, 10);
        const chanceLegendario = Math.min((3 + (nivelCaza * 0.3) + bonusSuerte + bonusHora + bonusClima + bonusRed) * penalizacionMacro, 20);
        const chanceEpico = Math.min((8 + (nivelCaza * 0.5) + bonusSuerte + bonusHora + bonusClima + bonusRed) * penalizacionMacro, 32);
        const chanceRaro = Math.min((15 + (nivelCaza * 0.8) + bonusSuerte + bonusHora + bonusClima + bonusRed) * penalizacionMacro, 48);
        const chancePocoComun = Math.min((25 + (nivelCaza * 1.0) + bonusSuerte + bonusHora + bonusRed) * penalizacionMacro, 65);

        await db.execute({
            sql: "UPDATE herramientas_durabilidad SET durabilidad = MAX(0, durabilidad - 1) WHERE user_id = ? AND item_id = ?",
            args: [userId, red.itemId]
        });

        const resRedAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, red.itemId]
        });
        const durRestante = Number(resRedAfter.rows[0]?.durabilidad || 0);

        const resComboCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'combo_caza' AND extra_id = 'global'",
            args: [userId]
        });
        const comboActivo = Number(resComboCd.rows[0]?.fecha_limite || 0) > ahora;
        const comboMsg = comboActivo ? "\n⚡ Combo activo: +1 captura bonus." : "";

        let encontrado = null;

        if (rand <= chanceMitico) {
            const bichosMiticos = [
                { id: "Escarabajo Divino", emoji: "🐞", texto: "¡¡LEGENDARIO!! ¡Un escarabajo que brilla con luz celestial!" },
                { id: "Fénix Polilla", emoji: "🦋", texto: "¡¡IMPOSIBLE!! ¡Una polilla que arde sin quemarse!" },
                { id: "Libélula Arcoiris", emoji: "🪰", texto: "¡¡INCREÍBLE!! ¡Sus alas tienen todos los colores del universo!" }
            ];
            encontrado = bichosMiticos[Math.floor(Math.random() * bichosMiticos.length)];
            
            await registrarBitacora(userId, `¡¡CAPTURÓ UN ${encontrado.id.toUpperCase()} MÍTICO!!`);

        } else if (rand <= chanceLegendario) {
            const bichosLegendarios = [
                { id: "Tarántula", emoji: "🕷️", texto: "¡Ay mamita! ¡Un monstruo peludo saltó a tu red!" },
                { id: "Escorpión Dorado", emoji: "🦂", texto: "Brilla como el oro, ¡qué peligro!" },
                { id: "Cicada Gigante", emoji: "🦗", texto: "Cantó tan fuerte que casi te ensordece" },
                { id: "Luciérnaga Estelar", emoji: "✨", texto: "Ilumina como una pequeña estrella" },
                { id: "Abeja Reina", emoji: "🐝", texto: "¡La reina del panal!" }
            ];
            encontrado = bichosLegendarios[Math.floor(Math.random() * bichosLegendarios.length)];
            
            await registrarBitacora(userId, `Capturó un legendario ${encontrado.id}!`);

        } else if (rand <= chanceEpico) {
            const bichosEpicos = [
                { id: "Mariposa Emperador", emoji: "🦋", texto: "¡Qué belleza! Sus alas son majestuosas." },
                { id: "Oruga Tornasol", emoji: "🐛", texto: "Cambia de color al moverse" },
                { id: "Grillo Dorado", emoji: "🦗", texto: "Canta melodías preciosas" },
                { id: "Saltamontes Esmeralda", emoji: "🦗", texto: "Verde brillante como una gema" },
                { id: "Escarabajo Rinoceronte", emoji: "🪲",texto: "¡Qué cuernito tan imponente!" }
            ];
            encontrado = bichosEpicos[Math.floor(Math.random() * bichosEpicos.length)];

        } else if (rand <= chanceRaro) {
            const bichosRaros = [
                { id: "Abeja Mielera", emoji: "🐝", texto: "¡Zumba feliz!" },
                { id: "Mariposa Nocturna", emoji: "🦋", texto: "Vuela en la oscuridad" },
                { id: "Libélula Azul", emoji: "🦗", texto: "Planea sobre el agua" },
                { id: "Crisopa Verde", emoji: "🐛", texto: "Alas como encaje" },
                { id: "Chinche Soldado", emoji: "🐞", texto: "Vestida de rojo y negro" },
                { id: "Mosca Dragón", emoji: "🦗", texto: "Vuela a toda velocidad" }
            ];
            encontrado = bichosRaros[Math.floor(Math.random() * bichosRaros.length)];

        } else if (rand <= chancePocoComun) {
            const bichosPocosComunes = [
                { id: "Mantis Religiosa", emoji: "🦗", texto: "Zaz, un manotazo rápido y ¡listo!" },
                { id: "Mariquita", emoji: "🐞", texto: "Roja con puntitos" },
                { id: "Catarina", emoji: "🐞", texto: "Preciosa y redondita" },
                { id: "Hormiga Roja", emoji: "🐜", texto: "Trabajadora incansable" },
                { id: "Mosca Verde", emoji: "🪰", texto: "Brilla con tonos metálicos" },
                { id: "Caracolito", emoji: "🐌", texto: "Arrastrándose lentito" }
            ];
            encontrado = bichosPocosComunes[Math.floor(Math.random() * bichosPocosComunes.length)];

        } else if (rand <= 85) {
            const bichosComunes = [
                { id: "Hormiga", emoji: "🐜", texto: "Chiquitita pero fuerte" },
                { id: "Mosca", emoji: "🪰", texto: "Zumba por ahí" },
                { id: "Mosquito", emoji: "🫰", texto: "¡Ese pica!" },
                { id: "Polilla", emoji: "🦋", texto: "Busca la luz" },
                { id: "Escarabajo", emoji: "🪲", texto: "Camina lentamente" },
                { id: "Gusano", emoji: "🪱", texto: "Se retuerce en la tierra" },
                { id: "Araña Pequeña", emoji: "🕷️", texto: "Teje su telarañita" },
                { id: "Tijereta", emoji: "🦗", texto: "Con sus pinzas en la colita" }
            ];
            encontrado = bichosComunes[Math.floor(Math.random() * bichosComunes.length)];

        } else {
            // Fallo
            await registrarEstadistica(userId, "bichos_fallados", 1, interaction);
            return interaction.followUp(
                `🍃 *Swish, swish...* \n\n` +
                `${bostezo}¡Ups! Viste algo moverse, pero cuando bajaste la red solo atrapaste aire y hojas secas. ¡Mejor suerte a la próxima, corazón! *(Nv. Caza: ${nivelCaza})*\n` +
                `🛠️ Durabilidad de ${RED_META[red.itemId]?.nombre || "Red básica"}: **${durRestante}/${red.maxDurabilidad}**`
            );
        }

        // 4. Guardar en inventario de economía si atrapó algo
        const cantidad = comboActivo ? 2 : 1;
        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
            VALUES (?, ?, ?) 
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
            args: [userId, encontrado.id, cantidad]
        });

        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite)
                  VALUES (?, 'combo_caza', 'global', ?)
                  ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, ahora + (20 * 60 * 1000)]
        });

        const mensajesCaptura = [
            "Empiezas a buscar entre las plantitas...",
            "Observas cuidadosamente el follaje...",
            "Acechas silenciosamente...",
            "Mueves la red con delicadeza...",
            "Escuchas un zumbido cerca..."
        ];
        const mensajeAleatorio = mensajesCaptura[Math.floor(Math.random() * mensajesCaptura.length)];

        // 5. Mensaje de éxito
        return interaction.followUp(
            `🐛 *${mensajeAleatorio}* \n\n${encontrado.texto} Has capturado **${cantidad}x ${encontrado.emoji} ${encontrado.id}** *(Nv. Caza: ${nivelCaza})*${comboMsg}` +
            `\n🛠️ Durabilidad de ${RED_META[red.itemId]?.nombre || "Red básica"}: **${durRestante}/${red.maxDurabilidad}**` +
            `${patronCount >= 3 ? "\n\n⚠️ Señal anti-macro: detecté un patrón demasiado preciso en tus tiempos. Juega con ritmo más natural para mantener drops óptimos." : ""}`
        );

    } catch (error) {
        console.error("Error en comando /capturar:", error);
        return interaction.followUp(`${bostezo}La red tiene un agujerito, mi amor. Vamos a tener que tejerla de nuevo y probar después.`);
    }
}
