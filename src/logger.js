import { EmbedBuilder } from "discord.js";
import { CONFIG } from "./config.js";

/**
 * Registra un error tanto en la consola como en el canal de logs de Discord.
 * @param {import("discord.js").Client} client - Cliente de Discord
 * @param {Error|String} error - El error a loggear
 * @param {String} context - Contexto opcional (ej. "Comando /linkid")
 */
export async function logError(client, error, context = "Error General") {
    console.error(`[ERROR] ${context}:`, error);

    if (!CONFIG.LOG_CHANNEL_ID) return;

    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const errorMsg = error instanceof Error ? error.stack || error.message : String(error);

        const embed = new EmbedBuilder()
            .setTitle("🚨 Error Detectado en Annie")
            .setColor("#FF0000")
            .addFields(
                { name: "Contexto", value: `\`${context}\``, inline: false },
                { name: "Detalles", value: `\`\`\`js\n${errorMsg.slice(0, 1000)}\n\`\`\``, inline: false }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => { });
    } catch (err) {
        console.error("No se pudo enviar el error al canal de logs:", err);
    }
}

/**
 * Registra el inicio correcto de Annie en el canal de logs.
 * @param {import("discord.js").Client} client - Cliente de Discord
 */
export async function logStartup(client) {
    if (!CONFIG.LOG_CHANNEL_ID) return;

    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setTitle("🌱 Annie Despertó")
            .setColor("#4CAF50") // Verde
            .setDescription(`**${client.user.tag}** se ha conectado exitosamente.\n\n` +
                `✓ Caché de autocompletado cargada\n` +
                `✓ Conectada a Turso y Discord\n` +
                `✓ Comandos registrados`)
            .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => { });
    } catch (err) {
        console.error("No se pudo enviar mensaje de inicio al canal de logs:", err);
    }
}

/**
 * Registra el uso de un comando slash incluyendo sus opciones.
 * @param {import("discord.js").CommandInteraction} interaction - Interaction del comando usado
 */
export async function logCommand(interaction) {
    if (!CONFIG.LOG_CHANNEL_ID) return;

    try {
        const guild = await interaction.client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const options = interaction.options.data.map(opt => {
            return `${opt.name}: ${opt.value}`;
        });

        const opcionesStr = options.length > 0 ? options.join(", ") : "Ninguna";

        const embed = new EmbedBuilder()
            .setAuthor({
                name: interaction.user.tag,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setColor("#2B2D31") // Gris oscuro
            .setDescription(`**Comando usado:** \`/${interaction.commandName}\``)
            .addFields(
                { name: "Usuario", value: `<@${interaction.user.id}> (${interaction.user.id})`, inline: true },
                { name: "Canal", value: `<#${interaction.channelId}>`, inline: true },
                { name: "Opciones", value: `\`${opcionesStr}\``, inline: false }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => { });
    } catch (err) {
        console.error("No se pudo registrar log de comando:", err);
    }
}
