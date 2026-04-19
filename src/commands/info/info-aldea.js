import { SlashCommandBuilder } from "discord.js";
import { crearEmbed } from "../../core/utils.js";

export const data = new SlashCommandBuilder()
  .setName("aldea")
  .setDescription("Tour rápido por la Aldea Luciérnaga 🏡");

export async function execute(interaction) {
  const embed = crearEmbed("#F7D774")
    .setTitle("🏡 Bienvenid@ a la Aldea Luciérnaga")
    .setDescription(
      "Aquí el tiempo va lento, las estrellas conceden deseos y las luciérnagas guían el camino 🪷\n\n" +
      "**¿Dónde está qué?**\n" +
      "🕯️ **El Faro** — bienvenidas, normas, anuncios, roles, eventos\n" +
      "🌺 **La Plaza Central** — charla general, multimedia, mascotas, foto-del-día, arte, highlights\n" +
      "🎀 **Heartopia** — todo lo del juego (rotaciones, códigos, player cards, guías)\n" +
      "🌿 **Los Jardines** — otros cozy games (Stardew, AC, Palia, Dreamlight, Hello Kitty Island)\n" +
      "🔊 **La Fogata** — salas de voz, stage de eventos y ASMR\n\n" +
      "**Comandos clave de Annie:**\n" +
      "• `/perfil` — tu progreso, nivel y moneditas\n" +
      "• `/diario` — regalito diario\n" +
      "• `/tienda` — comprar colores, mascotas, temas\n" +
      "• `/cumple guardar fecha:DD-MM` — agenda tu cumple\n" +
      "• `/help` — ver todos mis comandos\n\n" +
      "**Primeros pasos:**\n" +
      "1. Acepta las normas con ✅ en <#1465883350509293640>\n" +
      "2. Suscríbete a los juegos que te gusten en <#1465883980728504482>\n" +
      "3. Charla, comparte, disfruta ✨"
    );

  await interaction.reply({ embeds: [embed] });
}
