import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { db } from "./src/db.js";
import { CONFIG } from "./src/config.js";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
});

client.once("ready", async () => {
    console.log(`Conectado como ${client.user.tag}`);
    try {
        const guild = await client.guilds.fetch("1463659718382977253");
        console.log(`Cargando miembros del servidor: ${guild.name}...`);

        const members = await guild.members.fetch();
        const validMembers = members.filter(m => !m.user.bot);

        let added = 0;
        let updated = 0;
        let errors = 0;

        console.log(`Procesando ${validMembers.size} vecinos...`);

        for (const [id, member] of validMembers) {
            const username = member.user.username;
            const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 }) || null;
            try {
                const res = await db.execute({
                    sql: "SELECT id FROM usuarios WHERE id = ?",
                    args: [id]
                });

                if (res.rows.length === 0) {
                    await db.execute({
                        sql: "INSERT INTO usuarios (id, username, avatar, monedas, xp, nivel) VALUES (?, ?, ?, 0, 0, 1)",
                        args: [id, username, avatarUrl]
                    });
                    added++;
                } else {
                    await db.execute({
                        sql: "UPDATE usuarios SET username = ?, avatar = ? WHERE id = ?",
                        args: [username, avatarUrl, id]
                    });
                    updated++;
                }
            } catch (e) {
                console.error(`Error con ${username} (${id}):`, e.message);
                errors++;
            }
        }

        console.log(`
✅ ¡Sincronización Terminada!
-----------------------------------
Vecinos Nuevos Registrados: ${added}
Nombres Actualizados: ${updated}
Errores Encontrados: ${errors}
-----------------------------------
Ya puedes revisar tu top/rankings en la web.`);

    } catch (err) {
        console.error("Error fatal:", err);
    } finally {
        process.exit(0);
    }
});

client.login(CONFIG.TOKEN);
