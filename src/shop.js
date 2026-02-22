import { db } from "./db.js";

export async function procesarCompraTienda(interaction, itemSeleccionado) {
  const resItem = await db.execute({
    sql: "SELECT precio_monedas, tipo, discord_role_id, nombre FROM tienda_items WHERE id = ?",
    args: [itemSeleccionado],
  });

  if (resItem.rows.length === 0) {
    return { ok: false, message: "Item inválido o ya no está en la tienda." };
  }

  const precio = Number(resItem.rows[0].precio_monedas);
  const tipoItem = String(resItem.rows[0].tipo || "rol");
  const discordRoleIdToAssign = resItem.rows[0].discord_role_id;
  const nombreItem = String(resItem.rows[0].nombre || itemSeleccionado);

  const result = await db.execute({
    sql: "SELECT monedas FROM usuarios WHERE id = ?",
    args: [interaction.user.id],
  });

  if (result.rows.length === 0) {
    return { ok: false, message: "No estás registrado en el pueblito." };
  }

  const currentMonedas = Number(result.rows[0].monedas);
  if (currentMonedas < precio) {
    return { ok: false, message: `Pucha corazón, te faltan **${precio - currentMonedas} Moneditas** para comprar eso. ¡Sigue charlando en el pueblito!` };
  }

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

    if (!boostId || duracionMs <= 0) {
      return { ok: false, message: "Este consumible aún no está disponible." };
    }

    const ahora = Date.now();
    const nuevoExpira = ahora + duracionMs;

    await db.execute({
      sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
      args: [precio, interaction.user.id],
    });

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

    await db.execute({
      sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = inventario_economia.cantidad + 1`,
      args: [interaction.user.id, itemSeleccionado],
    });

    return { ok: true, message: `✨ Consumible aplicado: **${nombreItem}**. Efecto activo: **${textoEfecto}**.` };
  }

  if (tipoItem === "servicio") {
    if (itemSeleccionado !== "reset_racha_perdon") {
      return { ok: false, message: "Este servicio aún no está disponible." };
    }

    const resServicio = await db.execute({
      sql: "SELECT ultimo_reset_racha FROM servicios_usuarios WHERE user_id = ? LIMIT 1",
      args: [interaction.user.id],
    });

    const ultimoUso = String(resServicio.rows[0]?.ultimo_reset_racha || "");
    if (ultimoUso) {
      const msDesdeUltimo = Date.now() - new Date(ultimoUso).getTime();
      const semanaMs = 7 * 24 * 60 * 60 * 1000;
      if (!Number.isNaN(msDesdeUltimo) && msDesdeUltimo < semanaMs) {
        const faltanDias = Math.ceil((semanaMs - msDesdeUltimo) / (24 * 60 * 60 * 1000));
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
    const fechaAyer = String(resAyer.rows[0]?.ayer || "");

    const resActividadAyer = await db.execute({
      sql: `SELECT acciones, xp_ganado, monedas_ganadas
            FROM actividad_diaria
            WHERE user_id = ? AND fecha = ?
            LIMIT 1`,
      args: [interaction.user.id, fechaAyer],
    });

    const huboActividadAyer =
      resActividadAyer.rows.length > 0 &&
      (Number(resActividadAyer.rows[0].acciones || 0) > 0 ||
        Number(resActividadAyer.rows[0].xp_ganado || 0) > 0 ||
        Number(resActividadAyer.rows[0].monedas_ganadas || 0) > 0);

    if (huboActividadAyer) {
      return { ok: false, message: "Tu racha no se rompió ayer, así que no necesitas usar este servicio todavía 💖." };
    }

    await db.execute({
      sql: "UPDATE usuarios SET monedas = monedas - ? WHERE id = ?",
      args: [precio, interaction.user.id],
    });

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

    await db.execute({
      sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = inventario_economia.cantidad + 1`,
      args: [interaction.user.id, itemSeleccionado],
    });

    return { ok: true, message: "🛟 Servicio aplicado: recuperé tu día perdido de ayer para mantener la racha activa." };
  }

  if (tipoItem === "marco") {
    await db.execute({
      sql: "UPDATE usuarios SET monedas = monedas - ?, marco_perfil = ? WHERE id = ?",
      args: [precio, itemSeleccionado, interaction.user.id],
    });

    await db.execute({
      sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = inventario_economia.cantidad + 1`,
      args: [interaction.user.id, itemSeleccionado],
    });

    return { ok: true, message: `🖼️ ¡Listo! Equipé el **${nombreItem}** en tu perfil web.` };
  }

  if (tipoItem === "tema") {
    await db.execute({
      sql: "UPDATE usuarios SET monedas = monedas - ?, tema_perfil = ? WHERE id = ?",
      args: [precio, itemSeleccionado, interaction.user.id],
    });

    await db.execute({
      sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = inventario_economia.cantidad + 1`,
      args: [interaction.user.id, itemSeleccionado],
    });

    return { ok: true, message: `🎨 ¡Gracias lindo/a! Acabas de comprar el tema \`${itemSeleccionado}\`.\n\nAcabo de actualizar la escenografía de tu libretita web. ¡Se va a ver preciosa!` };
  }

  if (tipoItem === "mascota") {
    await db.execute({
      sql: "UPDATE usuarios SET monedas = monedas - ?, mascota_activa = ? WHERE id = ?",
      args: [precio, itemSeleccionado, interaction.user.id],
    });

    await db.execute({
      sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = inventario_economia.cantidad + 1`,
      args: [interaction.user.id, itemSeleccionado],
    });

    return { ok: true, message: `🐾 ¡Awww! Felicidades por tu nuevo amiguito \`${itemSeleccionado}\`.\n\nAcabo de hacerle espacio en tu Libretita Web. ¡Ve a la página de tu perfil para mirarlo!` };
  }

  await db.execute({
    sql: "UPDATE usuarios SET monedas = monedas - ?, color_rol_id = ? WHERE id = ?",
    args: [precio, itemSeleccionado, interaction.user.id],
  });

  let roleMsg = "";
  if (discordRoleIdToAssign && typeof discordRoleIdToAssign === "string") {
    try {
      const role = interaction.guild?.roles.cache.get(discordRoleIdToAssign);
      if (role) {
        await interaction.member.roles.add(role);
        roleMsg = " y te he asignado el rol oficial en el servidor automáticamente";
      }
    } catch (err) {
      console.error("Fallo al asignar el rol a ", interaction.user.username, err);
    }
  }

  if (itemSeleccionado === "color_custom") {
    return { ok: true, message: "✨ ¡Has comprado el Pincel Mágico! Pronto un administrador contactará contigo para darte tu color Hexadecimal único. ¡Qué emoción!" };
  }

  return { ok: true, message: `🎨 ¡Gracias tesoro! Te acabo de dar el tinte \`${itemSeleccionado}\`${roleMsg} para que resaltes tu nombre.` };
}
