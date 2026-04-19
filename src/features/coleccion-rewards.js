/**
 * Sistema de recompensas por completar colecciones.
 * Cuando un usuario completa todos los items de una categoría,
 * recibe monedas, XP, y un título exclusivo.
 */
import { db } from "../services/db.js";
import { addBalance } from "../services/db-helpers.js";
import { crearEmbed } from "../core/utils.js";
import { CONFIG } from "../core/config.js";

// ── Recompensas por categoría ────────────────────────────────────

const RECOMPENSAS_COLECCION = {
  peces:         { titulo: "Maestro/a de los Mares",     monedas: 2000, xp: 500,  emoji: "🎣" },
  insectos:      { titulo: "Rey/Reina de los Bichos",    monedas: 2000, xp: 500,  emoji: "🦋" },
  aves:          { titulo: "Susurrador/a de Pájaros",    monedas: 2000, xp: 500,  emoji: "🐦" },
  animales:      { titulo: "Amigo/a de la Fauna",        monedas: 1500, xp: 400,  emoji: "🐾" },
  cultivos:      { titulo: "Horticultor/a Supremo/a",    monedas: 1500, xp: 400,  emoji: "🌱" },
  recolectables: { titulo: "Coleccionista Legendario/a", monedas: 2500, xp: 600,  emoji: "🍄" },
  recetas:       { titulo: "Chef Estrella del Pueblito", monedas: 2000, xp: 500,  emoji: "🍳" },
  logros:        { titulo: "Leyenda de la Aldea",        monedas: 5000, xp: 1000, emoji: "🏆" },
};

// ── Función principal ────────────────────────────────────────────

/**
 * Checks if user just completed a collection category and awards the reward.
 * Call this after adding a new item to colecciones.
 *
 * @param {string} userId
 * @param {string} categoria
 * @param {Object} [interaction] - Discord interaction for notification
 * @returns {Promise<{completed: boolean, reward?: object}>}
 */
export async function verificarCompletacionColeccion(userId, categoria, interaction) {
  const reward = RECOMPENSAS_COLECCION[categoria];
  if (!reward) return { completed: false };

  try {
    // 1. Check if already claimed
    const yaClamada = await db.execute({
      sql: "SELECT reclamada FROM coleccion_recompensas WHERE user_id = ? AND categoria = ?",
      args: [userId, categoria],
    });

    if (yaClamada.rows.length > 0 && Number(yaClamada.rows[0].reclamada) === 1) {
      return { completed: false };
    }

    // 2. Count user's items in this category
    const userItems = await db.execute({
      sql: "SELECT COUNT(*) AS total FROM colecciones WHERE user_id = ? AND categoria = ?",
      args: [userId, categoria],
    });
    const userCount = Number(userItems.rows[0].total);

    // 3. Count total items in the source table
    const totalItems = await db.execute({
      sql: `SELECT COUNT(*) AS total FROM ${categoria}`,
      args: [],
    });
    const totalCount = Number(totalItems.rows[0].total);

    // 4. If not complete, return early
    if (totalCount === 0 || userCount < totalCount) {
      return { completed: false };
    }

    // 5. Award everything!
    // -- Monedas
    await addBalance(userId, reward.monedas);

    // -- XP
    await db.execute({
      sql: "UPDATE usuarios SET xp = xp + ? WHERE id = ?",
      args: [reward.xp, userId],
    });

    // -- Título
    await db.execute({
      sql: "INSERT INTO titulos (user_id, titulo, equipado) VALUES (?, ?, 0) ON CONFLICT DO NOTHING",
      args: [userId, reward.titulo],
    });

    // -- Mark as claimed (upsert)
    await db.execute({
      sql: `INSERT INTO coleccion_recompensas (user_id, categoria, reclamada)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, categoria) DO UPDATE SET reclamada = 1`,
      args: [userId, categoria],
    });

    // 6. Send congratulatory embed if interaction is provided
    if (interaction) {
      const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle(`${reward.emoji} ¡¡COLECCIÓN COMPLETADA!! ${reward.emoji}`)
        .setDescription(
          `*Annie salta de su silla en la oficinita y empieza a aplaudir con los ojos brillando...*\n\n` +
          `¡¡WEEEENA, <@${userId}>!! ¡¡LO LOGRASTE, TESORO!!\n\n` +
          `Completaste **TODA** la colección de **${categoria}** y eso merece una celebración como corresponde, po.\n\n` +
          `${reward.emoji} **¡Te has ganado el título exclusivo:**\n` +
          `✨✨ **${reward.titulo}** ✨✨\n\n` +
          `*(Equípalo con \`/titulos\` pa' que todos lo vean en tu perfil)*`
        )
        .setColor("#FFD700")
        .addFields(
          { name: "🪙 Monedas", value: `+${reward.monedas.toLocaleString()}`, inline: true },
          { name: "⭐ XP", value: `+${reward.xp}`, inline: true },
          { name: "🏆 Título", value: reward.titulo, inline: true },
        )
        .setFooter({ text: "Annie está orgullosa de ti, corazoncito 🌟" });

      interaction.followUp({ embeds: [embed] }).catch(() => {});
    }

    return { completed: true, reward };
  } catch (err) {
    console.error(`[ColeccionRewards] Error verificando completación de ${categoria}:`, err);
    return { completed: false };
  }
}
