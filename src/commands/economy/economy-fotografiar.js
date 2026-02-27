import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedCooldown, crearEmbedDrop } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { ganarXP, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";

// Cooldown de 3 minutos
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
                const embed = crearEmbedCooldown(faltanMinutos, bostezo.trim(), "fotografiar")
                    .setDescription(
                        `*${bostezo.trim()}*\n\n` +
                        `📷 Todavía estás revelando el rollo de fotos, corazón...\n` +
                        `⌛ Espera **${faltanMinutos} minutos** para volver a fotografiar aves.`
                    );
                return interaction.editReply({ embeds: [embed] });
            }
        }

        // 2. Establecer cooldown
        await db.execute({
            sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite)
            VALUES (?, 'fotografiar', 'global', ?)
            ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
            args: [userId, ahora + COOLDOWN_FOTOGRAFIAR]
        });

        // XP de Fotografía
        const xpGanada = Math.floor(Math.random() * 15) + 10;
        const nivelFoto = await ganarXP(userId, "fotografia", xpGanada, interaction);

        // Lógica de drops
        const bonoNivel = (nivelFoto - 1) * 0.3;
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 8 : 0;

        const chanceMitica = Math.min(0.5 + (bonoNivel * 0.1) + bonusSuerte, 5);
        const chanceLegendaria = Math.min(3 + (bonoNivel * 0.2) + bonusSuerte, 15);
        const chanceEpica = Math.min(10 + (bonoNivel * 0.4) + bonusSuerte, 28);
        const chanceRara = Math.min(20 + (bonoNivel * 0.5) + bonusSuerte, 40);

        const rand = Math.random() * 100;

        let elegido = null;
        let rareza = "comun";
        let mensajeFlash = "*Flash... ¡clic!* 📸";

        if (rand <= chanceMitica) {
            rareza = "mitico";
            const fotosMiticas = [
                { id: "Foto de Fénix", emoji: "🔥", texto: "¡¡INCREÍBLE!! ¡Fotografiaste a un pájaro incendiándose y renaciendo en el cielo rojo! ¡Una toma única en la historia!" },
                { id: "Foto de Pájaro Trueno", emoji: "⚡", texto: "¡Por las nubes! ¡Capturaste un relámpago con alas! ¡Esta foto se exhibe en museos, tesoro!" },
            ];
            elegido = fotosMiticas[Math.floor(Math.random() * fotosMiticas.length)];
            await registrarBitacora(userId, `¡¡Tomó una ${elegido.id.toUpperCase()} MÍTICA!!`);

        } else if (rand <= chanceLegendaria) {
            rareza = "legendario";
            const fotosLegendarias = [
                { id: "Foto de Águila Real", emoji: "🦅", texto: "¡Majestuoso! Lograste una toma perfecta de un águila real peinando las nubes del pueblito." },
                { id: "Foto de Búho Nival", emoji: "🦉", texto: "¡Espléndido! Encontraste a un Búho de las nieves mirándote fijamente con esos ojos sabios." },
            ];
            elegido = fotosLegendarias[Math.floor(Math.random() * fotosLegendarias.length)];
            await registrarBitacora(userId, `Tomó una hermosa ${elegido.id} legendaria.`);

        } else if (rand <= chanceEpica) {
            rareza = "epico";
            const fotosEpicas = [
                { id: "Foto de Halcón Peregrino", emoji: "🦅", texto: "¡Qué velocidad! Lograste fotografiarlo en pleno picado. El encuadre es perfecto." },
                { id: "Foto de Martín Pescador", emoji: "🐦", texto: "¡Hermosísimo! Lo pillaste justo en el instante en que atrapaba a un pececito. ¡Arte puro!" },
            ];
            elegido = fotosEpicas[Math.floor(Math.random() * fotosEpicas.length)];

        } else if (rand <= chanceRara) {
            rareza = "raro";
            const fotosRaras = [
                { id: "Foto de Tucán", emoji: "🦜", texto: "¡Colores vibrantes! Su pico multicolor resalta perfecto con el fondo verde del bosque." },
                { id: "Foto de Picaflor", emoji: "🪶", texto: "Tuviste que usar ráfaga ultra-rápida para congelar las alas del picaflor batiendo." },
            ];
            elegido = fotosRaras[Math.floor(Math.random() * fotosRaras.length)];

        } else {
            // Comunes / poco comunes
            const fotosComunes = [
                { id: "Foto de Loro Macho", emoji: "🦜", rareza: "poco_comun", texto: "Se quedó posando tranquilo en la reja del antejardín. ¡Modelo natural!" },
                { id: "Foto de Golondrina", emoji: "🐦", rareza: "poco_comun", texto: "Una linda golondrina descansando en el cable de la luz eléctrica." },
                { id: "Foto de Paloma", emoji: "🕊️", rareza: "comun", texto: "Le sacaste foto a una palomita comiendo migas del suelo de la plaza." },
                { id: "Foto de Gorrión", emoji: "🐦", rareza: "comun", texto: "Un gorrioncito muy simpático saltando de rama en rama en el balcón." },
                { id: "Foto Borrosa", emoji: "📷", rareza: "comun", texto: "Te tembló la mano y salió un manchón de plumas volando lejos... Próxima vez, corazón." },
            ];
            const elegidoComun = fotosComunes[Math.floor(Math.random() * fotosComunes.length)];
            elegido = elegidoComun;
            rareza = elegidoComun.rareza;

            if (elegido.id === "Foto Borrosa") {
                mensajeFlash = "*Clickk... ay, me moví.* 📸😬";
            }
        }

        // Guardar en inventario
        await db.execute({
            sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                  VALUES (?, ?, 1)
                  ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
            args: [userId, elegido.id]
        });

        const embed = crearEmbedDrop({
            emoji: elegido.emoji,
            nombre: elegido.id,
            rareza,
            narrativa: `${mensajeFlash}\n\n${elegido.texto}`,
            extras: [
                { name: "📸 Nivel de Fotografía", value: `\`${nivelFoto}\``, inline: true },
                ...(amuletoActivo ? [{ name: "🍀 Amuleto activo", value: "Suerte aumentada", inline: true }] : []),
            ]
        });

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /fotografiar:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Sin batería!")
            .setDescription(`${bostezo}La cámara se atascó o se quedó sin batería... Intentemos de nuevo en un rato, corazoncito.`);
        return interaction.editReply({ embeds: [embed] });
    }
}
