/**
 * Evento: messageReactionAdd — Asignación de roles por reacción
 */
import { CONFIG } from "../core/config.js";

export const event = "messageReactionAdd";
export const once = false;

function resolveRoleId(messageId, emojiName) {
  if (messageId === CONFIG.MENSAJE_ROLES_ID) return CONFIG.REACTION_ROLES?.[emojiName];
  if (messageId === CONFIG.MENSAJE_ROLES_COZY_ID) return CONFIG.REACTION_ROLES_COZY?.[emojiName];
  if (messageId === CONFIG.MENSAJE_NORMAS_ID) return CONFIG.REACTION_NORMAS?.[emojiName];
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
    if (!role) return;

    await member.roles.add(role);
    console.log(`Rol ${role.name} asignado a ${user.tag}`);

    // Si el rol asignado es Vecino (via MENSAJE_NORMAS_ID), remover Visitante para evitar ambigüedad jerárquica
    if (
      reaction.message.id === CONFIG.MENSAJE_NORMAS_ID &&
      CONFIG.ROL_VISITANTE_ID &&
      member.roles.cache.has(CONFIG.ROL_VISITANTE_ID)
    ) {
      try {
        await member.roles.remove(CONFIG.ROL_VISITANTE_ID, "Graduación Visitante → Vecino");
      } catch (e) {
        console.error("[Normas] No pude quitar rol Visitante:", e.message);
      }
    }

    try { await user.send(`Te puse el rol **${role.name}** con cariño, vecino.`); } catch { }
  } catch (e) {
    console.error("Error dando rol:", e.message);
  }
}
