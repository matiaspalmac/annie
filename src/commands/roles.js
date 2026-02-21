import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { crearEmbed } from "../utils.js";

export const data = new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Envía el mensaje de selección de roles")
    .addChannelOption(o => o.setName("canal").setDescription("Canal donde enviar (por defecto: canal actual)").setRequired(false));

export async function execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.member.permissions.has("ManageRoles")) {
        return interaction.editReply({
            content: "Ay, tesorito... este comando es solo para quienes cuidan el pueblito (necesitas permiso de gestionar roles).",
        });
    }

    const canalObjetivo = interaction.options.getChannel("canal") || interaction.channel;
    if (!canalObjetivo.isTextBased()) {
        return interaction.editReply({
            content: "Ese canal no es de texto, corazoncito... elige uno donde pueda escribir Annie."
        });
    }

    const embed = crearEmbed(CONFIG.COLORES.ROSA)
        .setTitle("🌈 Oficinita de Annie — ¡Elige tus roles con cariño, vecino!")
        .setDescription(
            "¡Wena, corazoncitos del pueblito! Soy Annie, tu carterita favorita.\n\n" +
            "Reacciona con los emojis que más te gusten para recibir notificaciones dulces " +
            "de los eventos que te hagan ilusión.\n\n" +
            "**Lista de roles:**\n" +
            Object.entries(CONFIG.REACTION_ROLES).map(([emoji]) => {
                const nombres = {
                    "🪲": "Atraer Bichos",
                    "🫧": "Lanzador de Burbujas",
                    "🦆": "Pato Amarillo",
                    "🎣": "Pesca Marina",
                    "🪺": "Nido de las Aves",
                    "💐": "Ramo de Flores Arcoiris",
                    "🌠": "Lluvia de Estrellas"
                };
                return `${emoji} — ${nombres[emoji] || "Rol"}`;
            }).join("\n") +
            "\n\nReacciona con el emoji que quieras y te pongo el rol con cariño.\nSi quitas la reacción, te lo quito sin drama."
        )
        .setFooter({ text: "v2.0 | Heartopia", iconURL: interaction.guild?.iconURL({ size: 32 }) })
        .setTimestamp();

    try {
        const msg = await canalObjetivo.send({ content: "Reacciona abajo para elegir tus roles, ¡vecinitos lindos!", embeds: [embed] });
        const emojis = Object.keys(CONFIG.REACTION_ROLES);
        for (const emoji of emojis) await msg.react(emoji);

        await interaction.editReply({
            content: `¡Listo, corazoncito! El mensajito de roles quedó publicado en ${canalObjetivo}.\n**ID del mensaje:** \`${msg.id}\``,
        });
    } catch (err) {
        console.error("Error enviando mensaje de roles:", err);
        await interaction.editReply({
            content: "Ay no... se me enredó el delantal y no pude enviar el mensaje. Revisa mis permisos en ese canal, tesoro.",
        });
    }
}
