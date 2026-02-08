// ============================================================
// Annie Bot v2 — Configuracion Central
// ============================================================

export const CONFIG = {
  TOKEN: process.env.DISCORD_BOT_TOKEN,
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  TIMEZONE: "America/Santiago",
  TIMEZONE_VOZ: "America/New_York",
  GUILD_ID: "1463659718382977253",

  // Canales
  CANAL_GENERAL_ID: "1463659720207372464",
  CANAL_HORA_ID: "1465953316029726801",
  CANAL_CLIMA_ID: "1466973835831283876",
  CANAL_VOZ_DORMIR_ID: "1466250598302355570",

  // Roles
  MENSAJE_ROLES_ID: "1470188601760284931",
  REACTION_ROLES: {
    "\uD83E\uDEB2": "1465882704607449190",   // insectos
    "\uD83E\uDEE7": "1465882796198330389",   // burbujas
    "\uD83E\uDD86": "1465882906881818654",   // pato
    "\uD83C\uDFA3": "1465883005162885445",   // pesca
    "\uD83E\uDEBA": "1465883082824483060",   // nido
    "\uD83D\uDC90": "1465928627123257550",   // flores
    "\uD83C\uDF20": "1469838445865079009",   // estrellas
  },

  // Annie
  ANNIE_IMG: "https://imgur.com/pCWlxKG.png",
  ANNIE_IMG_BIG: "https://imgur.com/pCWlxKG.png",
  WIKI_URL: "https://heartopiachile.vercel.app/",
  HORA_DORMIR: 23,
  HORA_DESPERTAR: 8,

  // Chisme
  UMBRAL_CHISME: 15,
  VENTANA_CHISME: 180000,
  COOLDOWN_CHISME: 900000,

  // Colores
  COLORES: {
    ROSA: "#FFB7C5",
    VERDE: "#A8E6CF",
    AZUL: "#A8DADC",
    AMARILLO: "#FAD02E",
    NARANJA: "#F8961E",
    DORADO: "#FFD700",
    OLIVA: "#90BE6D",
    INSECTO: "#FFD166",
    CIELO: "#A7D8DE",
  },
};
