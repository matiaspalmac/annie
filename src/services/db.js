import { createClient } from "@libsql/client";
import { CONFIG } from "../core/config.js";

// ── Constantes ────────────────────────────────────────────────────────────
/** Timeout máximo para operaciones de base de datos (15 segundos) */
const DB_OPERATION_TIMEOUT = 15000;

/** Límite de logs a mantener en bitácora por usuario */
const MAX_BITACORA_REGISTROS = 10;

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
  CANAL_GENERAL_ID: "1495527885476200569",
  CANAL_GENERAL_HEARTOPIA_ID: "1463659720207372464",
  CANAL_BIENVENIDA_ID: "1463664186310791392",
  CANAL_HORA_ID: "1465953316029726801",
  CANAL_CLIMA_ID: "1466973835831283876",
  CANAL_VOZ_DORMIR_ID: "1466250598302355570",
  LOG_CHANNEL_ID: "1474525474632892469",
  MENSAJE_ROLES_ID: "1495551440385478866",
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
  UMBRAL_CHISME: "40",
  VENTANA_CHISME: "300000",
  COOLDOWN_CHISME: "5400000",
  TRIVIA_DURACION_MS: "60000",
  TRIVIA_RECOMPENSA_XP: "100",
  TRIVIA_RECOMPENSA_MONEDAS: "10",
  ROLES_PROGRESION: JSON.stringify([
    { nivel: 1,  nombre: "🍃 Aprendiz",            roleId: "1495528480320913548" },
    { nivel: 10, nombre: "🐛 Coleccionista",        roleId: "1495528575166840992" },
    { nivel: 20, nombre: "🌾 Agricultor Dedicado",  roleId: "1495528634050674706" },
    { nivel: 30, nombre: "🎣 Pescador Experto",     roleId: "1495528705127223437" },
    { nivel: 50, nombre: "⛏️ Minero Legendario",   roleId: "1495528793744343111" }
  ]),
  ROL_VISITANTE_ID: "1495548034514157711",
  CANAL_CUMPLEANOS_ID: "1495552161428275300",
  CUMPLE_ULTIMA_REVISION: "",
  CANAL_HIGHLIGHTS_ID: "1495556569943769219",
  CANAL_EVENTOS_ID: "1495556557159796838",
  CANAL_FOTO_DIA_ID: "1495556559185383564",
  CANAL_ARTE_ID: "1495556566521352213",
  CANAL_STAGE_ID: "1495556573341417625",
  CANAL_ASMR_ID: "1495556577669681343",
  PROMPT_DIARIO_ULTIMA_FECHA: "",
  HIGHLIGHTS_ULTIMA_FECHA: "",
  PROMPTS_DIARIOS: JSON.stringify([
    { dia: 1, canalId: "1495552165551276205", titulo: "📚 Lunes de Recomendación", mensaje: "¿Qué serie, libro, anime, manga o juego estás consumiendo esta semana? Cuéntanos y comparte tu recomendación 💌" },
    { dia: 2, canalId: "1467326699707564187", titulo: "🐈 Martes de Mascotas", mensaje: "Muéstranos a tu pet cotidiano — perrito, gato, conejo, pececito, el que sea. ¡La aldea quiere conocerlo! 🪷" },
    { dia: 3, canalId: "1463659720207372464", titulo: "🎀 Miércoles de Heartopia", mensaje: "Comparte una captura tuya del juego — tu casa, tu mascota ingame, un momentito cute. ✨" },
    { dia: 4, canalId: "1495546967382818847", titulo: "🖼️ Jueves de Jardines", mensaje: "¿Qué cozy game estás jugando esta semana? Stardew, AC, Palia, Dreamlight, Hello Kitty Island... muéstranos 🌾" },
    { dia: 5, canalId: "1495552158236541070", titulo: "💭 Viernes de Mood", mensaje: "¿Cómo estás hoy? Usa una palabra, un emoji o una frase corta — nos leemos sin juicio 🌙" },
    { dia: 6, canalId: "1495527885476200569", titulo: "🎤 Sábado de Charla", mensaje: "Sábado en la aldea — esta noche podemos juntarnos en voz para chismecito. ¿Quién se apunta? ✨" },
  ]),
  CANALES_HIGHLIGHTS_SCAN: JSON.stringify([
    "1495527885476200569",
    "1495552158236541070",
    "1463660849653874853",
    "1467326699707564187",
    "1495556559185383564",
    "1495556566521352213",
  ]),
  ROL_VECINO_ID: "1463661564568801485",
  ROL_GUIA_ID: "1469760697503322132",
  ROL_LUCIERNAGA_MAYOR_ID: "1467953316922392598",
  ROL_LUNA_GUARDIANA_ID: "1463661508679696590",
  REACTION_ROLES: JSON.stringify({
    "🪲": "1465882704607449190",
    "🫧": "1465882796198330389",
    "🦆": "1465882906881818654",
    "🎣": "1465883005162885445",
    "🪺": "1465883082824483060",
    "💐": "1465928627123257550",
    "🌠": "1469838445865079009",
  }),
  MENSAJE_ROLES_COZY_ID: "1495550443902865448",
  REACTION_ROLES_COZY: JSON.stringify({
    "🌾": "1495550359278583972",
    "🍃": "1495550361778262088",
    "🏰": "1495550367776116938",
    "🌸": "1495550372419342436",
    "🐱": "1495550375883837482",
  }),
  MENSAJE_NORMAS_ID: "1495554820604563527",
  REACTION_NORMAS: JSON.stringify({
    "✅": "1463661564568801485",
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

/**
 * Inicializa todas las tablas de la base de datos y ejecuta migraciones.
 * @async
 * @returns {Promise<void>}
 */
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
    // F13 - Eventos y Donaciones (mejorado: soporte para items, fases, deadlines)
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
    // Migraciones de eventos: soporte items, fases, deadline
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN tipo TEXT DEFAULT 'monedas'"); } catch { }
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN item_requerido TEXT DEFAULT NULL"); } catch { }
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN meta_items INTEGER DEFAULT 0"); } catch { }
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN progreso_items INTEGER DEFAULT 0"); } catch { }
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN fase INTEGER DEFAULT 1"); } catch { }
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN total_fases INTEGER DEFAULT 1"); } catch { }
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN fecha_limite TEXT DEFAULT NULL"); } catch { }
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN recompensa_monedas INTEGER DEFAULT 0"); } catch { }
    try { await db.execute("ALTER TABLE eventos_globales ADD COLUMN recompensa_xp INTEGER DEFAULT 0"); } catch { }
    // Donaciones: soporte items
    try { await db.execute("ALTER TABLE evento_donaciones ADD COLUMN cantidad_items INTEGER DEFAULT 0"); } catch { }
    // ── Prestigio ─────────────────────────────────────────────────
    await db.execute(`
          CREATE TABLE IF NOT EXISTS prestigio (
            user_id TEXT PRIMARY KEY,
            nivel_prestigio INTEGER DEFAULT 0,
            fecha_ultimo TEXT DEFAULT NULL
          )
        `);
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN prestigio INTEGER DEFAULT 0"); } catch { }
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
          CREATE TABLE IF NOT EXISTS rifa_ganadores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            fecha TEXT NOT NULL,
            pozo INTEGER NOT NULL,
            boletos_ganador INTEGER DEFAULT 1,
            boletos_totales INTEGER DEFAULT 1
          )
        `);
    // ── Misiones diarias ────────────────────────────────────────
    await db.execute(`
          CREATE TABLE IF NOT EXISTS misiones_diarias (
            user_id TEXT,
            fecha TEXT,
            misiones TEXT DEFAULT '[]',
            bonus_reclamado INTEGER DEFAULT 0,
            PRIMARY KEY(user_id, fecha)
          )
        `);
    // ── Recompensas de colección reclamadas ────────────────────
    await db.execute(`
          CREATE TABLE IF NOT EXISTS coleccion_recompensas (
            user_id TEXT,
            categoria TEXT,
            reclamada INTEGER DEFAULT 0,
            PRIMARY KEY(user_id, categoria)
          )
        `);
    // ── Nivel de mascotas ──────────────────────────────────────
    try { await db.execute("ALTER TABLE mascotas_estado ADD COLUMN nivel INTEGER DEFAULT 1"); } catch { }
    try { await db.execute("ALTER TABLE mascotas_estado ADD COLUMN xp INTEGER DEFAULT 0"); } catch { }
    // ── Maestría de crafting ───────────────────────────────────
    await db.execute(`
          CREATE TABLE IF NOT EXISTS crafting_maestria (
            user_id TEXT,
            receta_id TEXT,
            veces_crafteado INTEGER DEFAULT 0,
            PRIMARY KEY(user_id, receta_id)
          )
        `);
    // ── Trivia stats mejoradas ─────────────────────────────────
    try { await db.execute("ALTER TABLE trivia_stats ADD COLUMN categoria TEXT DEFAULT 'habitantes'"); } catch { }
    try { await db.execute("ALTER TABLE trivia_stats ADD COLUMN dificultad TEXT DEFAULT 'normal'"); } catch { }

    await db.execute(`
          CREATE TABLE IF NOT EXISTS items_economia (
            id TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            emoji TEXT,
            tipo TEXT NOT NULL,
            rareza TEXT,
            precio_venta INTEGER DEFAULT 0
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
    await db.execute(`
          CREATE TABLE IF NOT EXISTS mascotas_estado(
        user_id TEXT PRIMARY KEY,
        mascota_id TEXT,
        felicidad INTEGER DEFAULT 70,
        hambre INTEGER DEFAULT 50,
        ultima_interaccion INTEGER DEFAULT 0
      )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS banco(
        user_id TEXT PRIMARY KEY,
        monedas INTEGER DEFAULT 0,
        ultimo_interes INTEGER DEFAULT 0
      )
        `);
    await db.execute(`
          CREATE TABLE IF NOT EXISTS recetas(
        id TEXT PRIMARY KEY,
        nombre_resultado TEXT NOT NULL,
        cantidad_resultado INTEGER DEFAULT 1,
        emoji_resultado TEXT DEFAULT '🎁',
        ingredientes TEXT NOT NULL,
        descripcion TEXT DEFAULT ''
      )
        `);

    // Migraciones seguras para columnas añadidas posteriormente
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN banner_url TEXT DEFAULT NULL"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN marco_perfil TEXT DEFAULT 'default'"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN diario_racha INTEGER DEFAULT 0"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN seguro_antirobo_hasta INTEGER DEFAULT 0"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN reputacion_pillo INTEGER DEFAULT 0"); } catch (e) { /* Ignorar si ya existe */ }
    try { await db.execute("ALTER TABLE usuarios ADD COLUMN cumple TEXT DEFAULT NULL"); } catch (e) { /* Ignorar si ya existe */ }

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

    // ── Indexes para queries frecuentes ─────────────────────────────
    await db.execute("CREATE INDEX IF NOT EXISTS idx_cooldowns_user_cmd ON cooldowns(user_id, comando)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_herramientas_equipado ON herramientas_durabilidad(user_id, equipado)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_inventario_user ON inventario_economia(user_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_rifa_boletos_fecha ON rifa_boletos(fecha)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_colecciones_user ON colecciones(user_id, categoria)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_actividad_user_fecha ON actividad_diaria(user_id, fecha)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_bitacora_user ON bitacora(user_id)");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_boosts_user ON boosts_activos(user_id, boost_id)");

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
    await seedItemsEconomia();
  } catch (err) {
    console.error("[DB] Error iniciando Turso:", err);
  }
}

/**
 * Inserta los valores por defecto en `configuracion` si la tabla está vacía.
 * @async
 * @returns {Promise<void>}
 */
async function seedConfig() {
  try {
    const existing = await db.execute("SELECT COUNT(*) as c FROM configuracion");
    const count = Number(existing?.rows?.[0]?.c ?? 0);
    if (count > 0) return; // ya hay datos, no pisar

    for (const [clave, valor] of Object.entries(CONFIG_DEFAULTS)) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)",
        args: [clave, String(valor)],
      });
    }
    console.log("[DB] Configuración inicial sembrada en la tabla `configuracion`.");
  } catch (err) {
    console.error("[DB] Error en seedConfig:", err);
  }
}

/**
 * Carga la configuración desde la DB y la mezcla en el objeto CONFIG importado.
 * Llama esto justo después de initDB() en el arranque del bot.
 * @async
 * @returns {Promise<void>}
 */
export async function loadConfig() {
  try {
    const result = await db.execute("SELECT clave, valor FROM configuracion");
    if (!result?.rows) {
      console.warn("[DB] No se pudo cargar configuración: respuesta vacía");
      return;
    }

    for (const row of result.rows) {
      const key = String(row?.clave ?? "");
      const raw = String(row?.valor ?? "");
      if (!key) continue;

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



/**
 * Devuelve el id del log más reciente en admin_logs, o 0 si no hay.
 * @async
 * @returns {Promise<number>} ID del último log
 */
export async function getLatestLogId() {
  try {
    const result = await db.execute("SELECT MAX(id) as maxId FROM admin_logs");
    return Number(result?.rows?.[0]?.maxId ?? 0);
  } catch (err) {
    console.error("[DB] Error obteniendo último log ID:", err.message);
    return 0;
  }
}

/**
 * Devuelve los logs nuevos desde un id determinado.
 * @async
 * @param {number} sinceId - ID desde donde obtener logs
 * @returns {Promise<Array>} Array de logs
 */
export async function getLogsSince(sinceId) {
  try {
    const id = Number(sinceId);
    if (isNaN(id) || id < 0) return [];

    const result = await db.execute({
      sql: "SELECT * FROM admin_logs WHERE id > ? ORDER BY id ASC LIMIT 20",
      args: [id],
    });
    return result?.rows ?? [];
  } catch (err) {
    console.error("[DB] Error obteniendo logs desde ID:", err.message);
    return [];
  }
}

/**
 * Siembra los items de la tienda si la tabla está vacía.
 * @async
 * @returns {Promise<void>}
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
    { id: "tema_morado", tipo: "tema", nombre: "Fondo: Jardín Violeta", descripcion: "Envuelve tu libretita en tonos púrpura y lavanda, perfecta para las almas mágicas.", precio_monedas: 400 },
    { id: "tema_negro", tipo: "tema", nombre: "Fondo: Abismo Oscuro", descripcion: "Un negro profundo y elegante para las almas misteriosas del pueblito.", precio_monedas: 600 },
    { id: "tema_rojo", tipo: "tema", nombre: "Fondo: Corazón Ardiente", descripcion: "Rojos apasionados y carmesí para un perfil lleno de energía.", precio_monedas: 450 },
    { id: "tema_celestial", tipo: "tema", nombre: "Fondo: Amanecer Soñado", descripcion: "Blancos perlados y tonos pastel suaves, para los espíritus más serenos.", precio_monedas: 350 },

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

  try {
    for (const item of items) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO tienda_items (id, nombre, descripcion, precio_monedas, tipo, discord_role_id)
              VALUES (?, ?, ?, ?, ?, NULL)`,
        args: [item.id, item.nombre, item.descripcion, item.precio_monedas, item.tipo],
      });
    }
    console.log(`[DB] Tienda verificada al inicio (${items.length} items base).`);
  } catch (err) {
    console.error("[DB] Error en seedTienda:", err);
  }
}

/**
 * Carga items de economía obtenibles (minerales, peces, frutas, bichos)
 * @async
 * @returns {Promise<void>}
 */
async function seedItemsEconomia() {
  const items = [
    // MINERALES (Minar)
    { id: "Diamante puro", nombre: "Diamante puro", emoji: "💎", tipo: "mineral", rareza: "mitico", precio_venta: 150 },
    { id: "Esmeralda brillante", nombre: "Esmeralda brillante", emoji: "💚", tipo: "mineral", rareza: "epico", precio_venta: 80 },
    { id: "Rubí carmesí", nombre: "Rubí carmesí", emoji: "❤️", tipo: "mineral", rareza: "epico", precio_venta: 75 },
    { id: "Zafiro estelar", nombre: "Zafiro estelar", emoji: "💙", tipo: "mineral", rareza: "epico", precio_venta: 70 },
    { id: "Amatista cristalina", nombre: "Amatista cristalina", emoji: "💜", tipo: "mineral", rareza: "raro", precio_venta: 50 },
    { id: "Fluorita impecable", nombre: "Fluorita impecable", emoji: "🟢", tipo: "mineral", rareza: "raro", precio_venta: 45 },
    { id: "Topacio dorado", nombre: "Topacio dorado", emoji: "🟡", tipo: "mineral", rareza: "poco_comun", precio_venta: 30 },
    { id: "Cuarzo rosa", nombre: "Cuarzo rosa", emoji: "🪷", tipo: "mineral", rareza: "poco_comun", precio_venta: 25 },
    { id: "Hierro", nombre: "Hierro", emoji: "⚙️", tipo: "mineral", rareza: "comun", precio_venta: 8 },
    { id: "Cobre", nombre: "Cobre", emoji: "🟠", tipo: "mineral", rareza: "comun", precio_venta: 7 },
    { id: "Obsidiana", nombre: "Obsidiana", emoji: "⬛", tipo: "mineral", rareza: "comun", precio_venta: 10 },
    { id: "Jade", nombre: "Jade", emoji: "🟩", tipo: "mineral", rareza: "comun", precio_venta: 12 },
    { id: "Ópalo", nombre: "Ópalo", emoji: "🌈", tipo: "mineral", rareza: "comun", precio_venta: 15 },
    { id: "Piedra", nombre: "Piedra", emoji: "🪨", tipo: "mineral", rareza: "basico", precio_venta: 2 },
    { id: "Grava", nombre: "Grava", emoji: "🔸", tipo: "mineral", rareza: "basico", precio_venta: 1 },
    { id: "Roca común", nombre: "Roca común", emoji: "🗿", tipo: "mineral", rareza: "basico", precio_venta: 1 },

    // PECES (Pescar)
    { id: "Dragón Marino", nombre: "Dragón Marino", emoji: "🐉", tipo: "pez", rareza: "mitico", precio_venta: 200 },
    { id: "Leviatán Bebé", nombre: "Leviatán Bebé", emoji: "🐳", tipo: "pez", rareza: "mitico", precio_venta: 180 },
    { id: "Sirena Escamosa", nombre: "Sirena Escamosa", emoji: "🧜", tipo: "pez", rareza: "mitico", precio_venta: 190 },
    { id: "Anguila Astral", nombre: "Anguila Astral", emoji: "⚡", tipo: "pez", rareza: "legendario", precio_venta: 100 },
    { id: "Koi Dorado", nombre: "Koi Dorado", emoji: "🐟", tipo: "pez", rareza: "legendario", precio_venta: 95 },
    { id: "Tiburón Bebé", nombre: "Tiburón Bebé", emoji: "🦈", tipo: "pez", rareza: "legendario", precio_venta: 90 },
    { id: "Pez Espada Lunar", nombre: "Pez Espada Lunar", emoji: "🗡️", tipo: "pez", rareza: "legendario", precio_venta: 85 },
    { id: "Manta Raya Celeste", nombre: "Manta Raya Celeste", emoji: "🫶", tipo: "pez", rareza: "legendario", precio_venta: 88 },
    { id: "Atún Gigante", nombre: "Atún Gigante", emoji: "🐟", tipo: "pez", rareza: "legendario", precio_venta: 82 },
    { id: "Salmón Real", nombre: "Salmón Real", emoji: "🐟", tipo: "pez", rareza: "epico", precio_venta: 55 },
    { id: "Lubina Plateada", nombre: "Lubina Plateada", emoji: "🐠", tipo: "pez", rareza: "epico", precio_venta: 50 },
    { id: "Pez Globo Mágico", nombre: "Pez Globo Mágico", emoji: "🐡", tipo: "pez", rareza: "epico", precio_venta: 48 },
    { id: "Caballito de Mar Dorado", nombre: "Caballito de Mar Dorado", emoji: "🫸", tipo: "pez", rareza: "epico", precio_venta: 45 },
    { id: "Medusa Luna", nombre: "Medusa Luna", emoji: "🌙", tipo: "pez", rareza: "epico", precio_venta: 52 },
    { id: "Trucha Arcoiris", nombre: "Trucha Arcoiris", emoji: "🌈", tipo: "pez", rareza: "raro", precio_venta: 30 },
    { id: "Carpa Koi", nombre: "Carpa Koi", emoji: "🐟", tipo: "pez", rareza: "raro", precio_venta: 28 },
    { id: "Pez Payaso", nombre: "Pez Payaso", emoji: "🤡", tipo: "pez", rareza: "raro", precio_venta: 25 },
    { id: "Morena Verde", nombre: "Morena Verde", emoji: "🐍", tipo: "pez", rareza: "raro", precio_venta: 32 },
    { id: "Perca Dorada", nombre: "Perca Dorada", emoji: "🟡", tipo: "pez", rareza: "raro", precio_venta: 27 },
    { id: "Pescado", nombre: "Pescado", emoji: "🐟", tipo: "pez", rareza: "comun", precio_venta: 8 },
    { id: "Trucha Clara", nombre: "Trucha Clara", emoji: "🐠", tipo: "pez", rareza: "comun", precio_venta: 10 },
    { id: "Mojarra", nombre: "Mojarra", emoji: "🐟", tipo: "pez", rareza: "comun", precio_venta: 9 },
    { id: "Bagre Joven", nombre: "Bagre Joven", emoji: "🐟", tipo: "pez", rareza: "comun", precio_venta: 8 },
    { id: "Carpa Soleada", nombre: "Carpa Soleada", emoji: "🐠", tipo: "pez", rareza: "comun", precio_venta: 11 },
    { id: "Róbalo", nombre: "Róbalo", emoji: "🐟", tipo: "pez", rareza: "comun", precio_venta: 12 },
    { id: "Pejerrey", nombre: "Pejerrey", emoji: "🐠", tipo: "pez", rareza: "comun", precio_venta: 10 },
    { id: "Bagre Sombrío", nombre: "Bagre Sombrío", emoji: "🐟", tipo: "pez", rareza: "comun", precio_venta: 13 },
    { id: "Anguila Común", nombre: "Anguila Común", emoji: "🐍", tipo: "pez", rareza: "comun", precio_venta: 14 },
    { id: "Pez Gato", nombre: "Pez Gato", emoji: "🐈", tipo: "pez", rareza: "comun", precio_venta: 11 },
    { id: "Sardina de Luna", nombre: "Sardina de Luna", emoji: "🌙", tipo: "pez", rareza: "comun", precio_venta: 9 },
    { id: "Anchoa Nocturna", nombre: "Anchoa Nocturna", emoji: "🐟", tipo: "pez", rareza: "comun", precio_venta: 8 },
    { id: "Boquerón", nombre: "Boquerón", emoji: "🐠", tipo: "pez", rareza: "comun", precio_venta: 7 },
    { id: "Botella con mensaje", nombre: "Botella con mensaje", emoji: "🍾", tipo: "tesoro", rareza: "raro", precio_venta: 0 },

    // FOTOS (Fotografiar)
    { id: "Foto de Fénix", nombre: "Foto de Fénix", emoji: "🔥", tipo: "foto", rareza: "mitico", precio_venta: 250 },
    { id: "Foto de Pájaro Trueno", nombre: "Foto de Pájaro Trueno", emoji: "⚡", tipo: "foto", rareza: "mitico", precio_venta: 230 },
    { id: "Foto de Águila Real", nombre: "Foto de Águila Real", emoji: "🦅", tipo: "foto", rareza: "legendario", precio_venta: 120 },
    { id: "Foto de Búho Nival", nombre: "Foto de Búho Nival", emoji: "🦉", tipo: "foto", rareza: "legendario", precio_venta: 110 },
    { id: "Foto de Halcón Peregrino", nombre: "Foto de Halcón Peregrino", emoji: "🦅", tipo: "foto", rareza: "epico", precio_venta: 65 },
    { id: "Foto de Martín Pescador", nombre: "Foto de Martín Pescador", emoji: "🐦", tipo: "foto", rareza: "epico", precio_venta: 60 },
    { id: "Foto de Tucán", nombre: "Foto de Tucán", emoji: "🦜", tipo: "foto", rareza: "raro", precio_venta: 35 },
    { id: "Foto de Picaflor", nombre: "Foto de Picaflor", emoji: "🪶", tipo: "foto", rareza: "raro", precio_venta: 30 },
    { id: "Foto de Loro Macho", nombre: "Foto de Loro Macho", emoji: "🦜", tipo: "foto", rareza: "poco_comun", precio_venta: 18 },
    { id: "Foto de Golondrina", nombre: "Foto de Golondrina", emoji: "🐦", tipo: "foto", rareza: "poco_comun", precio_venta: 15 },
    { id: "Foto de Paloma", nombre: "Foto de Paloma", emoji: "🕊️", tipo: "foto", rareza: "comun", precio_venta: 5 },
    { id: "Foto de Gorrión", nombre: "Foto de Gorrión", emoji: "🐦", tipo: "foto", rareza: "comun", precio_venta: 4 },
    { id: "Foto Borrosa", nombre: "Foto Borrosa", emoji: "📷", tipo: "foto", rareza: "comun", precio_venta: 1 },

    // FRUTAS (Talar)
    { id: "Manzana Dorada", nombre: "Manzana Dorada", emoji: "🍎", tipo: "fruta", rareza: "epico", precio_venta: 60 },
    { id: "Durazno Plateado", nombre: "Durazno Plateado", emoji: "🍑", tipo: "fruta", rareza: "epico", precio_venta: 58 },
    { id: "Pera Cristalina", nombre: "Pera Cristalina", emoji: "🍐", tipo: "fruta", rareza: "epico", precio_venta: 55 },
    { id: "Ciruela Mágica", nombre: "Ciruela Mágica", emoji: "🫐", tipo: "fruta", rareza: "epico", precio_venta: 57 },
    { id: "Naranjas", nombre: "Naranjas", emoji: "🍊", tipo: "fruta", rareza: "raro", precio_venta: 20 },
    { id: "Peras", nombre: "Peras", emoji: "🍐", tipo: "fruta", rareza: "raro", precio_venta: 18 },
    { id: "Duraznos", nombre: "Duraznos", emoji: "🍑", tipo: "fruta", rareza: "raro", precio_venta: 19 },
    { id: "Ciruelas", nombre: "Ciruelas", emoji: "🫐", tipo: "fruta", rareza: "raro", precio_venta: 17 },
    { id: "Cerezas", nombre: "Cerezas", emoji: "🍒", tipo: "fruta", rareza: "raro", precio_venta: 16 },
    { id: "Limones", nombre: "Limones", emoji: "🍋", tipo: "fruta", rareza: "raro", precio_venta: 15 },
    { id: "Manzanas", nombre: "Manzanas", emoji: "🍎", tipo: "fruta", rareza: "comun", precio_venta: 8 },
    { id: "Coco", nombre: "Coco", emoji: "🥥", tipo: "fruta", rareza: "comun", precio_venta: 12 },
    { id: "Plátanos", nombre: "Plátanos", emoji: "🍌", tipo: "fruta", rareza: "comun", precio_venta: 6 },
    { id: "Fresas", nombre: "Fresas", emoji: "🍓", tipo: "fruta", rareza: "comun", precio_venta: 7 },
    { id: "Uvas", nombre: "Uvas", emoji: "🍇", tipo: "fruta", rareza: "comun", precio_venta: 5 },
    { id: "Sandía", nombre: "Sandía", emoji: "🍉", tipo: "fruta", rareza: "comun", precio_venta: 15 },
    { id: "Melón", nombre: "Melón", emoji: "🍈", tipo: "fruta", rareza: "comun", precio_venta: 14 },
    { id: "Pluma brillante", nombre: "Pluma brillante", emoji: "🪶", tipo: "objeto", rareza: "raro", precio_venta: 35 },
    { id: "Huevo de Pájaro", nombre: "Huevo de Pájaro", emoji: "🥚", tipo: "objeto", rareza: "poco_comun", precio_venta: 20 },
    { id: "Rama Dorada", nombre: "Rama Dorada", emoji: "🌿", tipo: "objeto", rareza: "poco_comun", precio_venta: 25 },

    // BICHOS (Capturar)
    { id: "Escarabajo Divino", nombre: "Escarabajo Divino", emoji: "🐞", tipo: "bicho", rareza: "mitico", precio_venta: 250 },
    { id: "Fénix Polilla", nombre: "Fénix Polilla", emoji: "🦋", tipo: "bicho", rareza: "mitico", precio_venta: 240 },
    { id: "Libélula Arcoiris", nombre: "Libélula Arcoiris", emoji: "🪰", tipo: "bicho", rareza: "mitico", precio_venta: 230 },
    { id: "Tarántula", nombre: "Tarántula", emoji: "🕷️", tipo: "bicho", rareza: "legendario", precio_venta: 120 },
    { id: "Escorpión Dorado", nombre: "Escorpión Dorado", emoji: "🦂", tipo: "bicho", rareza: "legendario", precio_venta: 115 },
    { id: "Cicada Gigante", nombre: "Cicada Gigante", emoji: "🦗", tipo: "bicho", rareza: "legendario", precio_venta: 110 },
    { id: "Luciérnaga Estelar", nombre: "Luciérnaga Estelar", emoji: "✨", tipo: "bicho", rareza: "legendario", precio_venta: 105 },
    { id: "Abeja Reina", nombre: "Abeja Reina", emoji: "🐝", tipo: "bicho", rareza: "legendario", precio_venta: 100 },
    { id: "Mariposa Emperador", nombre: "Mariposa Emperador", emoji: "🦋", tipo: "bicho", rareza: "epico", precio_venta: 65 },
    { id: "Oruga Tornasol", nombre: "Oruga Tornasol", emoji: "🐛", tipo: "bicho", rareza: "epico", precio_venta: 60 },
    { id: "Grillo Dorado", nombre: "Grillo Dorado", emoji: "🦗", tipo: "bicho", rareza: "epico", precio_venta: 58 },
    { id: "Saltamontes Esmeralda", nombre: "Saltamontes Esmeralda", emoji: "🦗", tipo: "bicho", rareza: "epico", precio_venta: 62 },
    { id: "Escarabajo Rinoceronte", nombre: "Escarabajo Rinoceronte", emoji: "🪲", tipo: "bicho", rareza: "epico", precio_venta: 67 },
    { id: "Abeja Mielera", nombre: "Abeja Mielera", emoji: "🐝", tipo: "bicho", rareza: "raro", precio_venta: 35 },
    { id: "Mariposa Nocturna", nombre: "Mariposa Nocturna", emoji: "🦋", tipo: "bicho", rareza: "raro", precio_venta: 32 },
    { id: "Libélula Azul", nombre: "Libélula Azul", emoji: "🦗", tipo: "bicho", rareza: "raro", precio_venta: 30 },
    { id: "Crisopa Verde", nombre: "Crisopa Verde", emoji: "🐛", tipo: "bicho", rareza: "raro", precio_venta: 28 },
    { id: "Chinche Soldado", nombre: "Chinche Soldado", emoji: "🐞", tipo: "bicho", rareza: "raro", precio_venta: 26 },
    { id: "Mosca Dragón", nombre: "Mosca Dragón", emoji: "🦗", tipo: "bicho", rareza: "raro", precio_venta: 33 },
    { id: "Mantis Religiosa", nombre: "Mantis Religiosa", emoji: "🦗", tipo: "bicho", rareza: "poco_comun", precio_venta: 18 },
    { id: "Mariquita", nombre: "Mariquita", emoji: "🐞", tipo: "bicho", rareza: "poco_comun", precio_venta: 15 },
    { id: "Catarina", nombre: "Catarina", emoji: "🐞", tipo: "bicho", rareza: "poco_comun", precio_venta: 16 },
    { id: "Hormiga Roja", nombre: "Hormiga Roja", emoji: "🐜", tipo: "bicho", rareza: "poco_comun", precio_venta: 12 },
    { id: "Mosca Verde", nombre: "Mosca Verde", emoji: "🪰", tipo: "bicho", rareza: "poco_comun", precio_venta: 14 },
    { id: "Caracolito", nombre: "Caracolito", emoji: "🐌", tipo: "bicho", rareza: "poco_comun", precio_venta: 10 },
    { id: "Hormiga", nombre: "Hormiga", emoji: "🐜", tipo: "bicho", rareza: "comun", precio_venta: 3 },
    { id: "Mosca", nombre: "Mosca", emoji: "🪰", tipo: "bicho", rareza: "comun", precio_venta: 2 },
    { id: "Mosquito", nombre: "Mosquito", emoji: "🫰", tipo: "bicho", rareza: "comun", precio_venta: 2 },
    { id: "Polilla", nombre: "Polilla", emoji: "🦋", tipo: "bicho", rareza: "comun", precio_venta: 4 },
    { id: "Escarabajo", nombre: "Escarabajo", emoji: "🪲", tipo: "bicho", rareza: "comun", precio_venta: 5 },
    { id: "Gusano", nombre: "Gusano", emoji: "🪱", tipo: "bicho", rareza: "comun", precio_venta: 3 },
    { id: "Araña Pequeña", nombre: "Araña Pequeña", emoji: "🕷️", tipo: "bicho", rareza: "comun", precio_venta: 6 },
    { id: "Tijereta", nombre: "Tijereta", emoji: "🦗", tipo: "bicho", rareza: "comun", precio_venta: 4 },
  ];

  try {
    for (const item of items) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO items_economia (id, nombre, emoji, tipo, rareza, precio_venta)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [item.id, item.nombre, item.emoji, item.tipo, item.rareza, item.precio_venta],
      });
    }
    console.log(`[DB] Items de economía verificados al inicio (${items.length} items obtenibles).`);
  } catch (err) {
    console.error("[DB] Error en seedItemsEconomia:", err);
  }
}

/**
 * Construye el caché de autocompletado para todas las tablas de colecciones.
 * @async
 * @returns {Promise<Object>} Objeto con cache normalizado por tabla
 */
export async function buildAutocompleteCache() {
  const cache = {};
  const tables = ["peces", "insectos", "aves", "animales", "cultivos", "recolectables", "habitantes", "logros", "recetas"];

  for (const table of tables) {
    try {
      const result = await db.execute(`SELECT id FROM ${table}`);
      cache[table] = (result?.rows ?? []).map(row => ({
        original: String(row?.id ?? ""),
        normalized: String(row?.id ?? "")
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

/**
 * Guarda o actualiza el game_id de un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @param {string} gameId - ID del juego a guardar
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function saveGameId(userId, gameId) {
  try {
    if (!userId || !gameId) {
      console.warn("[DB] saveGameId: userId o gameId vacío");
      return null;
    }
    return await db.execute({
      sql: "INSERT INTO game_ids (user_id, game_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET game_id = excluded.game_id",
      args: [String(userId), String(gameId)],
    });
  } catch (err) {
    console.error("[DB] Error guardando game_id:", err);
    return null;
  }
}

/**
 * Obtiene el game_id de un usuario.
 * @async
 * @param {string} userId - ID del usuario de Discord
 * @returns {Promise<string|null>} Game ID o null si no existe
 */
export async function getGameId(userId) {
  try {
    if (!userId) return null;
    const result = await db.execute({
      sql: "SELECT game_id FROM game_ids WHERE user_id = ?",
      args: [String(userId)],
    });
    return result?.rows?.length > 0 ? result.rows[0].game_id : null;
  } catch (err) {
    console.error("[DB] Error obteniendo game_id:", err);
    return null;
  }
}

export { db };


