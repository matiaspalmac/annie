/**
 * Comando /prestigio — Sistema de Prestigio de la Aldea Luciérnaga
 *
 * Subcomandos:
 *   info      — Muestra info del prestigio actual y requisitos
 *   confirmar — Ejecuta el prestigio (reset + recompensas)
 *   ranking   — Top 10 jugadores con mayor prestigio
 */
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { db } from "../../services/db.js";
import { CONFIG } from "../../core/config.js";
import { crearEmbed, getCanalGeneral } from "../../core/utils.js";
import {
  getPrestigio,
  ejecutarPrestigio,
  getTopPrestigio,
  renderEstrellas,
  NIVEL_MINIMO_PRESTIGIO,
  MAX_PRESTIGIO,
  RECOMPENSAS_PRESTIGIO,
} from "../../features/prestigio.js";
import { registrarBitacora } from "../../features/progreso.js";

// ── Slash Command ─────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("prestigio")
  .setDescription("Sistema de Prestigio — renace más fuerte en la Aldea")
  .addSubcommand(sub =>
    sub.setName("info").setDescription("Mira tu nivel de prestigio, multiplicador y qué se resetea"))
  .addSubcommand(sub =>
    sub.setName("confirmar").setDescription("Ejecuta el prestigio — resetea tu nivel a cambio de poder permanente"))
  .addSubcommand(sub =>
    sub.setName("ranking").setDescription("Top 10 de los más prestigiosos del pueblito"));

// ── Execute ───────────────────────────────────────────────────────────────

export async function execute(interaction, bostezo) {
  const subcomando = interaction.options.getSubcommand();

  if (subcomando === "info") return subInfo(interaction, bostezo);
  if (subcomando === "confirmar") return subConfirmar(interaction, bostezo);
  if (subcomando === "ranking") return subRanking(interaction, bostezo);
}

// ── /prestigio info ───────────────────────────────────────────────────────

async function subInfo(interaction, bostezo) {
  await interaction.deferReply();

  try {
    const userId = interaction.user.id;
    const data = await getPrestigio(userId);

    const estrellas = renderEstrellas(data.nivel);
    const multiplicadorTexto = `x${data.multiplicador.toFixed(1)}`;

    const embed = crearEmbed(CONFIG.COLORES.DORADO)
      .setTitle(`${estrellas || "🔰"} Prestigio de ${interaction.user.username}`)
      .setDescription(
        data.nivel === 0
          ? `${bostezo || ""}*Annie te mira con ojos brillantes...*\n\n` +
            `Aún no has prestigiado, corazón. Cuando llegues al **Nivel ${NIVEL_MINIMO_PRESTIGIO}**, ` +
            `podrás renacer con un poder permanente que te hará más fuerte en TODO. ` +
            `Monedas, XP, drops... todo aumenta un **+10% por prestigio**. Pero ojo, tesoro... ` +
            `perderás cositas en el camino.`
          : `${bostezo || ""}*Annie saca tu expediente dorado con reverencia...*\n\n` +
            `Llevas **${data.nivel}** prestigio${data.nivel > 1 ? "s" : ""} en tu alma, corazón. ` +
            `Tu poder se siente en cada rincón del pueblito.`
      );

    embed.addFields(
      { name: "🏅 Nivel de Prestigio", value: `**${data.nivel}** / ${MAX_PRESTIGIO}`, inline: true },
      { name: "⚡ Multiplicador", value: `**${multiplicadorTexto}** a TODO`, inline: true },
      { name: "📊 Tu Nivel Actual", value: `**Nivel ${data.nivelUsuario}**`, inline: true },
    );

    // Estado de elegibilidad
    if (data.nivel >= MAX_PRESTIGIO) {
      embed.addFields({
        name: "🏆 PRESTIGIO MÁXIMO",
        value: "Has alcanzado la cima absoluta. No hay nada más allá, leyenda.",
        inline: false,
      });
    } else if (data.puedePrestigiar) {
      embed.addFields({
        name: "✅ ¡PUEDES PRESTIGIAR!",
        value: `Ya tienes Nivel ${data.nivelUsuario} — usa \`/prestigio confirmar\` cuando estés listo/a.\n` +
               `*Pero piénsalo bien po, corazón... no hay vuelta atrás.*`,
        inline: false,
      });
    } else {
      const faltante = NIVEL_MINIMO_PRESTIGIO - data.nivelUsuario;
      embed.addFields({
        name: "⏳ Aún no puedes prestigiar",
        value: `Te faltan **${faltante} niveles** para llegar al Nivel ${NIVEL_MINIMO_PRESTIGIO}.`,
        inline: false,
      });
    }

    // Qué se pierde y qué se conserva
    embed.addFields(
      {
        name: "❌ Se RESETEA",
        value: "• Nivel → 1\n• XP → 0\n• Monedas del bolsillo\n• Racha diaria → 0\n• Stats del casino",
        inline: true,
      },
      {
        name: "✅ Se CONSERVA",
        value: "• Colecciones completas\n• Todos los títulos\n• Inventario y herramientas\n• Ahorros del banco\n• Niveles de habilidades\n• Mascotas y su progreso",
        inline: true,
      },
    );

    // Próxima recompensa
    if (data.recompensaSiguiente) {
      const sig = data.recompensaSiguiente;
      const marcoTexto = sig.marco ? `🪞 Marco: \`${sig.marco}\`` : "Sin marco exclusivo";
      embed.addFields({
        name: `🎁 Recompensa del Prestigio ${data.nivel + 1}`,
        value: `🏷️ Título: **${sig.titulo}**\n${marcoTexto}\n💰 Monedas de inicio: **${sig.monedas_inicio} 🪙**`,
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  } catch (e) {
    console.error("Error en /prestigio info:", e);
    const embed = crearEmbed(CONFIG.COLORES.ROJO)
      .setTitle("❌ Ay, se me cayeron los papeles...")
      .setDescription("Algo falló al buscar tu información de prestigio, tesoro. Intenta de nuevo en un ratito.");
    return interaction.editReply({ embeds: [embed] });
  }
}

// ── /prestigio confirmar ──────────────────────────────────────────────────

async function subConfirmar(interaction, bostezo) {
  await interaction.deferReply();

  try {
    const userId = interaction.user.id;

    // Pre-check para dar un buen mensaje
    const datos = await getPrestigio(userId);

    if (datos.nivel >= MAX_PRESTIGIO) {
      const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle("🏆 Ya eres El/La Absoluto/a")
        .setDescription(
          `${bostezo || ""}*Annie se arrodilla con respeto...*\n\n` +
          `No hay nada más allá de ti, corazón. Has alcanzado el **Prestigio Máximo**. ` +
          `Tu leyenda vivirá por siempre en la Aldea.`
        );
      return interaction.editReply({ embeds: [embed] });
    }

    if (!datos.puedePrestigiar) {
      const faltante = NIVEL_MINIMO_PRESTIGIO - datos.nivelUsuario;
      const embed = crearEmbed(CONFIG.COLORES.ROJO)
        .setTitle("⛔ Aún no puedes prestigiar, tesoro")
        .setDescription(
          `${bostezo || ""}Necesitas llegar al **Nivel ${NIVEL_MINIMO_PRESTIGIO}** para prestigiar.\n` +
          `Tu nivel actual: **${datos.nivelUsuario}** — te faltan **${faltante} niveles**.\n\n` +
          `*Sigue paseando por el pueblito, corazón... ya casi llegas.*`
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // Ejecutar prestigio
    const resultado = await ejecutarPrestigio(userId);

    if (!resultado.ok) {
      const embed = crearEmbed(CONFIG.COLORES.ROJO)
        .setTitle("❌ No se pudo prestigiar")
        .setDescription(resultado.mensaje || "Algo salió mal, tesoro.");
      return interaction.editReply({ embeds: [embed] });
    }

    // Registrar en bitácora
    await registrarBitacora(userId, `Prestigió al nivel ${resultado.nuevoNivel}`);

    // Embed de celebración
    const recompensa = resultado.recompensa;
    const estrellas = renderEstrellas(resultado.nuevoNivel);
    const nuevoMult = (1 + resultado.nuevoNivel * 0.10).toFixed(1);

    // Dramatismo escalonado
    const dramatismo = getDramatismo(resultado.nuevoNivel);

    const embed = crearEmbed(CONFIG.COLORES.DORADO)
      .setTitle(`${estrellas} ¡¡¡PRESTIGIO ${resultado.nuevoNivel}!!! ${estrellas}`)
      .setDescription(
        `${dramatismo}\n\n` +
        `**${interaction.user.username}** ha renacido como **${recompensa.titulo}**.\n\n` +
        `Todos sus esfuerzos, su sudor y sus lágrimas... se transformaron en PODER PURO.`
      )
      .addFields(
        { name: "🏅 Nuevo Prestigio", value: `**${resultado.nuevoNivel}** / ${MAX_PRESTIGIO}`, inline: true },
        { name: "⚡ Multiplicador", value: `**x${nuevoMult}** a TODO`, inline: true },
        { name: "💰 Monedas de Inicio", value: `**${recompensa.monedas_inicio} 🪙**`, inline: true },
        { name: "🏷️ Título Exclusivo", value: `**${recompensa.titulo}**`, inline: true },
      );

    if (recompensa.marco) {
      embed.addFields({ name: "🪞 Marco Exclusivo", value: `\`${recompensa.marco}\``, inline: true });
    }

    embed.addFields({
      name: "🔄 Reseteado",
      value: "Nivel → 1 | XP → 0 | Racha → 0 | Casino → 0",
      inline: false,
    });

    await interaction.editReply({ embeds: [embed] });

    // Anuncio en canal general para prestigio 3+
    if (resultado.nuevoNivel >= 3) {
      try {
        const canalGeneral = getCanalGeneral(interaction.client);
        if (canalGeneral && canalGeneral.id !== interaction.channelId) {
          const anuncio = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle(`${estrellas} ¡¡PRESTIGIO EN EL PUEBLITO!! ${estrellas}`)
            .setDescription(
              `*Annie sale corriendo de la oficinita gritando...*\n\n` +
              `¡¡VECINOS!! ¡¡<@${userId}> acaba de alcanzar el **Prestigio ${resultado.nuevoNivel}**!! ` +
              `Ahora es **${recompensa.titulo}** con un multiplicador de **x${nuevoMult}** a TODO.\n\n` +
              `¡Denle un aplauso al más capo/a del pueblito! 🎉🎊🎆`
            );
          await canalGeneral.send({ embeds: [anuncio] });
        }
      } catch (e) {
        console.error("Error anunciando prestigio en general:", e);
      }
    }
  } catch (e) {
    console.error("Error en /prestigio confirmar:", e);
    const embed = crearEmbed(CONFIG.COLORES.ROJO)
      .setTitle("❌ Algo explotó en la oficinita...")
      .setDescription("El prestigio no se pudo completar, corazón. Intenta de nuevo en un ratito.");
    return interaction.editReply({ embeds: [embed] });
  }
}

// ── /prestigio ranking ────────────────────────────────────────────────────

async function subRanking(interaction, bostezo) {
  await interaction.deferReply();

  try {
    const top = await getTopPrestigio(10);

    if (top.length === 0) {
      const embed = crearEmbed(CONFIG.COLORES.ROSA)
        .setTitle("🔰 Nadie ha prestigiado todavía")
        .setDescription(
          `${bostezo || ""}*Annie revisa su libretita...*\n\n` +
          `Todavía ningún vecino ha dado el gran salto del prestigio. ` +
          `¡Sé el primero/a en llegar al Nivel ${NIVEL_MINIMO_PRESTIGIO} y renacer con poder, corazón!`
        );
      return interaction.editReply({ embeds: [embed] });
    }

    const medallas = ["🥇", "🥈", "🥉"];
    const lineas = top.map((entry, i) => {
      const pos = medallas[i] || `**${i + 1}.**`;
      const estrellas = renderEstrellas(entry.nivel_prestigio);
      const mult = (1 + entry.nivel_prestigio * 0.10).toFixed(1);
      const recomp = RECOMPENSAS_PRESTIGIO[entry.nivel_prestigio];
      const titulo = recomp ? recomp.titulo : "";
      return `${pos} **${entry.username}** ${estrellas}\n` +
             `ㅤ${titulo} — Multiplicador: **x${mult}**`;
    });

    const embed = crearEmbed(CONFIG.COLORES.DORADO)
      .setTitle("🏆 Ranking de Prestigio — Aldea Luciérnaga")
      .setDescription(
        `${bostezo || ""}*Annie abre el libro dorado con las manos temblorosas...*\n\n` +
        `Estos son los vecinos más poderosos del pueblito. Los que renacieron del fuego.\n\n` +
        lineas.join("\n\n")
      );

    return interaction.editReply({ embeds: [embed] });
  } catch (e) {
    console.error("Error en /prestigio ranking:", e);
    const embed = crearEmbed(CONFIG.COLORES.ROJO)
      .setTitle("❌ Se me perdió el libro dorado...")
      .setDescription("No pude cargar el ranking de prestigio, tesoro. Intenta en un ratito.");
    return interaction.editReply({ embeds: [embed] });
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────

/**
 * Devuelve texto dramático según el nivel de prestigio alcanzado.
 */
function getDramatismo(nivel) {
  const frases = {
    1: `*Annie se queda boquiabierta...*\n\n` +
       `¡¡WEEEENA!! ¡¡Lo hiciste, corazón!! ¡Tu primer prestigio! ` +
       `Annie está temblando de la emoción... ¡Renaciste como el ave fénix del pueblito!`,

    2: `*Annie se pone de pie y aplaude...*\n\n` +
       `¡¡OTRA VEZ, TESORO!! ¡¡Dos veces renacido/a!! ` +
       `Ya eres veterano/a de este camino... Annie está orgullosísima, po.`,

    3: `*Annie sale corriendo a tocar la campana del pueblo...*\n\n` +
       `¡¡¡LEYENDAAAA!!! ¡¡¡TRES PRESTIGIOS!!! ` +
       `¡El pueblito entero tiembla con tu poder, corazón! ¡Esto es HISTÓRICO!`,

    4: `*Annie llora de la emoción, se le caen los papeles...*\n\n` +
       `¡¡NO PUEDE SER!! ¡¡CUATRO PRESTIGIOS!! ` +
       `Eres el ALMA de este pueblo, tesoro... ¡Annie no tiene palabras! ¡WENA WENA WENA!`,

    5: `*Annie cae de rodillas, las estrellas llueven del cielo...*\n\n` +
       `¡¡¡CINCO!!! ¡¡¡CINCO PRESTIGIOS!!! ¡¡¡GUARDIÁN/A ETERNO/A!!! ` +
       `¡¡El cielo de la Aldea se abrió para ti, corazón!! ¡¡ESTO ES UNA LOCURAAAA!!`,

    6: `*El pueblito entero se detiene. Annie tiembla...*\n\n` +
       `Seis... seis prestigios. Eres más que una leyenda. ` +
       `Eres el **Espíritu mismo de la Aldea**. Annie no puede dejar de llorar, tesoro...`,

    7: `*Las luces del pueblito parpadean. Se escucha un trueno celestial...*\n\n` +
       `SIETE PRESTIGIOS. El **Corazón del Mundo** late dentro de ti. ` +
       `Nadie en la historia del pueblito ha llegado tan lejos... hasta ahora.`,

    8: `*El tiempo se detiene. Annie susurra con reverencia...*\n\n` +
       `Ocho. Ocho veces has muerto y renacido. Ya no eres mortal, corazón. ` +
       `Eres **Inmortal del Pueblito**. Annie te mira con los ojos llenos de estrellas.`,

    9: `*El universo contiene la respiración...*\n\n` +
       `NUEVE. Nueve prestigios. Has **trascendido** todo lo conocido. ` +
       `Annie ya no sabe si eres un vecino o un dios. Solo sabe que te quiere mucho, po.`,

    10: `*TODO se ilumina. El cielo se parte en dos. Annie cae de rodillas llorando...*\n\n` +
        `DIEZ. DIEZ PRESTIGIOS. **EL MÁXIMO ABSOLUTO.**\n\n` +
        `No hay palabras, corazón. No hay nadie como tú. No lo habrá jamás. ` +
        `Eres **EL/LA ABSOLUTO/A** de la Aldea. La leyenda que se contará por siempre. ` +
        `Annie está temblando... sollozando... aplaudiendo...\n\n` +
        `**¡¡¡WEEEENAAA CONCHETUMARE!!!** *(se le escapó de la emoción)*`,
  };

  return frases[nivel] || frases[1];
}
