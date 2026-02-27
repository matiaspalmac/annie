import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

const SKILL_EMOJI = {
    pesca: "🎣", mineria: "⛏️", recoleccion: "🌿", caza: "🐛",
    fotografia: "📸", cocina: "🍳", exploracion: "🗺️", comercio: "🛒"
};

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

        // 2. Obtener títulos del usuario
        const resTitulos = await db.execute({
            sql: "SELECT titulo, equipado FROM titulos WHERE user_id = ?",
            args: [userId]
        });

        let tituloEquipado = "*(Ninguno todavía — ¡sigue aventurando!)*";
        const opcionesTitulos = [];

        opcionesTitulos.push(
            new StringSelectMenuOptionBuilder()
                .setLabel("Ninguno")
                .setDescription("Quitar título equipado")
                .setValue("desequipar")
        );

        resTitulos.rows.forEach(r => {
            const t = String(r.titulo);
            const isEquipado = Number(r.equipado) === 1;
            if (isEquipado) tituloEquipado = `✨ **${t}**`;
            opcionesTitulos.push(
                new StringSelectMenuOptionBuilder()
                    .setLabel(t.slice(0, 100))
                    .setDescription("Equipar este título")
                    .setValue(t)
            );
        });

        const embed = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle(`👑 Perfil de ${interaction.user.username}`)
            .setDescription(`Aquí puedes ver tu nivel de experiencia en las tareas del pueblito y elegir tu título visible en el perfil.`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 128 }))
            .addFields(
                { name: "🏆 Título equipado", value: tituloEquipado, inline: false }
            );

        // Añadir habilidades como inline fields
        if (resHabilidades.rows.length === 0) {
            embed.addFields({ name: "📖 Habilidades", value: "Aún no has descubierto tus talentos ocultos.", inline: false });
        } else {
            for (const r of resHabilidades.rows) {
                const habilidad = String(r.habilidad);
                const emoji = SKILL_EMOJI[habilidad] || "⭐";
                embed.addFields({
                    name: `${emoji} ${habilidad.charAt(0).toUpperCase() + habilidad.slice(1)}`,
                    value: `Nivel **${r.nivel}**`,
                    inline: true
                });
            }
        }

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

                let tituloNuevo = "*(Ninguno)*";

                if (eleccion !== "desequipar") {
                    await db.execute({
                        sql: "UPDATE titulos SET equipado = 1 WHERE user_id = ? AND titulo = ?",
                        args: [userId, eleccion]
                    });
                    tituloNuevo = `✨ **${eleccion}**`;
                }

                const embedConfirm = crearEmbed(
                    eleccion === "desequipar" ? CONFIG.COLORES.ROSA : CONFIG.COLORES.DORADO
                )
                    .setTitle(eleccion === "desequipar" ? "🎽 Título desequipado" : "👑 ¡Título equipado!")
                    .setDescription(
                        eleccion === "desequipar"
                            ? `Has guardado tu título. Ahora aparecerás sin título en tu perfil.`
                            : `¡Ahora luces tu nuevo título en el pueblito, corazón! 🌸`
                    )
                    .addFields({ name: "🏆 Título activo", value: tituloNuevo, inline: false });

                await i.editReply({
                    embeds: [embedConfirm],
                    components: []
                });

            } catch (err) {
                console.error("Error cambiando título:", err);
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({ components: [] }).catch(() => { });
            }
        });

    } catch (error) {
        console.error("Error en comando /titulos:", error);
        const embedErr = crearEmbed(CONFIG.COLORES.ROSA)
            .setTitle("❌ ¡Ay, las medallas!")
            .setDescription(`${bostezo}Uy, se me cayeron las medallas del estante. Intenta de nuevo porfi.`);
        return interaction.followUp({ embeds: [embedErr] });
    }
}
