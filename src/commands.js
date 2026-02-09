import { SlashCommandBuilder } from "discord.js";
import { CONFIG } from "./config.js";
import {
  PECES, ANIMALES, AVES, INSECTOS, CULTIVOS, RECOLECTABLES,
  HABITANTES, RECETAS, LOGROS, CODIGOS,
  AUTOCOMPLETE_CACHE,
  buscarItem, esTodos, normalize,
} from "./data.js";
import { getTrato, getSaludoHora, getFraseAnnie, CLIMA_PUEBLO } from "./personality.js";
import {
  crearEmbed, crearEmbedError, agregarNarrativa, getBostezo,
  enviarPaginado, getHoraChile, estaDurmiendo,
  EMOJI_CATEGORIA,
} from "./utils.js";

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

const CMDS_CON_TODOS = new Set(["peces","insectos","aves","animales","cultivos","recolectables","recetas","habitantes","logros"]);

export async function handleAutocomplete(interaction) {
  const start = Date.now();
  const cmd = interaction.commandName;

  try {
    const cache = AUTOCOMPLETE_CACHE[cmd];
    if (!cache) {
      await interaction.respond([]).catch(() => {});
      return;
    }

    const focused = interaction.options.getFocused(true).value.trim();
    const norm = focused
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    let matches;
    if (norm === "") {
      matches = cache.slice(0, 25);
    } else {
      matches = [];
      for (let i = 0; i < cache.length && matches.length < 25; i++) {
        if (cache[i].normalized.includes(norm)) {
          matches.push(cache[i]);
        }
      }
    }

    const opciones = matches.map(m => ({ name: m.original, value: m.original }));

    if (opciones.length < 25 && CMDS_CON_TODOS.has(cmd)) {
      opciones.unshift({ name: "Todos los items (* / todos)", value: "todos" });
    }
    if (opciones.length > 25) opciones.length = 25;

    await interaction.respond(opciones).catch(err => {
      const code = err?.code ?? err?.rawError?.code;
      if (code === 10062) {
        console.warn(`[Autocomplete] /${cmd} expirado (10062) tras ${Date.now() - start}ms`);
      } else {
        console.error(`[Autocomplete] /${cmd} error en respond:`, err);
      }
    });

    console.log(`[Autocomplete] /${cmd} OK en ${Date.now() - start}ms (${opciones.length} opciones)`);
  } catch (err) {
    console.error(`[Autocomplete] /${cmd} error general tras ${Date.now() - start}ms:`, err);
    await interaction.respond([]).catch(() => {});
  }
}

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

async function cmdPeces(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.VERDE;
  const em = EMOJI_CATEGORIA.peces;

  if (esTodos(input)) {
    const items = Object.entries(PECES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 12,
      titulo: `${em.titulo} Todos los peces del pueblito ${em.titulo}`,
      descripcion: "Mira que lindos estan todos reuniditos... Annie los quiere muchisimo.\nVen a pescar con amor cuando los veas.",
      content: bostezo,
      renderItem: ([nombre, pez]) => ({
        name: `${em.icono} ${nombre}`,
        value: `**${pez.ubicacion}** | Nivel ${pez.nivel ?? "--"} | Tipo: ${pez.tipo ?? "--"}\n${em.clima} Clima: ${pez.clima?.join(", ") || "--"} | ${em.horario} Horario: ${pez.horario?.join(", ") || "--"}`,
      }),
    });
  }

  const result = buscarItem(PECES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("peces", input)], ephemeral: true });

  const { nombre, data: pez } = result;
  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .setDescription(`**${pez.tipo || "--"}** en **${pez.ubicacion}**`)
    .addFields(
      { name: "\u2B50 Nivel", value: String(pez.nivel ?? "--"), inline: true },
      { name: `${em.clima} Clima`, value: pez.clima?.join(", ") || "--", inline: true },
      { name: `${em.horario} Horario`, value: pez.horario?.join(", ") || "--", inline: true },
    );
  agregarNarrativa(embed, "peces");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdInsectos(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.INSECTO;
  const em = EMOJI_CATEGORIA.insectos;

  if (esTodos(input)) {
    const items = Object.entries(INSECTOS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 12,
      titulo: `${em.titulo} Insectos del pueblito ${em.titulo}`,
      descripcion: "Todos los bichitos que Annie ha visto. Red lista y a buscar.",
      content: bostezo,
      renderItem: ([nombre, data]) => ({
        name: `${em.icono} ${nombre}`,
        value: `**${data.ubicacion}**\nNivel ${data.nivel} | ${data.tipo}\n${em.clima} Clima: ${data.clima?.join(", ") || "--"} | ${em.horario} Horario: ${data.horario?.join(", ") || "--"}`,
      }),
    });
  }

  const result = buscarItem(INSECTOS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("insectos", input)], ephemeral: true });

  const { nombre, data } = result;
  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .setDescription(`**Ubicacion:** ${data.ubicacion}`)
    .addFields(
      { name: "\u2B50 Nivel", value: String(data.nivel), inline: true },
      { name: "\uD83C\uDFAF Tipo", value: data.tipo, inline: true },
      { name: `${em.clima} Clima`, value: data.clima?.join(", ") || "--", inline: true },
      { name: `${em.horario} Horario`, value: data.horario?.join(", ") || "--", inline: true },
    );
  agregarNarrativa(embed, "insectos");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdAves(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.AZUL;
  const em = EMOJI_CATEGORIA.aves;

  if (esTodos(input)) {
    const items = Object.entries(AVES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 10,
      titulo: `${em.titulo} Aves del pueblito ${em.titulo}`,
      descripcion: "Todas las pajaritas anotaditas con carino.\nSal a buscarlas cuando el clima este rico.",
      content: bostezo,
      renderItem: ([nombre, data]) => ({
        name: `${em.icono} ${nombre}`,
        value: `**${data.ubicacion}**\nNivel ${data.nivel} | ${data.actividad}\n${em.clima} Clima: ${data.clima?.join(", ") || "--"} | ${em.horario} Horario: ${data.horario?.join(", ") || "--"}`,
      }),
    });
  }

  const result = buscarItem(AVES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("aves", input)], ephemeral: true });

  const { nombre, data } = result;
  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .setDescription(`**Ubicacion:** ${data.ubicacion}`)
    .addFields(
      { name: "\u2B50 Nivel", value: String(data.nivel), inline: true },
      { name: "\uD83C\uDFB5 Actividad", value: data.actividad || "--", inline: true },
      { name: `${em.clima} Clima`, value: data.clima?.join(", ") || "--", inline: true },
      { name: `${em.horario} Horario`, value: data.horario?.join(", ") || "--", inline: true },
    );
  agregarNarrativa(embed, "aves");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdAnimales(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.ROSA;
  const em = EMOJI_CATEGORIA.animales;

  if (esTodos(input)) {
    const items = Object.entries(ANIMALES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 8,
      titulo: `${em.titulo} Todos los animalitos del pueblito ${em.titulo}`,
      descripcion: "Mira que lindos estan todos reuniditos... Annie los quiere muchisimo y los cuida con carinito.\nVen a darles su comidita favorita cuando los veas.",
      content: bostezo,
      renderItem: ([nombre, data]) => ({
        name: `${em.icono} ${nombre}`,
        value: `**${data.ubicacion}**\n\uD83C\uDF72 Comida favorita: ${data.comida_favorita?.join(", ") || "--"}\n${em.clima} Clima preferido: ${data.clima_preferido?.join(", ") || "--"}`,
      }),
    });
  }

  const result = buscarItem(ANIMALES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("animales", input)], ephemeral: true });

  const { nombre, data } = result;
  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .setDescription(`**Ubicacion:** ${data.ubicacion}`)
    .addFields(
      { name: "\uD83C\uDF72 Comida favorita", value: data.comida_favorita?.join(", ") || "--", inline: false },
      { name: `${em.clima} Clima preferido`, value: data.clima_preferido?.join(", ") || "--", inline: false },
    );
  agregarNarrativa(embed, "animales");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdCultivos(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.NARANJA;
  const em = EMOJI_CATEGORIA.cultivos;

  if (esTodos(input)) {
    const items = Object.entries(CULTIVOS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 12,
      titulo: `${em.titulo} Cultivos del pueblito ${em.titulo}`,
      descripcion: "Planta con amor y cosecha con paciencia.",
      content: bostezo,
      renderItem: ([nombre, info]) => ({
        name: `${em.icono} ${nombre}`,
        value: `\u23F3 Tiempo: ${info.tiempo_crecimiento} | \u2B50 Nivel: ${info.nivel_jardineria}\n\uD83D\uDCB0 Venta semilla: ${info.venta_semilla} | \uD83D\uDED2 Compra semilla: ${info.compra_semilla}`,
      }),
    });
  }

  const result = buscarItem(CULTIVOS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("cultivos", input)], ephemeral: true });

  const { nombre, data: info } = result;
  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .addFields(
      { name: "\u23F3 Tiempo", value: String(info.tiempo_crecimiento), inline: true },
      { name: "\u2B50 Nivel jardineria", value: String(info.nivel_jardineria), inline: true },
      { name: "\uD83D\uDCB0 Venta semilla", value: String(info.venta_semilla), inline: true },
      { name: "\uD83D\uDED2 Compra semilla", value: String(info.compra_semilla), inline: true },
    );
  agregarNarrativa(embed, "cultivos");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdRecolectables(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.OLIVA;
  const em = EMOJI_CATEGORIA.recolectables;

  if (esTodos(input)) {
    const items = Object.entries(RECOLECTABLES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 12,
      titulo: `${em.titulo} Recolectables del pueblito ${em.titulo}`,
      descripcion: "Todo lo que puedes juntar con tus manitos.",
      content: bostezo,
      renderItem: ([nombre, info]) => ({
        name: `${em.icono} ${nombre}`,
        value: `\uD83D\uDCCD Ubicacion: ${info.ubicacion}\n\uD83D\uDCB0 Precio venta: ${info.precio_venta} | \u26A1 Energia: ${info.ganancia_energia ?? "--"}`,
      }),
    });
  }

  const result = buscarItem(RECOLECTABLES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("recolectables", input)], ephemeral: true });

  const { nombre, data: info } = result;
  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .addFields(
      { name: "\uD83D\uDCCD Ubicacion", value: info.ubicacion, inline: false },
      { name: "\uD83D\uDCB0 Precio venta", value: String(info.precio_venta), inline: true },
      { name: "\u26A1 Energia", value: String(info.ganancia_energia ?? "--"), inline: true },
    );
  agregarNarrativa(embed, "recolectables");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdRecetas(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.NARANJA;
  const em = EMOJI_CATEGORIA.recetas;

  if (esTodos(input)) {
    const items = Object.entries(RECETAS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 8,
      titulo: `${em.titulo} Recetas del pueblito ${em.titulo}`,
      descripcion: "Cocinar es como escribir una carta: hay que ponerle amor en cada paso.",
      content: bostezo,
      renderItem: ([nombre, r]) => {
        const vals = r.valores ? `${r.valores[0]} ~ ${r.valores[4]}` : "--";
        return {
          name: `${em.icono} ${nombre} (${r.rareza})`,
          value: `\u2B50 Nivel: ${r.nivel_receta} | \uD83E\uDDC2 Ingredientes: ${r.ingredientes}\n\uD83D\uDCB0 Valor: ${vals} | \uD83D\uDCB2 Costo: ${r.costo ?? "--"} | \u26A1 Energia: ${r.energia?.[0] ?? "--"}-${r.energia?.[4] ?? "--"}`,
        };
      },
    });
  }

  const result = buscarItem(RECETAS, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("recetas", input)], ephemeral: true });

  const { nombre, data: r } = result;
  const stars = ["\u2B50", "\u2B50\u2B50", "\u2B50\u2B50\u2B50", "\u2B50\u2B50\u2B50\u2B50", "\u2B50\u2B50\u2B50\u2B50\u2B50"];
  const valoresStr = r.valores ? r.valores.map((v, i) => `${stars[i]}: ${v.toLocaleString("es-CL")}`).join("\n") : "--";

  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .setDescription(`**Rareza:** ${r.rareza} | **Nivel receta:** ${r.nivel_receta}`)
    .addFields(
      { name: "\uD83E\uDDC2 Ingredientes", value: r.ingredientes, inline: false },
      { name: "\uD83D\uDCB0 Valores de venta", value: valoresStr, inline: true },
      { name: "\uD83D\uDCB2 Costo", value: String(r.costo ?? "Requiere recetas previas"), inline: true },
      { name: "\u26A1 Energia", value: r.energia ? r.energia.join(" / ") : "--", inline: true },
    );
  agregarNarrativa(embed, "recetas");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdHabitantes(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.ROSA;
  const em = EMOJI_CATEGORIA.habitantes;

  if (esTodos(input)) {
    const items = Object.entries(HABITANTES).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 10,
      titulo: `${em.titulo} Habitantes del pueblito ${em.titulo}`,
      descripcion: "Cada habitante tiene algo especial que ofrecer. Solo hay que visitarlos.",
      content: bostezo,
      renderItem: ([nombre, npc]) => ({
        name: `${em.icono} ${nombre} \u2014 ${npc.rol}`,
        value: `${npc.descripcion}\n\uD83D\uDCCD Ubicacion: ${npc.ubicacion}`,
      }),
    });
  }

  const result = buscarItem(HABITANTES, input);
  if (!result) return int.reply({ embeds: [crearEmbedError("habitantes", input)], ephemeral: true });

  const { nombre, data: npc } = result;
  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .setDescription(`**${npc.rol}**`)
    .addFields(
      { name: "\uD83D\uDCDD Descripcion", value: npc.descripcion, inline: false },
      { name: "\uD83D\uDCCD Ubicacion", value: npc.ubicacion, inline: true },
    );
  agregarNarrativa(embed, "habitantes");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdLogros(int, bostezo) {
  const input = int.options.getString("nombre")?.trim() || "";
  const color = CONFIG.COLORES.DORADO;
  const em = EMOJI_CATEGORIA.logros;

  if (esTodos(input)) {
    const items = Object.entries(LOGROS).sort((a, b) => a[0].localeCompare(b[0], "es"));
    return enviarPaginado({
      interaction: int,
      baseEmbed: crearEmbed(color),
      items,
      itemsPorPagina: 5,
      titulo: `${em.titulo} Logros del pueblito ${em.titulo}`,
      descripcion: "Cada esfuerzo cuenta, vecino. Annie esta orgullosa de ti.",
      content: bostezo,
      renderItem: ([nombre, info]) => ({
        name: `${em.icono} ${nombre}`,
        value: `\uD83C\uDFF7\uFE0F Categoria: ${info.categoria}\n\uD83D\uDCCB Requisito: ${info.requisito}\n\uD83C\uDFC5 Titulo: ${info.titulo} (${info.nota || "—"})`,
      }),
    });
  }

  const result = buscarItem(LOGROS, input);
  if (!result) {
    await int.reply({ embeds: [crearEmbedError("logros", input)], ephemeral: true });
    return;
  }

  const { nombre, data: info } = result;
  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} ${nombre}`)
    .setDescription(`**Categoria:** ${info.categoria}`)
    .addFields(
      { name: "\uD83D\uDCCB Requisito", value: info.requisito, inline: false },
      { name: "\uD83C\uDFC5 Titulo obtenido", value: `${info.titulo}`, inline: true },
      { name: "\uD83D\uDCDD Nota", value: info.nota || "—", inline: true },
    );
  agregarNarrativa(embed, "logros");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdCodigos(int, bostezo) {
  const color = CONFIG.COLORES.DORADO;
  const em = EMOJI_CATEGORIA.codigos;
  const ahora = new Date();
  const activos = Object.entries(CODIGOS).filter(([, c]) => {
    if (c.status !== "active") return false;
    if (c.expirationDate && new Date(c.expirationDate) < ahora) return false;
    return true;
  });

  if (activos.length === 0) {
    const embed = crearEmbed(color)
      .setTitle(`${em.titulo} Codigos de Recompensa`)
      .setDescription("Ay, corazon... ahora mismo no tengo ningun codigo activo en mi libretita. Vuelve prontito que siempre llegan nuevos.");
    agregarNarrativa(embed, "codigos");
    return int.reply({ content: bostezo, embeds: [embed] });
  }

  const embed = crearEmbed(color)
    .setTitle(`${em.titulo} Codigos de Recompensa Activos ${em.titulo}`)
    .setDescription("Aqui te dejo los codigos vigentes, tesoro. Aprovechalos antes de que expiren.");

  activos.forEach(([codigo, data]) => {
    embed.addFields({
      name: `\uD83D\uDD11 ${codigo}`,
      value: `\uD83C\uDF81 Recompensas: ${data.rewards.join(", ")}\n\u23F3 Expira: ${data.expirationDate || "Sin fecha"}`,
      inline: false,
    });
  });

  agregarNarrativa(embed, "codigos");
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdRecordar(int, bostezo) {
  const min = int.options.getInteger("minutos");
  const mensaje = int.options.getString("mensaje");
  const color = estaDurmiendo() ? CONFIG.COLORES.AZUL : CONFIG.COLORES.ROSA;

  const embed = crearEmbed(color)
    .setTitle(estaDurmiendo() ? "\uD83D\uDCA4 Notita anotada... Zzz" : "\uD83D\uDCDD Recadito guardado con carino!")
    .setDescription(
      estaDurmiendo()
        ? "*(Annie escribe suave con ojitos cerrados)* Zzz... ya esta en mi libretita, no me despiertes mucho, ya?"
        : `Listo, ${getTrato()}! Te guardo tu recadito y te despierto en **${min}** minutitos. No se te olvide, corazon.`
    )
    .addFields({ name: "\uD83D\uDCE8 Tu mensajito guardado", value: `**${mensaje}**` });

  await int.reply({ embeds: [embed], ephemeral: true });

  setTimeout(() => {
    const embedRecordatorio = crearEmbed(color)
      .setTitle(estaDurmiendo() ? "\uD83D\uDCA4 Shhh... recadito nocturnito!" : "\u23F0 Oiga, corazoncito! Hora de recordar")
      .setDescription(
        estaDurmiendo()
          ? `*(Annie se despierta suave y busca su libretita)* Uy! Casi se me olvida... pero aqui esta, ${int.user}:`
          : `Despierta po, ${getTrato()}! Aqui te traigo tu recadito dulce con carino.`
      )
      .addFields({ name: "\uD83D\uDCCC Lo que tenias que recordar", value: `**${mensaje}**` });

    int.channel.send({ content: `${int.user}`, embeds: [embedRecordatorio] }).catch(console.error);
  }, min * 60000);
}

async function cmdClima(int, bostezo) {
  const hoy = CLIMA_PUEBLO.hoy;
  const em = EMOJI_CATEGORIA.clima;

  const ahoraChile = new Date(new Date().toLocaleString("en-US", { timeZone: CONFIG.TIMEZONE }));
  
  const getUnixTimestamp = (horaRef, plusDays = 0) => {
    const fecha = new Date(new Date().toLocaleString("en-US", { timeZone: CONFIG.TIMEZONE }));
    fecha.setDate(fecha.getDate() + plusDays);
    fecha.setHours(horaRef, 0, 0, 0);
    
    return Math.floor(fecha.getTime() / 1000);
  };

  const embed = crearEmbed(hoy.eventos?.length > 0 ? CONFIG.COLORES.DORADO : CONFIG.COLORES.CIELO)
    .setTitle(`${em.titulo} ${hoy.tipo.toUpperCase()}`)
    .setDescription(hoy.descripcion);

  if (hoy.eventos?.length > 0) {
    embed.addFields({ name: "⚠️ AVISOS IMPORTANTES", value: "\u200B", inline: false });
    
    hoy.eventos.forEach(ev => {
      const ts = getUnixTimestamp(ev.hora, 0); 
      
      embed.addFields({
        name: `🔔 ${ev.evento}`,
        value: `Hora: <t:${ts}:t> | <t:${ts}:R>`,
        inline: true,
      });
    });
  }

  let diaExtra = 0;
  let ultimaHoraProcesada = -1;

  const textoTimeline = hoy.timeline.map(e => {
    if (e.hora < ultimaHoraProcesada) {
      diaExtra++;
    }
    ultimaHoraProcesada = e.hora;

    const ts = getUnixTimestamp(e.hora, diaExtra);
    return `<t:${ts}:t> — ${e.texto}`;
  }).join("\n");

  embed.addFields(
    { name: "🕒 Cronología del tiempo", value: textoTimeline, inline: false },
    {
      name: "📅 Próximos días",
      value: "```\n" + CLIMA_PUEBLO.proximos.map(d => `${d.dia.padEnd(10)} | ${d.clima}`).join("\n") + "\n```",
      inline: false,
    },
  );

  embed.setFooter({ text: "☀️ Pronóstico hecho con mucho amor | Disfruta el clima, vecino!" });
  
  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdHelp(int, bostezo) {
  const embed = crearEmbed(CONFIG.COLORES.ROSA)
    .setThumbnail(CONFIG.ANNIE_IMG_BIG || CONFIG.ANNIE_IMG)
    .setTitle("\uD83C\uDF38 Oficinita dulce de Annie \uD83C\uDF38")
    .setDescription(
      estaDurmiendo()
        ? "*(Bosteza suave y se frota los ojitos)*\nZzz... Hola corazoncito, soy Annie. Aunque este medio dormidita, aqui tienes mi libretita de ayuda con mucho carino."
        : `Wena, ${getTrato()}!\nSoy **Annie**, la carterita del pueblito. Entre repartos y chismecitos, aqui te dejo mis cositas para ayudarte.`
    )
    .addFields(
      {
        name: "\uD83D\uDCB0 Utilidad",
        value:
          "`/recordar` <tiempo> <msg> \u2014 Te aviso con carino.\n" +
          "`/clima` \u2014 Pronostico del pueblito.",
        inline: false,
      },
      {
        name: "\uD83D\uDCD6 Enciclopedia del Pueblo",
        value:
          "```\n/peces       /insectos    /aves\n/animales    /cultivos    /recolectables\n/recetas     /habitantes  /logros\n/codigos```\n" +
          "Usa `<nombre>` o `todos` despues de cada comando.",
        inline: false,
      },
      {
        name: "\uD83C\uDF08 Comunidad",
        value:
          "Roles: Reacciona en el canal de roles.\n" +
          "Voz: Entra a mi oficina y pasare a saludarte!\n" +
          "`/wiki` \u2014 Enlace a la wiki completa.",
        inline: false,
      },
      {
        name: "\u23F0 Horarios de Annie",
        value:
          "\uD83D\uDCA4 Sueno: 23:00 - 08:00 (Chile)\n" +
          "\u2601\uFE0F Boletin del clima: 19:00 cada dia",
        inline: true,
      },
    )
    .setFooter({
      text: `Annie v2.0 | ${estaDurmiendo() ? "\uD83D\uDCA4 Zzz... suenen bonito" : "\uD83C\uDF38 Hecho con amor para Heartopia"}`,
      iconURL: int.guild?.iconURL() ?? undefined,
    })
    .setTimestamp();

  return int.reply({ content: bostezo, embeds: [embed] });
}

async function cmdWiki(int, bostezo) {
  const embed = crearEmbed(CONFIG.COLORES.ROSA)
    .setTitle("\uD83D\uDCD6 Wiki de Heartopia \u2764\uFE0F")
    .setDescription(`Aqui tienes el enlace a la wiki completa del pueblito, corazon.\n\n**${CONFIG.WIKI_URL}**\n\nToda la informacion esta ahi, organizada con carino por Annie y los vecinos.`);
  agregarNarrativa(embed, "general");
  return int.reply({ content: bostezo, embeds: [embed] });
}

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
    .setTitle("\uD83C\uDF08 Oficinita de Annie \u2014 Elige tus roles con carino, vecino!")
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
