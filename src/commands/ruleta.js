import { SlashCommandBuilder } from "discord.js";
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
import { getBostezo } from "../utils.js";

// Números rojos y negros en ruleta europea
const ROJOS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const NEGROS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function obtenerColorNumero(numero) {
  if (numero === 0) return "verde";
  if (ROJOS.includes(numero)) return "rojo";
  if (NEGROS.includes(numero)) return "negro";
  return "verde";
}

function obtenerEmojiColor(color) {
  if (color === "rojo") return "🔴";
  if (color === "negro") return "⚫";
  return "🟢";
}

export const data = new SlashCommandBuilder()
  .setName("ruleta")
  .setDescription("🎡 Juega a la ruleta europea")
  .addIntegerOption((option) =>
    option
      .setName("apuesta")
      .setDescription(`Cantidad a apostar (${CASINO_MIN_BET}-${CASINO_MAX_BET})`)
      .setRequired(true)
      .setMinValue(CASINO_MIN_BET)
      .setMaxValue(CASINO_MAX_BET)
  )
  .addStringOption((option) =>
    option
      .setName("tipo")
      .setDescription("Tipo de apuesta")
      .setRequired(true)
      .addChoices(
        { name: "🔴 Rojo", value: "rojo" },
        { name: "⚫ Negro", value: "negro" },
        { name: "🔢 Par", value: "par" },
        { name: "🔢 Impar", value: "impar" },
        { name: "🎯 Número específico (0-36)", value: "numero" }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName("numero")
      .setDescription("Número específico (solo si elegiste 'Número específico')")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(36)
  );

export async function execute(interaction, bostezo) {
  const apuesta = interaction.options.getInteger("apuesta");
  const tipo = interaction.options.getString("tipo");
  const numeroElegido = interaction.options.getInteger("numero");
  const userId = interaction.user.id;
  
  if (!bostezo) bostezo = getBostezo();

  // Validar que si eligió "numero", debe proporcionar el número
  if (tipo === "numero" && numeroElegido === null) {
    return interaction.reply({
      content: "❌ Debes especificar el número cuando eliges 'Número específico'",
      ephemeral: true,
    });
  }

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

  // Verificar balance
  const balanceActual = await obtenerBalance(userId);
  if (balanceActual < apuesta) {
    return interaction.reply({
      content: `${bostezo}❌ No tienes suficientes moneditas, corazón. Balance actual: **${balanceActual}** 💰`,
      ephemeral: true,
    });
  }

  // Actualizar cooldown
  await actualizarCooldownCasino(userId);

  // Mostrar animación
  let tipoApuestaTexto = "";
  if (tipo === "rojo") tipoApuestaTexto = "🔴 Rojo";
  else if (tipo === "negro") tipoApuestaTexto = "⚫ Negro";
  else if (tipo === "par") tipoApuestaTexto = "🔢 Par";
  else if (tipo === "impar") tipoApuestaTexto = "🔢 Impar";
  else if (tipo === "numero") tipoApuestaTexto = `🎯 Número ${numeroElegido}`;

  await interaction.reply({
    content: `🎡 **Girando la ruleta...** 🎡\n` +
      `📍 Apuesta: ${tipoApuestaTexto}\n` +
      `💰 Balance actual: **${balanceActual}**`,
  });

  // Esperar 2.5 segundos para la animación
  await new Promise((resolve) => setTimeout(resolve, 2500));

  // Generar número aleatorio (0-36)
  const numeroSalido = Math.floor(Math.random() * 37);
  const colorSalido = obtenerColorNumero(numeroSalido);
  const esPar = numeroSalido !== 0 && numeroSalido % 2 === 0;
  const emojiColor = obtenerEmojiColor(colorSalido);

  // Determinar si ganó
  let gano = false;
  let multiplicador = 0;

  switch (tipo) {
    case "rojo":
      gano = colorSalido === "rojo";
      multiplicador = 2;
      break;
    case "negro":
      gano = colorSalido === "negro";
      multiplicador = 2;
      break;
    case "par":
      gano = esPar;
      multiplicador = 2;
      break;
    case "impar":
      gano = numeroSalido !== 0 && !esPar;
      multiplicador = 2;
      break;
    case "numero":
      gano = numeroSalido === numeroElegido;
      multiplicador = 35;
      break;
  }

  const ganancia = gano ? Math.floor(apuesta * multiplicador) : 0;
  const nuevoBalance = balanceActual - apuesta + ganancia;

  // Actualizar balance
  await actualizarBalance(userId, nuevoBalance);

  // Actualizar estadísticas
  await actualizarEstadisticasCasino(userId, gano, apuesta, ganancia);

  // Mensaje de resultado
  if (gano) {
    let mensajeExtra = "";
    if (tipo === "numero") {
      mensajeExtra = " 🎯 ¡Acertaste el número!";
    }

    await interaction.editReply({
      content: `🎡 **RESULTADO** 🎡\n\n` +
        `${emojiColor} **${numeroSalido}** (${colorSalido.toUpperCase()})${mensajeExtra}\n\n` +
        `✨ **¡Ganaste!** Has ganado **${ganancia}** 💰\n` +
        `🎉 Multiplicador: **x${multiplicador}**\n\n` +
        `💰 Balance anterior: **${balanceActual}**\n` +
        `💰 Balance actual: **${nuevoBalance}** (+${ganancia - apuesta})`,
    });
  } else {
    await interaction.editReply({
      content: `🎡 **RESULTADO** 🎡\n\n` +
        `${emojiColor} **${numeroSalido}** (${colorSalido.toUpperCase()})\n\n` +
        `😔 Has perdido **${apuesta}** 💰\n\n` +
        `💰 Balance anterior: **${balanceActual}**\n` +
        `💰 Balance actual: **${nuevoBalance}** (-${apuesta})`,
    });
  }
}
