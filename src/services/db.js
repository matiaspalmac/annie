import { createClient } from "@libsql/client";
import { CONFIG } from "../core/config.js";

if (!CONFIG.TURSO_URL) {
  throw new Error(
    "Falta TURSO_DATABASE_URL en variables de entorno. Crea/recupera el archivo .env con TURSO_DATABASE_URL y TURSO_AUTH_TOKEN."
  );
}

if (!CONFIG.TURSO_TOKEN) {
  throw new Error(
    "Falta TURSO_AUTH_TOKEN en variables de entorno. Crea/recupera el archivo .env con TURSO_DATABASE_URL y TURSO_AUTH_TOKEN."
  );
}

const db = createClient({
  url: CONFIG.TURSO_URL,
  authToken: CONFIG.TURSO_TOKEN,
});

// ── Valores por defecto que se insertan la primera vez ──────────────────────
const CONFIG_DEFAULTS = {
  TIMEZONE: "America/Santiago",
  CHILE_TZ_OFFSET_SQLITE: "-3 hours",
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
  WIKI_ALLOWED_HOSTS: JSON.stringify(["heartopiachile.vercel.app"]),
  TIENDA_ITEMS_NUEVOS: JSON.stringify([
    "seguro_antirobo_24h",
    "cebo_simple",
    "herr_pico_hierro",
    "herr_pico_acero",
    "herr_cana_fibra",
    "herr_cana_lunar",
    "herr_hacha_hierro",
    "herr_hacha_titanio",
    "herr_red_fina",
    "herr_red_seda"
  ]),
  HORA_DORMIR: "23",
  HORA_DESPERTAR: "8",
  UMBRAL_CHISME: "25",
  VENTANA_CHISME: "300000",
  COOLDOWN_CHISME: "1800000",
  TRIVIA_DURACION_MS: "60000",
  TRIVIA_RECOMPENSA_XP: "100",
  TRIVIA_RECOMPENSA_MONEDAS: "10",
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
            username TEXT,
            avatar TEXT,
            monedas INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            nivel INTEGER DEFAULT 1,
            color_rol_id TEXT,
            tema_perfil TEXT DEFAULT 'default',
            ultimo_diario TEXT DEFAULT NULL,
            diario_racha INTEGER DEFAULT 0,
            mascota_activa TEXT DEFAULT NULL,
            banner_url TEXT DEFAULT NULL,
            seguro_antirobo_hasta INTEGER DEFAULT 0,
            reputacion_pillo INTEGER DEFAULT 0
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
    await db.execute(`
          CREATE TABLE IF NOT EXISTS clima (
            id TEXT PRIMARY KEY,
            tipo TEXT,
            descripcion TEXT,
            timeline TEXT
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS tienda_items (
            id TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            precio_monedas INTEGER DEFAULT 0,
            tipo TEXT DEFAULT 'rol',
            discord_role_id TEXT DEFAULT NULL
          )
        `);
    // F9 - Tabla Destacados (Vitrina Web)
    await db.execute(`
          CREATE TABLE IF NOT EXISTS destacados (
            user_id TEXT,
            slot INTEGER,
            categoria TEXT,
            item_id TEXT,
            PRIMARY KEY(user_id, slot)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS trivia_stats (
            id TEXT PRIMARY KEY,
            habitante TEXT NOT NULL,
            ganador_id TEXT,
            fue_respondida BOOLEAN DEFAULT 0,
            fecha TEXT NOT NULL
          )
        `);
    // F13 - Eventos y Donaciones
    await db.execute(`
          CREATE TABLE IF NOT EXISTS eventos_globales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            descripcion TEXT,
            meta_monedas INTEGER NOT NULL,
            progreso_monedas INTEGER DEFAULT 0,
            recompensa_rol_id TEXT DEFAULT NULL,
            recompensa_item_id TEXT DEFAULT NULL,
            activo INTEGER DEFAULT 1
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS evento_donaciones (
            evento_id INTEGER,
            user_id TEXT,
            cantidad INTEGER DEFAULT 0,
            PRIMARY KEY(evento_id, user_id)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS rifa_boletos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            fecha TEXT NOT NULL
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS inventario_economia (
            user_id TEXT,
            item_id TEXT,
            cantidad INTEGER DEFAULT 0,
            PRIMARY KEY(user_id, item_id)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS mascota_nombres (
            user_id TEXT,
            mascota_id TEXT,
            nombre TEXT NOT NULL,
            PRIMARY KEY(user_id, mascota_id)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS boosts_activos (
            user_id TEXT,
            boost_id TEXT,
            fecha_expira INTEGER,
            PRIMARY KEY(user_id, boost_id)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS servicios_usuarios (
            user_id TEXT PRIMARY KEY,
            ultimo_reset_racha TEXT DEFAULT NULL
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS user_item_favoritos (
            user_id TEXT,
            item_id TEXT,
            PRIMARY KEY(user_id, item_id)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS herramientas_durabilidad (
            user_id TEXT,
            item_id TEXT,
            durabilidad INTEGER DEFAULT 0,
            max_durabilidad INTEGER DEFAULT 0,
            equipado INTEGER DEFAULT 0,
            PRIMARY KEY(user_id, item_id)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS macro_patrones (
            user_id TEXT,
            comando TEXT,
            ultimo_ts INTEGER DEFAULT 0,
            patron_count INTEGER DEFAULT 0,
            PRIMARY KEY(user_id, comando)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS casino_stats (
            user_id TEXT PRIMARY KEY,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            total_betted INTEGER DEFAULT 0,
            net_winnings INTEGER DEFAULT 0
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS cooldowns (
            user_id TEXT,
            comando TEXT,
            extra_id TEXT,
            fecha_limite INTEGER,
            PRIMARY KEY(user_id, comando, extra_id)
          )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS habilidades(
      user_id TEXT,
      habilidad TEXT,
      nivel INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      PRIMARY KEY(user_id, habilidad)
    )
      `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS bitacora(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        accion TEXT,
        fecha TEXT
      )
      `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS actividad_diaria(
        user_id TEXT,
        fecha TEXT,
        xp_ganado INTEGER DEFAULT 0,
        monedas_ganadas INTEGER DEFAULT 0,
        acciones INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, fecha)
      )
      `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS estadisticas(
        user_id TEXT,
        accion TEXT,
        cantidad INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, accion)
      )
      `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS titulos(
        user_id TEXT,
        titulo TEXT,
        equipado INTEGER DEFAULT 0,
        PRIMARY KEY(user_id, titulo)
      )
        `);

    // Migraciones seguras para columnas añadidas posteriormente
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN banner_url TEXT DEFAULT NULL"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN marco_perfil TEXT DEFAULT 'default'"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN diario_racha INTEGER DEFAULT 0"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN seguro_antirobo_hasta INTEGER DEFAULT 0"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN reputacion_pillo INTEGER DEFAULT 0"); } catch (e) { /* Ignorar si ya existe */ }

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_actividad_usuarios_update
      AFTER UPDATE OF xp, monedas ON usuarios
      WHEN (NEW.xp != OLD.xp OR NEW.monedas != OLD.monedas)
      BEGIN
        INSERT INTO actividad_diaria (user_id, fecha, xp_ganado, monedas_ganadas, acciones)
        VALUES (
          NEW.id,
          date('now', COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours')),
          CASE WHEN NEW.xp > OLD.xp THEN NEW.xp - OLD.xp ELSE 0 END,
          CASE WHEN NEW.monedas > OLD.monedas THEN NEW.monedas - OLD.monedas ELSE 0 END,
          0
        )
        ON CONFLICT(user_id, fecha) DO UPDATE SET
          xp_ganado = actividad_diaria.xp_ganado + excluded.xp_ganado,
          monedas_ganadas = actividad_diaria.monedas_ganadas + excluded.monedas_ganadas;
      END;
    `);

    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trg_actividad_bitacora_insert
      AFTER INSERT ON bitacora
      BEGIN
        INSERT INTO actividad_diaria (user_id, fecha, xp_ganado, monedas_ganadas, acciones)
        VALUES (
          NEW.user_id,
          date(
            COALESCE(NEW.fecha, 'now'),
            COALESCE((SELECT valor FROM configuracion WHERE clave = 'CHILE_TZ_OFFSET_SQLITE'), '-3 hours')
          ),
          0,
          0,
          1
        )
        ON CONFLICT(user_id, fecha) DO UPDATE SET
          acciones = actividad_diaria.acciones + 1;
      END;
    `);

    // Backfill legacy purchases (idempotent): move active theme/pet into inventory if missing
    await db.execute(`
      INSERT INTO inventario_economia (user_id, item_id, cantidad)
      SELECT u.id, u.tema_perfil, 1
      FROM usuarios u
      WHERE u.tema_perfil IS NOT NULL
        AND u.tema_perfil LIKE 'tema_%'
        AND NOT EXISTS (
          SELECT 1
          FROM inventario_economia ie
          WHERE ie.user_id = u.id
            AND ie.item_id = u.tema_perfil
            AND ie.cantidad > 0
        )
    `);

    await db.execute(`
      INSERT INTO inventario_economia (user_id, item_id, cantidad)
      SELECT u.id, u.mascota_activa, 1
      FROM usuarios u
      WHERE u.mascota_activa IS NOT NULL
        AND u.mascota_activa LIKE 'mascota_%'
        AND NOT EXISTS (
          SELECT 1
          FROM inventario_economia ie
          WHERE ie.user_id = u.id
            AND ie.item_id = u.mascota_activa
            AND ie.cantidad > 0
        )
    `);

    console.log("[DB] Tablas verificadas.");

    await seedConfig();
    await seedTienda();
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

    console.log(`[DB] Configuración cargada(${result.rows.length} claves).`);
  } catch (err) {
    console.error("[DB] Error cargando configuración:", err);
  }
}



/**
 * Devuelve el id del log más reciente en admin_logs, o 0 si no hay.
 */
export async function getLatestLogId() {
  try {
    const result = await db.execute("SELECT MAX(id) as maxId FROM admin_logs");
    return Number(result.rows[0]?.maxId ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Devuelve los logs nuevos desde un id determinado.
 */
export async function getLogsSince(sinceId) {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM admin_logs WHERE id > ? ORDER BY id ASC LIMIT 20",
      args: [sinceId],
    });
    return result.rows;
  } catch {
    return [];
  }
}

/**
 * Siembra los items de la tienda si la tabla está vacía.
 */
async function seedTienda() {
  const items = [
    { id: "color_rosa", tipo: "rol", nombre: "Tinte Rosado", descripcion: "Tiñe tu nombre de un hermoso color rosa chicle.", precio_monedas: 120 },
    { id: "color_celeste", tipo: "rol", nombre: "Tinte Celeste", descripcion: "Muestra tu nombre como el cielo despejado.", precio_monedas: 120 },
    { id: "color_dorado", tipo: "rol", nombre: "Tinte Dorado", descripcion: "Brilla como el oro puro en el servidor.", precio_monedas: 180 },
    { id: "color_lila", tipo: "rol", nombre: "Tinte Lila", descripcion: "Un tono violeta suave para destacar en el chat.", precio_monedas: 160 },
    { id: "color_menta", tipo: "rol", nombre: "Tinte Menta", descripcion: "Un color fresco y tranquilito para tu nombre.", precio_monedas: 160 },
    { id: "color_coral", tipo: "rol", nombre: "Tinte Coral", descripcion: "Un coral cálido y vivo para brillar conversando.", precio_monedas: 170 },
    { id: "color_ambar", tipo: "rol", nombre: "Tinte Ámbar", descripcion: "Luce un tono dorado-naranja bien elegante.", precio_monedas: 190 },
    { id: "color_custom", tipo: "rol", nombre: "Pincel Mágico (Color Personalizado)", descripcion: "Elige tu propio color hexadecimal para tu nombre en el chat.", precio_monedas: 450 },

    // Temas de Perfil (F8)
    { id: "tema_bosque", tipo: "tema", nombre: "Fondo: Bosque Mágico", descripcion: "Pinta tu Libretita Web de color verde musgo, hojas y espíritu aventurero.", precio_monedas: 350 },
    { id: "tema_playa", tipo: "tema", nombre: "Fondo: Playa Sirena", descripcion: "Lleva la arena amarilla y el sonido del mar azul a tu página web de Heartopia.", precio_monedas: 350 },
    { id: "tema_noche", tipo: "tema", nombre: "Fondo: Noche Estrellada", descripcion: "Oscurece la libretita de tu perfil bajo un hermoso manto estelar.", precio_monedas: 550 },

    // Consumibles
    { id: "booster_xp_30m", tipo: "consumible", nombre: "Booster XP 30m", descripcion: "Otorga +25% XP durante 30 minutos.", precio_monedas: 800 },
    { id: "amuleto_suerte_15m", tipo: "consumible", nombre: "Amuleto de Suerte 15m", descripcion: "Aumenta la probabilidad de drops raros por 15 minutos.", precio_monedas: 950 },
    { id: "cebo_simple", tipo: "consumible", nombre: "Cebo Simple x3", descripcion: "Se consume automáticamente al pescar para mejorar la suerte de captura.", precio_monedas: 260 },

    // Servicio
    { id: "reset_racha_perdon", tipo: "servicio", nombre: "Perdón de Racha", descripcion: "Recupera tu racha rota (1 vez por semana).", precio_monedas: 1200 },
    { id: "etiqueta_mascota", tipo: "servicio", nombre: "Etiqueta para Mascota", descripcion: "Permite usar /renombrar mascota:[tu mascota] nombre:[nuevo nombre] para ponerle un nombre personalizado a una de tus mascotas.", precio_monedas: 250 },
    { id: "seguro_antirobo_24h", tipo: "servicio", nombre: "Seguro Anti-Robo (24h)", descripcion: "Protege tus moneditas de /robar durante 24 horas.", precio_monedas: 900 },

    // Herramientas
    { id: "herr_pico_hierro", tipo: "herramienta", nombre: "Pico de Hierro", descripcion: "Herramienta equipable de minería (+chance rara, 80 durabilidad).", precio_monedas: 1100 },
    { id: "herr_pico_acero", tipo: "herramienta", nombre: "Pico de Acero", descripcion: "Herramienta equipable avanzada de minería (+chance rara alta, 120 durabilidad).", precio_monedas: 2400 },
    { id: "herr_cana_fibra", tipo: "herramienta", nombre: "Caña de Fibra", descripcion: "Herramienta equipable de pesca (+captura rara, 90 durabilidad).", precio_monedas: 1300 },
    { id: "herr_cana_lunar", tipo: "herramienta", nombre: "Caña Lunar", descripcion: "Herramienta equipable de pesca legendaria (+captura épica, 130 durabilidad).", precio_monedas: 2900 },
    { id: "herr_hacha_hierro", tipo: "herramienta", nombre: "Hacha de Hierro", descripcion: "Herramienta equipable de tala (+eventos raros, 85 durabilidad).", precio_monedas: 1150 },
    { id: "herr_hacha_titanio", tipo: "herramienta", nombre: "Hacha de Titanio", descripcion: "Herramienta equipable avanzada de tala (+eventos raros altos, 125 durabilidad).", precio_monedas: 2550 },
    { id: "herr_red_fina", tipo: "herramienta", nombre: "Red Fina", descripcion: "Herramienta equipable para capturar bichos (+raros, 90 durabilidad).", precio_monedas: 1200 },
    { id: "herr_red_seda", tipo: "herramienta", nombre: "Red de Seda", descripcion: "Herramienta equipable premium para captura (+raros altos, 130 durabilidad).", precio_monedas: 2650 },

    // Marcos Web (F17)
    { id: "marco_perfil_bronce", tipo: "marco", nombre: "Marco de Perfil Bronce", descripcion: "Marco cálido y elegante para tu avatar en la web.", precio_monedas: 450 },
    { id: "marco_perfil_cristal", tipo: "marco", nombre: "Marco de Perfil Cristal", descripcion: "Brillo celeste y suave para tu libretita web.", precio_monedas: 650 },
    { id: "marco_perfil_galaxia", tipo: "marco", nombre: "Marco de Perfil Galaxia", descripcion: "Un aro cósmico con vibra estelar para tu perfil.", precio_monedas: 800 },

    // Mascotas (F15)
    { id: "mascota_kiltro", tipo: "mascota", nombre: "Cachupín, el Kiltro", descripcion: "Un perrito callejero apañador que te acompañará siempre en tu libretita web.", precio_monedas: 1800 },
    { id: "mascota_gatito", tipo: "mascota", nombre: "Gatito Romano", descripcion: "Un michi dormilón que ronroneará desde el encabezado de tu página web.", precio_monedas: 1800 },
    { id: "mascota_pudu", tipo: "mascota", nombre: "Pudú Tímido", descripcion: "El ciervo más pequeño y tierno de Chile. Cuidará tus logros en tu perfil.", precio_monedas: 2600 },
  ];

  for (const item of items) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO tienda_items (id, nombre, descripcion, precio_monedas, tipo, discord_role_id)
            VALUES (?, ?, ?, ?, ?, NULL)`,
      args: [item.id, item.nombre, item.descripcion, item.precio_monedas, item.tipo],
    });
  }
  console.log(`[DB] Tienda verificada al inicio (${items.length} items base).`);
}

export async function buildAutocompleteCache() {
  const cache = {};
  const tables = ["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "habitantes", "logros", "recetas"];

  for (const table of tables) {
    try {
      const result = await db.execute(`SELECT id FROM ${table} `);
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
      console.error(`[DB] No se pudo armar cache para tabla ${table}: `, e.message);
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


