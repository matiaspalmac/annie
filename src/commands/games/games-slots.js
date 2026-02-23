import { SlashCommandBuilder, MessageFlags } from "discord.js";
import {
  validarApuesta,
  verificarCooldownCasino,
  actualizarCooldownCasino,
  obtenerBalance,
  actualizarBalance,
  actualizarEstadisticasCasino,
  CASINO_MIN_BET,
  CASINO_MAX_BET,
} from "../../features/casino.js";
import { getBostezo } from "../../core/utils.js";

// Símbolos de la tragamonedas con sus pesos (más común = mayor peso)
const SIMBOLOS = [
  { emoji: "🍒", peso: 40 },
  { emoji: "🍋", peso: 30 },
  { emoji: "🍉", peso: 20 },
  { emoji: "⭐", peso: 8 },
  { emoji: "💎", peso: 2 },
];

// Multiplicadores según combinaciones
const MULTIPLICADORES = {
  "💎💎💎": 50,  // Jackpot
  "⭐⭐⭐": 10,
  "🍉🍉🍉": 5,
  "🍋🍋🍋": 3,
  "🍒🍒🍒": 2,
};

function obtenerSimboloAleatorio() {
  const pesoTotal = SIMBOLOS.reduce((sum, s) => sum + s.peso, 0);
  let random = Math.random() * pesoTotal;
  
  for (const simbolo of SIMBOLOS) {
    random -= simbolo.peso;
    if (random <= 0) {
      return simbolo.emoji;
    }
  }
  return SIMBOLOS[0].emoji;
}

function calcularGanancia(reels, apuesta) {
  const combinacion = reels.join("");
  
  // Verificar si los 3 símbolos son iguales
  if (combinacion in MULTIPLICADORES) {
    return Math.floor(apuesta * MULTIPLICADORES[combinacion]);
  }
  
  // Sin premio
  return 0;
}

export const data = new SlashCommandBuilder()
  .setName("slots")
  .setDescription("🎰 Juega a la máquina tragamonedas")
  .addIntegerOption((option) =>
    option
      .setName("apuesta")
      .setDescription(`Cantidad a apostar (${CASINO_MIN_BET}-${CASINO_MAX_BET})`)
      .setRequired(true)
      .setMinValue(CASINO_MIN_BET)
      .setMaxValue(CASINO_MAX_BET)
  );

export async function execute(interaction, bostezo) {
  const apuesta = interaction.options.getInteger("apuesta");
  const userId = interaction.user.id;
  
  if (!bostezo) bostezo = getBostezo();

  // Validar apuesta
  const validacion = validarApuesta(apuesta);
  if (!validacion.ok) {
    return interaction.reply({ content: validacion.mensaje, flags: MessageFlags.Ephemeral });
  }

  // Verificar cooldown
  const cooldown = await verificarCooldownCasino(userId);
  if (!cooldown.ok) {
    return interaction.reply({ content: cooldown.mensaje, flags: MessageFlags.Ephemeral });
  }

  // Verificar balance
  const balanceActual = await obtenerBalance(userId);
  if (balanceActual < apuesta) {
    return interaction.reply({
      content: `${bostezo}❌ No tienes suficientes moneditas, tesoro. Balance actual: **${balanceActual}** 💰`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Actualizar cooldown
  await actualizarCooldownCasino(userId);

  // Mostrar animación inicial
  await interaction.reply({
    content: `🎰 **Girando las ruletas...** 🎰\n💰 Balance actual: **${balanceActual}**`,
  });

  // Primera fase: mostrar símbolos aleatorios girando
  await new Promise((resolve) => setTimeout(resolve, 800));
  await interaction.editReply({
    content: `🎰 **Girando...** 🎰\n\n🎲 🎲 🎲\n\n💰 Balance actual: **${balanceActual}**`,
  });

  // Segunda fase: detener primer reel
  await new Promise((resolve) => setTimeout(resolve, 600));
  const reel1 = obtenerSimboloAleatorio();
  await interaction.editReply({
    content: `🎰 **Girando...** 🎰\n\n${reel1} 🎲 🎲\n\n💰 Balance actual: **${balanceActual}**`,
  });

  // Tercera fase: detener segundo reel
  await new Promise((resolve) => setTimeout(resolve, 600));
  const reel2 = obtenerSimboloAleatorio();
  await interaction.editReply({
    content: `🎰 **Girando...** 🎰\n\n${reel1} ${reel2} 🎲\n\n💰 Balance actual: **${balanceActual}**`,
  });

  // Cuarta fase: detener tercer reel y mostrar resultado
  await new Promise((resolve) => setTimeout(resolve, 600));
  const reel3 = obtenerSimboloAleatorio();
  const reels = [reel1, reel2, reel3];
  const ganancia = calcularGanancia(reels, apuesta);
  const gano = ganancia > 0;
  const nuevoBalance = balanceActual - apuesta + ganancia;

  // Actualizar balance
  await actualizarBalance(userId, nuevoBalance);

  // Actualizar estadísticas
  await actualizarEstadisticasCasino(userId, gano, apuesta, ganancia);

  // Mensaje de resultado
  const combinacion = reels.join("");
  const multiplicador = combinacion in MULTIPLICADORES ? MULTIPLICADORES[combinacion] : 0;

  if (gano) {
    let mensaje = `🎰 **RESULTADO** 🎰\n\n${reel1} ${reel2} ${reel3}\n\n`;
    
    if (multiplicador === 50) {
      mensaje += `💎 **¡¡¡JACKPOT!!!** 💎\n`;
    } else if (multiplicador >= 10) {
      mensaje += `⭐ **¡GRAN PREMIO!** ⭐\n`;
    } else {
      mensaje += `✨ **¡Ganaste!** ✨\n`;
    }
    
    mensaje += `🎉 Multiplicador: **x${multiplicador}**\n`;
    mensaje += `💰 Has ganado **${ganancia}** monedas\n\n`;
    mensaje += `💰 Balance anterior: **${balanceActual}**\n`;
    mensaje += `💰 Balance actual: **${nuevoBalance}** (+${ganancia - apuesta})`;
    
    await interaction.editReply({ content: mensaje });
  } else {
    await interaction.editReply({
      content: `🎰 **RESULTADO** 🎰\n\n${reel1} ${reel2} ${reel3}\n\n` +
        `😔 **Sin premio** - Has perdido **${apuesta}** 💰\n\n` +
        `💰 Balance anterior: **${balanceActual}**\n` +
        `💰 Balance actual: **${nuevoBalance}** (-${apuesta})`,
    });
  }
}
