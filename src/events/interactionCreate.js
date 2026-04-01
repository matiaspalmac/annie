/**
 * Evento: interactionCreate
 * Enruta commands, autocomplete, buttons y select menus.
 */
import { Events, MessageFlags } from "discord.js";
import { handleCommand, handleAutocomplete } from "../handlers/commands.js";
import { handleAutocompleteGlobal } from "../core/data.js";
import { procesarCompraTienda } from "../features/shop.js";
import { handlePerfilVerMas } from "../features/perfil-viewer.js";
import { handlePerfilVerColeccion } from "../features/perfil-viewer.js";
import { handleColeccionButton } from "../features/coleccion-button.js";
import { db } from "../services/db.js";

export const event = Events.InteractionCreate;
export const once = false;

// Comandos que usan autocomplete global
const GLOBAL_AUTOCOMPLETE = new Set([
  "peces", "insectos", "aves", "animales", "cultivos",
  "recolectables", "recetas", "habitantes", "logros",
]);

export async function execute(interaction, client) {
  // ── Select Menus ────────────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "tienda_comprar") {
      return handleTiendaCompra(interaction);
    }
    if (interaction.customId === "perfil_ver_mas") {
      return handlePerfilVerMas(interaction);
    }
    if (interaction.customId === "perfil_ver_coleccion") {
      return handlePerfilVerColeccion(interaction);
    }
    return;
  }

  // ── Buttons ─────────────────────────────────────────────────
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("col_")) {
      return handleColeccionButton(interaction);
    }
    if (interaction.customId.startsWith("blackjack_")) {
      const { handleBlackjackButton } = await import("../commands/games/games-blackjack.js");
      return handleBlackjackButton(interaction);
    }
    if (interaction.customId.startsWith("casino_")) {
      const { handleCasinoButton } = await import("../commands/games/games-casino.js");
      return handleCasinoButton(interaction);
    }
    return;
  }

  // ── Autocomplete ────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    try {
      if (GLOBAL_AUTOCOMPLETE.has(interaction.commandName)) {
        await handleAutocompleteGlobal(interaction);
      } else {
        await handleAutocomplete(interaction);
      }
    } catch (err) {
      const code = err?.code ?? err?.rawError?.code;
      if (code === 10062) {
        console.warn(`[Autocomplete] Expirado (10062) para /${interaction.commandName}`);
      } else {
        console.error(`[Autocomplete] Error en /${interaction.commandName}:`, err);
      }
    }
    return;
  }

  // ── Slash Commands ──────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    return handleCommand(client, interaction);
  }
}

// ── Handlers internos ─────────────────────────────────────────

async function handleTiendaCompra(interaction) {
  if (interaction.user.id !== interaction.message.interaction?.user.id && interaction.message.interaction) {
    return interaction.reply({
      content: "¡Ey! Esta tienda la abrió otra personita. Escribe `/tienda` tú mismo para comprar.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const itemSeleccionado = interaction.values[0];
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await procesarCompraTienda(interaction, itemSeleccionado);
    await interaction.followUp(result.message);
  } catch (e) {
    console.error("Error comprando en tienda:", e);
    await interaction.followUp("Ocurrió un error mágico al procesar tu compra.");
  }
}
