import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo } from "../../core/utils.js";
import { ganarXP, obtenerNivelHabilidad, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";

// Cooldown de 3 minutos = 180000 ms
const COOLDOWN_FOTOGRAFIAR = 180000;

export const data = new SlashCommandBuilder()
    .setName("fotografiar")
    .setDescription("Toma tu cámara y sal a sacar fotos a distintas aves en el pueblito.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const ahora = Date.now();

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const resCd = await db.execute({
            sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = 'fotografiar' AND extra_id = 'global'",
            args: [userId]
        });

        if (resCd.rows.length > 0) {
            const limite = Number(resCd.rows[0].fecha_limite);
            if (ahora < limite) {
                const faltanMinutos = Math.ceil((limite - ahora) / 60000);
                return interaction.followUp(`${bostezo}Todavía estás revelando el rollo de fotos... Espera **${faltanMinutos} minutos** para volver a fotografiar aves.`);
            }
        }

        // 2. Establecer nuevo cooldown
        const nuevoLimite = ahora + COOLDOWN_FOTOGRAFIAR;
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite) 
            VALUES (?, 'fotografiar', 'global', ?) 
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, nuevoLimite]
        });

        // Ganar XP de Fotografía (Habilidad tipo "naturaleza" o "exploracion", usemos "fotografía" aunque sea nueva)
        const xpGanada = Math.floor(Math.random() * 15) + 10;
        const nivelFoto = await ganarXP(userId, "fotografia", xpGanada, interaction);

        // 3. Lógica de drops
        const bonoNivel = (nivelFoto - 1) * 0.3;
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 8 : 0;

        const chanceMitica = Math.min(0.5 + (bonoNivel * 0.1) + bonusSuerte, 5);
        const chanceLegendaria = Math.min(3 + (bonoNivel * 0.2) + bonusSuerte, 15);
        const chanceEpica = Math.min(10 + (bonoNivel * 0.4) + bonusSuerte, 28);
        const chanceRara = Math.min(20 + (bonoNivel * 0.5) + bonusSuerte, 40);
        const rand = Math.random() * 100;

        let elegido = null;
        let mensajeFlash = "*Flash... click!* 📸";

        // MITICO (Fénix, Pájaro Trueno)
        if (rand <= chanceMitica) {
            const fotosMiticas = [
                { id: "Foto de Fénix", emoji: "🔥", texto: "¡¡INCREÍBLE!! ¡Fotografiaste a un pájaro incendiándose y renaciendo en el cielo rojo!" },
                { id: "Foto de Pájaro Trueno", emoji: "⚡", texto: "¡Por las nubes! Capturaste un relámpago con alas... ¡Una foto única en la vida!" }
            ];
            elegido = fotosMiticas[Math.floor(Math.random() * fotosMiticas.length)];
            await registrarBitacora(userId, `¡¡Tomó una ${elegido.id.toUpperCase()} MÍTICA!!`);
        }
        // LEGENDARIO (Águila, Búho)
        else if (rand <= chanceLegendaria) {
            const fotosLegendarias = [
                { id: "Foto de Águila Real", emoji: "🦅", texto: "¡Majestuoso! Lograste una toma perfecta de un águila peinando las nubes." },
                { id: "Foto de Búho Nival", emoji: "🦉", texto: "¡Espléndido! Encontraste a un Búho de las nieves mirándote fijamente a la cámara." }
            ];
            elegido = fotosLegendarias[Math.floor(Math.random() * fotosLegendarias.length)];
            await registrarBitacora(userId, `Tomó una hermosa ${elegido.id} legendaria.`);
        }
        // EPICO (Halcón, Martín)
        else if (rand <= chanceEpica) {
            const fotosEpicas = [
                { id: "Foto de Halcón Peregrino", emoji: "🦅", texto: "¡Qué velocidad! Lograste fotografiarlo en pleno picado." },
                { id: "Foto de Martín Pescador", emoji: "🐦", texto: "¡Hermoso! Lo pillaste justo atrapando a un pececito." }
            ];
            elegido = fotosEpicas[Math.floor(Math.random() * fotosEpicas.length)];
        }
        // RARO (Tucán, Picaflor)
        else if (rand <= chanceRara) {
            const fotosRaras = [
                { id: "Foto de Tucán", emoji: "🦜", texto: "¡Colores vibrantes! Su pico resalta perfecto en la foto." },
                { id: "Foto de Picaflor", emoji: "🪶", texto: "Tuviste que usar una ráfaga muy rápida para congelar el vuelo del picaflor." }
            ];
            elegido = fotosRaras[Math.floor(Math.random() * fotosRaras.length)];
        }
        // COMÚN / POCO COMÚN (Loro, Paloma, Gorrión)
        else {
            const fotosComunes = [
                { id: "Foto de Loro Macho", emoji: "🦜", texto: "Se quedó posando en la reja del antejardín." },
                { id: "Foto de Golondrina", emoji: "🐦", texto: "Una linda golondrina descansando en el cable de la luz." },
                { id: "Foto de Paloma", emoji: "🕊️", texto: "Le sacaste una foto a una palomita comiendo migas del suelo." },
                { id: "Foto de Gorrión", emoji: "🐦", texto: "Un gorrioncito muy simpático saltando en el balcón." },
                { id: "Foto Borrosa", emoji: "📷", texto: "Te tembló la mano y salió un manchón de plumas volando lejos..." }
            ];
            elegido = fotosComunes[Math.floor(Math.random() * fotosComunes.length)];

            // Si sale borrosa, chance de que solo sea un chiste y mensaje rápido
            if (elegido.id === "Foto Borrosa") {
                mensajeFlash = "*Clickk... ahh me moví.* 📸";
            }
        }

        // 4. Guardar la foto en el inventario
        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad) 
                  VALUES (?, ?, 1) 
                  ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
            args: [userId, elegido.id]
        });

        // 5. Imprimir resultado
        return interaction.followUp(
            `${mensajeFlash}\n\n` +
            `${elegido.texto}\n` +
            `Obtuviste: **${elegido.emoji} ${elegido.id}**\n` +
            `📷 Nivel de Fotografía: **${nivelFoto}**`
        );

    } catch (error) {
        console.error("Error en comando /fotografiar:", error);
        return interaction.followUp(`${bostezo}La cámara se atascó o se quedó sin batería... intentemos en un rato.`);
    }
}
