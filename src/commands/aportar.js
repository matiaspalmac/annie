import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { crearEmbed } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("aportar")
    .setDescription("Donar moneditas de tu bolsillo para el Evento Comunitario actual del Pueblito")
    .addIntegerOption(option =>
        option.setName("cantidad")
            .setDescription("Cantidad de monedas a donar")
            .setRequired(true)
            .setMinValue(1)
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const cantidadStr = interaction.options.getInteger("cantidad");
    const cantidad = Number(cantidadStr);

    if (isNaN(cantidad) || cantidad <= 0) {
        return interaction.reply({ content: `Eso no parece una cantidad válida, tesoro.`, flags: MessageFlags.Ephemeral });
    }

    try {
        // 1. Check if there's an active global event
        const resEvento = await db.execute("SELECT * FROM eventos_globales WHERE activo = 1 LIMIT 1");

        if (resEvento.rows.length === 0) {
            return interaction.reply({
                content: `${bostezo} En este momento no hay ningún proyecto o junta vecinal activa, corazoncito. ¡Guarda tus moneditas para más tarde!`,
                flags: MessageFlags.Ephemeral
            });
        }

        const evento = resEvento.rows[0];
        const eventoId = evento.id;
        const titulo = evento.titulo;
        const meta = Number(evento.meta_monedas);
        const progreso = Number(evento.progreso_monedas);

        if (progreso >= meta) {
            return interaction.reply({
                content: `¡Llegaste tarde, tesoro! Ya logramos la meta de **${titulo}**. ¡El pueblito está de fiesta!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // 2. Check if user has enough coins
        const resUser = await db.execute({
            sql: "SELECT monedas FROM usuarios WHERE id = ?",
            args: [userId]
        });

        if (resUser.rows.length === 0 || Number(resUser.rows[0].monedas) < cantidad) {
            return interaction.reply({
                content: `¡Ay! Me parece que no tienes tantas moneditas en los bolsillos. Solo tienes **${resUser.rows.length ? resUser.rows[0].monedas : 0}** 💰.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // 3. Process the donation
        const nuevoProgresoTotal = progreso + cantidad;
        const cantidadRestante = meta - evento.progreso_monedas;
        const donacionReal = cantidad > cantidadRestante ? cantidadRestante : cantidad;

        // Deduct from user
        await db.execute({
            sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
            args: [donacionReal, userId]
        });

        // Add to event
        await db.execute({
            sql: "UPDATE eventos_globales SET progreso_monedas = progreso_monedas + ? WHERE id = ?",
            args: [donacionReal, eventoId]
        });

        // Upsert user donation record
        await db.execute({
            sql: `INSERT INTO evento_donaciones (evento_id, user_id, cantidad) 
                  VALUES (?, ?, ?) 
                  ON CONFLICT(evento_id, user_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
            args: [eventoId, userId, donacionReal]
        });

        // 4. Check if the event was completed with this donation!
        if (nuevoProgresoTotal >= meta) {
            const embed = crearEmbed(CONFIG.COLORES.DORADO)
                .setTitle("🎉 ¡META DEL PUEBLITO ALCANZADA! 🎉")
                .setDescription(`*¡Annie sale corriendo de la oficinita emocionada!*`)
                .addFields(
                    { name: "🌟 Proyecto Completado", value: `**${titulo}**` },
                    { name: "💰 Recaudación Total", value: `${meta} / ${meta} moneditas` },
                    { name: "👑 Héroe del Momento", value: `¡**${username}** acaba de dar el golpe final donando **${donacionReal}** moneditas!` }
                )
                .setFooter({ text: "¡El servidor entero festeja! | Annie" });

            return interaction.reply({
                content: `¡ATENCIÓN PUEBLITO! 🎈🥳 @everyone`,
                embeds: [embed]
            });
        }

        // Success reply
        const embed = crearEmbed(CONFIG.COLORES.VERDE)
            .setTitle("💖 ¡Gracias por tu aporte!")
            .setDescription(`**${username}** acaba de donar **${donacionReal}** moneditas de todo corazón.`)
            .addFields(
                { name: "Causa", value: `*${titulo}*` },
                { name: "Progreso Total", value: `${progreso + donacionReal} / ${meta} 💰` }
            )
            .setFooter({ text: "¡Cada granito de arena cuenta! | Annie" });

        await interaction.reply({ embeds: [embed] });

    } catch (e) {
        console.error("Error comando aportar:", e.message, e.stack);
        return interaction.reply({ content: "Parece que se me trabó la cajita fuerte... inténtalo en un ratito.", flags: MessageFlags.Ephemeral });
    }
}
