import { SlashCommandBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed, crearEmbedCooldown, crearEmbedDrop } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { ganarXP, registrarBitacora, tieneBoostActivo } from "../../features/progreso.js";
import { verificarCooldown, setCooldown, detectarMacro } from "../../features/cooldown.js";
import { progresarMision } from "../../features/misiones.js";

// Cooldown de 3 minutos
const COOLDOWN_FOTOGRAFIAR = 180000;

export const data = new SlashCommandBuilder()
    .setName("fotografiar")
    .setDescription("Toma tu cámara y sal a sacar fotos a distintas aves en el pueblito.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
        // 1. Revisar cooldown
        const cd = await verificarCooldown(userId, "fotografiar", COOLDOWN_FOTOGRAFIAR, bostezo);
        if (!cd.ok) return interaction.editReply({ embeds: [cd.embed] });

        // 2. Establecer cooldown
        await setCooldown(userId, "fotografiar", COOLDOWN_FOTOGRAFIAR);

        // XP de Fotografía
        const xpGanada = Math.floor(Math.random() * 15) + 10;
        const nivelFoto = await ganarXP(userId, "fotografia", xpGanada, interaction);

        // Anti-macro
        const penalizacionMacro = await detectarMacro(userId, "fotografiar", COOLDOWN_FOTOGRAFIAR);

        // Lógica de drops
        const bonoNivel = (nivelFoto - 1) * 0.3;
        const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
        const bonusSuerte = amuletoActivo ? 8 : 0;

        const chanceMitica = Math.min((0.5 + (bonoNivel * 0.1) + bonusSuerte) * penalizacionMacro, 5);
        const chanceLegendaria = Math.min((3 + (bonoNivel * 0.2) + bonusSuerte) * penalizacionMacro, 15);
        const chanceEpica = Math.min((10 + (bonoNivel * 0.4) + bonusSuerte) * penalizacionMacro, 28);
        const chanceRara = Math.min((20 + (bonoNivel * 0.5) + bonusSuerte) * penalizacionMacro, 40);

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

        progresarMision(interaction.user.id, "fotografiar").catch(() => {});
        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("Error en comando /fotografiar:", error);
        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Sin batería!")
            .setDescription(`${bostezo}La cámara se atascó o se quedó sin batería... Intentemos de nuevo en un rato, corazoncito.`);
        return interaction.editReply({ embeds: [embed] });
    }
}
