/**
 * Annie Bot v2.2 — Entry Point
 *
 * Este archivo solo hace 4 cosas:
 * 1. Crear el cliente de Discord
 * 2. Cargar los event handlers dinámicamente
 * 3. Manejar shutdown graceful
 * 4. Conectar al gateway
 */
import "dotenv/config";
import http from "node:http";
import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { CONFIG } from "./core/config.js";
import { registerEvents } from "./events/loader.js";
import { stopAllSchedulers } from "./schedulers/scheduler.js";

// ── Cliente de Discord ────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ── Cargar eventos ────────────────────────────────────────────
await registerEvents(client);

// ── Error handlers a nivel de proceso ─────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error, origin) => {
  console.error("[FATAL] Uncaught Exception:", error);
  console.error("Origin:", origin);
});

process.on("SIGINT", () => {
  console.log("[Shutdown] Limpiando...");
  stopAllSchedulers();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAllSchedulers();
  client.destroy();
  process.exit(0);
});

// ── Health check HTTP ─────────────────────────────────────────
http.createServer((req, res) => {
  res.writeHead(200);
  res.end(`${CONFIG.APP_LABEL} is live`);
}).listen(8000);

// ── Conectar ──────────────────────────────────────────────────
client.login(CONFIG.TOKEN);
