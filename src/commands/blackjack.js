import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import {
  validarApuesta,
  verificarCooldownCasino,
  actualizarCooldownCasino,
  obtenerBalance,
  actualizarBalance,
  actualizarEstadisticasCasino,
  CASINO_MIN_BET,
  CASINO_MAX_BET,
} from "../casino.js";

// Mapas de emojis para las cartas
const PALOS = ["♠️", "♥️", "♦️", "♣️"];
const VALORES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

class Mazo {
  constructor() {
    this.cartas = [];
    for (const palo of PALOS) {
      for (const valor of VALORES) {
        this.cartas.push({ valor, palo });
      }
    }
    this.mezclar();
  }

  mezclar() {
    for (let i = this.cartas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cartas[i], this.cartas[j]] = [this.cartas[j], this.cartas[i]];
    }
  }

  repartir() {
    return this.cartas.pop();
  }
}

function obtenerValorCarta(valor) {
  if (valor === "A") return 11;
  if (["J", "Q", "K"].includes(valor)) return 10;
  return parseInt(valor);
}

function calcularMano(cartas) {
  let suma = 0;
  let ases = 0;

  for (const carta of cartas) {
    const valor = obtenerValorCarta(carta.valor);
    suma += valor;
    if (carta.valor === "A") ases++;
  }

  // Ajustar ases si es necesario
  while (suma > 21 && ases > 0) {
    suma -= 10;
    ases--;
  }

  return suma;
}

function formatearCartas(cartas, ocultarPrimera = false) {
  return cartas
    .map((carta, i) => {
      if (ocultarPrimera && i === 0) return "🎴";
      return `${carta.valor}${carta.palo}`;
    })
    .join(" ");
}

// Almacenar partidas activas
const partidasActivas = new Map();

export const data = new SlashCommandBuilder()
  .setName("blackjack")
  .setDescription("🃏 Juega Blackjack contra la casa")
  .addIntegerOption((option) =>
    option
      .setName("apuesta")
      .setDescription(`Cantidad a apostar (${CASINO_MIN_BET}-${CASINO_MAX_BET})`)
      .setRequired(true)
      .setMinValue(CASINO_MIN_BET)
      .setMaxValue(CASINO_MAX_BET)
  );

export async function execute(interaction) {
  const apuesta = interaction.options.getInteger("apuesta");
  const userId = interaction.user.id;

  // Validar apuesta
  const validacion = validarApuesta(apuesta);
  if (!validacion.ok) {
    return interaction.reply({ content: validacion.mensaje, ephemeral: true });
  }

  // Verificar cooldown
  const cooldown = await verificarCooldownCasino(userId);
  if (!cooldown.ok) {
    return interaction.reply({ content: cooldown.mensaje, ephemeral: true });
  }

  // Verificar si ya tiene una partida activa
  if (partidasActivas.has(userId)) {
    return interaction.reply({
      content: "❌ Ya tienes una partida activa de Blackjack",
      ephemeral: true,
    });
  }

  // Verificar balance
  const balanceActual = await obtenerBalance(userId);
  if (balanceActual < apuesta) {
    return interaction.reply({
      content: `❌ No tienes suficientes monedas. Balance actual: **${balanceActual}** 💰`,
      ephemeral: true,
    });
  }

  // Actualizar cooldown
  await actualizarCooldownCasino(userId);

  // Iniciar partida
  const mazo = new Mazo();
  const manoJugador = [mazo.repartir(), mazo.repartir()];
  const manoCasa = [mazo.repartir(), mazo.repartir()];

  // Guardar estado de la partida
  partidasActivas.set(userId, {
    mazo,
    manoJugador,
    manoCasa,
    apuesta,
    balanceActual,
  });

  const valorJugador = calcularMano(manoJugador);
  const valorCasaVisible = obtenerValorCarta(manoCasa[1].valor);

  // Verificar Blackjack natural
  if (valorJugador === 21) {
    return await finalizarPartida(interaction, userId, "blackjack");
  }

  // Botones de acción
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`blackjack_hit_${userId}`)
      .setLabel("🎴 Pedir Carta")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`blackjack_stand_${userId}`)
      .setLabel("✋ Plantarse")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: `🃏 **BLACKJACK** 🃏\n\n` +
      `💰 Balance actual: **${balanceActual}**\n` +
      `💰 Apuesta: **${apuesta}**\n\n` +
      `**Tu mano:** ${formatearCartas(manoJugador)} = **${valorJugador}**\n` +
      `**Casa:** ${formatearCartas(manoCasa, true)} = **${valorCasaVisible}+?**\n\n` +
      `¿Qué deseas hacer?`,
    components: [row],
  });

  // Timeout de 60 segundos
  setTimeout(() => {
    if (partidasActivas.has(userId)) {
      finalizarPartida(interaction, userId, "timeout");
    }
  }, 60000);
}

export async function handleBlackjackButton(interaction) {
  const [, action, userId] = interaction.customId.split("_");

  // Verificar que sea el jugador correcto
  if (interaction.user.id !== userId) {
    return interaction.reply({
      content: "❌ Esta no es tu partida",
      ephemeral: true,
    });
  }

  const partida = partidasActivas.get(userId);
  if (!partida) {
    return interaction.update({
      content: "❌ Esta partida ya finalizó",
      components: [],
    });
  }

  if (action === "hit") {
    // Pedir carta
    const nuevaCarta = partida.mazo.repartir();
    partida.manoJugador.push(nuevaCarta);
    const valorJugador = calcularMano(partida.manoJugador);

    // Verificar si se pasó de 21
    if (valorJugador > 21) {
      return await finalizarPartida(interaction, userId, "bust");
    }

    // Actualizar mensaje con nueva carta
    const valorCasaVisible = obtenerValorCarta(partida.manoCasa[1].valor);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`blackjack_hit_${userId}`)
        .setLabel("🎴 Pedir Carta")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`blackjack_stand_${userId}`)
        .setLabel("✋ Plantarse")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
      content: `🃏 **BLACKJACK** 🃏\n\n` +
        `💰 Balance actual: **${partida.balanceActual}**\n` +
        `💰 Apuesta: **${partida.apuesta}**\n\n` +
        `**Tu mano:** ${formatearCartas(partida.manoJugador)} = **${valorJugador}**\n` +
        `**Casa:** ${formatearCartas(partida.manoCasa, true)} = **${valorCasaVisible}+?**\n\n` +
        `¿Qué deseas hacer?`,
      components: [row],
    });
  } else if (action === "stand") {
    // Plantarse - juega la casa
    return await finalizarPartida(interaction, userId, "stand");
  }
}

async function finalizarPartida(interaction, userId, tipo) {
  const partida = partidasActivas.get(userId);
  if (!partida) return;

  const { manoJugador, manoCasa, mazo, apuesta, balanceActual } = partida;
  let valorJugador = calcularMano(manoJugador);
  let valorCasa = calcularMano(manoCasa);

  // Si el jugador se plantó o tiene blackjack, la casa juega
  if (tipo === "stand" || tipo === "blackjack") {
    // La casa pide cartas hasta tener 17 o más
    while (valorCasa < 17) {
      manoCasa.push(mazo.repartir());
      valorCasa = calcularMano(manoCasa);
    }
  }

  // Determinar ganador
  let resultado = "";
  let gano = false;
  let ganancia = 0;
  let multiplicador = 0;

  if (tipo === "timeout") {
    resultado = "⏱️ **Tiempo agotado** - Se te ha plantado automáticamente";
    if (valorCasa > 21 || valorJugador > valorCasa) {
      gano = true;
      multiplicador = 2;
      ganancia = apuesta * multiplicador;
      resultado += "\n✨ **¡Ganaste!**";
    } else if (valorJugador === valorCasa) {
      resultado += "\n🤝 **Empate**";
      ganancia = apuesta;
    } else {
      resultado += "\n😔 **Perdiste**";
    }
  } else if (tipo === "bust") {
    resultado = "💥 **¡Te pasaste de 21!**\n😔 **Perdiste**";
    gano = false;
  } else if (tipo === "blackjack" && valorCasa !== 21) {
    resultado = "🎯 **¡BLACKJACK!** 🎯\n✨ **¡Ganaste!**";
    gano = true;
    multiplicador = 2.5;
    ganancia = Math.floor(apuesta * multiplicador);
  } else if (valorJugador > 21) {
    resultado = "💥 **¡Te pasaste de 21!**\n😔 **Perdiste**";
    gano = false;
  } else if (valorCasa > 21) {
    resultado = "💥 **¡La casa se pasó de 21!**\n✨ **¡Ganaste!**";
    gano = true;
    multiplicador = 2;
    ganancia = apuesta * multiplicador;
  } else if (valorJugador > valorCasa) {
    resultado = "✨ **¡Ganaste!**";
    gano = true;
    multiplicador = 2;
    ganancia = apuesta * multiplicador;
  } else if (valorJugador === valorCasa) {
    resultado = "🤝 **Empate** - Recuperas tu apuesta";
    ganancia = apuesta;
  } else {
    resultado = "😔 **Perdiste**";
    gano = false;
  }

  const nuevoBalance = balanceActual - apuesta + ganancia;

  // Actualizar balance
  await actualizarBalance(userId, nuevoBalance);

  // Actualizar estadísticas (empate no cuenta como win ni loss)
  if (valorJugador !== valorCasa) {
    await actualizarEstadisticasCasino(userId, gano, apuesta, ganancia);
  }

  // Mensaje final
  let mensaje = `🃏 **RESULTADO FINAL** 🃏\n\n` +
    `**Tu mano:** ${formatearCartas(manoJugador)} = **${valorJugador}**\n` +
    `**Casa:** ${formatearCartas(manoCasa)} = **${valorCasa}**\n\n` +
    `${resultado}\n\n`;

  if (gano) {
    mensaje += `💰 Has ganado **${ganancia}** monedas\n`;
  } else if (valorJugador === valorCasa) {
    mensaje += `💰 Apuesta devuelta: **${apuesta}** monedas\n`;
  } else {
    mensaje += `💰 Has perdido **${apuesta}** monedas\n`;
  }

  mensaje += `💰 Balance anterior: **${balanceActual}**\n`;
  mensaje += `💰 Balance actual: **${nuevoBalance}** `;
  
  if (gano) {
    mensaje += `(+${ganancia - apuesta})`;
  } else if (valorJugador === valorCasa) {
    mensaje += `(±0)`;
  } else {
    mensaje += `(-${apuesta})`;
  }

  // Actualizar o responder según el tipo de interacción
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      content: mensaje,
      components: [],
    });
  } else {
    await interaction.update({
      content: mensaje,
      components: [],
    });
  }

  // Limpiar partida
  partidasActivas.delete(userId);
}
