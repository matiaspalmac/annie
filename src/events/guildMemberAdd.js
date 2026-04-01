/**
 * Evento: guildMemberAdd — Bienvenida a nuevos miembros
 */
import { Events } from "discord.js";
import { CONFIG } from "../core/config.js";
import { crearEmbed } from "../core/utils.js";

export const event = Events.GuildMemberAdd;
export const once = false;

export async function execute(member) {
  try {
    const canal = await member.guild.channels.fetch(CONFIG.CANAL_GENERAL_ID);
    if (!canal) return;

    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("Un nuevo corazóncito llego al pueblito!")
      .setDescription(
        `Bienvenid@, **${member.user.username}** a Heartopia! Pasa por la oficinita cuando quieras, te espero con tecito y abrazos.`
      );

    await canal.send({
      content: `Oigan toditos! Denle un abrazote dulce a ${member}`,
      embeds: [embed],
    });
  } catch (e) {
    console.error("Error bienvenida:", e.message);
  }
}
