import { SlashCommandBuilder } from "discord.js";
import { db } from "../db.js";
import { ganarXP, registrarBitacora, registrarEstadistica, tieneBoostActivo } from "../progreso.js";

const COOLDOWN_TRABAJO = 300000;

const TRABAJOS = [
  { key: "minar", label: "Minar" },
  { key: "pescar", label: "Pescar" },
  { key: "sacudir_arbol", label: "Sacudir árbol" },
  { key: "cazar_bichos", label: "Cazar bichos" },
];

const TRABAJOS_SET = new Set(TRABAJOS.map((trabajo) => trabajo.key));

export const data = new SlashCommandBuilder()
  .setName("accion")
  .setDescription("Elige una acción del pueblito desde un solo comando.")
  .addStringOption((option) =>
    option
      .setName("actividad")
      .setDescription("Acción que quieres hacer")
      .setRequired(true)
      .setAutocomplete(true)
  );

function formatearCooldown(msRestante) {
  if (msRestante <= 0) return "Listo";

  const segundos = Math.ceil(msRestante / 1000);
  if (segundos < 60) return `${segundos}sec`;

  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = segundos % 60;
  if (segundosRestantes === 0) return `${minutos}min`;

  return `${minutos}min ${segundosRestantes}sec`;
}

async function getCooldownsTrabajos(userId) {
  const ahora = Date.now();
  const placeholders = TRABAJOS.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `SELECT comando, fecha_limite
          FROM cooldowns
          WHERE user_id = ?
            AND extra_id = 'global'
            AND comando IN (${placeholders})`,
    args: [userId, ...TRABAJOS.map((trabajo) => trabajo.key)],
  });

  const cooldowns = Object.fromEntries(TRABAJOS.map((trabajo) => [trabajo.key, 0]));

  for (const row of result.rows) {
    if (!TRABAJOS_SET.has(row.comando)) continue;
    const limite = Number(row.fecha_limite) || 0;
    cooldowns[row.comando] = Math.max(0, limite - ahora);
  }

  return cooldowns;
}

async function getCooldownRestante(userId, trabajoKey) {
  const ahora = Date.now();
  const result = await db.execute({
    sql: "SELECT fecha_limite FROM cooldowns WHERE user_id = ? AND comando = ? AND extra_id = 'global'",
    args: [userId, trabajoKey],
  });

  if (result.rows.length === 0) return 0;
  const limite = Number(result.rows[0].fecha_limite) || 0;
  return Math.max(0, limite - ahora);
}

async function setCooldown(userId, trabajoKey) {
  const nuevoLimite = Date.now() + COOLDOWN_TRABAJO;
  await db.execute({
    sql: `INSERT INTO cooldowns (user_id, comando, extra_id, fecha_limite)
          VALUES (?, ?, 'global', ?)
          ON CONFLICT(user_id, comando, extra_id) DO UPDATE SET fecha_limite = excluded.fecha_limite`,
    args: [userId, trabajoKey, nuevoLimite],
  });
}

async function ejecutarMinar(userId, interaction) {
  const xpGanada = Math.floor(Math.random() * 11) + 10;
  const nivelMineria = await ganarXP(userId, "mineria", xpGanada, interaction);

  const bonoNivel = (nivelMineria - 1) * 0.5;
  const rand = Math.random() * 100;

  const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
  const bonusSuerte = amuletoActivo ? 10 : 0;
  const chanceFluorita = Math.min(5 + bonoNivel + bonusSuerte, 35);
  const chanceMineral = Math.min(30 + (bonoNivel * 1.5) + bonusSuerte, 70);

  let itemId = "";
  let emoji = "";
  let rarezaTexto = "";

  if (rand <= chanceFluorita) {
    itemId = "Fluorita impecable";
    emoji = "💎";
    rarezaTexto = "¡Cielo santo! ¡Qué brillo tan hermoso!";
    await registrarBitacora(userId, "Desenterró una codiciada Fluorita impecable.");
  } else if (rand <= chanceMineral) {
    itemId = "Mineral";
    emoji = "🪨✨";
    rarezaTexto = "¡Conseguiste algo de mineral brillante!";
  } else {
    itemId = "Piedra";
    emoji = "🪨";
    rarezaTexto = "¡Pura piedrecilla sólida y rústica!";
  }

  await db.execute({
    sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
          VALUES (?, ?, 1)
          ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
    args: [userId, itemId],
  });

  return `⛏️ *Clink, clink... clank!*\n\n${rarezaTexto} \nHas obtenido **1x ${emoji} ${itemId}**. ¡Guárdalo bien en tus bolsillitos! *(Nv. Minería: ${nivelMineria})*`;
}

async function ejecutarPescar(userId, interaction) {
  const xpGanada = Math.floor(Math.random() * 16) + 10;
  const nivelPesca = await ganarXP(userId, "pesca", xpGanada, interaction);

  const bonoNivel = (nivelPesca - 1) * 0.5;
  const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
  const bonusSuerte = amuletoActivo ? 8 : 0;
  const chanceBotella = Math.min(5 + bonoNivel + bonusSuerte, 45);
  const rand = Math.random() * 100;

  if (rand <= chanceBotella) {
    const monedasGanadas = Math.floor(Math.random() * 41) + 10 + (nivelPesca * 2);

    await db.execute({
      sql: `INSERT INTO usuarios (id, monedas, xp, nivel)
            VALUES (?, ?, 0, 1)
            ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
      args: [userId, monedasGanadas],
    });

    await registrarBitacora(userId, "¡Pescó una misteriosa Botella con mensaje!");

    return `🎣 *Sientes un tirón extraño en la caña...* \n\n¡Atrapaste una **📜 Botella con mensaje**!\nAdentro del vidrio había **${monedasGanadas} moneditas**. ¡Qué suerte! *(Nv. Pesca: ${nivelPesca})*`;
  }

  const itemId = "Pescado";
  const emoji = "🐟";

  await db.execute({
    sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
          VALUES (?, ?, 1)
          ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
    args: [userId, itemId],
  });

  return `🎣 *Splash...* \n\n¡Ha picado algo! Has pescado **1x ${emoji} ${itemId}**. ¡Directo a la canasta! *(Nv. Pesca: ${nivelPesca})*`;
}

async function ejecutarSacudirArbol(userId, interaction) {
  const xpGanada = Math.floor(Math.random() * 11) + 10;
  const nivelRecoleccion = await ganarXP(userId, "recoleccion", xpGanada, interaction);

  await registrarEstadistica(userId, "arboles_sacudidos", 1, interaction);

  const bonoNivel = (nivelRecoleccion - 1) * 0.5;
  const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
  const bonusSuerte = amuletoActivo ? 10 : 0;
  const chanceAbejas = Math.max((10 - bonoNivel) - (amuletoActivo ? 4 : 0), 1);
  const chanceMonedas = Math.min(20 + bonoNivel + bonusSuerte, 55);
  const rand = Math.random() * 100;

  if (rand <= chanceAbejas) {
    const monedasPerdidas = Math.floor(Math.random() * 11) + 5;

    await db.execute({
      sql: "UPDATE usuarios SET monedas = MAX(0, monedas - ?) WHERE id = ?",
      args: [monedasPerdidas, userId],
    });

    await registrarBitacora(userId, "Huyó despavorido/a de un enjambre de Abejas.");

    return `🌳 *Shake, shake...* \n\n🐝 **¡BZZZ! ¡UN PANAL DE ABEJAS!** 🐝\n\nSaliste corriendo pero te picaron igual. En el escándalo, se te cayeron **${monedasPerdidas} moneditas**. ¡Pobrecito mi niño! *(Nv. Recolección: ${nivelRecoleccion})*`;
  }

  if (rand <= chanceAbejas + chanceMonedas) {
    const monedasGanadas = Math.floor(Math.random() * 21) + 10 + (nivelRecoleccion * 2);

    await db.execute({
      sql: `INSERT INTO usuarios (id, monedas, xp, nivel)
            VALUES (?, ?, 0, 1)
            ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
      args: [userId, monedasGanadas],
    });

    await registrarBitacora(userId, "¡Encontró una bolsa mágica de moneditas en un árbol!");

    return `🌳 *Shake, shake...* \n\n💰 **¡CLINK CLINK!** \n\n¡En vez de frutas, te llovieron del cielo **${monedasGanadas} moneditas**! A veces la magia del pueblito te sorprende. *(Nv. Recolección: ${nivelRecoleccion})*`;
  }

  const itemId = "Manzanas";
  const emoji = "🍎";

  await db.execute({
    sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
          VALUES (?, ?, 3)
          ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 3`,
    args: [userId, itemId],
  });

  return `🌳 *Shake, shake... thump!* \n\n¡Cayeron unos frutos deliciosos! Has recogido **3x ${emoji} ${itemId}**.\nGuárdalas en la canasta para venderlas después. *(Nv. Recolección: ${nivelRecoleccion})*`;
}

async function ejecutarCazarBichos(userId, interaction) {
  const xpGanada = Math.floor(Math.random() * 16) + 15;
  const nivelCaza = await ganarXP(userId, "caza", xpGanada, interaction);

  const bonoNivel = (nivelCaza - 1) * 0.4;
  const rand = Math.random() * 100;

  const amuletoActivo = await tieneBoostActivo(userId, "amuleto_suerte_15m");
  const bonusSuerte = amuletoActivo ? 10 : 0;
  const chanceTarantula = Math.min(5 + bonoNivel + bonusSuerte, 30);
  const chanceMariposa = Math.min(25 + (bonoNivel * 1.5) + bonusSuerte, 60);

  let itemId = "";
  let mensajeObtencion = "";

  if (rand <= chanceTarantula) {
    itemId = "Tarántula";
    mensajeObtencion = `¡Ay mamita! ¡Un monstruo peludo saltó a tu red! Te dio un susto tremendo, pero... eh, ¡atrapaste una **🕷️ Tarántula**! *(Nv. Caza: ${nivelCaza})*`;
    await registrarBitacora(userId, "Sobrevivió y cazó una Tarántula mortal.");
  } else if (rand <= chanceMariposa) {
    itemId = "Mariposa Emperador";
    mensajeObtencion = `¡Qué belleza! Una vibrante **🦋 Mariposa Emperador** se posó solita en tu red. *(Nv. Caza: ${nivelCaza})*`;
    await registrarBitacora(userId, "Atrapó una deslumbrante Mariposa Emperador.");
  } else if (rand <= 65) {
    itemId = "Mantis Religiosa";
    mensajeObtencion = `Zaz, un manotazo rápido y ¡listo! Tienes una **🦗 Mantis Religiosa**. *(Nv. Caza: ${nivelCaza})*`;
  } else {
    await registrarEstadistica(userId, "bichos_fallados", 1, interaction);
    return `🍃 *Swish, swish...* \n\n¡Ups! Viste algo moverse, pero cuando bajaste la red solo atrapaste aire y hojas secas. ¡Mejor suerte a la próxima! *(Nv. Caza: ${nivelCaza})*`;
  }

  await db.execute({
    sql: `INSERT INTO inventario_economia (user_id, item_id, cantidad)
          VALUES (?, ?, 1)
          ON CONFLICT(user_id, item_id) DO UPDATE SET cantidad = cantidad + 1`,
    args: [userId, itemId],
  });

  return `🐛 *Empiezas a buscar entre las plantitas...* \n\n${mensajeObtencion}`;
}

const EJECUTORES = {
  minar: ejecutarMinar,
  pescar: ejecutarPescar,
  sacudir_arbol: ejecutarSacudirArbol,
  cazar_bichos: ejecutarCazarBichos,
};

export async function autocomplete(interaction) {
  try {
    const focused = (interaction.options.getFocused() || "").toLowerCase();
    const cooldowns = await getCooldownsTrabajos(interaction.user.id);

    const choices = TRABAJOS
      .filter((trabajo) =>
        trabajo.label.toLowerCase().includes(focused) || trabajo.key.includes(focused)
      )
      .map((trabajo) => ({
        name: `${trabajo.label} - ${formatearCooldown(cooldowns[trabajo.key] || 0)}`,
        value: trabajo.key,
      }))
      .slice(0, 25);

    await interaction.respond(choices);
  } catch (error) {
    console.error("[Autocomplete] /accion:", error);
    await interaction.respond([]).catch(() => { });
  }
}

export async function execute(interaction, bostezo) {
  const userId = interaction.user.id;
  const actividad = interaction.options.getString("actividad", true);

  await interaction.deferReply();

  try {
    const ejecutor = EJECUTORES[actividad];

    if (!ejecutor) {
      return interaction.followUp(`${bostezo}No me sale esa acción en la libretita. Prueba con una opción del autocompletado.`);
    }

    const cooldownRestante = await getCooldownRestante(userId, actividad);
    if (cooldownRestante > 0) {
      return interaction.followUp(`${bostezo}${TRABAJOS.find((trabajo) => trabajo.key === actividad)?.label || "Ese trabajo"} aún no está listo. Espera **${formatearCooldown(cooldownRestante)}**.`);
    }

    await setCooldown(userId, actividad);
    const mensajeResultado = await ejecutor(userId, interaction);
    return interaction.followUp(mensajeResultado);
  } catch (error) {
    console.error("Error en comando /accion:", error);
    return interaction.followUp(`${bostezo}Uy... se me enredaron los papelitos de la acción. Inténtalo de nuevo en un ratito.`);
  }
}
