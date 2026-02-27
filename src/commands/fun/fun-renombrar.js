import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { crearEmbed } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

function nombreMascotaBase(mascotaId) {
  return String(mascotaId || "").replace("mascota_", "");
}

export const data = new SlashCommandBuilder()
  .setName("renombrar")
  .setDescription("Renombra una de tus mascotas.")
  .addStringOption((option) =>
    option
      .setName("mascota")
      .setDescription("Mascota que quieres renombrar")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((option) =>
    option
      .setName("nombre")
      .setDescription("Nuevo nombre para tu mascota")
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(24)
  );

export async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "mascota") { await interaction.respond([]); return; }

    const texto = String(focused.value || "").toLowerCase().trim();

    const res = await db.execute({
      sql: `SELECT ie.item_id, mn.nombre
                  FROM inventario_economia ie
                  LEFT JOIN mascota_nombres mn
                    ON mn.user_id = ie.user_id
                   AND mn.mascota_id = ie.item_id
                  WHERE ie.user_id = ?
                    AND ie.item_id LIKE 'mascota_%'
                    AND ie.cantidad > 0
                  ORDER BY ie.item_id ASC`,
      args: [interaction.user.id],
    });

    const opciones = res.rows
      .map((row) => {
        const itemId = String(row.item_id);
        const base = nombreMascotaBase(itemId);
        const nombreCustom = String(row.nombre || "").trim();
        const display = nombreCustom ? `${base} (${nombreCustom})` : base;
        return { name: display.slice(0, 100), value: itemId };
      })
      .filter((opt) => opt.name.toLowerCase().includes(texto) || opt.value.toLowerCase().includes(texto))
      .slice(0, 25);

    await interaction.respond(opciones);
  } catch (error) {
    console.error("Error autocomplete /renombrar:", error);
    await interaction.respond([]).catch(() => { });
  }
}

export async function execute(interaction, bostezo) {
  const mascotaId = interaction.options.getString("mascota", true);
  const nuevoNombre = interaction.options.getString("nombre", true).trim();
  const userId = interaction.user.id;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    if (!mascotaId.startsWith("mascota_")) {
      const embed = crearEmbed(CONFIG.COLORES.ROSA)
        .setTitle("❓ Mascota inválida")
        .setDescription(`${bostezo}La mascota seleccionada no es válida. Usa el autocompletado para elegir una de tus mascotas.`);
      return interaction.editReply({ embeds: [embed] });
    }

    const resMascota = await db.execute({
      sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
      args: [userId, mascotaId],
    });

    if (resMascota.rows.length === 0 || Number(resMascota.rows[0].cantidad || 0) <= 0) {
      const embed = crearEmbed(CONFIG.COLORES.ROSA)
        .setTitle("❓ No tienes esa mascota")
        .setDescription(`${bostezo}No tienes esa mascota en tu inventario, corazón.`);
      return interaction.editReply({ embeds: [embed] });
    }

    const resEtiquetas = await db.execute({
      sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = 'etiqueta_mascota'",
      args: [userId],
    });

    const etiquetas = Number(resEtiquetas.rows[0]?.cantidad || 0);
    if (etiquetas <= 0) {
      const embed = crearEmbed(CONFIG.COLORES.NARANJA)
        .setTitle("🏷️ ¡Necesitas una Etiqueta para Mascota!")
        .setDescription(
          `${bostezo}Para renombrar a tu amiguito necesitas una **Etiqueta para Mascota**, corazón.\n\n` +
          `La puedes comprar en \`/tienda\` con \`/comprar item:etiqueta_mascota\`.`
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // Obtener nombre anterior
    const resNombreAnterior = await db.execute({
      sql: "SELECT nombre FROM mascota_nombres WHERE user_id = ? AND mascota_id = ?",
      args: [userId, mascotaId],
    });
    const nombreAnterior = String(resNombreAnterior.rows[0]?.nombre || nombreMascotaBase(mascotaId));

    await db.execute({
      sql: `INSERT INTO mascota_nombres (user_id, mascota_id, nombre)
                  VALUES (?, ?, ?)
                  ON CONFLICT(user_id, mascota_id) DO UPDATE SET nombre = excluded.nombre`,
      args: [userId, mascotaId, nuevoNombre],
    });

    await db.execute({
      sql: `UPDATE inventario_economia
                  SET cantidad = cantidad - 1
                  WHERE user_id = ? AND item_id = 'etiqueta_mascota' AND cantidad > 0`,
      args: [userId],
    });

    await db.execute({
      sql: "DELETE FROM inventario_economia WHERE user_id = ? AND item_id = 'etiqueta_mascota' AND cantidad <= 0",
      args: [userId],
    });

    const embed = crearEmbed(CONFIG.COLORES.MENTA)
      .setTitle("🏷️ ¡Mascota Renombrada!")
      .setDescription(`${bostezo}¡Qué nombre tan bonito elegiste! Tu mascota ahora tiene un nombre oficial en el pueblito. 🌸`)
      .addFields(
        { name: "🐾 Mascota", value: `**${nombreMascotaBase(mascotaId)}**`, inline: true },
        { name: "📛 Antes", value: `*${nombreAnterior}*`, inline: true },
        { name: "✨ Ahora", value: `**${nuevoNombre}**`, inline: true },
        { name: "🏷️ Etiquetas usadas", value: "**1x Etiqueta para Mascota** consumida", inline: false }
      );

    return interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Error en comando /renombrar:", error);
    const embed = crearEmbed(CONFIG.COLORES.ROSA)
      .setTitle("❌ ¡Error al renombrar!")
      .setDescription(`${bostezo}Se me enredó la etiquetita, inténtalo de nuevo en un ratito.`);
    return interaction.editReply({ embeds: [embed] });
  }
}
