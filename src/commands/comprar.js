import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../db.js";
import { procesarCompraTienda } from "../shop.js";

export const data = new SlashCommandBuilder()
  .setName("comprar")
  .setDescription("Compra un ítem de la tienda por su nombre o id")
  .addStringOption((o) =>
    o
      .setName("item")
      .setDescription("Ítem de la tienda")
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function autocomplete(interaction) {
  try {
    const focused = interaction.options.getFocused(true).value?.trim() || "";
    const term = `%${focused.toLowerCase()}%`;

    const res = await db.execute({
      sql: `SELECT id, nombre, precio_monedas
            FROM tienda_items
            WHERE LOWER(id) LIKE ? OR LOWER(nombre) LIKE ?
            ORDER BY precio_monedas ASC, nombre ASC
            LIMIT 25`,
      args: [term, term],
    });

    const options = res.rows.map((row) => ({
      name: `${String(row.nombre).slice(0, 70)} · ${Number(row.precio_monedas)}💰`,
      value: String(row.id),
    }));

    await interaction.respond(options);
  } catch (e) {
    console.error("Error autocomplete /comprar", e);
    await interaction.respond([]).catch(() => {});
  }
}

export async function execute(interaction, bostezo) {
  const item = interaction.options.getString("item", true).trim();

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await procesarCompraTienda(interaction, item);
    const content = result.ok ? result.message : `${bostezo}${result.message}`;
    await interaction.editReply({ content });
  } catch (e) {
    console.error("Error en /comprar", e);
    await interaction.editReply({ content: "Ocurrió un error mágico al procesar tu compra." });
  }
}
