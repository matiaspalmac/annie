import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo, crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

export const data = new SlashCommandBuilder()
    .setName("tema")
    .setDescription("Elige el tema visual para tu tarjeta de perfil (Web y Discord).");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
        // 1. Obtener temas comprados
        const resTemas = await db.execute({
            sql: "SELECT item_id FROM inventario_economia WHERE user_id = ? AND item_id LIKE 'tema_%' AND cantidad > 0",
            args: [userId]
        });

        // 2. Obtener el tema activo actual
        const resUsuario = await db.execute({
            sql: "SELECT tema_perfil FROM usuarios WHERE id = ?",
            args: [userId]
        });

        let temaActivo = "Por Defecto (Rosado)";
        if (resUsuario.rows.length > 0 && resUsuario.rows[0].tema_perfil !== "default") {
            temaActivo = String(resUsuario.rows[0].tema_perfil).replace('tema_', '');
        }

        const opcionesTemas = [];

        // Agregar la opción por defecto
        opcionesTemas.push(
            new StringSelectMenuOptionBuilder()
                .setLabel("Por Defecto (Rosado)")
                .setDescription("El cálido amanecer del pueblito")
                .setValue("default")
        );

        if (resTemas.rows.length > 0) {
            resTemas.rows.forEach(r => {
                const rawId = String(r.item_id);
                const nombreTema = rawId.replace('tema_', '');

                // Descripciones bonitas según el tema
                let desc = "Un ambiente especial";
                if (nombreTema === "bosque") desc = "Tonos esmeraldas y naturaleza";
                if (nombreTema === "playa") desc = "Brisas oceánicas y cian";
                if (nombreTema === "noche") desc = "Misteriosos tonos índigo";

                opcionesTemas.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`Tema: ${nombreTema.charAt(0).toUpperCase() + nombreTema.slice(1)}`)
                        .setDescription(desc)
                        .setValue(rawId)
                );
            });
        }

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle(`🖌️ Paletas de Color de ${interaction.user.username}`)
            .setDescription(`Tienes **${resTemas.rows.length}** tema(s) especial(es) desbloqueado(s).\n\n🖼️ **Tema Actual:**\n${temaActivo}\n\nUsa el menú de abajo para pintar tu perfil.`);

        // Armar el menú selector
        const select = new StringSelectMenuBuilder()
            .setCustomId('seleccionar_tema')
            .setPlaceholder('Elige un tema visual...')
            .addOptions(opcionesTemas);

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
                // Actualizar tema_perfil en la tabla de usuarios
                await db.execute({
                    sql: "UPDATE usuarios SET tema_perfil = ? WHERE id = ?",
                    args: [eleccion, userId]
                });

                let mensajeAlerta = "Tu perfil ha vuelto a su acogedor color Rosado por defecto.";

                if (eleccion !== "default") {
                    mensajeAlerta = `¡Magia! 🖌️ Tu perfil ahora luce con el **${eleccion.replace('_', ' de ')}**.`;
                }

                await i.editReply({
                    content: `✅ ${mensajeAlerta}`,
                    embeds: [],
                    components: []
                });

            } catch (err) {
                console.error("Error cambiando tema:", err);
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    components: [],
                    content: `${bostezo}La caja de crayones se cerró. Usa el comando \`/tema\` otra vez si quieres seguir pintando.`
                }).catch(() => { });
            }
        });

    } catch (error) {
        console.error("Error en comando /tema:", error);
        return interaction.followUp(`${bostezo}Se me derramó la pintura... Intenta elegir tema de nuevo porfi.`);
    }
}
