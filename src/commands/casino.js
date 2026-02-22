import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { obtenerEstadisticasCasino, obtenerTopCasino, obtenerBalance } from "../casino.js";

export const data = new SlashCommandBuilder()
  .setName("casino")
  .setDescription("🎰 Casino de Heartopia")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("menu")
      .setDescription("Ver menú principal del casino")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stats")
      .setDescription("Ver tus estadísticas del casino")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("top")
      .setDescription("Ver el top de ganadores del casino")
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "menu") {
    return await mostrarMenu(interaction);
  } else if (subcommand === "stats") {
    return await mostrarStats(interaction);
  } else if (subcommand === "top") {
    return await mostrarTop(interaction);
  }
}

async function mostrarMenu(interaction) {
  const userId = interaction.user.id;
  const balance = await obtenerBalance(userId);

  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🎰 Casino de Heartopia 🎰")
    .setDescription(
      "¡Bienvenido al casino! Elige tu juego favorito:\n\n" +
      "🎰 **Slots** - Máquina tragamonedas con jackpots\n" +
      "🎡 **Ruleta** - Ruleta europea clásica\n" +
      "🪙 **Coinflip** - Cara o cruz simple\n" +
      "🃏 **Blackjack** - Vence a la casa en 21\n\n" +
      "📊 **Stats** - Ver tus estadísticas\n" +
      "🏆 **Top** - Ver los mejores jugadores\n\n" +
      `💰 Tu balance: **${balance}** monedas\n` +
      `💵 Apuestas: **50** - **50,000** monedas\n` +
      `⏱️ Cooldown: **8 segundos** entre apuestas`
    )
    .setFooter({ text: "¡Juega responsablemente! 🎲" })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("casino_game_slots")
      .setLabel("🎰 Slots")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("casino_game_ruleta")
      .setLabel("🎡 Ruleta")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("casino_game_coinflip")
      .setLabel("🪙 Coinflip")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("casino_game_blackjack")
      .setLabel("🃏 Blackjack")
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("casino_stats")
      .setLabel("📊 Mis Stats")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("casino_top")
      .setLabel("🏆 Top Ganadores")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
  });
}

async function mostrarStats(interaction) {
  const userId = interaction.user.id;
  const stats = await obtenerEstadisticasCasino(userId);
  const balance = await obtenerBalance(userId);

  const totalPartidas = stats.wins + stats.losses;
  const winRate = totalPartidas > 0 ? ((stats.wins / totalPartidas) * 100).toFixed(1) : 0;

  const embed = new EmbedBuilder()
    .setColor("#00BFFF")
    .setTitle(`📊 Estadísticas del Casino`)
    .setDescription(`Jugador: <@${userId}>`)
    .addFields(
      { name: "✅ Victorias", value: `${stats.wins}`, inline: true },
      { name: "❌ Derrotas", value: `${stats.losses}`, inline: true },
      { name: "📈 Win Rate", value: `${winRate}%`, inline: true },
      { name: "💰 Total Apostado", value: `${stats.total_betted} monedas`, inline: true },
      { name: "💎 Ganancia Neta", value: `${stats.net_winnings >= 0 ? '+' : ''}${stats.net_winnings} monedas`, inline: true },
      { name: "💰 Balance Actual", value: `${balance} monedas`, inline: true }
    )
    .setFooter({ text: "¡Sigue jugando para mejorar tus estadísticas!" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function mostrarTop(interaction) {
  const topJugadores = await obtenerTopCasino(10);

  if (topJugadores.length === 0) {
    return interaction.reply({
      content: "📊 Aún no hay jugadores en el ranking del casino",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor("#FFD700")
    .setTitle("🏆 Top Ganadores del Casino 🏆")
    .setDescription("Los 10 jugadores con mayor ganancia neta:\n");

  let descripcion = "";
  for (let i = 0; i < topJugadores.length; i++) {
    const jugador = topJugadores[i];
    const medalla = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
    const winRate = ((jugador.wins / (jugador.wins + jugador.losses)) * 100).toFixed(1);
    
    descripcion += `${medalla} <@${jugador.userId}>\n`;
    descripcion += `💎 **${jugador.netWinnings >= 0 ? '+' : ''}${jugador.netWinnings}** monedas | `;
    descripcion += `${jugador.wins}W-${jugador.losses}L (${winRate}%)\n\n`;
  }

  embed.setDescription(descripcion);
  embed.setFooter({ text: "¡Juega para subir en el ranking!" });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Handler para los botones del menú
export async function handleCasinoButton(interaction) {
  const action = interaction.customId.replace("casino_", "");

  if (action === "stats") {
    return await mostrarStats(interaction);
  } else if (action === "top") {
    return await mostrarTop(interaction);
  } else if (action.startsWith("game_")) {
    const juego = action.replace("game_", "");
    const mensajes = {
      slots: "Usa el comando `/slots [apuesta]` para jugar a las tragamonedas 🎰",
      ruleta: "Usa el comando `/ruleta [apuesta] [tipo]` para jugar a la ruleta 🎡",
      coinflip: "Usa el comando `/coinflip [apuesta] [lado]` para jugar al coinflip 🪙",
      blackjack: "Usa el comando `/blackjack [apuesta]` para jugar al blackjack 🃏",
    };

    await interaction.reply({
      content: mensajes[juego] || "Juego no disponible",
      ephemeral: true,
    });
  }
}
