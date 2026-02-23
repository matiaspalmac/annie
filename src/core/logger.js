import { EmbedBuilder } from "discord.js";
import { CONFIG } from "./config.js";

// Constantes
const MAX_ERROR_LENGTH = 1000;
const MAX_OPTIONS_LENGTH = 500;
const LOG_TIMEOUT = 5000; // 5 segundos timeout

/**
 * Registra un error tanto en la consola como en el canal de logs de Discord
 * @param {import("discord.js").Client} client - Cliente de Discord
 * @param {Error|string} error - El error a loggear
 * @param {string} [context="Error General"] - Contexto opcional (ej. "Comando /linkid")
 * @returns {Promise<void>}
 */
export async function logError(client, error, context = "Error General") {
    // Validación de entrada
    if (!error) {
        console.warn('[Logger] logError llamado sin error');
        return;
    }

    const contextSeguro = String(context).substring(0, 100);
    console.error(`[ERROR] ${contextSeguro}:`, error);

    if (!CONFIG.LOG_CHANNEL_ID || !client) return;

    try {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Log timeout')), LOG_TIMEOUT);
        });

        const logPromise = (async () => {
            const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
            if (!guild) {
                console.warn('[Logger] Guild no encontrado');
                return;
            }

            const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                console.warn('[Logger] Canal de logs no encontrado o no es de texto');
                return;
            }

            const errorMsg = error instanceof Error 
                ? (error.stack || error.message) 
                : String(error);
            const errorMsgSeguro = errorMsg.substring(0, MAX_ERROR_LENGTH);

            const embed = new EmbedBuilder()
                .setTitle("🚨 Error Detectado en Annie")
                .setColor("#FF0000")
                .addFields(
                    { name: "Contexto", value: `\`${contextSeguro}\``, inline: false },
                    { name: "Detalles", value: `\`\`\`js\n${errorMsgSeguro}\n\`\`\``, inline: false }
                )
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        })();

        await Promise.race([logPromise, timeoutPromise]);
    } catch (err) {
        // Silenciar errores de logging para evitar loops
        if (err.message !== 'Log timeout') {
            console.error("[Logger] Error enviando log:", err.message);
        }
    }
}

/**
 * Registra el inicio correcto de Annie en el canal de logs
 * @param {import("discord.js").Client} client - Cliente de Discord
 * @returns {Promise<void>}
 */
export async function logStartup(client) {
    if (!CONFIG.LOG_CHANNEL_ID || !client) return;

    try {
        const guild = await client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
        if (!guild) {
            console.warn('[Logger] Guild no encontrado para startup log');
            return;
        }

        const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            console.warn('[Logger] Canal de logs no encontrado para startup');
            return;
        }

        const appLabel = CONFIG.APP_LABEL || 'Annie';
        const userTag = client.user?.tag || 'Bot';

        const embed = new EmbedBuilder()
            .setTitle("🌱 Annie Despertó")
            .setColor("#4CAF50") // Verde
            .setDescription(
                `**${userTag}** (${appLabel}) se ha conectado exitosamente.\n\n` +
                `✓ Caché de autocompletado cargada\n` +
                `✓ Conectada a Turso y Discord\n` +
                `✓ Comandos registrados`
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error("[Logger] Error enviando startup log:", err.message);
    }
}

/**
 * Registra el uso de un comando slash incluyendo sus opciones
 * @param {import("discord.js").CommandInteraction} interaction - Interacción del comando usado
 * @returns {Promise<void>}
 */
export async function logCommand(interaction) {
    if (!CONFIG.LOG_CHANNEL_ID || !interaction) return;

    try {
        const guild = await interaction.client.guilds.fetch(CONFIG.GUILD_ID).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(CONFIG.LOG_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        // Extraer opciones de forma segura
        let opcionesStr = "Ninguna";
        if (interaction.options?.data && Array.isArray(interaction.options.data)) {
            const options = interaction.options.data
                .map(opt => `${opt.name}: ${String(opt.value).substring(0, 50)}`)
                .join(", ");
            opcionesStr = options.substring(0, MAX_OPTIONS_LENGTH) || "Ninguna";
        }

        const userId = interaction.user?.id || 'unknown';
        const userTag = interaction.user?.tag || 'Unknown User';
        const channelId = interaction.channelId || 'unknown';
        const commandName = interaction.commandName || 'unknown';

        const embed = new EmbedBuilder()
            .setAuthor({
                name: userTag,
                iconURL: interaction.user?.displayAvatarURL() || undefined
            })
            .setColor("#2B2D31") // Gris oscuro
            .setDescription(`**Comando usado:** \`/${commandName}\``)
            .addFields(
                { name: "Usuario", value: `<@${userId}> (${userId})`, inline: true },
                { name: "Canal", value: `<#${channelId}>`, inline: true },
                { name: "Opciones", value: `\`${opcionesStr}\``, inline: false }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (err) {
        // Silenciar errores de logging
        console.error("[Logger] Error registrando comando:", err.message);
    }
}
