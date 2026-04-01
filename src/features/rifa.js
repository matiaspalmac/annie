/**
 * Sistema de Rifa Diaria de Annie
 *
 * Mecánica de pozo:
 * - POZO MÍNIMO GARANTIZADO: Si hay participantes pero el pozo de boletos
 *   es menor al mínimo, Annie completa la diferencia.
 * - ROLLOVER: Si nadie compra boletos, el pozo no se sortea y se acumula
 *   para el día siguiente (+ una contribución diaria de Annie).
 *   Esto genera expectativa: "el pozo lleva 3 días acumulando..."
 *
 * El pozo acumulado se guarda en la tabla `configuracion` con la clave
 * `RIFA_POZO_ACUMULADO` para persistir entre reinicios del bot.
 */
import { CONFIG } from "../core/config.js";
import { crearEmbed, getCanalGeneral, getFechaChile } from "../core/utils.js";
import { isRifaSorteadaHoy, setRifaSorteadaHoy } from "../core/state.js";
import { db } from "../services/db.js";
import { addBalance } from "../services/db-helpers.js";

// ── Constantes compartidas ────────────────────────────────────

/** Costo por boleto */
export const COSTO_BOLETO = 10;

/** Máximo de boletos que un usuario puede comprar por día */
export const MAX_BOLETOS_DIA = 10;

/** Pozo mínimo garantizado cuando hay participantes */
const POZO_MINIMO = 200;

/** Monedas que Annie aporta al rollover cada día sin participantes */
const APORTE_DIARIO_ROLLOVER = 100;

// ── Estado interno ────────────────────────────────────────────
let _recordatorioEnviado = false;

// ── Pozo acumulado (persistido en DB) ─────────────────────────

async function getPozoAcumulado() {
  try {
    const res = await db.execute({
      sql: "SELECT valor FROM configuracion WHERE clave = 'RIFA_POZO_ACUMULADO'",
    });
    return Number(res.rows[0]?.valor || 0);
  } catch {
    return 0;
  }
}

async function setPozoAcumulado(cantidad) {
  await db.execute({
    sql: `INSERT INTO configuracion (clave, valor) VALUES ('RIFA_POZO_ACUMULADO', ?)
          ON CONFLICT(clave) DO UPDATE SET valor = ?`,
    args: [String(Math.max(0, cantidad)), String(Math.max(0, cantidad))],
  });
}

// ── Procesamiento del sorteo (se llama cada minuto) ───────────

export async function procesarSorteoRifa(client) {
  try {
    const ahora = new Date();
    const horaEnChile = parseInt(
      ahora.toLocaleString("en-US", { timeZone: CONFIG.TIMEZONE, hour: "numeric", hour12: false }),
      10,
    );
    const minutoEnChile = parseInt(
      ahora.toLocaleString("en-US", { timeZone: CONFIG.TIMEZONE, minute: "numeric" }),
      10,
    );

    // Reset flags fuera de las 23:xx
    if (horaEnChile !== 23) {
      setRifaSorteadaHoy(false);
      _recordatorioEnviado = false;
      return;
    }

    // Recordatorio a las 23:30
    if (minutoEnChile >= 30 && minutoEnChile <= 32 && !_recordatorioEnviado) {
      _recordatorioEnviado = true;
      await enviarRecordatorio(client);
    }

    // Sorteo a las 23:59
    if (minutoEnChile === 59 && !isRifaSorteadaHoy()) {
      setRifaSorteadaHoy(true);
      await ejecutarSorteo(client, ahora);
      await limpiarBoletosViejos();
    }
  } catch (error) {
    console.error("[Rifa] Error en procesarSorteoRifa:", error);
  }
}

// ── Recordatorio ──────────────────────────────────────────────

async function enviarRecordatorio(client) {
  const canal = getCanalGeneral(client);
  if (!canal) return;

  const hoyStr = getFechaChile();
  const { totalBoletos } = await getEstadisticasRifa(hoyStr);
  const acumulado = await getPozoAcumulado();

  // Calcular pozo que se mostraría
  const pozoVentas = totalBoletos * COSTO_BOLETO;
  const pozoTotal = Math.max(POZO_MINIMO, pozoVentas + acumulado);

  const tieneRollover = acumulado > 0;

  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("⏰ ¡La rifa cierra en 30 minutos!")
    .setDescription(
      `*Annie agita una campanita desde la oficinita...*\n\n` +
      `El pozo va en **${pozoTotal.toLocaleString()} 🪙**` +
      `${tieneRollover ? ` *(incluye ${acumulado.toLocaleString()} 🪙 acumuladas de días anteriores)*` : ""}` +
      ` con **${totalBoletos} boletos** vendidos.\n\n` +
      (totalBoletos === 0
        ? `¡Aún nadie ha comprado boleto! Si no hay participantes, el pozo seguirá creciendo para mañana... 👀\n\n`
        : "") +
      `¡Última oportunidad para comprar tu boleto con \`/rifa comprar\`! El sorteo es a las **23:59**. 🎰`,
    );

  canal.send({ embeds: [embed] }).catch(() => {});
}

// ── Sorteo principal ──────────────────────────────────────────

async function ejecutarSorteo(client, ahora) {
  const canal = getCanalGeneral(client);
  if (!canal) return;

  const hoyStr = getFechaChile();

  let resBoletos = await db.execute({
    sql: "SELECT id, user_id FROM rifa_boletos WHERE fecha = ?",
    args: [hoyStr],
  });

  // Compatibilidad con fechas UTC legacy
  if (resBoletos.rows.length === 0) {
    const hoyUtc = ahora.toISOString().split("T")[0];
    if (hoyUtc !== hoyStr) {
      resBoletos = await db.execute({
        sql: "SELECT id, user_id FROM rifa_boletos WHERE fecha = ?",
        args: [hoyUtc],
      });
    }
  }

  const acumuladoAnterior = await getPozoAcumulado();

  // ── Sin participantes → rollover ──────────────────────────
  if (resBoletos.rows.length === 0) {
    const nuevoAcumulado = acumuladoAnterior + APORTE_DIARIO_ROLLOVER;
    await setPozoAcumulado(nuevoAcumulado);

    const embed = crearEmbed(CONFIG.COLORES.NARANJA)
      .setTitle("🎫 La rifa quedó desierta...")
      .setDescription(
        `*Annie abre la libretita y ve que está vacía...*\n\n` +
        `Pucha, nadie compró un boleto hoy. Pero no se pierde nada, corazón...\n\n` +
        `Annie puso **${APORTE_DIARIO_ROLLOVER} 🪙** de su bolsillo y el pozo se acumula para mañana.\n\n` +
        `💰 **Pozo acumulado para mañana: ${nuevoAcumulado.toLocaleString()} 🪙**\n\n` +
        `*¡Mientras más días pasan sin ganador, más grande se pone el pozo!* 👀`,
      )
      .setFooter({ text: "El pozo crece cada día sin ganador | ¡Mañana será otra oportunidad!" });

    await canal.send({ embeds: [embed] });
    return;
  }

  // ── Con participantes → sorteo ────────────────────────────
  const totalBoletos = resBoletos.rows.length;
  const pozoVentas = totalBoletos * COSTO_BOLETO;

  // Pozo final = ventas + acumulado, con mínimo garantizado
  const pozoSinMinimo = pozoVentas + acumuladoAnterior;
  const pozoFinal = Math.max(POZO_MINIMO, pozoSinMinimo);
  const annieAporto = pozoFinal - pozoVentas - acumuladoAnterior;

  // Contar boletos por participante
  const participantes = {};
  for (const row of resBoletos.rows) {
    participantes[row.user_id] = (participantes[row.user_id] || 0) + 1;
  }
  const numParticipantes = Object.keys(participantes).length;

  // Sorteo
  const boletoGanador = resBoletos.rows[Math.floor(Math.random() * totalBoletos)];
  const ganadorId = boletoGanador.user_id;
  const boletosGanador = participantes[ganadorId];
  const chanceGanador = ((boletosGanador / totalBoletos) * 100).toFixed(1);

  // Pagar al ganador
  await addBalance(ganadorId, pozoFinal);

  // Reset del pozo acumulado
  await setPozoAcumulado(0);

  // Guardar en historial
  await db.execute({
    sql: `INSERT INTO rifa_ganadores (user_id, fecha, pozo, boletos_ganador, boletos_totales)
          VALUES (?, ?, ?, ?, ?)`,
    args: [ganadorId, hoyStr, pozoFinal, boletosGanador, totalBoletos],
  });

  // Top 3 participantes
  const topParticipantes = Object.entries(participantes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([uid, boletos], i) => {
      const medallas = ["🥇", "🥈", "🥉"];
      const chance = ((boletos / totalBoletos) * 100).toFixed(1);
      return `${medallas[i]} <@${uid}> — ${boletos} boleto(s) (${chance}%)`;
    })
    .join("\n");

  // Desglose del pozo
  const desgloseLines = [`🎫 Boletos vendidos: **${pozoVentas.toLocaleString()} 🪙**`];
  if (acumuladoAnterior > 0) {
    desgloseLines.push(`📦 Acumulado anterior: **${acumuladoAnterior.toLocaleString()} 🪙**`);
  }
  if (annieAporto > 0) {
    desgloseLines.push(`🌸 Annie completó: **${annieAporto.toLocaleString()} 🪙**`);
  }

  // Embed del sorteo
  const embed = crearEmbed(CONFIG.COLORES.DORADO)
    .setTitle("🎉 ¡Sorteo Histórico de la Rifa!")
    .setDescription(
      `*Annie saca un papelito temblando de un frasco de vidrio... y lee en voz alta:*\n\n` +
      `¡YEEEEEEEI! ¡Tenemos un ganadorcito para las **${pozoFinal.toLocaleString()} Moneditas**!\n\n` +
      `Se nos van directamente a los bolsillos de: <@${ganadorId}>.\n` +
      `¡Disfrútalas y hazte algo rico para cenar, mi tesoro! 💖`,
    )
    .addFields(
      { name: "🎫 Boletos del ganador", value: `**${boletosGanador}** de ${totalBoletos} (${chanceGanador}%)`, inline: true },
      { name: "👥 Participantes", value: `**${numParticipantes}**`, inline: true },
      { name: "💰 Pozo total", value: `**${pozoFinal.toLocaleString()} 🪙**`, inline: true },
      { name: "📊 Desglose del pozo", value: desgloseLines.join("\n"), inline: false },
    );

  if (topParticipantes) {
    embed.addFields({ name: "🏅 Top participantes", value: topParticipantes, inline: false });
  }

  embed.setFooter({ text: `Se vendieron ${totalBoletos} boletos hoy. ¡Mañana hay otra oportunidad!` });

  await canal.send({ embeds: [embed] });
}

// ── Limpieza ──────────────────────────────────────────────────

async function limpiarBoletosViejos() {
  try {
    const result = await db.execute({
      sql: "DELETE FROM rifa_boletos WHERE fecha < date(?, '-7 days')",
      args: [getFechaChile()],
    });
    if (result.rowsAffected > 0) {
      console.log(`[Rifa] Limpiados ${result.rowsAffected} boletos viejos`);
    }
  } catch (e) {
    console.error("[Rifa] Error limpiando boletos:", e.message);
  }
}

// ── Queries reutilizables (para el comando) ───────────────────

/**
 * Obtiene estadísticas de la rifa del día, incluyendo pozo acumulado.
 * @param {string} fecha
 * @returns {Promise<{totalBoletos: number, pozoVentas: number, pozoAcumulado: number, pozoTotal: number, participantes: Object}>}
 */
export async function getEstadisticasRifa(fecha) {
  const countRes = await db.execute({
    sql: "SELECT user_id, COUNT(*) as boletos FROM rifa_boletos WHERE fecha = ? GROUP BY user_id ORDER BY boletos DESC",
    args: [fecha],
  });

  const participantes = {};
  let totalBoletos = 0;
  for (const row of countRes.rows) {
    participantes[String(row.user_id)] = Number(row.boletos);
    totalBoletos += Number(row.boletos);
  }

  const pozoVentas = totalBoletos * COSTO_BOLETO;
  const pozoAcumulado = await getPozoAcumulado();
  const pozoTotal = totalBoletos > 0
    ? Math.max(POZO_MINIMO, pozoVentas + pozoAcumulado)
    : pozoAcumulado; // Sin participantes: solo mostrar acumulado

  return { totalBoletos, pozoVentas, pozoAcumulado, pozoTotal, participantes };
}

/**
 * Obtiene los boletos de un usuario para una fecha.
 * @param {string} userId
 * @param {string} fecha
 * @returns {Promise<number>}
 */
export async function getBoletosUsuario(userId, fecha) {
  const res = await db.execute({
    sql: "SELECT COUNT(*) as total FROM rifa_boletos WHERE fecha = ? AND user_id = ?",
    args: [fecha, userId],
  });
  return Number(res.rows[0]?.total || 0);
}

/**
 * Obtiene el historial de los últimos ganadores.
 * @param {number} [limit=5]
 * @returns {Promise<Array>}
 */
export async function getHistorialGanadores(limit = 5) {
  const res = await db.execute({
    sql: `SELECT user_id, fecha, pozo, boletos_ganador, boletos_totales
          FROM rifa_ganadores
          ORDER BY id DESC
          LIMIT ?`,
    args: [limit],
  });
  return res.rows;
}

/** Exportar constante para uso en el comando */
export { POZO_MINIMO };
