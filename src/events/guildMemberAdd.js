/**
 * Evento: guildMemberAdd — Bienvenida a nuevos miembros de Aldea Luciérnaga
 */
import { Events } from "discord.js";
import { CONFIG } from "../core/config.js";
import { crearEmbed } from "../core/utils.js";

export const event = Events.GuildMemberAdd;
export const once = false;

const COLOR_LUCIERNAGA = "#F7D774";

const SALUDOS = [
  `Mira quién cruzó el puente del río... ¡${'{name}'} llegó a la aldea!`,
  `¡Las luciérnagas se encendieron toditas! Llegó ${'{name}'} 🪷`,
  `Psst... ¿escucharon? ${'{name}'} acaba de abrir la puerta del caserío ✨`,
  `El farolito del pueblo tintineó — es que llegó ${'{name}'} 🏮`,
];

function saludoAleatorio(member) {
  const plantilla = SALUDOS[Math.floor(Math.random() * SALUDOS.length)];
  return plantilla.replace("{name}", `${member}`);
}

export async function execute(member) {
  try {
    const canalId = CONFIG.CANAL_BIENVENIDA_ID || CONFIG.CANAL_GENERAL_ID;
    const canal = await member.guild.channels.fetch(canalId);
    if (!canal) return;

    const embed = crearEmbed(COLOR_LUCIERNAGA)
      .setTitle("🪷 Un nuevo brote llegó a la aldea")
      .setDescription(
        `Bienvenid@, **${member.user.username}**, a **Aldea Luciérnaga** 🏡✨\n\n` +
        `Aquí el tiempo va lento, las estrellas conceden deseos y las luciérnagas guían el camino. ` +
        `Pasa por la oficinita cuando quieras — te espero con tecito, abrazos y una silla calentita junto a la fogata. 🌙`
      )
      .addFields(
        {
          name: "🌱 Primeros pasitos",
          value:
            "• Lee las reglas del pueblo\n" +
            "• Pasa por los roles y elige los tuyos\n" +
            "• Usa `/diario` conmigo para reclamar tu primer regalito",
        },
      );

    await canal.send({
      content: saludoAleatorio(member),
      embeds: [embed],
    });
  } catch (e) {
    console.error("Error bienvenida:", e.message);
  }
}
