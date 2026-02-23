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
};
