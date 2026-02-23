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
} from "../../features/casino.js";
import { getBostezo } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
  .setName("coinflip")
  .setDescription("🪙 Apuesta en cara o cruz")
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
      .setName("lado")
      .setDescription("Elige cara o cruz")
      .setRequired(true)
      .addChoices(
        { name: "🪙 Cara", value: "cara" },
        { name: "🌀 Cruz", value: "cruz" }
      )
  );

export async function execute(interaction, bostezo) {
  const apuesta = interaction.options.getInteger("apuesta");
  const lado = interaction.options.getString("lado");
  const userId = interaction.user.id;
  
  if (!bostezo) bostezo = getBostezo();

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
  await interaction.reply({
    content: `🪙 **Lanzando la moneda...** 🌀\n💰 Balance actual: **${balanceActual}**`,
  });

  // Esperar 2 segundos para dramatismo
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Determinar resultado
  const resultado = Math.random() < 0.5 ? "cara" : "cruz";
  const gano = resultado === lado;
  const multiplicador = 1.95;
  const ganancia = gano ? Math.floor(apuesta * multiplicador) : 0;
  const nuevoBalance = balanceActual - apuesta + ganancia;

  // Actualizar balance
  await actualizarBalance(userId, nuevoBalance);

  // Actualizar estadísticas
  await actualizarEstadisticasCasino(userId, gano, apuesta, ganancia);

  // Mensaje de resultado
  const emoji = resultado === "cara" ? "🪙" : "🌀";
  const nombreResultado = resultado === "cara" ? "Cara" : "Cruz";

  if (gano) {
    await interaction.editReply({
      content: `${emoji} **¡${nombreResultado}!** ✅\n\n` +
        `✨ **¡Ganaste, tesoro!** Has ganado **${ganancia}** 💰\n\n` +
        `💰 Balance anterior: **${balanceActual}**\n` +
        `💰 Balance actual: **${nuevoBalance}** (+${ganancia - apuesta})`,
    });
  } else {
    await interaction.editReply({
      content: `${emoji} **¡${nombreResultado}!** ❌\n\n` +
        `😔 Has perdido **${apuesta}** 💰, pero la suerte cambia\n\n` +
        `💰 Balance anterior: **${balanceActual}**\n` +
        `💰 Balance actual: **${nuevoBalance}** (-${apuesta})`,
    });
  }
}
