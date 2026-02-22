import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "../db.js";
import { getBostezo, crearEmbed, getItemEnDemanda } from "../utils.js";
import { CONFIG } from "../config.js";

const PRECIOS_ECONOMIA = {
    "Piedra": 1,
    "Mineral": 5,
    "Fluorita impecable": 100,
    "Pescado": 2,
    "Manzanas": 2,
    "Mantis Religiosa": 3,
    "Mariposa Emperador": 15,
    "Tarántula": 35
};

export const data = new SlashCommandBuilder()
    .setName("vender")
    .setDescription("Véndele a Annie todo lo que has farmeado (Piedritas, peces, manzanas) por moneditas.");

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
        const resInv = await db.execute({
            sql: "SELECT item_id, cantidad FROM inventario_economia WHERE user_id = ? AND cantidad > 0",
            args: [userId]
        });

        if (resInv.rows.length === 0) {
            return interaction.followUp(`${bostezo}Revisé tus bolsillos pero no vi nada que pueda comprarte, tesoro. ¡Sal a pescar o a picar rocas primero!`);
        }

        let textoResumen = "";
        let totalMonedas = 0;
        const itemDoris = getItemEnDemanda();
        let dorisAparecio = false;

        for (const row of resInv.rows) {
            const item = String(row.item_id);
            const qty = Number(row.cantidad);
            let precioUnitario = PRECIOS_ECONOMIA[item] || 1; // 1 por defecto por si acaso
            let multiplicadorTexto = "";

            if (item === itemDoris) {
                precioUnitario = precioUnitario * 3;
                multiplicadorTexto = " **(¡x3 Precio Doris!)**";
                dorisAparecio = true;
            }

            const subtotal = qty * precioUnitario;
            textoResumen += `• **${qty}x** ${item} *(+${subtotal} monedas)*${multiplicadorTexto}\n`;
            totalMonedas += subtotal;
        }

        if (dorisAparecio) {
            textoResumen += `\n🚀 **¡Doris te compró tus ${itemDoris} al triple de precio!**`;
        }

        // Día de pago especial? (Ej: Doble ganancia los viernes)
        const hoyDate = new Date();
        // 5 es viernes en getDay()
        const esViernes = hoyDate.getDay() === 5;

        if (esViernes) {
            totalMonedas = Math.floor(totalMonedas * 1.5);
            textoResumen += `\n✨ **¡Bonificación de Viernes Loco! (+50%)** ✨`;
        }

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("💰 La tiendita de compra de Annie")
            .setDescription(`*Annie saca la calculadora y se pone los lentecitos...*\n\n"A ver, mi niño, en tus bolsillos tienes todo esto:"\n\n${textoResumen}\n\n**Total a pagarte: 🪙 ${totalMonedas} moneditas.**\n¿Me lo vendes todo?`)
            .setFooter({ text: "Esta acción vaciará de estos ítems tu inventario" });

        const btnSi = new ButtonBuilder()
            .setCustomId("vender_si")
            .setLabel("¡Vender todo!")
            .setStyle(ButtonStyle.Success);

        const btnNo = new ButtonBuilder()
            .setCustomId("vender_no")
            .setLabel("Mejor me lo guardo")
            .setStyle(ButtonStyle.Danger);

        const rowBtns = new ActionRowBuilder().addComponents(btnSi, btnNo);

        const mensaje = await interaction.followUp({
            embeds: [embed],
            components: [rowBtns],
            fetchReply: true
        });

        const collector = mensaje.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000 // 1 minuto para responder
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === "vender_si") {
                // Ejecutar transacción
                try {
                    await db.execute({
                        sql: "DELETE FROM inventario_economia WHERE user_id = ?",
                        args: [userId]
                    });

                    await db.execute({
                        sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
                  VALUES (?, ?, 0, 1) 
                  ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
                        args: [userId, totalMonedas]
                    });

                    await i.editReply({
                        content: `🤝 ¡Trato hecho! Te he sumado **${totalMonedas} moneditas** con todo cariño. Tus bolsillos ahora están vacíos.`,
                        embeds: [],
                        components: []
                    });
                } catch (err) {
                    console.error("Error al vender items:", err);
                    await i.editReply({
                        content: `Uy... me quedé sin vuelto en la caja, perdoncito. (Error técnico)`,
                        embeds: [],
                        components: []
                    });
                }
            } else {
                await i.editReply({
                    content: `Está bien tesoro, guárdalo para más tardecito. ¡Aquí estaré si cambias de opinión!`,
                    embeds: [],
                    components: []
                });
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                await interaction.editReply({
                    components: [],
                    content: `${bostezo}Me quedé esperando tu respuesta y se me hizo tarde... vuelve a usar el comando cuando estés listito.`
                }).catch(() => { });
            }
        });

    } catch (error) {
        console.error("Error en comando /vender:", error);
        return interaction.followUp(`${bostezo}Se me cayeron las monedas... inténtalo de nuevo.`);
    }
}
