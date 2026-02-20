import { createClient } from "@libsql/client";
import { CONFIG } from "./config.js";

const db = createClient({
    url: CONFIG.TURSO_URL,
    authToken: CONFIG.TURSO_TOKEN,
});

// ── Valores por defecto que se insertan la primera vez ──────────────────────
const CONFIG_DEFAULTS = {
    TIMEZONE: "America/Santiago",
    TIMEZONE_VOZ: "America/New_York",
    GUILD_ID: "1463659718382977253",
    CANAL_GENERAL_ID: "1463659720207372464",
    CANAL_HORA_ID: "1465953316029726801",
    CANAL_CLIMA_ID: "1466973835831283876",
    CANAL_VOZ_DORMIR_ID: "1466250598302355570",
    LOG_CHANNEL_ID: "1474525474632892469",
    MENSAJE_ROLES_ID: "1470188601760284931",
    ANNIE_IMG: "https://imgur.com/pCWlxKG.png",
    ANNIE_IMG_BIG: "https://imgur.com/pCWlxKG.png",
    WIKI_URL: "https://heartopiachile.vercel.app/",
    HORA_DORMIR: "23",
    HORA_DESPERTAR: "8",
    UMBRAL_CHISME: "25",
    VENTANA_CHISME: "300000",
    COOLDOWN_CHISME: "1800000",
    // JSON strings para objetos anidados
    REACTION_ROLES: JSON.stringify({
        "🪲": "1465882704607449190",
        "🫧": "1465882796198330389",
        "🦆": "1465882906881818654",
        "🎣": "1465883005162885445",
        "🪺": "1465883082824483060",
        "💐": "1465928627123257550",
        "🌠": "1469838445865079009",
    }),
    COLORES: JSON.stringify({
        ROSA: "#FFB7C5",
        VERDE: "#A8E6CF",
        AZUL: "#A8DADC",
        AMARILLO: "#FAD02E",
        NARANJA: "#F8961E",
        DORADO: "#FFD700",
        OLIVA: "#90BE6D",
        INSECTO: "#FFD166",
        CIELO: "#A7D8DE",
    }),
};

export async function initDB() {
    try {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS game_ids (
            user_id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL
          )
        `);
        await db.execute(`
          CREATE TABLE IF NOT EXISTS usuarios (
            id TEXT PRIMARY KEY,
            monedas INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            nivel INTEGER DEFAULT 1,
            color_rol_id TEXT
          )
        `);
        await db.execute(`
          CREATE TABLE IF NOT EXISTS colecciones (
            user_id TEXT,
            categoria TEXT,
            item_id TEXT,
            PRIMARY KEY(user_id, categoria, item_id)
          )
        `);
        await db.execute(`
          CREATE TABLE IF NOT EXISTS configuracion (
            clave TEXT PRIMARY KEY,
            valor TEXT NOT NULL
          )
        `);
        console.log("[DB] Tablas principales, usuarios, colecciones y configuracion verificadas.");

        // Insertar valores por defecto si no existen aún
        await seedConfig();
    } catch (err) {
        console.error("[DB] Error iniciando Turso:", err);
    }
}

/**
 * Inserta los valores por defecto en `configuracion` si la tabla está vacía.
 */
async function seedConfig() {
    const existing = await db.execute("SELECT COUNT(*) as c FROM configuracion");
    if (Number(existing.rows[0].c) > 0) return; // ya hay datos, no pisar

    for (const [clave, valor] of Object.entries(CONFIG_DEFAULTS)) {
        await db.execute({
            sql: "INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)",
            args: [clave, String(valor)],
        });
    }
    console.log("[DB] Configuración inicial sembrada en la tabla `configuracion`.");
}

/**
 * Carga la configuración desde la DB y la mezcla en el objeto CONFIG importado.
 * Llama esto justo después de initDB() en el arranque del bot.
 */
export async function loadConfig() {
    try {
        const result = await db.execute("SELECT clave, valor FROM configuracion");
        for (const row of result.rows) {
            const key = row.clave;
            const raw = row.valor;
            if (raw.startsWith("{") || raw.startsWith("[")) {
                // Objetos y arrays JSON
                try { CONFIG[key] = JSON.parse(raw); } catch { CONFIG[key] = raw; }
            } else if (/^\d+$/.test(raw)) {
                // Número entero puro — solo convertir si es seguro (no snowflake de 64-bit)
                const n = BigInt(raw);
                CONFIG[key] = n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(raw) : raw;
            } else {
                // String puro (URLs, timezones, etc.)
                CONFIG[key] = raw;
            }
        }

        console.log(`[DB] Configuración cargada (${result.rows.length} claves).`);
    } catch (err) {
        console.error("[DB] Error cargando configuración:", err);
    }
}



export async function buildAutocompleteCache() {
    const cache = {};
    const tables = ["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "habitantes", "logros", "recetas"];

    for (const table of tables) {
        try {
            const result = await db.execute(`SELECT id FROM ${table}`);
            cache[table] = result.rows.map(row => ({
                original: String(row.id),
                normalized: String(row.id)
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/\s+/g, " ")
                    .trim()
            }));
        } catch (e) {
            console.error(`[DB] No se pudo armar cache para tabla ${table}:`, e.message);
            cache[table] = [];
        }
    }
    return cache;
}

export async function saveGameId(userId, gameId) {
    return await db.execute({
        sql: "INSERT INTO game_ids (user_id, game_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET game_id = excluded.game_id",
        args: [userId, gameId],
    });
}

export async function getGameId(userId) {
    const result = await db.execute({
        sql: "SELECT game_id FROM game_ids WHERE user_id = ?",
        args: [userId],
    });
    return result.rows.length > 0 ? result.rows[0].game_id : null;
}

export { db };


