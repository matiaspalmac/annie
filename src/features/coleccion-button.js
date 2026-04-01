/**
 * Handler para el botón "¡Lo tengo!" del sistema de colecciones.
 */
import { MessageFlags } from "discord.js";
import { db } from "../services/db.js";
import { verificarCompletacionColeccion } from "./coleccion-rewards.js";

/**
 * Maneja el botón col_{categoria}_{itemId}
 * @param {import("discord.js").ButtonInteraction} interaction
 */
export async function handleColeccionButton(interaction) {
  const [, categoria, ...itemIdParts] = interaction.customId.split("_");
  const itemId = itemIdParts.join("_");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await db.execute({
      sql: "INSERT INTO colecciones (user_id, categoria, item_id) VALUES (?, ?, ?)",
      args: [interaction.user.id, categoria, itemId],
    });

    const verbos = {
      peces: "¡pescado",
      insectos: "¡atrapado",
      aves: "¡avistado",
      animales: "¡acariciado",
      cultivos: "¡cosechado",
      recolectables: "¡recolectado",
      recetas: "¡cocinado",
      logros: "¡desbloqueado",
    };
    const verbo = verbos[categoria] || "¡registrado";

    await interaction.followUp(`💖 **${itemId}** ${verbo}! Lo he anotado en tu libretita de colecciones.`);

    // Verificar si completó la colección y otorgar recompensa
    await verificarCompletacionColeccion(interaction.user.id, categoria, interaction);
  } catch (e) {
    if (e.message.includes("UNIQUE constraint failed")) {
      await interaction.followUp("Jeje, tranquilo corazón... ya tenías a este amiguito registrado en tu colección. ✨");
    } else {
      console.error("Error guardando colección:", e);
      await interaction.followUp("Uy... se me cayó el lápiz y no pude anotarlo. Intenta de nuevo.");
    }
  }
}
