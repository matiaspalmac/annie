import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo, crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

export const data = new SlashCommandBuilder()
    .setName("titulos")
    .setDescription("Maneja tus títulos ganados y observa tus niveles de habilidad ocultos.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
        // 1. Obtener niveles de habilidades
        const resHabilidades = await db.execute({
            sql: "SELECT habilidad, nivel FROM habilidades WHERE user_id = ?",
            args: [userId]
        });

        let textoHabilidades = "";
        if (resHabilidades.rows.length === 0) {
            textoHabilidades = "Aún no has descubierto tus talentos ocultos.";
        } else {
            resHabilidades.rows.forEach(r => {
                textoHabilidades += `**${String(r.habilidad).toUpperCase()}:** Nivel ${r.nivel}\n`;
            });
        }

        // 2. Obtener títulos del usuario
        const resTitulos = await db.execute({
            sql: "SELECT titulo, equipado FROM titulos WHERE user_id = ?",
            args: [userId]
        });

        let tituloEquipado = "*(Ninguno)*";
        const opcionesTitulos = [];

        // Agregar la opción de desequipar
        opcionesTitulos.push(
            new StringSelectMenuOptionBuilder()
                .setLabel("Ninguno")
                .setDescription("Quitar título equipado")
                .setValue("desequipar")
        );

        resTitulos.rows.forEach(r => {
            const t = String(r.titulo);
            const isEquipado = Number(r.equipado) === 1;

            if (isEquipado) tituloEquipado = `✨ **${t}** ✨`;

            opcionesTitulos.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(t)
                    .setDescription("Equipar este título")
                    .setValue(t)
            );
        });

        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle(`👑 Perfil y Títulos de ${interaction.user.username}`)
            .setDescription(`Aquí puedes ver tu nivel de experiencia en las tareas del pueblito.\n\n📖 **Tus Habilidades:**\n${textoHabilidades}\n\n🏆 **Tu Título Equipado:**\n${tituloEquipado}`);

        if (resTitulos.rows.length === 0) {
            embed.setFooter({ text: "Sigue jugando para desbloquear títulos secretos." });
            return interaction.followUp({ embeds: [embed] });
        }

        // Si tiene títulos, armar el menú selector
        const select = new StringSelectMenuBuilder()
            .setCustomId('seleccionar_titulo')
            .setPlaceholder('Elige un título para equipar...')
            .addOptions(opcionesTitulos);

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
                // Desequipar todo
                await db.execute({
                    sql: "UPDATE titulos SET equipado = 0 WHERE user_id = ?",
                    args: [userId]
                });

                let mensajeAlerta = "Has desequipado tu título.";

                if (eleccion !== "desequipar") {
                    // Equipar el nuevo
                    await db.execute({
                        sql: "UPDATE titulos SET equipado = 1 WHERE user_id = ? AND titulo = ?",
                        args: [userId, eleccion]
                    });
                    mensajeAlerta = `Te has equipado el título: **${eleccion}** ✨`;
                }

                await i.editReply({
                    content: `✅ ${mensajeAlerta}`,
                    embeds: [],
                    components: []
                });

            } catch (err) {
                console.error("Error cambiando título:", err);
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    components: [],
                    content: `${bostezo}La libretita de títulos se cerró. Usa el comando otra vez si quieres cambiarlo.`
                }).catch(() => { });
            }
        });

    } catch (error) {
        console.error("Error en comando /titulos:", error);
        return interaction.followUp(`${bostezo}Uy, se me cayeron las medallas. Intenta de nuevo porfi.`);
    }
}
