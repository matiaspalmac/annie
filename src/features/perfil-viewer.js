/**
 * Visor de perfil — handlers para los select menus del perfil.
 * Extraído del monolítico index.js original.
 */
import { MessageFlags } from "discord.js";
import { CONFIG } from "../core/config.js";
import { crearEmbed, barraProgreso } from "../core/utils.js";
import { db } from "../services/db.js";

// ── Helpers compartidos ───────────────────────────────────────

function formatCompact(n) {
  return new Intl.NumberFormat("es-CL", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));
}

async function calcularRacha(targetUserId) {
  const resDiasActivos = await db.execute({
    sql: `SELECT fecha FROM actividad_diaria
          WHERE user_id = ? AND (acciones > 0 OR xp_ganado > 0 OR monedas_ganadas > 0)
          ORDER BY fecha DESC LIMIT 180`,
    args: [targetUserId],
  });
  const resHoyChile = await db.execute({
    sql: `SELECT date('now', COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours')) as hoy`,
  });

  const diasActivos = new Set(resDiasActivos.rows.map(r => String(r.fecha || "")).filter(Boolean));

  let racha = 0;
  let cursorKey = String(resHoyChile.rows[0]?.hoy || new Date().toISOString().slice(0, 10));
  while (diasActivos.has(cursorKey)) {
    racha++;
    const d = new Date(`${cursorKey}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    cursorKey = d.toISOString().slice(0, 10);
  }
  return racha;
}

async function getMaxItemsPorCategoria() {
  const totalResult = await db.execute(
    `SELECT 'peces' as cat, COUNT(*) as c FROM peces
     UNION ALL SELECT 'insectos', COUNT(*) FROM insectos
     UNION ALL SELECT 'aves', COUNT(*) FROM aves
     UNION ALL SELECT 'animales', COUNT(*) FROM animales
     UNION ALL SELECT 'cultivos', COUNT(*) FROM cultivos
     UNION ALL SELECT 'recolectables', COUNT(*) FROM recolectables
     UNION ALL SELECT 'recetas', COUNT(*) FROM recetas
     UNION ALL SELECT 'logros', COUNT(*) FROM logros`,
  );
  const maxItems = {};
  for (const r of totalResult.rows) maxItems[r.cat] = Number(r.c);
  return maxItems;
}

async function getColeccionesUsuario(targetUserId) {
  const colResult = await db.execute({
    sql: "SELECT categoria, COUNT(*) as total FROM colecciones WHERE user_id = ? GROUP BY categoria",
    args: [targetUserId],
  });
  const colMap = {};
  for (const r of colResult.rows) colMap[String(r.categoria)] = Number(r.total);
  return colMap;
}

// ── Handler: perfil_ver_mas ───────────────────────────────────

const SECTION_HANDLERS = {
  objetivo: handleObjetivo,
  actividad: handleActividad,
  comparativa: handleComparativa,
  insignias: handleInsignias,
  progreso: handleProgreso,
  inventario: handleInventario,
};

export async function handlePerfilVerMas(interaction) {
  const value = interaction.values[0];
  if (!value.startsWith("pv_")) return;

  const parts = value.split("_");
  const tipo = parts[1];
  const targetUserId = parts.slice(2).join("_");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const resUser = await db.execute({
      sql: "SELECT monedas, xp, nivel FROM usuarios WHERE id = ?",
      args: [targetUserId],
    });

    if (resUser.rows.length === 0) {
      return interaction.followUp("No pude encontrar ese perfil en la base de datos.");
    }

    const user = resUser.rows[0];
    const handler = SECTION_HANDLERS[tipo];

    if (handler) {
      return handler(interaction, targetUserId, user);
    }

    return interaction.followUp("No entendí esa opción de perfil.");
  } catch (e) {
    console.error("Error en perfil_ver_mas:", e);
    return interaction.followUp("Hubo un error al abrir esa sección del perfil.");
  }
}

async function handleObjetivo(interaction, targetUserId, user) {
  const xp = Number(user.xp || 0);
  const nivel = Number(user.nivel || 1);
  const xpSigNivel = Math.pow(nivel * 10, 2);
  const xpRestante = Math.max(0, xpSigNivel - xp);

  const maxItems = await getMaxItemsPorCategoria();
  const colMap = await getColeccionesUsuario(targetUserId);

  const categorias = ["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "recetas", "logros"];
  let objetivoColeccion = "Completa una categoría nueva en tu libretita";
  let menorFaltante = Number.MAX_SAFE_INTEGER;

  for (const cat of categorias) {
    const owned = Number(colMap[cat] || 0);
    const total = Number(maxItems[cat] || 0);
    if (total <= 0 || owned >= total) continue;
    const faltan = total - owned;
    if (faltan < menorFaltante) {
      menorFaltante = faltan;
      objetivoColeccion = `${cat}: faltan ${faltan} (${owned}/${total})`;
    }
  }

  const embed = crearEmbed(CONFIG.COLORES.AZUL)
    .setTitle("🎯 Objetivo Siguiente")
    .setDescription(`Faltan **${formatCompact(xpRestante)} XP** para subir a nivel **${nivel + 1}**.`)
    .addFields({ name: "Colección más cercana", value: objetivoColeccion });

  return interaction.followUp({ embeds: [embed] });
}

async function handleActividad(interaction, targetUserId, user) {
  const nivel = Number(user.nivel || 1);
  const racha = await calcularRacha(targetUserId);

  const resActividadMes = await db.execute({
    sql: `SELECT
            COALESCE(SUM(xp_ganado), 0) as xp_mes,
            COALESCE(SUM(monedas_ganadas), 0) as monedas_mes,
            COUNT(*) as dias_activos_mes
          FROM actividad_diaria
          WHERE user_id = ?
            AND fecha >= date('now',
              COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours'),
              'start of month')
            AND (acciones > 0 OR xp_ganado > 0 OR monedas_ganadas > 0)`,
    args: [targetUserId],
  });

  const xpMes = Number(resActividadMes.rows[0]?.xp_mes || 0);
  const monedasMes = Number(resActividadMes.rows[0]?.monedas_mes || 0);
  const diasActivosMes = Number(resActividadMes.rows[0]?.dias_activos_mes || 0);

  const objetivoXpMensual = Math.max(1000, nivel * 300);
  const progresoXpMensual = Math.min(100, Math.round((xpMes / objetivoXpMensual) * 100));

  const embed = crearEmbed(CONFIG.COLORES.VERDE)
    .setTitle("🔥 Racha y Actividad")
    .setDescription(`Racha activa: **${racha}** días`)
    .addFields({
      name: "Resumen mensual",
      value:
        `Días activos este mes: **${diasActivosMes}**\n` +
        `XP mensual: **${formatCompact(xpMes)}** / ${formatCompact(objetivoXpMensual)} (${progresoXpMensual}%)\n` +
        `Monedas obtenidas este mes: **${formatCompact(monedasMes)}**`,
    });

  return interaction.followUp({ embeds: [embed] });
}

async function handleComparativa(interaction, targetUserId, user) {
  const monedas = Number(user.monedas || 0);

  const resRanking = await db.execute({
    sql: "SELECT COUNT(*) as rank FROM usuarios WHERE monedas > ?",
    args: [monedas],
  });
  const puestoEconomico = Number(resRanking.rows[0]?.rank || 0) + 1;
  const totalUsersRes = await db.execute("SELECT COUNT(*) as total FROM usuarios");
  const totalUsers = Math.max(1, Number(totalUsersRes.rows[0]?.total || 1));

  const resColecciones = await db.execute({
    sql: "SELECT COUNT(*) as total FROM colecciones WHERE user_id = ?",
    args: [targetUserId],
  });
  const totalColeccionUsuario = Number(resColecciones.rows[0]?.total || 0);

  const resRankingColeccion = await db.execute({
    sql: "SELECT COUNT(*) as rank FROM (SELECT user_id, COUNT(*) as total_items FROM colecciones GROUP BY user_id) t WHERE t.total_items > ?",
    args: [totalColeccionUsuario],
  });
  const puestoColeccion = Number(resRankingColeccion.rows[0]?.rank || 0) + 1;
  const totalColeccionistasRes = await db.execute("SELECT COUNT(DISTINCT user_id) as total FROM colecciones");
  const totalColeccionistas = Math.max(1, Number(totalColeccionistasRes.rows[0]?.total || 1));

  const topEconomicoPercent = Math.min(100, Math.max(1, Math.ceil((puestoEconomico / totalUsers) * 100)));
  const topColeccionPercent = Math.min(100, Math.max(1, Math.ceil((puestoColeccion / totalColeccionistas) * 100)));

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("🧭 Comparativa Vecinal")
    .setDescription(
      `💸 Económico: **Top ${topEconomicoPercent}%** (puesto #${puestoEconomico}/${totalUsers})\n` +
      `📚 Coleccionista: **Top ${topColeccionPercent}%** (puesto #${puestoColeccion}/${totalColeccionistas})`,
    );

  return interaction.followUp({ embeds: [embed] });
}

async function handleInsignias(interaction, targetUserId, user) {
  const monedas = Number(user.monedas || 0);

  const resHabilidades = await db.execute({
    sql: "SELECT habilidad, nivel FROM habilidades WHERE user_id = ?",
    args: [targetUserId],
  });
  const pescaNivel = Number((resHabilidades.rows.find(r => String(r.habilidad) === "pesca") || {}).nivel || 0);

  const resRanking = await db.execute({ sql: "SELECT COUNT(*) as rank FROM usuarios WHERE monedas > ?", args: [monedas] });
  const totalUsersRes = await db.execute("SELECT COUNT(*) as total FROM usuarios");
  const puestoEconomico = Number(resRanking.rows[0]?.rank || 0) + 1;
  const totalUsers = Math.max(1, Number(totalUsersRes.rows[0]?.total || 1));
  const topEconomicoPercent = Math.max(1, Math.round((puestoEconomico / totalUsers) * 100));

  const resColecciones = await db.execute({
    sql: "SELECT COUNT(*) as total FROM colecciones WHERE user_id = ?",
    args: [targetUserId],
  });
  const totalColeccionUsuario = Number(resColecciones.rows[0]?.total || 0);

  const racha = await calcularRacha(targetUserId);

  const insignias = [];
  if (topEconomicoPercent <= 10) insignias.push("💸 Top 10% económico");
  if (monedas >= 10000) insignias.push("💰 Millonario");
  if (pescaNivel >= 10) insignias.push("🎣 Maestro de pesca");
  if (totalColeccionUsuario >= 100) insignias.push("📚 Coleccionista experto");
  if (racha >= 7) insignias.push("🔥 Constancia 7d");

  const embed = crearEmbed(CONFIG.COLORES.OLIVA)
    .setTitle("🏅 Insignias Dinámicas")
    .setDescription(insignias.length ? insignias.join("\n") : "Aún no hay insignias desbloqueadas.");

  return interaction.followUp({ embeds: [embed] });
}

async function handleProgreso(interaction, targetUserId) {
  const resHabilidades = await db.execute({
    sql: "SELECT habilidad, nivel FROM habilidades WHERE user_id = ?",
    args: [targetUserId],
  });

  const textoHabilidades = resHabilidades.rows.length
    ? resHabilidades.rows.map(r => `• ${String(r.habilidad)}: Nv.${Number(r.nivel)}`).join("\n")
    : "Sin habilidades registradas aún.";

  const maxItems = await getMaxItemsPorCategoria();
  const colResult = await db.execute({
    sql: "SELECT categoria, COUNT(*) as total FROM colecciones WHERE user_id = ? GROUP BY categoria",
    args: [targetUserId],
  });
  const textoColecciones = colResult.rows.length
    ? colResult.rows.map(r => {
        const cat = String(r.categoria);
        return `• ${cat}: ${Number(r.total)}/${Number(maxItems[cat] || 0)}`;
      }).join("\n")
    : "Sin colecciones registradas.";

  const resBitacora = await db.execute({
    sql: "SELECT accion FROM bitacora WHERE user_id = ? ORDER BY id DESC LIMIT 5",
    args: [targetUserId],
  });
  const textoBitacora = resBitacora.rows.length
    ? resBitacora.rows.map(r => `• ${String(r.accion)}`).join("\n")
    : "Sin aventuras recientes.";

  const embed = crearEmbed(CONFIG.COLORES.CIELO)
    .setTitle("📊 Progreso Detallado")
    .addFields(
      { name: "🌟 Habilidades", value: textoHabilidades, inline: false },
      { name: "📔 Colecciones", value: textoColecciones, inline: false },
      { name: "📖 Bitácora", value: textoBitacora, inline: false },
    );

  return interaction.followUp({ embeds: [embed] });
}

async function handleInventario(interaction, targetUserId) {
  const resMascotas = await db.execute({
    sql: "SELECT item_id FROM inventario_economia WHERE user_id = ? AND item_id LIKE 'mascota_%' AND cantidad > 0",
    args: [targetUserId],
  });
  const resTemas = await db.execute({
    sql: "SELECT item_id FROM inventario_economia WHERE user_id = ? AND item_id LIKE 'tema_%' AND cantidad > 0",
    args: [targetUserId],
  });
  const resMarcos = await db.execute({
    sql: "SELECT item_id FROM inventario_economia WHERE user_id = ? AND item_id LIKE 'marco_perfil_%' AND cantidad > 0",
    args: [targetUserId],
  });
  const resConsumibles = await db.execute({
    sql: "SELECT item_id, cantidad FROM inventario_economia WHERE user_id = ? AND item_id IN ('booster_xp_30m','amuleto_suerte_15m','reset_racha_perdon','etiqueta_mascota') AND cantidad > 0",
    args: [targetUserId],
  });
  const resTitulos = await db.execute({
    sql: "SELECT titulo, equipado FROM titulos WHERE user_id = ? ORDER BY equipado DESC, titulo ASC",
    args: [targetUserId],
  });

  const mascotas = resMascotas.rows.map(r => String(r.item_id).replace("mascota_", ""));
  const temas = resTemas.rows.map(r => String(r.item_id).replace("tema_", ""));
  const marcos = resMarcos.rows.map(r => String(r.item_id).replace("marco_perfil_", ""));
  const consumibles = resConsumibles.rows.map(r => `${String(r.item_id)} x${Number(r.cantidad || 0)}`);
  const titulos = resTitulos.rows.map(r => `${Number(r.equipado) === 1 ? "✨ " : ""}${String(r.titulo)}`);

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("🎒 Inventario y Logros")
    .addFields(
      { name: "🐾 Mascotas", value: mascotas.length ? mascotas.join(", ") : "Ninguna", inline: false },
      { name: "🖼️ Temas", value: temas.length ? temas.join(", ") : "Ninguno", inline: false },
      { name: "🪞 Marcos de Perfil", value: marcos.length ? marcos.join(", ") : "Ninguno", inline: false },
      { name: "⚗️ Consumibles / Servicios", value: consumibles.length ? consumibles.join("\n") : "Ninguno", inline: false },
      { name: "🏆 Títulos", value: titulos.length ? titulos.join("\n") : "Ninguno", inline: false },
    );

  return interaction.followUp({ embeds: [embed] });
}

// ── Handler: perfil_ver_coleccion ─────────────────────────────

export async function handlePerfilVerColeccion(interaction) {
  const value = interaction.values[0];
  if (!value.startsWith("vt_")) return;

  const [, categoria, targetUserId] = value.split("_");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await db.execute({
      sql: "SELECT item_id FROM colecciones WHERE user_id = ? AND categoria = ? ORDER BY item_id ASC",
      args: [targetUserId, categoria],
    });

    if (result.rows.length === 0) {
      return interaction.followUp(`No hay ningún registro de **${categoria}** en esa libretita.`);
    }

    const items = result.rows.map(r => r.item_id).join(", ");
    const catLabel = categoria.charAt(0).toUpperCase() + categoria.slice(1);
    const content = `**Libretita de ${catLabel} de <@${targetUserId}>**\n\n\`\`\`\n${items}\n\`\`\``;

    if (content.length > 2000) {
      await interaction.followUp(`**Libretita de ${catLabel} de <@${targetUserId}>**\n(¡Tiene muchísimos! Te muestro los primeros)\n\n\`\`\`\n${items.substring(0, 1850)}...\n\`\`\``);
    } else {
      await interaction.followUp(content);
    }
  } catch (e) {
    console.error("Error cargando colección:", e);
    await interaction.followUp("Hubo un error al hojear la libretita.");
  }
}
