/**
 * Evento: messageReactionAdd — Asignación de roles por reacción
 */
import { CONFIG } from "../core/config.js";

export const event = "messageReactionAdd";
export const once = false;

export async function execute(reaction, user) {
  if (user.bot) return;
  if (reaction.message.id !== CONFIG.MENSAJE_ROLES_ID) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }

  const roleId = CONFIG.REACTION_ROLES?.[reaction.emoji.name];
  if (!roleId) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId);
    if (role) {
      await member.roles.add(role);
      console.log(`Rol ${role.name} asignado a ${user.tag}`);
      try { await user.send(`Te puse el rol **${role.name}** con cariño, vecino.`); } catch { }
    }
  } catch (e) {
    console.error("Error dando rol:", e.message);
  }
}
