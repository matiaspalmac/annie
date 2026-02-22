import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { db } from "../db.js";
import { getBostezo, crearEmbed } from "../utils.js";
import { CONFIG } from "../config.js";

export const data = new SlashCommandBuilder()
    .setName("mascota")
    .setDescription("Elige qué mascota del inventario te acompañará en tu perfil.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
        // 1. Obtener mascotas compradas
        const resMascotas = await db.execute({
            sql: "SELECT item_id FROM inventario_economia WHERE user_id = ? AND item_id LIKE 'mascota_%' AND cantidad > 0",
            args: [userId]
        });

        if (resMascotas.rows.length === 0) {
            return interaction.followUp(`${bostezo}Ay mi cielo, todavía no has adoptado ninguna mascota. Pásate por la tienda cuando tengas moneditas.`);
        }

        // 2. Obtener la mascota activa actual
        const resUsuario = await db.execute({
            sql: "SELECT mascota_activa FROM usuarios WHERE id = ?",
            args: [userId]
        });

        let mascotaActiva = "Ninguna";
        if (resUsuario.rows.length > 0 && resUsuario.rows[0].mascota_activa !== "default") {
            mascotaActiva = String(resUsuario.rows[0].mascota_activa).replace('mascota_', '');
        }

        const opcionesMascotas = [];

        // Agregar la opción de desequipar
        opcionesMascotas.push(
            new StringSelectMenuOptionBuilder()
                .setLabel("Ninguna")
                .setDescription("Guardar tu mascota actual en la casita")
                .setValue("default")
        );

        resMascotas.rows.forEach(r => {
            const rawId = String(r.item_id);
            const nombreMascota = rawId.replace('mascota_', '');

            opcionesMascotas.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(nombreMascota)
                    .setDescription(`Equipar a ${nombreMascota}`)
                    .setValue(rawId)
            );
        });

        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle(`🐾 Refugio de Mascotas de ${interaction.user.username}`)
            .setDescription(`Tienes **${resMascotas.rows.length}** amiguito(s) esperándote.\n\n🐕 **Acompañante Actual:**\n${mascotaActiva}\n\nUsa el menú de abajo para elegir quién paseará contigo por el pueblito hoy.`);

        // Armar el menú selector
        const select = new StringSelectMenuBuilder()
            .setCustomId('seleccionar_mascota')
            .setPlaceholder('Elige una mascota para que te acompañe...')
            .addOptions(opcionesMascotas);

        const row = new ActionRowBuilder().addComponents(select);

        const mensaje = await interaction.followUp({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        // Colector del dropdown
        const collector = mensaje.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000 // 1 minuto
        });

        collector.on('collect', async i => {
            const eleccion = i.values[0];

            await i.deferUpdate();

            try {
                // Actualizar mascota_activa en la tabla de usuarios
                await db.execute({
                    sql: "UPDATE usuarios SET mascota_activa = ? WHERE id = ?",
                    args: [eleccion, userId]
                });

                let mensajeAlerta = "Tu amiguito se ha ido a dormir a su casita.";

                if (eleccion !== "default") {
                    mensajeAlerta = `¡**${eleccion.replace('mascota_', '')}** está saltando de alegría! Ahora te acompañará a todas partes. 🐾`;
                }

                await i.editReply({
                    content: `✅ ${mensajeAlerta}`,
                    embeds: [],
                    components: []
                });

            } catch (err) {
                console.error("Error cambiando mascota:", err);
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    components: [],
                    content: `${bostezo}La puerta del refugio se cerró. Usa el comando \`/mascota\` otra vez si quieres cambiar a tu amiguito.`
                }).catch(() => { });
            }
        });

    } catch (error) {
        console.error("Error en comando /mascota:", error);
        return interaction.followUp(`${bostezo}Las llaves del refugio se me perdieron... Intenta llamar a tu mascota de nuevo porfi.`);
    }
}
