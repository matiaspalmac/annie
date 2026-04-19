import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed } from "../../core/utils.js";
import { parsearFechaCumple, formatearFechaCumple } from "../../features/cumpleanos.js";

export const data = new SlashCommandBuilder()
  .setName("cumple")
  .setDescription("Guarda y consulta cumpleaños de la aldea 🎂")
  .addSubcommand(sub => sub
    .setName("guardar")
    .setDescription("Guarda tu fecha de cumpleaños (la aldea te saludará ese día)")
    .addStringOption(o => o.setName("fecha").setDescription("Formato DD-MM (ej: 24-12)").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("ver")
    .setDescription("Mira el cumpleaños de un vecino")
    .addUserOption(o => o.setName("vecino").setDescription("¿De quién?"))
  )
  .addSubcommand(sub => sub
    .setName("proximos")
    .setDescription("Muestra los próximos cumpleaños (30 días)")
  )
  .addSubcommand(sub => sub
    .setName("borrar")
    .setDescription("Borra tu fecha de cumpleaños guardada")
  );

export async function execute(interaction, bostezo) {
  const sub = interaction.options.getSubcommand();

  if (sub === "guardar") {
    const fechaTxt = interaction.options.getString("fecha");
    const mmdd = parsearFechaCumple(fechaTxt);
    if (!mmdd) {
      return interaction.reply({
        content: `${bostezo} Esa fechita no se ve bien, vecino. Úsame \`DD-MM\` — ejemplo: \`24-12\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await db.execute({
      sql: `INSERT INTO usuarios (id, cumple) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET cumple = excluded.cumple`,
      args: [interaction.user.id, mmdd],
    });

    const canalCumple = CONFIG.CANAL_CUMPLEANOS_ID;
    const canalMention = canalCumple ? ` en <#${canalCumple}>` : "";
    const embed = crearEmbed("#FFB7C5")
      .setTitle("🎂 Cumpleaños guardado")
      .setDescription(
        `Anoté tu cumple para el **${formatearFechaCumple(mmdd)}** 🪷\n\n` +
        `Ese día la aldea entera te va a saludar${canalMention} ✨`
      );
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (sub === "ver") {
    const target = interaction.options.getUser("vecino") || interaction.user;
    const res = await db.execute({
      sql: "SELECT cumple FROM usuarios WHERE id = ?",
      args: [target.id],
    });
    const mmdd = String(res?.rows?.[0]?.cumple ?? "");
    if (!mmdd) {
      const msg = target.id === interaction.user.id
        ? `${bostezo} Aún no has guardado tu cumple. Usa \`/cumple guardar\` para dejarlo anotado.`
        : `**${target.username}** todavía no ha guardado su cumple.`;
      return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
    const embed = crearEmbed("#FFB7C5")
      .setTitle(`🎂 Cumple de ${target.username}`)
      .setDescription(`**${formatearFechaCumple(mmdd)}** — agéndalo 💌`);
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "proximos") {
    const res = await db.execute(
      "SELECT id, cumple FROM usuarios WHERE cumple IS NOT NULL AND cumple != ''"
    );
    if (res.rows.length === 0) {
      return interaction.reply({
        content: "Nadie en la aldea ha guardado su cumple todavía. ¡Sé el primero con `/cumple guardar`!",
      });
    }

    const hoy = new Date();
    const hoyY = hoy.getFullYear();
    const proximos = res.rows
      .map(r => {
        const mmdd = String(r.cumple);
        const [mm, dd] = mmdd.split("-").map(n => parseInt(n, 10));
        if (!Number.isFinite(mm) || !Number.isFinite(dd)) return null;
        let fecha = new Date(hoyY, mm - 1, dd);
        if (fecha < hoy) fecha = new Date(hoyY + 1, mm - 1, dd);
        const dias = Math.ceil((fecha - hoy) / (24 * 3600_000));
        return { userId: r.id, mmdd, dias };
      })
      .filter(p => p && p.dias <= 30)
      .sort((a, b) => a.dias - b.dias);

    if (proximos.length === 0) {
      return interaction.reply({
        content: "No hay cumples en los próximos 30 días — pero guarda el tuyo con `/cumple guardar` ✨",
      });
    }

    const lista = proximos
      .map(p => `• <@${p.userId}> — **${formatearFechaCumple(p.mmdd)}** (en ${p.dias} día${p.dias === 1 ? "" : "s"})`)
      .join("\n");
    const embed = crearEmbed("#FFB7C5")
      .setTitle("🎂 Próximos cumpleaños — Aldea Luciérnaga")
      .setDescription(lista);
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "borrar") {
    await db.execute({
      sql: "UPDATE usuarios SET cumple = NULL WHERE id = ?",
      args: [interaction.user.id],
    });
    return interaction.reply({
      content: "🗑️ Tu cumple fue borradito. Puedes volver a guardarlo cuando quieras.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

