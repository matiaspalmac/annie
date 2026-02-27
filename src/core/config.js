const APP_NAME = "Annie";
const APP_VERSION = "2.2";
const APP_SEMVER = "2.2.0";

export const CONFIG = {
  APP_NAME,
  APP_VERSION,
  APP_SEMVER,
  APP_LABEL: `${APP_NAME} V${APP_VERSION}`,
  TOKEN: process.env.DISCORD_BOT_TOKEN,
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  TURSO_URL: process.env.TURSO_DATABASE_URL,
  TURSO_TOKEN: process.env.TURSO_AUTH_TOKEN,

  // Paleta de colores temática de Annie — se sobreescribe con loadConfig() desde la DB
  // Cada sección del bot tiene color propio para mantener coherencia visual
  COLORES: {
    // 🌸 Identidad de Annie — errores, mensajes vacíos, bienvenidas
    ROSA: "#FFB7C5",

    // 🪙 Economía y monedas — balance, niveles, diario
    DORADO: "#FFD700",

    // 🏦 Banco y transacciones financieras
    AZUL: "#5B8DEF",

    // 🌊 Pesca — actividad acuática
    CIAN: "#00BCD4",

    // ⛏️ Minería — tierra y gemas
    NARANJA: "#F8961E",

    // 🌲 Tala, naturaleza y captura de bichos/insectos
    VERDE: "#4CAF50",

    // 📷 Fotografía — arte y colecciones
    VIOLETA: "#9B59B6",

    // 🐾 Mascotas — mimar, alimentar, cuidado
    MENTA: "#3EB489",

    // 🎁 Regalos, diario semanal, cofres
    MAGENTA: "#E91E8C",

    // ⚡ Cooldowns, alertas, robos, apuestas
    ROJO: "#E74C3C",

    // ❄️ Clima frío, efectos negativos
    CELESTE: "#A7D8DE",

    // 🌅 Info, clima general, enciclopedia
    CIELO: "#87CEEB",

    // 🏆 Ranking, podios, logros
    AMARILLO: "#FAD02E",

    // 🐛 Insectos y bugs (enciclopedia)
    INSECTO: "#FFD166",

    // 🌱 Cultivos y recetas
    OLIVA: "#90BE6D",

    // 🎰 Casino y juegos
    CASINO: "#8E44AD",
  },
};
