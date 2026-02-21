import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../db.js";
import { CONFIG } from "../config.js";
import { crearEmbed } from "../utils.js";

const PRECIO_SOBRE = 1000;

// Posibles cromos (Residentes de Heartopia)
const CROMOS = [
    { nombre: "Gato Romano", rareza: "Común", desc: "Un gatito estándar pero mimoso." },
    { nombre: "Pato Pescador", rareza: "Común", desc: "Pato experto en sacar bocadillos del lago." },
    { nombre: "Oso Campista", rareza: "Común", desc: "Le encanta dormir bajo las estrellas." },
    { nombre: "Conejito Veloz", rareza: "Común", desc: "Nunca llega tarde a entregar recados." },
    { nombre: "Perrito Kiltro", rareza: "Raro", desc: "Un fiel amigo con collar verde chillón." },
    { nombre: "Zorro Herrero", rareza: "Raro", desc: "Tiene unas gafas soldadoras encantadoras." },
    { nombre: "Rana Mágica", rareza: "Raro", desc: "Croa melodías que atraen la lluvia." },
    { nombre: "Pudú Tímido", rareza: "Épico", desc: "Se esconde en los matorrales de berries." },
    { nombre: "Ciervo Dorado", rareza: "Épico", desc: "El guardián secreto del bosque nuboso." },
];

function tirarGacha() {
    const rnd = Math.random();
    let rarezaSeleccionada = "Común";

    // Probabilidad: Común 75% | Raro 20% | Épico 5%
    if (rnd < 0.05) rarezaSeleccionada = "Épico";
    else if (rnd < 0.25) rarezaSeleccionada = "Raro";

    const posibles = CROMOS.filter(c => c.rareza === rarezaSeleccionada);
    return posibles[Math.floor(Math.random() * posibles.length)];
}

export const data = new SlashCommandBuilder()
    .setName("abrirsobre")
    .setDescription(`Compra un sobre de cartas coleccionables por ${PRECIO_SOBRE} moneditas`);

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    try {
        // Verificar balance
        const resUser = await db.execute({
            sql: "SELECT monedas FROM usuarios WHERE id = ?",
            args: [userId]
        });

        if (resUser.rows.length === 0 || Number(resUser.rows[0].monedas) < PRECIO_SOBRE) {
            return interaction.reply({
                content: `Ay corazón... un sobre mágico cuesta **${PRECIO_SOBRE}** moneditas brillantes, y tú solo tienes ${resUser.rows.length ? resUser.rows[0].monedas : 0}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Descontar monedas
        await db.execute({
            sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
            args: [PRECIO_SOBRE, userId]
        });

        // Tirar gacha 3 veces
        const premio1 = tirarGacha();
        const premio2 = tirarGacha();
        const premio3 = tirarGacha();

        const premios = [premio1, premio2, premio3];
        let hayEpico = false;

        // Insertar en Base de Datos de Colecciones
        for (const p of premios) {
            if (p.rareza === "Épico") hayEpico = true;
            await db.execute({
                sql: "INSERT OR IGNORE INTO colecciones (user_id, categoria, item_id) VALUES (?, ?, ?)",
                args: [userId, 'cromos', p.nombre]
            });
        }

        const colorResult = hayEpico ? CONFIG.COLORES.DORADO : CONFIG.COLORES.AZUL;

        const renderCromo = (c) => {
            const estrellas = c.rareza === "Épico" ? "⭐⭐⭐" : c.rareza === "Raro" ? "⭐⭐" : "⭐";
            return `**${c.nombre}** [${estrellas} ${c.rareza}]\n*${c.desc}*`;
        };

        const embed = crearEmbed(colorResult)
            .setTitle(`💌 ${username} abrió un Sobre Engomado`)
            .setDescription(`*¡Rrrriipp! Has rasgado el sobre y sacaste estas 3 cartitas...*\n\n1. ${renderCromo(premio1)}\n\n2. ${renderCromo(premio2)}\n\n3. ${renderCromo(premio3)}`)
            .setFooter({ text: "Revisalas luego en tu vitrina web | Annie" });

        // Si hay una épica es un mensaje masivo no oculto
        if (hayEpico) {
            return interaction.reply({
                content: `¡OMG! ✨ ¡Miren pueblito! **${username}** acaba de sacar una carta ÉPICA del sobrecito. Tírenle buena onda.`,
                embeds: [embed]
            });
        }

        // Si son normales, contestar solo a él o normal (mejor normal para presumir la suerte basica igual)
        return interaction.reply({ embeds: [embed] });

    } catch (e) {
        console.error("Error comando abrirsobre:", e.message);
        return interaction.reply({ content: "Me rompí, tesoro :(", flags: MessageFlags.Ephemeral });
    }
}
