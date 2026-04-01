import { db } from "../services/db.js";
import { addToInventory, deductBalance } from "../services/db-helpers.js";

// ── Constantes ────────────────────────────────────────────────────────────
/** Cooldown para usar el servicio de reset de racha (1 semana en milisegundos) */
const RESET_RACHA_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Duración del seguro anti-robo (24 horas en milisegundos) */
const SEGURO_ANTIROBO_DURACION_MS = 24 * 60 * 60 * 1000;

/** Cantidad de cebos simples que se compran por unidad */
const CEBO_SIMPLE_CANTIDAD = 3;

// ── Metadatos de Herramientas ───────────────────────────────────────────
const TOOL_META = {
  herr_pico_hierro: { maxDur: 80, family: "pico", tier: 2 },
  herr_pico_acero: { maxDur: 120, family: "pico", tier: 3 },
  herr_cana_fibra: { maxDur: 90, family: "cana", tier: 2 },
  herr_cana_lunar: { maxDur: 130, family: "cana", tier: 3 },
  herr_hacha_hierro: { maxDur: 85, family: "hacha", tier: 2 },
  herr_hacha_titanio: { maxDur: 125, family: "hacha", tier: 3 },
  herr_red_fina: { maxDur: 90, family: "red", tier: 2 },
  herr_red_seda: { maxDur: 130, family: "red", tier: 3 },
};

/**
 * Obtiene los metadatos de una herramienta.
 * @param {string} itemId - ID de la herramienta
 * @returns {{maxDur: number, family: string, tier: number}|null}
 */
function getToolMeta(itemId) {
  return TOOL_META[itemId] || null;
}

/**
 * Obtiene el patrón LIKE para buscar herramientas de una familia.
 * @param {string} family - Familia de herramienta (pico, cana, hacha, red)
 * @returns {string} Patrón SQL LIKE
 */
function getFamilyLikePattern(family) {
  if (family === "pico") return "herr_pico_%";
  if (family === "cana") return "herr_cana_%";
  if (family === "hacha") return "herr_hacha_%";
  if (family === "red") return "herr_red_%";
  return "herr_%";
}

/**
 * Obtiene el orden de prioridad de herramientas de una familia (mejor primero).
 * @param {string} family - Familia de herramienta
 * @returns {Array<string>} Array de IDs ordenados por calidad
 */
function getFamilyBestOrder(family) {
  if (family === "pico") return ["herr_pico_acero", "herr_pico_hierro"];
  if (family === "cana") return ["herr_cana_lunar", "herr_cana_fibra"];
  if (family === "hacha") return ["herr_hacha_titanio", "herr_hacha_hierro"];
  if (family === "red") return ["herr_red_seda", "herr_red_fina"];
  return [];
}

/**
 * Procesa la compra de un item de la tienda.
 * @async
 * @param {Object} interaction - Interacción de Discord
 * @param {string} itemSeleccionado - ID del item a comprar
 * @returns {Promise<{ok: boolean, message: string}>} Resultado de la compra
 */
export async function procesarCompraTienda(interaction, itemSeleccionado) {
  try {
    if (!interaction?.user?.id || !itemSeleccionado) {
      return { ok: false, message: "❌ Datos de compra inválidos." };
    }

    const resItem = await db.execute({
      sql: "SELECT precio_monedas, tipo, discord_role_id, nombre FROM tienda_items WHERE id = ?",
      args: [String(itemSeleccionado)],
    });

    if (!resItem?.rows?.length) {
      return { ok: false, message: "Item inválido o ya no está en la tienda." };
    }

    const precio = Number(resItem.rows[0]?.precio_monedas ?? 0);
    const tipoItem = String(resItem.rows[0]?.tipo ?? "rol");
    const discordRoleIdToAssign = resItem.rows[0]?.discord_role_id;
    const nombreItem = String(resItem.rows[0]?.nombre ?? itemSeleccionado);

    const result = await db.execute({
      sql: "SELECT monedas FROM usuarios WHERE id = ?",
      args: [interaction.user.id],
    });

    if (!result?.rows?.length) {
      return { ok: false, message: "No estás registrado en el pueblito." };
    }

    const currentMonedas = Number(result.rows[0]?.monedas ?? 0);
    if (currentMonedas < precio) {
      return { ok: false, message: `Pucha corazón, te faltan **${precio - currentMonedas} Moneditas** para comprar eso. ¡Sigue charlando en el pueblito!` };
    }

    // ── CONSUMIBLES ───────────────────────────────────────────────────────────
    if (tipoItem === "consumible") {
      let duracionMs = 0;
      let boostId = "";
      let textoEfecto = "";

      if (itemSeleccionado === "booster_xp_30m") {
        duracionMs = 30 * 60 * 1000;
        boostId = "booster_xp_30m";
        textoEfecto = "+25% XP por 30 minutos";
      } else if (itemSeleccionado === "amuleto_suerte_15m") {
        duracionMs = 15 * 60 * 1000;
        boostId = "amuleto_suerte_15m";
        textoEfecto = "+chance de drops raros por 15 minutos";
      }

      // Caso especial: Cebo Simple
      if (itemSeleccionado === "cebo_simple") {
        await deductBalance(interaction.user.id, precio);
        await addToInventory(interaction.user.id, itemSeleccionado, CEBO_SIMPLE_CANTIDAD);

        return { ok: true, message: `🎣 Compraste **Cebo Simple x${CEBO_SIMPLE_CANTIDAD}**. Se usará automáticamente al pescar para mejorar tus capturas.` };
      }

      if (!boostId || duracionMs <= 0) {
        return { ok: false, message: "Este consumible aún no está disponible." };
      }

      const ahora = Date.now();
      const nuevoExpira = ahora + duracionMs;

      await deductBalance(interaction.user.id, precio);

      await db.execute({
        sql: `INSERT INTO boosts_activos (user_id, boost_id, fecha_expira)
              VALUES (?, ?, ?)
              ON CONFLICT(user_id, boost_id) DO UPDATE SET
              fecha_expira = CASE
                WHEN boosts_activos.fecha_expira > ? THEN boosts_activos.fecha_expira + ?
                ELSE ?
              END`,
        args: [interaction.user.id, boostId, nuevoExpira, ahora, duracionMs, nuevoExpira],
      });

      await addToInventory(interaction.user.id, itemSeleccionado);

      return { ok: true, message: `✨ Consumible aplicado: **${nombreItem}**. Efecto activo: **${textoEfecto}**.` };
    }

    // ── SERVICIOS ─────────────────────────────────────────────────────────────
    if (tipoItem === "servicio") {
      // Seguro Anti-Robo
      if (itemSeleccionado === "seguro_antirobo_24h") {
        const ahora = Date.now();

        await deductBalance(interaction.user.id, precio);

        await db.execute({
          sql: `UPDATE usuarios
                SET seguro_antirobo_hasta = CASE
                  WHEN COALESCE(seguro_antirobo_hasta, 0) > ? THEN seguro_antirobo_hasta + ?
                  ELSE ?
                END
                WHERE id = ?`,
          args: [ahora, SEGURO_ANTIROBO_DURACION_MS, ahora + SEGURO_ANTIROBO_DURACION_MS, interaction.user.id],
        });

        await db.execute({
          sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                VALUES (?, ?, 1)
                ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = inventario_economia.cantidad + 1`,
          args: [interaction.user.id, itemSeleccionado],
        });

        return { ok: true, message: "🛡️ Activé tu **Seguro Anti-Robo** por 24h (acumulable). Tus moneditas estarán protegidas de /robar." };
      }

      // Etiqueta para Mascota
      if (itemSeleccionado === "etiqueta_mascota") {
        await deductBalance(interaction.user.id, precio);

        await db.execute({
          sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
                VALUES (?, ?, 1)
                ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = inventario_economia.cantidad + 1`,
          args: [interaction.user.id, itemSeleccionado],
        });

        return {
          ok: true,
          message: "🏷️ Compraste una **Etiqueta para Mascota**. Usa **/renombrar mascota:[tu mascota] nombre:[nuevo nombre]** para ponerle nombre a tu compañerito.",
        };
      }

      // Reset de Racha (Perdón)
      if (itemSeleccionado !== "reset_racha_perdon") {
        return { ok: false, message: "Este servicio aún no está disponible." };
      }

      const resServicio = await db.execute({
        sql: "SELECT ultimo_reset_racha FROM servicios_usuarios WHERE user_id = ? LIMIT 1",
        args: [interaction.user.id],
      });

      const ultimoUso = String(resServicio?.rows?.[0]?.ultimo_reset_racha ?? "");
      if (ultimoUso) {
        const msDesdeUltimo = Date.now() - new Date(ultimoUso).getTime();
        if (!Number.isNaN(msDesdeUltimo) && msDesdeUltimo < RESET_RACHA_COOLDOWN_MS) {
          const faltanDias = Math.ceil((RESET_RACHA_COOLDOWN_MS - msDesdeUltimo) / (24 * 60 * 60 * 1000));
          return { ok: false, message: `Este servicio solo se puede usar **1 vez por semana**. Te faltan ~**${faltanDias} día(s)**.` };
        }
      }

      const resAyer = await db.execute({
        sql: `SELECT date(
                'now',
                COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours'),
                '-1 day'
              ) as ayer`,
      });
      const fechaAyer = String(resAyer?.rows?.[0]?.ayer ?? "");

      const resActividadAyer = await db.execute({
        sql: `SELECT acciones, xp_ganado, monedas_ganadas
              FROM actividad_diaria
              WHERE user_id = ? AND fecha = ?
              LIMIT 1`,
        args: [interaction.user.id, fechaAyer],
      });

      const huboActividadAyer =
        resActividadAyer?.rows?.length > 0 &&
        (Number(resActividadAyer.rows[0]?.acciones ?? 0) > 0 ||
          Number(resActividadAyer.rows[0]?.xp_ganado ?? 0) > 0 ||
          Number(resActividadAyer.rows[0]?.monedas_ganadas ?? 0) > 0);

      if (huboActividadAyer) {
        return { ok: false, message: "Tu racha no se rompió ayer, así que no necesitas usar este servicio todavía 💖." };
      }

      await deductBalance(interaction.user.id, precio);

      await db.execute({
        sql: `INSERT INTO actividad_diaria (user_id, fecha, xp_ganado, monedas_ganadas, acciones)
              VALUES (?, ?, 0, 0, 1)
              ON CONFLICT(user_id, fecha) DO UPDATE SET
                acciones = MAX(actividad_diaria.acciones, 1)`,
        args: [interaction.user.id, fechaAyer],
      });

      await db.execute({
        sql: `INSERT INTO servicios_usuarios (user_id, ultimo_reset_racha)
              VALUES (?, datetime('now'))
              ON CONFLICT(user_id) DO UPDATE SET ultimo_reset_racha = excluded.ultimo_reset_racha`,
        args: [interaction.user.id],
      });

      await addToInventory(interaction.user.id, itemSeleccionado);

      return { ok: true, message: "🛟 Servicio aplicado: recuperé tu día perdido de ayer para mantener la racha activa." };
    }

    // ── HERRAMIENTAS ────────────────────────────────────────────────────────────────────────────────
    if (tipoItem === "herramienta") {
      const meta = getToolMeta(itemSeleccionado);
      if (!meta) {
        return { ok: false, message: "Esta herramienta no está configurada correctamente." };
      }

      await deductBalance(interaction.user.id, precio);
      await addToInventory(interaction.user.id, itemSeleccionado);

      await db.execute({
        sql: `INSERT INTO herramientas_durabilidad (user_id, item_id, durabilidad, max_durabilidad, equipado)
              VALUES (?, ?, ?, ?, 0)
              ON CONFLICT(user_id, item_id) DO UPDATE SET
              durabilidad = CASE
                WHEN herramientas_durabilidad.durabilidad < herramientas_durabilidad.max_durabilidad
                  THEN herramientas_durabilidad.max_durabilidad
                ELSE herramientas_durabilidad.durabilidad
              END,
              max_durabilidad = excluded.max_durabilidad`,
        args: [interaction.user.id, itemSeleccionado, meta.maxDur, meta.maxDur],
      });

      const likePattern = getFamilyLikePattern(meta.family);

      const resFamily = await db.execute({
        sql: `SELECT item_id, equipado FROM herramientas_durabilidad WHERE user_id = ? AND item_id LIKE ?`,
        args: [interaction.user.id, likePattern],
      });

      const anyEquipped = (resFamily?.rows ?? []).some(r => Number(r?.equipado ?? 0) === 1);
      const bestOwned = getFamilyBestOrder(meta.family).find(id =>
        (resFamily?.rows ?? []).some(r => String(r?.item_id ?? "") === id)
      );

      if (!anyEquipped || bestOwned === itemSeleccionado) {
        await db.execute({
          sql: `UPDATE herramientas_durabilidad
                SET equipado = CASE WHEN item_id = ? THEN 1 ELSE 0 END
                WHERE user_id = ? AND item_id LIKE ?`,
          args: [itemSeleccionado, interaction.user.id, likePattern],
        });
      }

      return { ok: true, message: `🧰 Compraste **${nombreItem}** y quedó listo con durabilidad completa. ${bestOwned === itemSeleccionado || !anyEquipped ? "Se equipó automáticamente." : "Puedes equiparlo luego."}` };
    }

    // ── MARCOS ──────────────────────────────────────────────────────────────────────────────────────
    if (tipoItem === "marco") {
      const resYaLoTiene = await db.execute({
        sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
        args: [interaction.user.id, itemSeleccionado],
      });
      if (resYaLoTiene.rows.length > 0 && resYaLoTiene.rows[0].cantidad > 0) {
        return { ok: false, message: `Ya tienes el ${nombreItem} en tu colección, no necesitas comprarlo de nuevo. 💖` };
      }

      await db.execute({
        sql: "UPDATE usuarios SET monedas = monedas - ?, marco_perfil = ? WHERE id = ?",
        args: [precio, itemSeleccionado, interaction.user.id],
      });

      await addToInventory(interaction.user.id, itemSeleccionado);

      return { ok: true, message: `🖼️ ¡Listo! Equipé el **${nombreItem}** en tu perfil web.` };
    }

    // ── TEMAS ───────────────────────────────────────────────────────────────────────────────────────
    if (tipoItem === "tema") {
      const resYaLoTiene = await db.execute({
        sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
        args: [interaction.user.id, itemSeleccionado],
      });
      if (resYaLoTiene.rows.length > 0 && resYaLoTiene.rows[0].cantidad > 0) {
        return { ok: false, message: `Ya tienes el ${nombreItem} en tu colección, no necesitas comprarlo de nuevo. 💖` };
      }

      await db.execute({
        sql: "UPDATE usuarios SET monedas = monedas - ?, tema_perfil = ? WHERE id = ?",
        args: [precio, itemSeleccionado, interaction.user.id],
      });

      await addToInventory(interaction.user.id, itemSeleccionado);

      return { ok: true, message: `🎨 ¡Gracias lindo/a! Acabas de comprar el tema \`${itemSeleccionado}\`.\n\nAcabo de actualizar la escenografía de tu libretita web. ¡Se va a ver preciosa!` };
    }

    // ── MASCOTAS ────────────────────────────────────────────────────────────────────────────────────
    if (tipoItem === "mascota") {
      const resYaLoTiene = await db.execute({
        sql: "SELECT cantidad FROM inventario_economia WHERE user_id = ? AND item_id = ?",
        args: [interaction.user.id, itemSeleccionado],
      });
      if (resYaLoTiene.rows.length > 0 && resYaLoTiene.rows[0].cantidad > 0) {
        return { ok: false, message: `Ya adoptaste a ${nombreItem}, no puedes adoptarlo dos veces. 💖` };
      }

      await db.execute({
        sql: "UPDATE usuarios SET monedas = monedas - ?, mascota_activa = ? WHERE id = ?",
        args: [precio, itemSeleccionado, interaction.user.id],
      });

      await addToInventory(interaction.user.id, itemSeleccionado);

      return { ok: true, message: `🐾 ¡Awww! Felicidades por tu nuevo amiguito \`${itemSeleccionado}\`.\n\nAcabo de hacerle espacio en tu Libretita Web. ¡Ve a la página de tu perfil para mirarlo!` };
    }

    // ── ROLES DE COLOR (por defecto) ────────────────────────────────────────────────────────────────
    await db.execute({
      sql: "UPDATE usuarios SET monedas = monedas - ?, color_rol_id = ? WHERE id = ?",
      args: [precio, itemSeleccionado, interaction.user.id],
    });

    let roleMsg = "";
    if (discordRoleIdToAssign && typeof discordRoleIdToAssign === "string") {
      try {
        const role = interaction.guild?.roles?.cache?.get(discordRoleIdToAssign);
        if (role) {
          await interaction.member.roles.add(role);
          roleMsg = " y te he asignado el rol oficial en el servidor automáticamente";
        }
      } catch (err) {
        console.error("[Shop] Fallo al asignar el rol a", interaction.user.username, err);
      }
    }

    if (itemSeleccionado === "color_custom") {
      return { ok: true, message: "✨ ¡Has comprado el Pincel Mágico! Pronto un administrador contactará contigo para darte tu color Hexadecimal único. ¡Qué emoción!" };
    }

    return { ok: true, message: `🎨 ¡Gracias tesoro! Te acabo de dar el tinte \`${itemSeleccionado}\`${roleMsg} para que resaltes tu nombre.` };

  } catch (err) {
    console.error("[Shop] Error procesando compra:", err);
    return { ok: false, message: "❌ Ocurrió un error al procesar tu compra. Inténtalo de nuevo." };
  }
}
