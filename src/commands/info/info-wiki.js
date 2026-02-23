import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed, agregarNarrativa } from "../../core/utils.js";

const CATEGORIAS = [
    { name: "Peces", value: "peces" },
    { name: "Insectos", value: "insectos" },
    { name: "Aves", value: "aves" },
    { name: "Animales", value: "animales" },
    { name: "Cultivos", value: "cultivos" },
    { name: "Recolectables", value: "recolectables" },
    { name: "Recetas", value: "recetas" },
    { name: "Habitantes", value: "habitantes" },
    { name: "Logros", value: "logros" },
];

function getAllowedHosts() {
    if (Array.isArray(CONFIG.WIKI_ALLOWED_HOSTS) && CONFIG.WIKI_ALLOWED_HOSTS.length > 0) {
        return CONFIG.WIKI_ALLOWED_HOSTS.map(h => String(h).toLowerCase());
    }

    if (typeof CONFIG.WIKI_ALLOWED_HOSTS === "string" && CONFIG.WIKI_ALLOWED_HOSTS.trim()) {
        return CONFIG.WIKI_ALLOWED_HOSTS.split(",").map(h => h.trim().toLowerCase()).filter(Boolean);
    }

    return ["heartopiachile.vercel.app"];
}

function isWikiUrlAllowed(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const allowed = getAllowedHosts();
        return allowed.some(h => host === h || host.endsWith(`.${h}`));
    } catch {
        return false;
    }
}

function joinWikiUrl(base, suffix = "") {
    const cleanBase = String(base || "").replace(/\/+$/, "");
    if (!suffix) return `${cleanBase}/`;
    return `${cleanBase}/${suffix.replace(/^\/+/, "")}`;
}

export const data = new SlashCommandBuilder()
    .setName("wiki")
    .setDescription("Enlace directo a la wiki de Heartopia")
    .addStringOption(option =>
        option
            .setName("categoria")
            .setDescription("Abrir sección directa de la wiki")
            .setRequired(false)
            .addChoices(...CATEGORIAS)
    );

export async function execute(interaction, bostezo) {
    const categoria = interaction.options.getString("categoria");
    const baseUrl = String(CONFIG.WIKI_URL || "").trim();

    if (!baseUrl || !isWikiUrlAllowed(baseUrl)) {
        return interaction.reply({
            content: `${bostezo} No puedo abrir la wiki porque la URL configurada no es válida o no está permitida.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    const targetUrl = categoria ? joinWikiUrl(baseUrl, `wiki/${categoria}`) : joinWikiUrl(baseUrl);

    const embed = crearEmbed(CONFIG.COLORES.ROSA)
        .setTitle("📖 Wiki de Heartopia ❤️")
        .setDescription(
            `Aquí tienes el enlace de la wiki del pueblito, corazón.\n\n` +
            `🔗 **${targetUrl}**\n\n` +
            `${categoria ? `Abrí directo la categoría **${categoria}** para ti.` : "Toda la información está ahí, organizada con cariño por Annie y los vecinos."}`
        )
        .addFields({
            name: "Secciones populares",
            value: "Usa los botoncitos de abajo para abrir rápido categorías útiles.",
        });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("🐟 Peces").setStyle(ButtonStyle.Link).setURL(joinWikiUrl(baseUrl, "wiki/peces")),
        new ButtonBuilder().setLabel("🦋 Insectos").setStyle(ButtonStyle.Link).setURL(joinWikiUrl(baseUrl, "wiki/insectos")),
        new ButtonBuilder().setLabel("🌾 Cultivos").setStyle(ButtonStyle.Link).setURL(joinWikiUrl(baseUrl, "wiki/cultivos")),
        new ButtonBuilder().setLabel("🍳 Recetas").setStyle(ButtonStyle.Link).setURL(joinWikiUrl(baseUrl, "wiki/recetas")),
        new ButtonBuilder().setLabel("🏡 Habitantes").setStyle(ButtonStyle.Link).setURL(joinWikiUrl(baseUrl, "wiki/habitantes"))
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("✨ Logros").setStyle(ButtonStyle.Link).setURL(joinWikiUrl(baseUrl, "wiki/logros")),
        new ButtonBuilder().setLabel("🏠 Inicio Wiki").setStyle(ButtonStyle.Link).setURL(joinWikiUrl(baseUrl, ""))
    );

    agregarNarrativa(embed, "general");
    return interaction.reply({ content: bostezo, embeds: [embed], components: [row1, row2] });
}
