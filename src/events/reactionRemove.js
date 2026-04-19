/**
 * Evento: messageReactionRemove — Remoción de roles por reacción
 */
import { CONFIG } from "../core/config.js";

export const event = "messageReactionRemove";
export const once = false;

function resolveRoleId(messageId, emojiName) {
  if (messageId === CONFIG.MENSAJE_ROLES_ID) return CONFIG.REACTION_ROLES?.[emojiName];
  if (messageId === CONFIG.MENSAJE_ROLES_COZY_ID) return CONFIG.REACTION_ROLES_COZY?.[emojiName];
  return null;
}

export async function execute(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }

  const roleId = resolveRoleId(reaction.message.id, reaction.emoji.name);
  if (!roleId) return;

  try {
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleId);
    if (role) {
      await member.roles.remove(role);
      console.log(`Rol ${role.name} quitado a ${user.tag}`);
      try { await user.send(`Te quite el rol **${role.name}** con cariño, vecino... si lo quieres de vuelta, solo reacciona otra vez.`); } catch { }
    }
  } catch (e) {
    console.error("Error quitando rol:", e.message);
  }
}
