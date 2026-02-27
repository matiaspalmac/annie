import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
    .setName("admin-roles")
    .setDescription("Envía el mensaje de selección de roles")
    .addChannelOption(o => o.setName("canal").setDescription("Canal donde enviar (por defecto: canal actual)").setRequired(false));

export async function execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.member.permissions.has("ManageRoles")) {
        const embed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("🚫 Sin permisos")
            .setDescription("Ay, tesorito... este comando es solo para quienes cuidan el pueblito. Necesitas permiso de **Gestionar Roles**.");
        return interaction.editReply({ embeds: [embed] });
    }

    const canalObjetivo = interaction.options.getChannel("canal") || interaction.channel;
    if (!canalObjetivo.isTextBased()) {
        const embed = crearEmbed(CONFIG.COLORES.NARANJA)
            .setTitle("⚠️ Canal no válido")
            .setDescription("Ese canal no es de texto, corazoncito... Elige uno donde pueda escribir Annie.");
        return interaction.editReply({ embeds: [embed] });
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
        .setFooter({ text: `${CONFIG.APP_LABEL} | Heartopia`, iconURL: interaction.guild?.iconURL({ size: 32 }) })
        .setTimestamp();

    try {
        const msg = await canalObjetivo.send({ content: "Reacciona abajo para elegir tus roles, ¡vecinitos lindos!", embeds: [embed] });
        const emojis = Object.keys(CONFIG.REACTION_ROLES);
        for (const emoji of emojis) await msg.react(emoji);

        const confirmEmbed = crearEmbed(CONFIG.COLORES.VERDE)
            .setTitle("✅ ¡Mensaje de roles publicado!")
            .setDescription(`El mensajito de roles quedó listo en ${canalObjetivo}. ¡Los vecinos ya pueden elegir sus roles!`)
            .addFields(
                { name: "📌 Canal", value: `${canalObjetivo}`, inline: true },
                { name: "🔖 ID del mensaje", value: `\`${msg.id}\``, inline: true }
            );
        await interaction.editReply({ embeds: [confirmEmbed] });
    } catch (err) {
        console.error("Error enviando mensaje de roles:", err);
        const errEmbed = crearEmbed(CONFIG.COLORES.ROJO)
            .setTitle("❌ ¡Error al publicar!")
            .setDescription("Ay no... se me enredó el delantal y no pude enviar el mensaje. Revisa mis permisos en ese canal, tesoro.");
        await interaction.editReply({ embeds: [errEmbed] });
    }
}
