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
    // Auto-asignar rol 🌱 Visitante del Valle a nuevos miembros
    const rolVisitanteId = CONFIG.ROL_VISITANTE_ID;
    if (rolVisitanteId && !member.user.bot) {
      try {
        await member.roles.add(rolVisitanteId, "Auto-asignación a nuevo miembro");
      } catch (e) {
        console.error("[guildMemberAdd] No pude asignar rol Visitante:", e.message);
      }
    }

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
            "• Lee las normas en <#1465883350509293640>\n" +
            "• Reacciona con ✅ al final para graduarte a **🍄 Vecino del Valle** y ver toda la aldea\n" +
            "• Después, pasa por <#1465883980728504482> para suscribirte a los juegos que te gusten",
        },
      );

    await canal.send({
      content: saludoAleatorio(member),
      embeds: [embed],
    });

    // DM personal con el flow de onboarding (no bloqueante)
    try {
      const dmEmbed = crearEmbed(COLOR_LUCIERNAGA)
        .setTitle("🏮 Bienvenid@ a Aldea Luciérnaga")
        .setDescription(
          `Hola **${member.user.username}** 🪷 Soy **Annie**, la ayudantita de la aldea.\n\n` +
          "Te dejo los tres pasitos para empezar:\n\n" +
          "**1.** Pásate por <#1465883350509293640> y lee las normas — al final hay un ✅ para aceptarlas y desbloquear toda la aldea.\n\n" +
          "**2.** Una vez dentro, elige los juegos cozy que te interesan en <#1465883980728504482> — te pingueo cuando haya eventos.\n\n" +
          "**3.** Agrega tu cumple con `/cumple guardar fecha:DD-MM` y usa `/aldea` para un tour completo.\n\n" +
          "Si te pierdes, estoy por ahí con tecito calientito 🫖✨"
        );
      await member.send({ embeds: [dmEmbed] });
    } catch {
      // DMs cerrados — no pasa nada, se recibe en canal igual
    }
  } catch (e) {
    console.error("Error bienvenida:", e.message);
  }
}
