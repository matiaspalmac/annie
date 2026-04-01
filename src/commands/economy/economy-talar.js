import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedDrop } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { ganarXP, registrarEstadistica, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";
import { verificarCooldown, setCooldown, detectarMacro } from "../../features/cooldown.js";
import { degradarHerramienta } from "../../services/db-helpers.js";
import { progresarMision } from "../../features/misiones.js";

const COOLDOWN_ARBOL = 300000; // 5 minutos

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

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const cd = await verificarCooldown(userId, "talar", COOLDOWN_ARBOL, bostezo);
        if (!cd.ok) return interaction.editReply({ embeds: [cd.embed] });

        // 2. Validar herramienta
        const axe = await getEquippedAxe(userId);
        if (axe.durabilidad <= 0) {
            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("🪓 ¡Hacha rota!")
                .setDescription(
                    `${bostezo}Tu hacha equipada está en pedacitos, corazón. No puedes talar así.\n\n` +
                    `🛒 Pásate por la \`/tienda\` o equipa otra con \`/equipar\`.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // 3. Establecer cooldown
        await setCooldown(userId, "talar", COOLDOWN_ARBOL);

        // Anti-macro
        const macroMult = await detectarMacro(userId, "talar", COOLDOWN_ARBOL);

        // XP de Recolección
        const xpGanada = Math.floor(Math.random() * 11) + 10;
        const nivelRecoleccion = await ganarXP(userId, "recoleccion", xpGanada, interaction);
        await registrarEstadistica(userId, "arboles_sacudidos", 1, interaction);

        // Lógica de drops
        const bonoNivel = (nivelRecoleccion - 1) * 0.5;
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 10 : 0;
        const bonusHacha = AXE_META[axe.itemId]?.bonusRare || 0;

        // Clima
        let mensajeClima = "";
        let climaAbejas = 0, climaMonedas = 0;
        try {
            const resClima = await db.execute("SELECT tipo FROM clima WHERE id = 'hoy' LIMIT 1");
            const climaTipo = String(resClima.rows[0]?.tipo || "").toLowerCase();
            if (climaTipo.includes("soleado")) { climaAbejas = 2; mensajeClima = "☀️ *El sol soleado hace que las abejas estén más activas...*"; }
            if (climaTipo.includes("lluv")) { climaAbejas = -2; mensajeClima = "🌧️ *La lluvia aleja a las abejas. ¡Más seguro hoy!*"; }
            if (climaTipo.includes("viento")) { climaMonedas = 5; mensajeClima = "💨 *El viento hace que caigan más cosas de los árboles...*"; }
        } catch { /* ignorar */ }

        const month = new Date().getMonth() + 1;
        const bonusEstacion = [3, 4, 5].includes(month) ? 4 : 0; // otoño = más frutos

        const chanceAbejas = Math.max((10 - bonoNivel + climaAbejas) - (amuletoActivo ? 4 : 0), 1);
        const chanceMonedas = Math.min(20 + bonoNivel + bonusSuerte + climaMonedas + (bonusHacha / 2), 55) * macroMult;
        const chanceFrutaEpica = Math.min(5 + bonusEstacion + bonusSuerte + (bonusHacha / 2), 25) * macroMult;
        const chanceFrutaRara = Math.min(12 + bonusEstacion + bonusSuerte + bonusHacha, 40) * macroMult;
        const chanceEventoRaro = Math.min(8 + bonusEstacion + (bonusSuerte / 2) + bonusHacha, 28) * macroMult;

        const rand = Math.random() * 100;

        // Desgastar hacha
        await degradarHerramienta(userId, axe.itemId);
        const resAxeAfter = await db.execute({
            sql: "SELECT durabilidad FROM herramientas_durabilidad WHERE user_id = ? AND item_id = ?",
            args: [userId, axe.itemId]
        });
        const durRestante = Number(resAxeAfter.rows[0]?.durabilidad || 0);

        const nombreHacha = AXE_META[axe.itemId]?.nombre || "Hacha Básica";
        const camposBase = [
            { name: "🪓 Hacha usada", value: `**${nombreHacha}** — \`${durRestante}/${axe.maxDurabilidad} dur.\``, inline: true },
            { name: "📊 Nv. Recolección", value: `\`${nivelRecoleccion}\``, inline: true },
            ...(mensajeClima ? [{ name: "🌤️ Clima del pueblito", value: mensajeClima, inline: false }] : []),
        ];

        // Evento raro
        if (rand <= chanceEventoRaro) {
            const subRand = Math.random() * 100;

            if (subRand <= 20) {
                // Pluma brillante
                await db.execute({ sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, 'Pluma brillante', 1) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`, args: [userId] });
                const embed = crearEmbedDrop({
                    emoji: "🪶", nombre: "Pluma brillante", rareza: "raro",
                    narrativa: `🌳 *¡Evento raro: nido escondido!*\n\nEntre las ramas apareció un nidito suavecito con una pluma mágica brillando dentro. 🥹`,
                    extras: [{ name: "📦 Obtenido", value: "**1x 🪶 Pluma brillante**", inline: true }, ...camposBase]
                });
                progresarMision(interaction.user.id, "talar").catch(() => {});
                return interaction.editReply({ embeds: [embed] });
            }

            if (subRand <= 40) {
                const nidoTipo = Math.floor(Math.random() * 3);
                if (nidoTipo === 0) {
                    await db.execute({ sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, 'Huevo de Pájaro', 1) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`, args: [userId] });
                    const embed = crearEmbedDrop({
                        emoji: "🥚", nombre: "Huevo de Pájaro", rareza: "poco_comun",
                        narrativa: `🥚 *¡Evento: nido con huevito!*\n\n¡Qué ternura! Entre las hojitas había un nidito con un huevito bien calientito. 🐣`,
                        extras: [{ name: "📦 Obtenido", value: "**1x 🥚 Huevo de Pájaro**", inline: true }, ...camposBase]
                    });
                    progresarMision(interaction.user.id, "talar").catch(() => {});
                    return interaction.editReply({ embeds: [embed] });
                } else if (nidoTipo === 1) {
                    const pajaritos = Math.floor(Math.random() * 5) + 3;
                    await db.execute({ sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?", args: [pajaritos, userId] });
                    const embed = crearEmbedDrop({
                        emoji: "🐦", nombre: "Nido de Pajaritos", rareza: "comun",
                        narrativa: `🐦 *¡Evento: nido de pajaritos!*\n\nLos pichoncitos hicieron pío-pío y su mamá te regaló **${pajaritos} moneditas** de agradecimiento. ¡Qué dulzura!`,
                        extras: [{ name: "💰 Monedas recibidas", value: `**+${pajaritos} 🪙**`, inline: true }, ...camposBase]
                    });
                    progresarMision(interaction.user.id, "talar").catch(() => {});
                    return interaction.editReply({ embeds: [embed] });
                } else {
                    await db.execute({ sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, 'Rama Dorada', 1) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`, args: [userId] });
                    const embed = crearEmbedDrop({
                        emoji: "🌿", nombre: "Rama Dorada", rareza: "raro",
                        narrativa: `✨ *¡Evento: rama mágica!*\n\n¡Una rama del árbol brillaba en dorado! La tomaste con cuidado... ¡es mágica!`,
                        extras: [{ name: "📦 Obtenido", value: "**1x 🌿 Rama Dorada**", inline: true }, ...camposBase]
                    });
                    progresarMision(interaction.user.id, "talar").catch(() => {});
                    return interaction.editReply({ embeds: [embed] });
                }
            }

            if (subRand <= 60) {
                const perdida = Math.floor(Math.random() * 9) + 7;
                await db.execute({ sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?", args: [perdida, userId] });
                const embed = crearEmbed(CONFIG.COLORES.ROJO)
                    .setTitle("🐝 ¡¡BZZZZ!! ¡Abejas furiosas!")
                    .setDescription(
                        `🌳 *Shake... shake... CRACK...*\n\n` +
                        `¡Una colmena enojadísima! Saliste corriendo pero te picaron igual y perdiste **${perdida} moneditas** en la huida. 😱\n\n` +
                        `*Annie te mira preocupada desde lejos: "¡Corre, corazoncito, CORRE!"*`
                    )
                    .addFields(...camposBase.map(c => ({ name: c.name, value: c.value, inline: c.inline ?? true })))
                    .setFooter({ text: "🌸 Con cariñito de tu carterita" });
                return interaction.editReply({ embeds: [embed] });
            }

            if (subRand <= 80) {
                const monedasDorado = Math.floor(Math.random() * 31) + 25;
                await db.execute({ sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?", args: [monedasDorado, userId] });
                const embed = crearEmbedDrop({
                    emoji: "🍎", nombre: "Fruto Dorado Mágico", rareza: "legendario",
                    narrativa: `🍎 *¡Evento raro: fruto dorado!*\n\nCayó un fruto mágico dorado que brillaba solo. Lo cambiaste por **${monedasDorado} moneditas** en el mercado del pueblito. 🌟`,
                    extras: [{ name: "💰 Monedas ganadas", value: `**+${monedasDorado} 🪙**`, inline: true }, ...camposBase]
                });
                progresarMision(interaction.user.id, "talar").catch(() => {});
                return interaction.editReply({ embeds: [embed] });
            }

            // Ardilla traviesa
            const ardillaLoot = Math.floor(Math.random() * 15) + 10;
            await db.execute({ sql: "UPDATE usuarios SET monedas = monedas + ? WHERE id = ?", args: [ardillaLoot, userId] });
            const embed = crearEmbedDrop({
                emoji: "🐿️", nombre: "Tesoro de Ardilla", rareza: "poco_comun",
                narrativa: `🐿️ *¡Evento: ardilla traviesa!*\n\n¡Una ardillita cayó junto con un montón de cositas guardadas! Te dejó **${ardillaLoot} moneditas** del tesoro que tenía escondido.`,
                extras: [{ name: "💰 Monedas ganadas", value: `**+${ardillaLoot} 🪙**`, inline: true }, ...camposBase]
            });
            progresarMision(interaction.user.id, "talar").catch(() => {});
            return interaction.editReply({ embeds: [embed] });
        }

        // Abejas
        if (rand <= chanceAbejas) {
            const monedasPerdidas = Math.floor(Math.random() * 11) + 5;
            await db.execute({ sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?", args: [monedasPerdidas, userId] });
            await registrarBitacora(userId, `Huyó de un enjambre de Abejas.`);

            const embed = crearEmbed(CONFIG.COLORES.ROJO)
                .setTitle("🐝 ¡¡BZZZ!! ¡Un panal!")
                .setDescription(
                    `🌳 *Shake, shake...*\n\n` +
                    `🐝 **¡UN PANAL DE ABEJAS FURIOSAS!** 🐝\n\n` +
                    `Saliste corriendo pero te picaron igual. En el escándalo perdiste **${monedasPerdidas} moneditas**. ¡Pobrecito tesoro!`
                )
                .addFields(...camposBase.map(c => ({ name: c.name, value: c.value, inline: c.inline ?? true })))
                .setFooter({ text: "🌸 Annie te cura las picaduras con cariño" });
            return interaction.editReply({ embeds: [embed] });
        }

        // Frutas ÉPICAS
        if (rand <= chanceAbejas + chanceMonedas + chanceFrutaEpica) {
            const frutasEpicas = [
                { id: "Manzana Dorada", emoji: "🍎", texto: "¡Brilla como el sol del mediodía!" },
                { id: "Pera Cristalina", emoji: "🍐", texto: "¡Casi transparente y brillante!" },
                { id: "Ciruela Mágica", emoji: "🫐", texto: "Emana un aura mística violeta." },
            ];
            const elegida = frutasEpicas[Math.floor(Math.random() * frutasEpicas.length)];

            await db.execute({ sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, 1) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`, args: [userId, elegida.id] });
            await registrarBitacora(userId, `¡Sacó una ${elegida.id} épica del árbol!`);

            const embed = crearEmbedDrop({
                emoji: elegida.emoji, nombre: elegida.id, rareza: "epico",
                narrativa: `🌳 *El árbol desprendió un brillo especial...*\n\n${elegida.texto}`,
                extras: [{ name: "📦 Obtenido", value: `**1x ${elegida.emoji} ${elegida.id}**`, inline: true }, ...camposBase]
            });
            progresarMision(interaction.user.id, "talar").catch(() => {});
            return interaction.editReply({ embeds: [embed] });
        }

        // Frutas RARAS
        if (rand <= chanceAbejas + chanceMonedas + chanceFrutaEpica + chanceFrutaRara) {
            const frutasRaras = [
                { id: "Naranjas", emoji: "🍊", cantidad: 4, texto: "¡Muy jugosas y aromáticas!" },
                { id: "Peras", emoji: "🍐", cantidad: 3, texto: "¡Dulces y maduritas!" },
                { id: "Duraznos", emoji: "🍑", cantidad: 3, texto: "¡Suavecitos y fragantes!" },
                { id: "Ciruelas", emoji: "🫐", cantidad: 4, texto: "Moraditas y perfectas." },
                { id: "Cerezas", emoji: "🍒", cantidad: 5, texto: "Rojitas y brillantes." },
                { id: "Limones", emoji: "🍋", cantidad: 4, texto: "¡Tan aciditos!" },
            ];
            const elegida = frutasRaras[Math.floor(Math.random() * frutasRaras.length)];

            await db.execute({ sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?`, args: [userId, elegida.id, elegida.cantidad, elegida.cantidad] });

            const embed = crearEmbedDrop({
                emoji: elegida.emoji, nombre: elegida.id, rareza: "raro",
                narrativa: `🌳 *Shake, shake... thump!*\n\n${elegida.texto}`,
                extras: [{ name: "📦 Obtenido", value: `**${elegida.cantidad}x ${elegida.emoji} ${elegida.id}**`, inline: true }, ...camposBase]
            });
            progresarMision(interaction.user.id, "talar").catch(() => {});
            return interaction.editReply({ embeds: [embed] });
        }

        // Frutas COMUNES
        const frutasComunes = [
            { id: "Manzanas", emoji: "🍎", cantidad: 3 },
            { id: "Coco", emoji: "🥥", cantidad: 2 },
            { id: "Plátanos", emoji: "🍌", cantidad: 4 },
            { id: "Fresas", emoji: "🍓", cantidad: 5 },
            { id: "Uvas", emoji: "🍇", cantidad: 6 },
            { id: "Sandía", emoji: "🍉", cantidad: 1 },
            { id: "Melón", emoji: "🍈", cantidad: 1 },
        ];
        const elegida = frutasComunes[Math.floor(Math.random() * frutasComunes.length)];

        await db.execute({ sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + ?`, args: [userId, elegida.id, elegida.cantidad, elegida.cantidad] });

        const mensajesSacudir = [
            "¡Cayeron unos frutos deliciosos! 🌳",
            "*Thump thump!* ¡Mira cuántas frutas salieron!",
            "¡Qué lindo! El árbol estaba bien cargadito.",
            "¡Excelente cosecha, mi cielo! 🌿",
        ];
        const narrativa = `🌳 *Shake, shake... thump!*\n\n${mensajesSacudir[Math.floor(Math.random() * mensajesSacudir.length)]}`;

        const embed = crearEmbedDrop({
            emoji: elegida.emoji, nombre: elegida.id, rareza: "comun",
            narrativa,
            extras: [{ name: "📦 Obtenido", value: `**${elegida.cantidad}x ${elegida.emoji} ${elegida.id}**`, inline: true }, ...camposBase]
        });
        progresarMision(interaction.user.id, "talar").catch(() => {});
        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /talar:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Ay, la rama estaba muy alta!")
            .setDescription(`${bostezo}La rama estaba muy alta y no pude sacudir el arbolito. Perdón, mi cielo.`);
        return interaction.editReply({ embeds: [embed] });
    }
}
