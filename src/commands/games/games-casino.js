import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { obtenerEstadisticasCasino, obtenerTopCasino, obtenerBalance } from "../../features/casino.js";
import { crearEmbed, getBostezo } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";

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

export async function execute(interaction, bostezo) {
  const subcommand = interaction.options.getSubcommand();
  
  if (!bostezo) bostezo = getBostezo();

  if (subcommand === "menu") {
    return await mostrarMenu(interaction, bostezo);
  } else if (subcommand === "stats") {
    return await mostrarStats(interaction, bostezo);
  } else if (subcommand === "top") {
    return await mostrarTop(interaction, bostezo);
  }
}

async function mostrarMenu(interaction, bostezo) {
  const userId = interaction.user.id;
  const balance = await obtenerBalance(userId);

  const embed = crearEmbed()
    .setColor(CONFIG.COLOR)
    .setTitle("🎰 Casino de Heartopia 🎰")
    .setDescription(
      `${bostezo} ¡Bienvenido al casino, tesoro! Elige tu juego favorito, corazón:\n\n` +
      "🎰 **Slots** - Máquina tragamonedas con jackpots\n" +
      "🎡 **Ruleta** - Ruleta europea clásica\n" +
      "🪙 **Coinflip** - Cara o cruz simple\n" +
      "🃏 **Blackjack** - Vence a la casa en 21\n\n" +
      "📊 **Stats** - Ver tus estadísticas\n" +
      "🏆 **Top** - Ver los mejores jugadores\n\n" +
      `💰 Tu balance: **${balance}** moneditas\n` +
      `💵 Apuestas: **50** - **50,000** moneditas\n` +
      `⏱️ Cooldown: **8 segundos** entre apuestas`
    )
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

async function mostrarStats(interaction, bostezo) {
  const userId = interaction.user.id;
  const stats = await obtenerEstadisticasCasino(userId);
  const balance = await obtenerBalance(userId);

  const totalPartidas = stats.wins + stats.losses;
  const winRate = totalPartidas > 0 ? ((stats.wins / totalPartidas) * 100).toFixed(1) : 0;

  const embed = crearEmbed()
    .setColor(CONFIG.COLOR)
    .setTitle(`📊 Estadísticas del Casino`)
    .setDescription(`${bostezo} Aquí están tus números, ${interaction.user.username}:\n\nJugador: <@${userId}>`)
    .addFields(
      { name: "✅ Victorias", value: `${stats.wins}`, inline: true },
      { name: "❌ Derrotas", value: `${stats.losses}`, inline: true },
      { name: "📈 Win Rate", value: `${winRate}%`, inline: true },
      { name: "💰 Total Apostado", value: `${stats.total_betted} moneditas`, inline: true },
      { name: "💎 Ganancia Neta", value: `${stats.net_winnings >= 0 ? '+' : ''}${stats.net_winnings} moneditas`, inline: true },
      { name: "💰 Balance Actual", value: `${balance} moneditas`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function mostrarTop(interaction, bostezo) {
  const topJugadores = await obtenerTopCasino(10);

  if (topJugadores.length === 0) {
    return interaction.reply({
      content: `${bostezo} Aún no hay jugadores en el ranking del casino, tesoro. ¡Sé el primero! 🎰`,
      ephemeral: true,
    });
  }

  const embed = crearEmbed()
    .setColor(CONFIG.COLOR)
    .setTitle("🏆 Top Ganadores del Casino 🏆")
    .setDescription(`${bostezo} Estos son los mejores del casino, corazón:\n\nLos 10 jugadores con mayor ganancia neta:\n`);

  let descripcion = embed.data.description;
  for (let i = 0; i < topJugadores.length; i++) {
    const jugador = topJugadores[i];
    const medalla = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
    const winRate = ((jugador.wins / (jugador.wins + jugador.losses)) * 100).toFixed(1);
    
    descripcion += `${medalla} <@${jugador.userId}>\n`;
    descripcion += `💎 **${jugador.netWinnings >= 0 ? '+' : ''}${jugador.netWinnings}** moneditas | `;
    descripcion += `${jugador.wins}W-${jugador.losses}L (${winRate}%)\n\n`;
  }

  embed.setDescription(descripcion);
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Handler para los botones del menú
export async function handleCasinoButton(interaction) {
  const action = interaction.customId.replace("casino_", "");
  const bostezo = getBostezo();

  if (action === "stats") {
    return await mostrarStats(interaction, bostezo);
  } else if (action === "top") {
    return await mostrarTop(interaction, bostezo);
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
