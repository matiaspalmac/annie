import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed } from "../../core/utils.js";
import { db } from "../../services/db.js";
import { sincronizarRolesProgresion } from "../../features/roles-progresion.js";

export const data = new SlashCommandBuilder()
  .setName("admin-sync-roles")
  .setDescription("Re-sincroniza los roles de progresión de todos los vecinos según su nivel máximo");

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.member.permissions.has("ManageRoles")) {
    const embed = crearEmbed(CONFIG.COLORES.ROJO)
      .setTitle("🚫 Sin permisos")
      .setDescription("Ay, tesorito... este comando es solo para quienes cuidan el pueblito. Necesitas permiso de **Gestionar Roles**.");
    return interaction.editReply({ embeds: [embed] });
  }

  const tiers = Array.isArray(CONFIG.ROLES_PROGRESION) ? CONFIG.ROLES_PROGRESION : [];
  const tiersValidos = tiers.filter((t) => t?.roleId);

  if (tiersValidos.length === 0) {
    const embed = crearEmbed(CONFIG.COLORES.NARANJA)
      .setTitle("⚠️ No hay roles configurados")
      .setDescription(
        "La configuración `ROLES_PROGRESION` está vacía o no tiene `roleId` asignados todavía.\n\n" +
        "Actualiza la fila en la tabla `configuracion` con los IDs de los roles que creaste en Discord."
      );
    return interaction.editReply({ embeds: [embed] });
  }

  let procesados = 0;
  let promovidos = 0;
  let errores = 0;
  let noEnServidor = 0;
  const promocionesMuestra = [];

  try {
    const res = await db.execute(
      "SELECT user_id, MAX(nivel) as nivelMax FROM habilidades GROUP BY user_id"
    );
    const rows = res?.rows ?? [];

    if (rows.length === 0) {
      const embed = crearEmbed(CONFIG.COLORES.AMARILLO)
        .setTitle("🌾 Nada que sincronizar todavía")
        .setDescription("Ningún vecino tiene habilidades registradas aún.");
      return interaction.editReply({ embeds: [embed] });
    }

    await interaction.editReply({
      embeds: [
        crearEmbed(CONFIG.COLORES.CIELO)
          .setTitle("🪷 Sincronizando la aldea...")
          .setDescription(`Procesando **${rows.length}** vecinos con habilidades registradas. Dame un momentito ✨`),
      ],
    });

    for (const row of rows) {
      const userId = String(row?.user_id ?? "");
      const nivelMax = Number(row?.nivelMax ?? 1);
      if (!userId) continue;

      try {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) {
          noEnServidor++;
          continue;
        }

        const tierNuevo = await sincronizarRolesProgresion(member, nivelMax);
        procesados++;
        if (tierNuevo) {
          promovidos++;
          if (promocionesMuestra.length < 10) {
            promocionesMuestra.push(`• ${member.user.username} → ${tierNuevo.nombre} (nv ${nivelMax})`);
          }
        }
      } catch (err) {
        errores++;
        console.error(`[SyncRoles] Error con ${userId}:`, err.message);
      }
    }

    const embedFinal = crearEmbed(CONFIG.COLORES.VERDE)
      .setTitle("✨ Aldea sincronizada")
      .setDescription(
        "Las luciérnagas repartieron los nuevos rangos entre los vecinos del pueblito."
      )
      .addFields(
        { name: "👥 Procesados", value: `${procesados}`, inline: true },
        { name: "🏡 Promovidos", value: `${promovidos}`, inline: true },
        { name: "🚪 No en servidor", value: `${noEnServidor}`, inline: true },
      );

    if (errores > 0) {
      embedFinal.addFields({ name: "⚠️ Errores", value: `${errores}`, inline: true });
    }

    if (promocionesMuestra.length > 0) {
      embedFinal.addFields({
        name: "🌟 Promociones",
        value: promocionesMuestra.join("\n") + (promovidos > promocionesMuestra.length ? `\n*...y ${promovidos - promocionesMuestra.length} más*` : ""),
      });
    }

    await interaction.editReply({ embeds: [embedFinal] });
  } catch (err) {
    console.error("[admin-sync-roles] Error general:", err);
    const errEmbed = crearEmbed(CONFIG.COLORES.ROJO)
      .setTitle("❌ Ay no, se me enredó el delantal")
      .setDescription(`Algo falló mientras sincronizaba: \`${err.message}\``);
    await interaction.editReply({ embeds: [errEmbed] });
  }
}
