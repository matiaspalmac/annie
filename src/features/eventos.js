/**
 * Sistema de Eventos Comunitarios del Pueblito
 * - Soporte para eventos de monedas, items y mixtos
 * - Sistema de fases (hasta 3 fases por evento)
 * - Deadlines con auto-fallo
 * - Distribución de recompensas proporcionales
 * - Top contribuidores con bonificaciones
 */
import { db } from "../services/db.js";
import { CONFIG } from "../core/config.js";
import { crearEmbed, getCanalGeneral, barraProgreso } from "../core/utils.js";
import { addBalance, addToInventory } from "../services/db-helpers.js";

// ── Tipos de evento ──────────────────────────────────────────────
export const TIPOS_EVENTO = {
  monedas: { emoji: "\u{1F4B0}", unidad: "moneditas" },
  items:   { emoji: "\u{1F4E6}", unidad: "items" },
  mixto:   { emoji: "\u{1F3AF}", unidad: "contribuciones" },
};

// ── Obtener evento activo ────────────────────────────────────────
/**
 * Devuelve el evento comunitario activo con todos sus detalles, o null.
 */
export async function getEventoActivo() {
  const res = await db.execute("SELECT * FROM eventos_globales WHERE activo = 1 LIMIT 1");
  if (res.rows.length === 0) return null;

  const evento = res.rows[0];
  return {
    ...evento,
    id: Number(evento.id),
    meta_monedas: Number(evento.meta_monedas || 0),
    progreso_monedas: Number(evento.progreso_monedas || 0),
    meta_items: Number(evento.meta_items || 0),
    progreso_items: Number(evento.progreso_items || 0),
    fase: Number(evento.fase || 1),
    total_fases: Number(evento.total_fases || 1),
    recompensa_monedas: Number(evento.recompensa_monedas || 0),
    recompensa_xp: Number(evento.recompensa_xp || 0),
    tipo: evento.tipo || "monedas",
  };
}

// ── Aportar items a un evento ────────────────────────────────────
/**
 * Procesa la donacion de items de un usuario a un evento.
 * @param {string} userId
 * @param {number} eventoId
 * @param {string} itemId - ID del item donado
 * @param {number} cantidad
 * @returns {{ ok: boolean, error?: string, donacionReal?: number }}
 */
export async function aportarItems(userId, eventoId, itemId, cantidad) {
  // Verificar que el usuario tiene el item
  const resInv = await db.execute({
    sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
    args: [userId, itemId],
  });

  if (resInv.rows.length === 0 || Number(resInv.rows[0].cantidad) < cantidad) {
    const tiene = resInv.rows.length > 0 ? Number(resInv.rows[0].cantidad) : 0;
    return { ok: false, error: `No tienes suficientes items. Tienes **${tiene}** de ese item.` };
  }

  // Obtener evento actualizado
  const resEvento = await db.execute({
    sql: "SELECT * FROM eventos_globales WHERE id = ? AND activo = 1",
    args: [eventoId],
  });
  if (resEvento.rows.length === 0) return { ok: false, error: "El evento ya no esta activo." };

  const evento = resEvento.rows[0];
  const metaItems = Number(evento.meta_items || 0);
  const progresoItems = Number(evento.progreso_items || 0);
  const restante = metaItems - progresoItems;

  if (restante <= 0) return { ok: false, error: "La meta de items ya fue alcanzada." };

  const donacionReal = Math.min(cantidad, restante);

  // Descontar del inventario
  await db.execute({
    sql: "UPDATE inventario_economia SET cantidad = cantidad - ? WHERE user_id = ? AND item_id = ?",
    args: [donacionReal, userId, itemId],
  });

  // Limpiar items con cantidad 0
  await db.execute({
    sql: "DELETE FROM inventario_economia WHERE user_id = ? AND item_id = ? AND cantidad <= 0",
    args: [userId, itemId],
  });

  // Sumar al progreso del evento
  await db.execute({
    sql: "UPDATE eventos_globales SET progreso_items = progreso_items + ? WHERE id = ?",
    args: [donacionReal, eventoId],
  });

  // Registrar donacion
  await db.execute({
    sql: `INSERT INTO evento_donaciones (evento_id, user_id, cantidad, cantidad_items)
          VALUES (?, ?, 0, ?)
          ON CONFLICT(evento_id, user_id) DO UPDATE SET cantidad_items = cantidad_items + excluded.cantidad_items`,
    args: [eventoId, userId, donacionReal],
  });

  return { ok: true, donacionReal };
}

// ── Verificar si una fase esta completa ──────────────────────────
/**
 * Revisa si la fase actual del evento se completo y avanza a la siguiente.
 * @param {number} eventoId
 * @returns {{ faseCompletada: boolean, eventoCompletado: boolean, nuevaFase?: number }}
 */
export async function verificarFaseEvento(eventoId) {
  const res = await db.execute({
    sql: "SELECT * FROM eventos_globales WHERE id = ? AND activo = 1",
    args: [eventoId],
  });
  if (res.rows.length === 0) return { faseCompletada: false, eventoCompletado: false };

  const e = res.rows[0];
  const fase = Number(e.fase || 1);
  const totalFases = Number(e.total_fases || 1);
  const tipo = e.tipo || "monedas";

  // Determinar si la fase actual esta completa
  let faseCompleta = false;

  if (tipo === "monedas") {
    faseCompleta = Number(e.progreso_monedas) >= Number(e.meta_monedas);
  } else if (tipo === "items") {
    faseCompleta = Number(e.progreso_items) >= Number(e.meta_items);
  } else if (tipo === "mixto") {
    // En mixto, fases impares = monedas, fases pares = items
    if (fase % 2 === 1) {
      faseCompleta = Number(e.progreso_monedas) >= Number(e.meta_monedas);
    } else {
      faseCompleta = Number(e.progreso_items) >= Number(e.meta_items);
    }
  }

  if (!faseCompleta) return { faseCompletada: false, eventoCompletado: false };

  // Fase completa!
  if (fase >= totalFases) {
    // Evento completo!
    return { faseCompletada: true, eventoCompletado: true };
  }

  // Avanzar a la siguiente fase
  const nuevaFase = fase + 1;
  await db.execute({
    sql: "UPDATE eventos_globales SET fase = ? WHERE id = ?",
    args: [nuevaFase, eventoId],
  });

  // Resetear progreso para la nueva fase (monedas o items segun corresponda)
  if (tipo === "mixto") {
    if (nuevaFase % 2 === 1) {
      await db.execute({ sql: "UPDATE eventos_globales SET progreso_monedas = 0 WHERE id = ?", args: [eventoId] });
    } else {
      await db.execute({ sql: "UPDATE eventos_globales SET progreso_items = 0 WHERE id = ?", args: [eventoId] });
    }
  }

  return { faseCompletada: true, eventoCompletado: false, nuevaFase };
}

// ── Progreso formateado ──────────────────────────────────────────
/**
 * Genera texto con barra de progreso y detalles del evento.
 * @param {object} evento - Evento con todos los campos
 * @returns {string}
 */
export function getProgresoEvento(evento) {
  const tipo = evento.tipo || "monedas";
  const fase = Number(evento.fase || 1);
  const totalFases = Number(evento.total_fases || 1);
  const tipoInfo = TIPOS_EVENTO[tipo] || TIPOS_EVENTO.monedas;

  let lines = [];

  if (totalFases > 1) {
    lines.push(`**Fase ${fase}/${totalFases}** ${tipoInfo.emoji}`);
  }

  // Progreso de monedas
  if (tipo === "monedas" || (tipo === "mixto" && fase % 2 === 1)) {
    const prog = Number(evento.progreso_monedas);
    const meta = Number(evento.meta_monedas);
    const pct = meta > 0 ? Math.min(100, Math.floor((prog / meta) * 100)) : 0;
    lines.push(`\u{1F4B0} **Moneditas:** ${prog.toLocaleString()} / ${meta.toLocaleString()}`);
    lines.push(barraProgreso(pct, "\u{1F7E9}", "\u2B1C", 10));
  }

  // Progreso de items
  if (tipo === "items" || (tipo === "mixto" && fase % 2 === 0)) {
    const prog = Number(evento.progreso_items);
    const meta = Number(evento.meta_items);
    const pct = meta > 0 ? Math.min(100, Math.floor((prog / meta) * 100)) : 0;
    const itemNombre = evento.item_requerido || "items";
    lines.push(`\u{1F4E6} **${itemNombre}:** ${prog.toLocaleString()} / ${meta.toLocaleString()}`);
    lines.push(barraProgreso(pct, "\u{1F7E6}", "\u2B1C", 10));
  }

  // Deadline
  if (evento.fecha_limite) {
    lines.push(`\u23F0 **Fecha limite:** ${evento.fecha_limite}`);
  }

  return lines.join("\n");
}

// ── Top contribuidores ───────────────────────────────────────────
/**
 * Obtiene los top donadores de un evento.
 * @param {number} eventoId
 * @param {number} limit
 * @returns {Promise<Array<{user_id: string, username: string, total: number}>>}
 */
export async function getTopContribuidores(eventoId, limit = 5) {
  const res = await db.execute({
    sql: `SELECT d.user_id,
                 COALESCE(u.username, d.user_id) as username,
                 (d.cantidad + d.cantidad_items) as total
          FROM evento_donaciones d
          LEFT JOIN usuarios u ON u.id = d.user_id
          WHERE d.evento_id = ?
          ORDER BY total DESC
          LIMIT ?`,
    args: [eventoId, limit],
  });
  return res.rows.map(r => ({
    user_id: r.user_id,
    username: r.username,
    total: Number(r.total),
  }));
}

// ── Completar evento (distribuir recompensas) ────────────────────
/**
 * Otorga recompensas a todos los participantes cuando el evento se completa.
 * Top 3 reciben bonus (50%, 30%, 15% extra).
 * @param {import("discord.js").Client} client
 * @param {object} evento
 */
export async function completarEvento(client, evento) {
  const eventoId = Number(evento.id);

  // Marcar como inactivo
  await db.execute({
    sql: "UPDATE eventos_globales SET activo = 0 WHERE id = ?",
    args: [eventoId],
  });

  // Obtener todos los participantes ordenados por contribucion
  const resPart = await db.execute({
    sql: `SELECT d.user_id,
                 COALESCE(u.username, d.user_id) as username,
                 (d.cantidad + d.cantidad_items) as total
          FROM evento_donaciones d
          LEFT JOIN usuarios u ON u.id = d.user_id
          WHERE d.evento_id = ?
          ORDER BY total DESC`,
    args: [eventoId],
  });

  const participantes = resPart.rows;
  if (participantes.length === 0) return;

  const baseMonedas = Number(evento.recompensa_monedas || 0);
  const baseXP = Number(evento.recompensa_xp || 0);
  const bonusMultipliers = [1.5, 1.3, 1.15]; // Top 1, 2, 3

  for (let i = 0; i < participantes.length; i++) {
    const p = participantes[i];
    const multiplier = i < 3 ? bonusMultipliers[i] : 1;
    const monedas = Math.floor(baseMonedas * multiplier);
    const xp = Math.floor(baseXP * multiplier);

    // Dar monedas
    if (monedas > 0) {
      await addBalance(p.user_id, monedas);
    }

    // Dar XP
    if (xp > 0) {
      await db.execute({
        sql: "UPDATE usuarios SET xp = xp + ? WHERE id = ?",
        args: [xp, p.user_id],
      });
    }

    // Dar rol si corresponde
    if (evento.recompensa_rol_id) {
      try {
        const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
        if (guild) {
          const member = await guild.members.fetch(p.user_id).catch(() => null);
          if (member) {
            await member.roles.add(evento.recompensa_rol_id).catch(() => {});
          }
        }
      } catch { /* ignore */ }
    }

    // Dar item si corresponde
    if (evento.recompensa_item_id) {
      await addToInventory(p.user_id, evento.recompensa_item_id, 1);
    }
  }

  // Anunciar en canal general
  const canal = getCanalGeneral(client);
  if (!canal) return;

  const top3 = participantes.slice(0, 3);
  const medallas = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  const topTexto = top3.map((p, i) =>
    `${medallas[i]} **${p.username}** \u2014 ${Number(p.total).toLocaleString()} aportes`
  ).join("\n");

  const recompensaTexto = [];
  if (baseMonedas > 0) recompensaTexto.push(`\u{1F4B0} ${baseMonedas} moneditas`);
  if (baseXP > 0) recompensaTexto.push(`\u2728 ${baseXP} XP`);
  if (evento.recompensa_item_id) recompensaTexto.push(`\u{1F381} Item: ${evento.recompensa_item_id}`);
  if (evento.recompensa_rol_id) recompensaTexto.push(`\u{1F3F7}\uFE0F Rol especial`);

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("\u{1F389}\u{1F38A} EVENTO COMUNITARIO COMPLETADO \u{1F38A}\u{1F389}")
    .setDescription(
      `*Annie sale corriendo de la oficinita tirando confetti por todas partes*\n\n` +
      `**${evento.titulo}** se completo gracias al esfuerzo de todito el pueblito!\n` +
      `Participaron **${participantes.length}** vecin${participantes.length === 1 ? "o" : "os"}. Que lindo es ver al pueblito unido!`
    )
    .addFields(
      { name: "\u{1F3C6} Top Contribuidores", value: topTexto || "Sin datos" },
      { name: "\u{1F381} Recompensas Base", value: recompensaTexto.join("\n") || "Amor y cariño del pueblito" },
      { name: "\u{1F31F} Bonus Top 3", value: "1ro: +50% | 2do: +30% | 3ro: +15%" }
    )
    .setFooter({ text: "El pueblito celebra unido! | Annie" });

  await canal.send({ content: "@everyone", embeds: [embed] }).catch(() => {});
}

// ── Verificar deadline ───────────────────────────────────────────
/**
 * Revisa si hay un evento con deadline vencido y lo falla parcialmente.
 * Debe ser llamado periodicamente desde el scheduler.
 * @param {import("discord.js").Client} client
 */
export async function verificarDeadline(client) {
  const evento = await getEventoActivo();
  if (!evento || !evento.fecha_limite) return;

  const ahora = new Date();
  const limite = new Date(evento.fecha_limite);

  if (ahora < limite) return; // Aun hay tiempo

  // Deadline vencido!
  console.log(`[Eventos] Deadline vencido para evento #${evento.id}: ${evento.titulo}`);

  // Marcar como inactivo
  await db.execute({
    sql: "UPDATE eventos_globales SET activo = 0 WHERE id = ?",
    args: [evento.id],
  });

  // Dar recompensas parciales (50%) a los que participaron
  const resPart = await db.execute({
    sql: `SELECT d.user_id,
                 COALESCE(u.username, d.user_id) as username,
                 (d.cantidad + d.cantidad_items) as total
          FROM evento_donaciones d
          LEFT JOIN usuarios u ON u.id = d.user_id
          WHERE d.evento_id = ?
          ORDER BY total DESC`,
    args: [evento.id],
  });

  const participantes = resPart.rows;
  const baseMonedas = Math.floor(Number(evento.recompensa_monedas || 0) * 0.5);
  const baseXP = Math.floor(Number(evento.recompensa_xp || 0) * 0.5);

  for (const p of participantes) {
    if (baseMonedas > 0) await addBalance(p.user_id, baseMonedas);
    if (baseXP > 0) {
      await db.execute({
        sql: "UPDATE usuarios SET xp = xp + ? WHERE id = ?",
        args: [baseXP, p.user_id],
      });
    }
  }

  // Anunciar fracaso en canal general
  const canal = getCanalGeneral(client);
  if (!canal) return;

  const progTexto = getProgresoEvento(evento);

  const embed = crearEmbed(CONFIG.COLORES.ROJO)
    .setTitle("\u23F0 Evento Comunitario Expirado...")
    .setDescription(
      `*Annie suspira mirando el reloj de la oficinita...*\n\n` +
      `Ay, corazoncitos... el tiempo para **${evento.titulo}** se acabo y no alcanzamos la meta.\n` +
      `Pero no se pongan tristes! Lo intentamos con harto corazon y eso vale mucho.`
    )
    .addFields(
      { name: "\u{1F4CA} Progreso Final", value: progTexto },
      { name: "\u{1F49B} Recompensa Parcial", value: participantes.length > 0
        ? `${participantes.length} participante${participantes.length === 1 ? "" : "s"} recibieron el 50% de la recompensa como agradecimiento.`
        : "No hubo participantes." }
    )
    .setFooter({ text: "El pueblito siempre se levanta! | Annie" });

  await canal.send({ content: "@everyone", embeds: [embed] }).catch(() => {});
}

// ── Helper: anunciar avance de fase ──────────────────────────────
/**
 * Envia un mensaje al canal general celebrando el avance de fase.
 * @param {import("discord.js").Client} client
 * @param {object} evento
 * @param {number} nuevaFase
 */
export async function anunciarFase(client, evento, nuevaFase) {
  const canal = getCanalGeneral(client);
  if (!canal) return;

  const totalFases = Number(evento.total_fases || 1);
  const tipo = evento.tipo || "monedas";

  // Determinar que pide la nueva fase
  let siguientePide;
  if (tipo === "mixto") {
    siguientePide = nuevaFase % 2 === 1 ? "moneditas \u{1F4B0}" : `items de **${evento.item_requerido || "recurso"}** \u{1F4E6}`;
  } else {
    siguientePide = tipo === "items" ? `items de **${evento.item_requerido || "recurso"}** \u{1F4E6}` : "moneditas \u{1F4B0}";
  }

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle(`\u{1F680} FASE ${nuevaFase - 1} COMPLETADA!`)
    .setDescription(
      `*Annie toca la campanita de la oficinita emocionada*\n\n` +
      `VECINOS! La **Fase ${nuevaFase - 1}** de **${evento.titulo}** esta LISTA!\n\n` +
      `Ahora entramos a la **Fase ${nuevaFase}/${totalFases}** y necesitamos ${siguientePide}.\n` +
      `Vamos con todo, que el pueblito puede!`
    )
    .setFooter({ text: `Fase ${nuevaFase} de ${totalFases} | Annie cree en ustedes!` });

  await canal.send({ content: "@everyone", embeds: [embed] }).catch(() => {});
}
