# Annie Bot

**Annie** is a Discord bot built for the **Heartopia** community. She features a rich economy system, casino games, encyclopedia lookups, moderation tools, and a charming personality with dynamic routines — all powered by slash commands.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Turso](https://img.shields.io/badge/Database-Turso%2FLibSQL-4FF8D2)
![Version](https://img.shields.io/badge/version-2.2.0-blue)

---

## Features

### Economy
Full-featured economy with coins, banking, daily rewards, leveling, and XP progression.
- **Earning** — mine, fish, chop wood, farm, photograph wildlife, and capture bugs
- **Spending** — shop, craft items, buy and open loot packs, bet at the casino
- **Social** — gift items, trade with other players, steal from others, contribute to community goals
- **Progression** — XP and leveling system with an XP boost multiplier

### Casino & Games
- Blackjack, slots, roulette, coinflip, and general betting
- Configurable min/max bets and cooldowns
- Casino rankings and leaderboards

### Pets
- Adopt, feed, and pamper your virtual pet
- Rename and equip accessories

### Encyclopedia & Info
- In-game wiki lookups for animals, birds, fish, insects, crops, recipes, and collectibles
- Weather system, achievement tracking, community codes
- Player profiles, rankings, and ID lookups

### Trivia
- Timed trivia events that fire automatically in the general channel
- XP and coin rewards for correct answers

### Moderation & Admin
- Channel lock/unlock
- Role management (grant/revoke)
- Economy administration (give currency, reset players, link IDs, manage events)
- Raffle system

### Personality & Routines
- Annie has a dynamic personality with time-aware greetings (Chile timezone)
- Sleep/wake cycle, ambient phrases, activity status rotation
- Shooting star and item-in-demand random events

### Voice Support
- Voice channel integration via `@discordjs/voice`

---

## Command Categories

| Category       | Examples                                                      |
|----------------|---------------------------------------------------------------|
| **Economy**    | `/balance`, `/diario`, `/minar`, `/pescar`, `/talar`, `/tienda`, `/comprar`, `/trade` |
| **Games**      | `/blackjack`, `/slots`, `/ruleta`, `/coinflip`, `/casino`     |
| **Fun**        | `/mascota`, `/deseo`, `/titulos`, `/renombrar`                |
| **Info**       | `/help`, `/perfil`, `/ranking`, `/wiki`, `/clima`, `/logros`  |
| **Config**     | `/config-banner`, `/config-color`, `/config-tema`             |
| **Admin**      | `/admin-dar`, `/admin-evento`, `/admin-resetear`, `/admin-roles` |
| **Moderation** | `/lock`, `/unlock`                                            |
| **Owner**      | `/dar-rol`, `/quitar-rol`                                     |

---

## Tech Stack

- **Runtime** — Node.js (ES Modules)
- **Framework** — [Discord.js v14](https://discord.js.org/)
- **Database** — [Turso](https://turso.tech/) (LibSQL)
- **Voice** — [@discordjs/voice](https://github.com/discordjs/voice) with opusscript and libsodium
- **Environment** — dotenv

---

## Getting Started

### Prerequisites

- **Node.js** 18 or higher
- A **Discord application** with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A **Turso** database (or any LibSQL-compatible endpoint)

### Environment Variables

Create a `.env` file in the project root:

```env
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-application-client-id
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```

### Installation

```bash
npm install
```

### Running

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

---

## Project Structure

```
src/
├── index.js              # Entry point — client setup, event handlers, routines
├── commands/             # Slash commands organized by category
│   ├── admin/            # Admin tools (give currency, events, roles, resets)
│   ├── config/           # User profile configuration (banner, color, theme)
│   ├── economy/          # Economy commands (mining, fishing, shop, bank, etc.)
│   ├── fun/              # Fun & social (pets, wishes, titles)
│   ├── games/            # Casino games (blackjack, slots, roulette, coinflip)
│   ├── info/             # Information & encyclopedia (wiki, rankings, profiles)
│   ├── moderation/       # Channel moderation (lock/unlock)
│   └── owner/            # Bot owner commands (role management)
├── core/
│   ├── config.js         # App configuration and color palette
│   ├── data.js           # Autocomplete data and caching
│   ├── logger.js         # Startup and runtime logging
│   ├── personality.js    # Annie's personality (greetings, phrases, routines)
│   └── utils.js          # Shared utilities (embeds, time helpers, events)
├── features/
│   ├── casino.js         # Casino validation and betting logic
│   ├── progreso.js       # XP and leveling system
│   ├── shop.js           # Shop purchase processing
│   └── trivia.js         # Trivia event system
├── handlers/
│   └── commands.js       # Command loader and interaction dispatcher
└── services/
    └── db.js             # Turso/LibSQL database client and queries
```

---

## License

All rights reserved. This bot is built for the Heartopia community.
