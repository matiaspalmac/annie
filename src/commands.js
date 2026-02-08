// ============================================================
// Annie Bot v2 — Definiciones de Slash Commands + Handlers
// ============================================================

import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "./config.js";
import {
  PECES, ANIMALES, AVES, INSECTOS, CULTIVOS, RECOLECTABLES,
  HABITANTES, RECETAS, LOGROS, CODIGOS, PRECIOS,
  buscarItem, esTodos, normalize,
} from "./data.js";
import { getTrato, getSaludoHora, getFraseAnnie, CLIMA_PUEBLO } from "./personality.js";
import {
  crearEmbed, crearEmbedError, agregarNarrativa, getBostezo,
  enviarPaginado, getHoraChile, estaDurmiendo,
} from "./utils.js";

// -------------------------------------------------------
// Definiciones de comandos (para registrar en Discord)
// -------------------------------------------------------
export const COMMAND_DEFS = [
  new SlashCommandBuilder()
    .setName("peces")
    .setDescription("Consulta los peces del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del pez o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("insectos")
    .setDescription("Consulta los insectos del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del insecto o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("aves")
    .setDescription("Consulta las aves del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del ave o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("animales")  
    .setDescription("Consulta los animales del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del animal o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("cultivos")
    .setDescription("Consulta los cultivos y flores del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del cultivo o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("recolectables")
    .setDescription("Consulta los recursos recolectables del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del recurso o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("recetas")
    .setDescription("Consulta las recetas de cocina del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre de la receta o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("habitantes")
    .setDescription("Consulta los NPCs y habitantes del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del habitante o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("logros")
    .setDescription("Consulta los logros y titulos del pueblito")
    .addStringOption(o => o.setName("nombre").setDescription("Nombre del logro o 'todos'").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("codigos")
    .setDescription("Muestra los codigos de recompensa activos"),

  new SlashCommandBuilder()
    .setName("precio")
    .setDescription("Consulta la libreta de precios de Annie")
    .addStringOption(o => o.setName("item").setDescription("Nombre del item").setAutocomplete(true).setRequired(true)),

  new SlashCommandBuilder()
    .setName("venta")
    .setDescription("Calcula cuanto ganas vendiendo un item")
    .addStringOption(o => o.setName("item").setDescription("Nombre del item").setAutocomplete(true).setRequired(true))
    .addIntegerOption(o => o.setName("estrellas").setDescription("Calidad (1-5 estrellas)").setRequired(true))
    .addIntegerOption(o => o.setName("cantidad").setDescription("Cantidad a vender").setRequired(true)),

  new SlashCommandBuilder()
    .setName("recordar")
    .setDescription("Annie te recuerda algo en unos minutitos")
    .addIntegerOption(o => o.setName("minutos").setDescription("En cuantos minutos te recuerdo").setRequired(true))
    .addStringOption(o => o.setName("mensaje").setDescription("Que necesitas recordar").setRequired(true)),

  new SlashCommandBuilder()
    .setName("clima")
    .setDescription("Muestra el clima del pueblito hoy y proximos dias"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Muestra la cartita de ayuda de Annie"),

  new SlashCommandBuilder()
    .setName("annie")
    .setDescription("Conoce a Annie, la carterita del pueblito"),

  new SlashCommandBuilder()
    .setName("wiki")
    .setDescription("Enlace directo a la wiki de Heartopia"),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Envia el mensaje de seleccion de roles")
    .addChannelOption(o => o.setName("canal").setDescription("Canal donde enviar (por defecto: canal actual)").setRequired(false)),
].map(c => c.toJSON());

// -------------------------------------------------------
// Fuentes de autocompletado por comando
// -------------------------------------------------------
const AUTOCOMPLETE_SOURCES = {
  peces:         () => Object.keys(PECES),
  insectos:      () => Object.keys(INSECTOS),
  aves:          () => Object.keys(AVES),
  animales:      () => Object.keys(ANIMALES),
  cultivos:      () => Object.keys(CULTIVOS),
  recolectables: () => Object.keys(RECOLECTABLES),
  recetas:       () => Object.keys(RECETAS),
  habitantes:    () => Object.keys(HABITANTES),
  logros:        () => Object.keys(LOGROS),
  precio:        () => Object.keys(PRECIOS),
  venta:         () => Object.keys(PRECIOS),
};

const CMDS_CON_TODOS = ["peces","insectos","aves","animales","cultivos","recolectables","recetas","habitantes","logros"];

export function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true).value.trim();
  const norm = normalize(focused);
  const sourceGen = AUTOCOMPLETE_SOURCES[interaction.commandName];
  if (!sourceGen) return interaction.respond([]);

  const source = sourceGen();
  let matches = source.filter(i => normalize(i).includes(norm));
  if (matches.length === 0 && norm === "") matches = source.slice(0, 25);
  matches = matches.slice(0, 25);

  const opciones = matches.map(i => ({ name: i, value: i }));
  if (opciones.length < 25 && CMDS_CON_TODOS.includes(interaction.commandName)) {
    opciones.unshift({ name: "Todos los items (* / todos)", value: "todos" });
  }
  if (opciones.length > 25) opciones.length = 25;

  return interaction.respond(opciones);
}

// -------------------------------------------------------
// Handler principal de comandos
// -------------------------------------------------------
export async function handleCommand(interaction) {
  const cmd = interaction.commandName;
  const bostezo = getBostezo();

  try {
    switch (cmd) {
      case "peces":         return await cmdPeces(interaction, bostezo);
      case "insectos":      return await cmdInsectos(interaction, bostezo);
      case "aves":          return await cmdAves(interaction, bostezo);
      case "animales":      return await cmdAnimales(interaction, bostezo);
      case "cultivos":      return await cmdCultivos(interaction, bostezo);
      case "recolectables": return await cmdRecolectables(interaction, bostezo);
      case "recetas":       return await cmdRecetas(interaction, bostezo);
      case "habitantes":    return await cmdHabitantes(interaction, bostezo);
      case "logros":        return await cmdLogros(interaction, bostezo);
      case "codigos":       return await cmdCodigos(interaction, bostezo);
      case "precio":        return await cmdPrecio(interaction, bostezo);
      case "venta":         return await cmdVenta(interaction, bostezo);
      case "recordar":      return await cmdRecordar(interaction, bostezo);
      case "clima":         return await cmdClima(interaction, bostezo);
      case "help":
      case "annie":         return await cmdHelp(interaction, bostezo);
      case "wiki":          return await cmdWiki(interaction, bostezo);
      case "roles":         return await cmdRoles(interaction, bostezo);
      default: break;
    }
  } catch (err) {
    console.error(`Error en comando /${cmd}:`, err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Ay, se me enredaron los papelitos... intentalo otra vez, corazon.", ephemeral: true });
    }
  }
}

// ====================================================================
// COMANDOS DE ENCICLOPEDIA (patron unificado)
// ====================================================================

// --- /peces ---
async function cmdPeces(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.VERDE;

  if (esTodos(input)) {
    const items = Object.entries(PECES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 12,
      titulo: "Todos los peces del pueblito",
      descripcion: "Mira que lindos estan todos reuniditos... Annie los quiere muchisimo.\nVen a pescar con amor cuando los veas.",
      content: bostezo,
      renderItem: ([nombre, pez]) => ({
        name: `${nombre}`,
        value: `**${pez.ubicacion}** | Nivel ${pez.nivel ?? "--"} | Tipo: ${pez.tipo ?? "--"}\nClima: ${pez.clima?.join(", ") || "--"} | Horario: ${pez.horario?.join(", ") || "--"}`,
      }),
    });
  }

  const result = buscarItem(PECES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("peces", input)], ephemeral: true });

  const { nombre, data: pez } = result;
  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .setDescription(`**${pez.tipo || "--"}** en **${pez.ubicacion}**`)
    .addFields(
      { name: "Nivel", value: String(pez.nivel ?? "--"), inline: true },
      { name: "Clima", value: pez.clima?.join(", ") || "--", inline: true },
      { name: "Horario", value: pez.horario?.join(", ") || "--", inline: true },
    );
  agregarNarrativa(embed, "peces");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /insectos ---
async function cmdInsectos(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.INSECTO;

  if (esTodos(input)) {
    const items = Object.entries(INSECTOS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 12,
      titulo: "Insectos del pueblito",
      descripcion: "Todos los bichitos que Annie ha visto. Red lista y a buscar.",
      content: bostezo,
      renderItem: ([nombre, data]) => ({
        name: `${nombre}`,
        value: `**${data.ubicacion}**\nNivel ${data.nivel} | ${data.tipo}\nClima: ${data.clima?.join(", ") || "--"} | Horario: ${data.horario?.join(", ") || "--"}`,
      }),
    });
  }

  const result = buscarItem(INSECTOS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("insectos", input)], ephemeral: true });

  const { nombre, data } = result;
  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .setDescription(`**Ubicacion:** ${data.ubicacion}`)
    .addFields(
      { name: "Nivel", value: String(data.nivel), inline: true },
      { name: "Tipo", value: data.tipo, inline: true },
      { name: "Clima", value: data.clima?.join(", ") || "--", inline: true },
      { name: "Horario", value: data.horario?.join(", ") || "--", inline: true },
    );
  agregarNarrativa(embed, "insectos");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /aves ---
async function cmdAves(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.AZUL;

  if (esTodos(input)) {
    const items = Object.entries(AVES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 10,
      titulo: "Aves del pueblito",
      descripcion: "Todas las pajaritas anotaditas con carino.\nSal a buscarlas cuando el clima este rico.",
      content: bostezo,
      renderItem: ([nombre, data]) => ({
        name: `${nombre}`,
        value: `**${data.ubicacion}**\nNivel ${data.nivel} | ${data.actividad}\nClima: ${data.clima?.join(", ") || "--"} | Horario: ${data.horario?.join(", ") || "--"}`,
      }),
    });
  }

  const result = buscarItem(AVES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("aves", input)], ephemeral: true });

  const { nombre, data } = result;
  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .setDescription(`**Ubicacion:** ${data.ubicacion}`)
    .addFields(
      { name: "Nivel", value: String(data.nivel), inline: true },
      { name: "Actividad", value: data.actividad || "--", inline: true },
      { name: "Clima", value: data.clima?.join(", ") || "--", inline: true },
      { name: "Horario", value: data.horario?.join(", ") || "--", inline: true },
    );
  agregarNarrativa(embed, "aves");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /animales ---
async function cmdAnimales(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.ROSA;

  if (esTodos(input)) {
    const items = Object.entries(ANIMALES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 8,
      titulo: "Todos los animalitos del pueblito",
      descripcion: "Mira que lindos estan todos reuniditos... Annie los quiere muchisimo y los cuida con carinito.\nVen a darles su comidita favorita cuando los veas.",
      content: bostezo,
      renderItem: ([nombre, data]) => ({
        name: `${nombre}`,
        value: `**${data.ubicacion}**\nComida favorita: ${data.comida_favorita?.join(", ") || "--"}\nClima preferido: ${data.clima_preferido?.join(", ") || "--"}`,
      }),
    });
  }

  const result = buscarItem(ANIMALES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("animales", input)], ephemeral: true });

  const { nombre, data } = result;
  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .setDescription(`**Ubicacion:** ${data.ubicacion}`)
    .addFields(
      { name: "Comida favorita", value: data.comida_favorita?.join(", ") || "--", inline: false },
      { name: "Clima preferido", value: data.clima_preferido?.join(", ") || "--", inline: false },
    );
  agregarNarrativa(embed, "animales");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /cultivos ---
async function cmdCultivos(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.NARANJA;

  if (esTodos(input)) {
    const items = Object.entries(CULTIVOS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 12,
      titulo: "Cultivos del pueblito",
      descripcion: "Planta con amor y cosecha con paciencia.",
      content: bostezo,
      renderItem: ([nombre, info]) => ({
        name: `${nombre}`,
        value: `Tiempo: ${info.tiempo_crecimiento} | Nivel: ${info.nivel_jardineria}\nVenta semilla: ${info.venta_semilla} | Compra semilla: ${info.compra_semilla}`,
      }),
    });
  }

  const result = buscarItem(CULTIVOS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("cultivos", input)], ephemeral: true });

  const { nombre, data: info } = result;
  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .addFields(
      { name: "Tiempo", value: String(info.tiempo_crecimiento), inline: true },
      { name: "Nivel jardineria", value: String(info.nivel_jardineria), inline: true },
      { name: "Venta semilla", value: String(info.venta_semilla), inline: true },
      { name: "Compra semilla", value: String(info.compra_semilla), inline: true },
    );
  agregarNarrativa(embed, "cultivos");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /recolectables ---
async function cmdRecolectables(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.OLIVA;

  if (esTodos(input)) {
    const items = Object.entries(RECOLECTABLES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 12,
      titulo: "Recolectables del pueblito",
      descripcion: "Todo lo que puedes juntar con tus manitos.",
      content: bostezo,
      renderItem: ([nombre, info]) => ({
        name: `${nombre}`,
        value: `Ubicacion: ${info.ubicacion}\nPrecio venta: ${info.precio_venta} | Energia: ${info.ganancia_energia ?? "--"}`,
      }),
    });
  }

  const result = buscarItem(RECOLECTABLES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("recolectables", input)], ephemeral: true });

  const { nombre, data: info } = result;
  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .addFields(
      { name: "Ubicacion", value: info.ubicacion, inline: false },
      { name: "Precio venta", value: String(info.precio_venta), inline: true },
      { name: "Energia", value: String(info.ganancia_energia ?? "--"), inline: true },
    );
  agregarNarrativa(embed, "recolectables");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /recetas (NUEVO) ---
async function cmdRecetas(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.NARANJA;

  if (esTodos(input)) {
    const items = Object.entries(RECETAS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 8,
      titulo: "Recetas del pueblito",
      descripcion: "Cocinar es como escribir una carta: hay que ponerle amor en cada paso.",
      content: bostezo,
      renderItem: ([nombre, r]) => {
        const vals = r.valores ? `${r.valores[0]} ~ ${r.valores[4]}` : "--";
        return {
          name: `${nombre} (${r.rareza})`,
          value: `Nivel: ${r.nivel_receta} | Ingredientes: ${r.ingredientes}\nValor: ${vals} | Costo: ${r.costo ?? "--"} | Energia: ${r.energia?.[0] ?? "--"}-${r.energia?.[4] ?? "--"}`,
        };
      },
    });
  }

  const result = buscarItem(RECETAS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("recetas", input)], ephemeral: true });

  const { nombre, data: r } = result;
  const stars = ["1 estrella", "2 estrellas", "3 estrellas", "4 estrellas", "5 estrellas"];
  const valoresStr = r.valores ? r.valores.map((v, i) => `${stars[i]}: ${v.toLocaleString("es-CL")}`).join("\n") : "--";

  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .setDescription(`**Rareza:** ${r.rareza} | **Nivel receta:** ${r.nivel_receta}`)
    .addFields(
      { name: "Ingredientes", value: r.ingredientes, inline: false },
      { name: "Valores de venta", value: valoresStr, inline: true },
      { name: "Costo", value: String(r.costo ?? "Requiere recetas previas"), inline: true },
      { name: "Energia", value: r.energia ? r.energia.join(" / ") : "--", inline: true },
    );
  agregarNarrativa(embed, "recetas");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /habitantes (NUEVO) ---
async function cmdHabitantes(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.ROSA;

  if (esTodos(input)) {
    const items = Object.entries(HABITANTES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 10,
      titulo: "Habitantes del pueblito",
      descripcion: "Cada habitante tiene algo especial que ofrecer. Solo hay que visitarlos.",
      content: bostezo,
      renderItem: ([nombre, npc]) => ({
        name: `${nombre} — ${npc.rol}`,
        value: `${npc.descripcion}\nUbicacion: ${npc.ubicacion}`,
      }),
    });
  }

  const result = buscarItem(HABITANTES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("habitantes", input)], ephemeral: true });

  const { nombre, data: npc } = result;
  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .setDescription(`**${npc.rol}**`)
    .addFields(
      { name: "Descripcion", value: npc.descripcion, inline: false },
      { name: "Ubicacion", value: npc.ubicacion, inline: true },
    );
  agregarNarrativa(embed, "habitantes");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /logros ---
async function cmdLogros(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.DORADO;

  if (esTodos(input)) {
    const items = Object.entries(LOGROS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 5,
      titulo: "Logros del pueblito",
      descripcion: "Cada esfuerzo cuenta, vecino. Annie esta orgullosa de ti.",
      content: bostezo,
      renderItem: ([nombre, info]) => ({
        name: `${nombre}`,
        value: `Categoria: ${info.categoria}\nRequisito: ${info.requisito}\nTitulo: ${info.titulo} (${info.nota})`,
      }),
    });
  }

  const result = buscarItem(LOGROS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("logros", input)], ephemeral: true });

  const { nombre, data: info } = result;
  const embed = crearEmbed(color)
    .setTitle(`${nombre}`)
    .setDescription(`**Categoria:** ${info.categoria}`)
    .addFields(
      { name: "Requisito", value: info.requisito, inline: false },
      { name: "Titulo obtenido", value: `${info.titulo}`, inline: true },
      { name: "Nota", value: info.nota, inline: true },
    );
  agregarNarrativa(embed, "logros");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /codigos (NUEVO) ---
async function cmdCodigos(int, bostezo) {
  const color = CONFIG.COLORES.DORADO;
  const ahora = new Date();
  const activos = Object.entries(CODIGOS).filter(([, c]) => {
    if (c.status !== "active") return false;
    if (c.expirationDate && new Date(c.expirationDate) < ahora) return false;
    return true;
  });

  if (activos.length === 0) {
    const embed = crearEmbed(color)
      .setTitle("Codigos de Recompensa")
      .setDescription("Ay, corazon... ahora mismo no tengo ningun codigo activo en mi libretita. Vuelve prontito que siempre llegan nuevos.");
    agregarNarrativa(embed, "codigos");
    return int.reply({ content: bostezo, embeds: [embed] });
  }

  const embed = crearEmbed(color)
    .setTitle("Codigos de Recompensa Activos")
    .setDescription("Aqui te dejo los codigos vigentes, tesoro. Aprovechalos antes de que expiren.");

  activos.forEach(([codigo, data]) => {
    embed.addFields({
      name: `${codigo}`,
      value: `Recompensas: ${data.rewards.join(", ")}\nExpira: ${data.expirationDate || "Sin fecha"}`,
      inline: false,
    });
  });

  agregarNarrativa(embed, "codigos");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// ====================================================================
// COMANDOS DE ECONOMIA
// ====================================================================

// --- /precio ---
async function cmdPrecio(int, bostezo) {
  const input = int.options.getString("item")?.trim() || "";
  const color = CONFIG.COLORES.AMARILLO;

  if (esTodos(input)) {
    const items = Object.entries(PRECIOS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 15,
      titulo: "Libreta de Precios",
      descripcion: "Aqui va uno por uno, bien clarito y con carino.",
      content: bostezo,
      renderItem: ([nombre, valores]) => {
        const stars = ["1*", "2*", "3*", "4*", "5*"];
        const preciosStr = valores.map((v, i) => v > 0 ? `${stars[i]}: ${v.toLocaleString("es-CL")}` : "").filter(Boolean).join(" | ") || "Sin precio";
        return { name: `${nombre}`, value: preciosStr };
      },
    });
  }

  const result = buscarItem(PRECIOS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("precio", input)], ephemeral: true });

  const { nombre, data: precios } = result;
  const embed = crearEmbed(color)
    .setTitle(`Precio de ${nombre}`)
    .setDescription("Mire cuanto pagan segun las estrellitas, vecino.");

  const stars = ["1 estrella", "2 estrellas", "3 estrellas", "4 estrellas", "5 estrellas"];
  precios.forEach((v, i) => {
    if (v > 0) {
      embed.addFields({ name: stars[i], value: `\`${v.toLocaleString("es-CL")}\``, inline: true });
    }
  });
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /venta ---
async function cmdVenta(int, bostezo) {
  const input = int.options.getString("item")?.trim() || "";
  const est = int.options.getInteger("estrellas");
  const cant = int.options.getInteger("cantidad");
  const color = CONFIG.COLORES.AMARILLO;

  if (est < 1 || est > 5) {
    const embed = crearEmbed(color)
      .setTitle("Ojo, corazoncito!")
      .setDescription(`Las estrellitas van de 1 a 5 nomas, ${getTrato()}. No me inventes calidades nuevas, tesoro.`);
    return int.reply({ embeds: [embed], ephemeral: true });
  }

  const result = buscarItem(PRECIOS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("precio", input)], ephemeral: true });

  const { nombre, data: precios } = result;
  const precioUnitario = precios[est - 1] || 0;

  if (precioUnitario === 0) {
    const embed = crearEmbed(color)
      .setTitle("Uy, tesorito!")
      .setDescription(`Ese item "${nombre}" no tiene precio para ${est} estrellas. Prueba con otra calidad, corazon.`);
    return int.reply({ embeds: [embed], ephemeral: true });
  }

  const total = precioUnitario * cant;
  const embed = crearEmbed(color)
    .setTitle("Calculo de venta")
    .setDescription(`Por **${cant}** de **${nombre}** (${est} estrellas)`)
    .addFields(
      { name: "Precio unitario", value: `${precioUnitario.toLocaleString("es-CL")}`, inline: true },
      { name: "Total", value: `**${total.toLocaleString("es-CL")}** moneditas`, inline: true },
    );
  return int.reply({ content: bostezo, embeds: [embed] });
}

// ====================================================================
// COMANDOS DE UTILIDAD
// ====================================================================

// --- /recordar ---
async function cmdRecordar(int, bostezo) {
  const min = int.options.getInteger("minutos");
  const mensaje = int.options.getString("mensaje");
  const color = estaDurmiendo() ? CONFIG.COLORES.AZUL : CONFIG.COLORES.ROSA;

  const embed = crearEmbed(color)
    .setTitle(estaDurmiendo() ? "Notita anotada... Zzz" : "Recadito guardado con carino!")
    .setDescription(
      estaDurmiendo()
        ? "*(Annie escribe suave con ojitos cerrados)* Zzz... ya esta en mi libretita, no me despiertes mucho, ya?"
        : `Listo, ${getTrato()}! Te guardo tu recadito y te despierto en **${min}** minutitos. No se te olvide, corazon.`
    )
    .addFields({ name: "Tu mensajito guardado", value: `**${mensaje}**` });

  await int.reply({ embeds: [embed], ephemeral: true });

  setTimeout(() => {
    const embedRecordatorio = crearEmbed(color)
      .setTitle(estaDurmiendo() ? "Shhh... recadito nocturnito!" : "Oiga, corazoncito! Hora de recordar")
      .setDescription(
        estaDurmiendo()
          ? `*(Annie se despierta suave y busca su libretita)* Uy! Casi se me olvida... pero aqui esta, ${int.user}:`
          : `Despierta po, ${getTrato()}! Aqui te traigo tu recadito dulce con carino.`
      )
      .addFields({ name: "Lo que tenias que recordar", value: `**${mensaje}**` });

    int.channel.send({ content: `${int.user}`, embeds: [embedRecordatorio] }).catch(console.error);
  }, min * 60000);
}

// --- /clima ---
async function cmdClima(int, bostezo) {
  const hoy = CLIMA_PUEBLO.hoy;

  const getSmartTimestamp = (horaRef) => {
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: CONFIG.TIMEZONE }));
    const res = new Date(ahora);
    if (horaRef < ahora.getHours()) res.setDate(ahora.getDate() + 1);
    res.setHours(horaRef, 0, 0, 0);
    return Math.floor(res.getTime() / 1000);
  };

  const embed = crearEmbed(hoy.eventos?.length > 0 ? CONFIG.COLORES.DORADO : CONFIG.COLORES.CIELO)
    .setTitle(`${hoy.tipo.toUpperCase()}`)
    .setDescription(hoy.descripcion);

  if (hoy.eventos?.length > 0) {
    embed.addFields({ name: "AVISOS IMPORTANTES", value: "\u200B", inline: false });
    hoy.eventos.forEach(ev => {
      const ts = getSmartTimestamp(ev.hora);
      embed.addFields({
        name: `${ev.evento}`,
        value: `Hora: <t:${ts}:t> | Inicia: <t:${ts}:R>`,
        inline: true,
      });
    });
  }

  const textoTimeline = hoy.timeline.map(e => {
    const ts = getSmartTimestamp(e.hora);
    return `<t:${ts}:t> -- ${e.texto}`;
  }).join("\n");

  embed.addFields(
    { name: "Cronologia del tiempo", value: textoTimeline, inline: false },
    {
      name: "Proximos dias",
      value: "```\n" + CLIMA_PUEBLO.proximos.map(d => `${d.dia.padEnd(10)} | ${d.clima}`).join("\n") + "\n```",
      inline: false,
    },
  );

  embed.setFooter({ text: "Pronostico hecho con mucho amor | Disfruta el clima, vecino!" });
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /help y /annie ---
async function cmdHelp(int, bostezo) {
  const embed = crearEmbed(CONFIG.COLORES.ROSA)
    .setTitle("Oficinita dulce de Annie")
    .setDescription(
      estaDurmiendo()
        ? "*(Bosteza suave y se frota los ojitos)*\nZzz... Hola corazoncito, soy Annie. Aunque este medio dormidita, aqui tienes mi libretita de ayuda con mucho carino."
        : `Wena, ${getTrato()}!\nSoy **Annie**, la carterita del pueblito. Entre repartos y chismecitos, aqui te dejo mis cositas para ayudarte.`
    )
    .addFields(
      {
        name: "Economia y Utilidad",
        value:
          "`/precio` <item> -- Revisa la libretita de precios.\n" +
          "`/venta` <item> <estrellas> <qty> -- Calcula tus ganancias.\n" +
          "`/recordar` <tiempo> <msg> -- Te aviso con carino.\n" +
          "`/clima` -- Pronostico del pueblito.",
        inline: false,
      },
      {
        name: "Enciclopedia del Pueblo",
        value:
          "```\n/peces       /insectos    /aves\n/animales    /cultivos    /recolectables\n/recetas     /habitantes  /logros\n/codigos```\n" +
          "Usa `<nombre>` o `todos` despues de cada comando.",
        inline: false,
      },
      {
        name: "Comunidad",
        value:
          "Roles: Reacciona en el canal de roles.\n" +
          "Voz: Entra a mi oficina y pasare a saludarte!\n" +
          "`/wiki` -- Enlace a la wiki completa.",
        inline: false,
      },
      {
        name: "Horarios de Annie",
        value:
          "Sueno: 23:00 - 08:00 (Chile)\n" +
          "Boletin del clima: 19:00 cada dia",
        inline: true,
      },
    )
    .setFooter({
      text: `Annie v2.0 | ${estaDurmiendo() ? "Zzz... suenen bonito" : "Hecho con amor para Heartopia"}`,
      iconURL: int.guild?.iconURL() ?? undefined,
    })
    .setTimestamp();

  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /wiki (NUEVO) ---
async function cmdWiki(int, bostezo) {
  const embed = crearEmbed(CONFIG.COLORES.ROSA)
    .setTitle("Wiki de Heartopia")
    .setDescription(`Aqui tienes el enlace a la wiki completa del pueblito, corazon.\n\n**${CONFIG.WIKI_URL}**\n\nToda la informacion esta ahi, organizada con carino por Annie y los vecinos.`);
  agregarNarrativa(embed, "general");
  return int.reply({ content: bostezo, embeds: [embed] });
}

// --- /roles ---
async function cmdRoles(int) {
  await int.deferReply({ ephemeral: true });
  if (!int.member.permissions.has("ManageRoles")) {
    return int.editReply({
      content: "Ay, tesorito... este comando es solo para quienes cuidan el pueblito (necesitas permiso de gestionar roles).",
      ephemeral: true,
    });
  }

  const canalObjetivo = int.options.getChannel("canal") || int.channel;
  if (!canalObjetivo.isTextBased()) {
    return int.reply({ content: "Ese canal no es de texto, corazoncito... elige uno donde pueda escribir Annie.", ephemeral: true });
  }

  const embed = crearEmbed(CONFIG.COLORES.ROSA)
    .setTitle("Oficinita de Annie -- Elige tus roles con carino, vecino!")
    .setDescription(
      "Wena, corazoncitos del pueblito! Soy Annie, tu carterita favorita.\n\n" +
      "Reacciona con los emojis que mas te gusten para recibir notificaciones dulces " +
      "de los eventos que te hagan ilusion.\n\n" +
      "**Lista de roles:**\n" +
      Object.entries(CONFIG.REACTION_ROLES).map(([emoji]) => {
        const nombres = { "\uD83E\uDEB2": "Atraer Bichos", "\uD83E\uDEE7": "Lanzador de Burbujas", "\uD83E\uDD86": "Pato Amarillo", "\uD83C\uDFA3": "Pesca Marina", "\uD83E\uDEBA": "Nido de las Aves", "\uD83D\uDC90": "Ramo de Flores Arcoiris", "\uD83C\uDF20": "Lluvia de Estrellas" };
        return `${emoji} -- ${nombres[emoji] || "Rol"}`;
      }).join("\n") +
      "\n\nReacciona con el emoji que quieras y te pongo el rol con carino.\nSi quitas la reaccion, te lo quito sin drama."
    )
    .setFooter({ text: "v2.0 | Heartopia", iconURL: int.guild?.iconURL({ size: 32 }) })
    .setTimestamp();

  try {
    const msg = await canalObjetivo.send({ content: "Reacciona abajo para elegir tus roles, vecinitos lindos!", embeds: [embed] });
    const emojis = Object.keys(CONFIG.REACTION_ROLES);
    for (const emoji of emojis) await msg.react(emoji);

    await int.editReply({
      content: `Listo, corazoncito! El mensajito de roles quedo publicado en ${canalObjetivo}.\n**ID del mensaje:** \`${msg.id}\``,
    });
  } catch (err) {
    console.error("Error enviando mensaje de roles:", err);
    await int.editReply({
      content: "Ay no... se me enredo el delantal y no pude enviar el mensaje. Revisa permisos en ese canal, tesoro.",
    });
  }
}
