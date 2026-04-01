/**
 * Evento: messageCreate
 * Maneja XP, tarro de chuchadas, chisme, easter eggs, y respuestas de Annie.
 */
import { Events } from "discord.js";
import { CONFIG } from "../core/config.js";
import { estaDurmiendo } from "../core/state.js";
import {
  getHistorialMensajes, setHistorialMensajes,
  getUltimoChisme, setUltimoChisme,
} from "../core/state.js";
import { crearEmbed, getHoraChile } from "../core/utils.js";
import { getTrato } from "../core/personality.js";
import { db } from "../services/db.js";
import { updateUserProfile } from "../services/db-helpers.js";

export const event = Events.MessageCreate;
export const once = false;

// ── Constantes ────────────────────────────────────────────────
const CHUCHADAS = /\b(weon|weón|conchetumare|ctm|culiao|qlao|ql|puta|wea|weá|mierda)\b/i;

const EASTER_EGGS = {
  "11": "Chupalo entonces, corazón!",
  "5": "Por el culo te la hinco con cariño!",
  "13": "Mas me crece de ternura!",
  "8": "El culo te abrocho con amor!",
  "4": "En tu culo mi aparatito dulce!",
};

export async function execute(message, client) {
  if (message.author.bot) return;

  const msg = message;
  const texto = msg.content.toLowerCase();
  const ahora = Date.now();

  // ── Actualizar perfil silenciosamente ─────────────────────
  const avatarUrl = msg.author.displayAvatarURL({ extension: "png", size: 256 }) || null;
  updateUserProfile(msg.author.id, msg.author.username, avatarUrl).catch(() => {});

  // ── Tarro de las Chuchadas ────────────────────────────────
  if (CHUCHADAS.test(texto)) {
    await procesarChuchada(msg);
  }

  // ── Easter egg: mondongo ──────────────────────────────────
  if (/mondongo/i.test(texto)) {
    msg.reply({
      files: [{ attachment: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTb-m0Yqk1nEAvN0Z1GN4QuHY5lXXFDTj6CyA&s", name: "mondongo.jpg" }],
    }).catch(() => {});
  }

  // ── Detección de chisme ───────────────────────────────────
  if (message.channel.id === CONFIG.CANAL_GENERAL_ID) {
    await detectarChisme(msg, ahora);
  }

  // ── Easter eggs numéricos ─────────────────────────────────
  if (EASTER_EGGS[texto]) {
    return msg.reply(EASTER_EGGS[texto]).catch(() => {});
  }
  if (texto.startsWith("me gusta")) {
    return msg.reply("Y el pico? Acuerdese que soy de campo, vecino lindo!").catch(() => {});
  }

  // ── Respuestas de Annie a menciones ───────────────────────
  const mencionaAnnie = texto.includes("annie");

  if (estaDurmiendo()) {
    if ((texto.includes("hola") || texto.includes("holi") || texto.includes("wena")) && mencionaAnnie) {
      return msg.reply("*(Annie se despereza suave)* Zzz... ah? Wena mi vecino lindo... que necesitas tan tempranito?");
    }
    if ((texto.includes("gracias") || texto.includes("vale")) && mencionaAnnie) {
      return msg.reply("*(susurra dormida)* De nada po, corazón... Zzz... siempre aqui para ti.");
    }
    if (texto.includes("chao") || texto.includes("buenas noches")) {
      return msg.reply("Buenas noches, mi vecino precioso... suena bonito y abrigate, ya? Zzz...");
    }
  } else {
    if ((texto.includes("hola") || texto.includes("holi") || texto.includes("wena")) && mencionaAnnie) {
      return msg.reply("Wena, wena mi vecino lindo! Como estas hoy, corazón? Pasa no mas, estoy con tecito dulce.");
    }
    if ((texto.includes("gracias") || texto.includes("vale")) && mencionaAnnie) {
      return msg.reply("De nada po, mi alegria! Siempre aqui para ti, ya?");
    }
    if ((texto.includes("chao") || texto.includes("adios")) && mencionaAnnie) {
      return msg.reply("Chao, corazón! Cuidate harto y vuelve prontito, ya?");
    }
  }

  // ── Sistema de XP por mensaje ─────────────────────────────
  await procesarXp(msg, client);
}

// ── Handlers internos ─────────────────────────────────────────

async function procesarChuchada(msg) {
  try {
    const resVal = await db.execute({ sql: "SELECT monedas FROM usuarios WHERE id = ?", args: [msg.author.id] });
    if (resVal.rows.length > 0 && Number(resVal.rows[0].monedas) >= 5) {
      await db.execute({ sql: "UPDATE usuarios SET monedas = monedas - 5 WHERE id = ?", args: [msg.author.id] });

      const resEvento = await db.execute("SELECT id FROM eventos_globales WHERE activo = 1 LIMIT 1");
      if (resEvento.rows.length > 0) {
        const eventoId = resEvento.rows[0].id;
        await db.execute({ sql: "UPDATE eventos_globales SET progreso_monedas = progreso_monedas + 5 WHERE id = ?", args: [eventoId] });
        await db.execute({
          sql: "INSERT INTO evento_donaciones (evento_id, user_id, cantidad) VALUES (?, ?, 5) ON CONFLICT(evento_id, user_id) DO UPDATE SET cantidad = cantidad + 5",
          args: [eventoId, "Tarro Chuchadas"],
        });
      }
      await msg.reply("*(Annie frunce el ceño)* ¡Ay! ¡Esa boquita! 🧼 Te saqué **5 moneditas** p'al tarro de la Junta de Vecinos.");
    } else {
      await msg.reply("*(Annie te mira feo)* ¡Qué vocabulario! Te multaría, pero veo que andas aguja de monedas... ¡Pórtate bien!");
    }
  } catch (e) {
    console.error("Error tarro chuchadas:", e.message);
  }
}

async function detectarChisme(msg, ahora) {
  let historial = getHistorialMensajes();
  historial.push(ahora);
  historial = historial.filter(m => ahora - m < CONFIG.VENTANA_CHISME);
  setHistorialMensajes(historial);

  if (historial.length >= CONFIG.UMBRAL_CHISME && ahora - getUltimoChisme() > CONFIG.COOLDOWN_CHISME) {
    setUltimoChisme(ahora);
    setHistorialMensajes([]);

    const frasesChismeDia = [
      "Ay, vecino lindo... se me pararon las orejititas curiosas con tanto mensajito. Que paso po? Cuentame todo con cariño...",
      "Uy, uy, tesoro! El chat esta lleno de cositas lindas... que paso? No me dejes con la intriga, corazón.",
      "Mi vecino precioso! Se siente olor a chismecito dulce... me cuentas con ternura?",
    ];
    const frasesChismeNoche = [
      "*(Annie abre un ojito)* Ay, vecino lindo... que paso po? Se me pararon las orejititas curiosas... cuentame bajito.",
      "*(susurra somnolienta)* Zzz... chismecito? Ay, no me dejes con la intriga, corazón... que paso?",
      "*(bosteza lindo)* Uf... desperte por el ruido dulce... que cosita linda paso?",
    ];

    const pool = estaDurmiendo() ? frasesChismeNoche : frasesChismeDia;
    msg.channel.send(`*Annie asoma la cabecita con cariño:* "${pool[Math.floor(Math.random() * pool.length)]}"`).catch(() => {});
  }
}

async function procesarXp(msg, client) {
  if (Math.random() <= 0.3) return;

  const xpGanada = Math.floor(Math.random() * 3) + 1;
  const monedaGanada = Math.random() > 0.85 ? 1 : 0;

  try {
    await db.execute({
      sql: `INSERT INTO usuarios (id, monedas, xp, nivel) VALUES (?, ?, ?, 1)
            ON CONFLICT(id) DO UPDATE SET xp = usuarios.xp + excluded.xp, monedas = usuarios.monedas + excluded.monedas`,
      args: [msg.author.id, monedaGanada, xpGanada],
    });

    const r = await db.execute({ sql: "SELECT xp, nivel FROM usuarios WHERE id = ?", args: [msg.author.id] });
    if (r.rows.length > 0) {
      const xp = Number(r.rows[0].xp);
      const nivelAnterior = Number(r.rows[0].nivel);
      const nivelNuevo = Math.floor(0.1 * Math.sqrt(xp)) + 1;

      if (nivelNuevo > nivelAnterior) {
        await db.execute({ sql: "UPDATE usuarios SET nivel = ? WHERE id = ?", args: [nivelNuevo, msg.author.id] });
        const embed = crearEmbed(CONFIG.COLORES.DORADO)
          .setTitle("¡Subiste de Nivel!")
          .setDescription(`¡Felicidades <@${msg.author.id}>! Has alcanzado el **Nivel ${nivelNuevo}** paseando por el pueblito. 🥳`);

        let canalDestino = msg.channel;
        if (nivelNuevo % 5 === 0) {
          const cGeneral = client.channels.cache.get(CONFIG.CANAL_GENERAL_ID);
          if (cGeneral) canalDestino = cGeneral;
        } else {
          const canalComandosId = CONFIG.CONFIG_COMANDOS_ID || "1463662463693230110";
          const cComandos = client.channels.cache.get(canalComandosId);
          if (cComandos) canalDestino = cComandos;
        }

        canalDestino.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("Error otorgando XP:", e.message);
  }
}
