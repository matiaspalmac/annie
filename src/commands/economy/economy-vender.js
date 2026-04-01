import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { db } from "../../services/db.js";
import { getBostezo, crearEmbed, getItemEnDemanda } from "../../core/utils.js";
import { CONFIG } from "../../core/config.js";
import { progresarMision } from "../../features/misiones.js";

/**
 * Obtiene el precio de venta de un item desde la base de datos
 * @async
 * @param {string} itemId - ID del item
 * @returns {Promise<number>} Precio de venta (0 si no existe)
 */
async function getPrecioVenta(itemId) {
    try {
        const res = await db.execute({
            sql: "SELECT precio_venta FROM items_economia WHERE id = ?",
            args: [itemId]
        });
        return Number(res.rows[0]?.precio_venta || 0);
    } catch (err) {
        console.error(`[Vender] Error obteniendo precio de ${itemId}:`, err);
        return 0;
    }
}

/**
 * Obtiene todos los items vendibles (con precio_venta > 0)
 * @async
 * @returns {Promise<Set<string>>} Set de item IDs vendibles
 */
async function getItemsVendibles() {
    try {
        const res = await db.execute({
            sql: "SELECT id FROM items_economia WHERE precio_venta > 0"
        });
        return new Set(res.rows.map(r => String(r.id)));
    } catch (err) {
        console.error("[Vender] Error obteniendo items vendibles:", err);
        return new Set();
    }
}

async function venderItemEspecifico(interaction, userId, itemNombre, itemData, bostezo) {
    const qty = Number(itemData.cantidad);
    const itemDoris = getItemEnDemanda();
    let precioUnitario = await getPrecioVenta(itemNombre);
    
    if (precioUnitario === 0) {
        return interaction.followUp(`${bostezo}Ese item no tiene precio de venta configurado, tesoro.`);
    }
    
    let multiplicadorTexto = "";
    let dorisAparecio = false;

    if (itemNombre === itemDoris) {
        precioUnitario = precioUnitario * 3;
        multiplicadorTexto = " **(¡x3 Precio Doris!)**";
        dorisAparecio = true;
    }

    // Bonificación de Viernes
    const hoyDate = new Date();
    const esViernes = hoyDate.getDay() === 5;
    let totalMonedas = qty * precioUnitario;

    if (esViernes) {
        totalMonedas = Math.floor(totalMonedas * 1.5);
    }

    let descripcion = `*Annie revisa tu cosita con cariño...*\n\n` +
        `• **${qty}x** ${itemNombre} *(+${qty * precioUnitario} monedas)*${multiplicadorTexto}\n`;

    if (dorisAparecio) {
        descripcion += `\n🚀 **¡Doris te compró tus ${itemNombre} al triple de precio!**`;
    }

    if (esViernes) {
        descripcion += `\n✨ **¡Bonificación de Viernes Loco! (+50%)** ✨`;
    }

    descripcion += `\n\n**Total a pagarte: 🪙 ${totalMonedas} moneditas.**\n¿Me lo vendes?`;

    const embed = crearEmbed(CONFIG.COLORES.DORADO)
        .setTitle("💰 La tiendita de compra de Annie")
        .setDescription(descripcion);

    const btnSi = new ButtonBuilder()
        .setCustomId("vender_item_si")
        .setLabel("¡Sí, véndelo!")
        .setStyle(ButtonStyle.Success);

    const btnNo = new ButtonBuilder()
        .setCustomId("vender_item_no")
        .setLabel("Mejor no")
        .setStyle(ButtonStyle.Danger);

    const rowBtns = new ActionRowBuilder().addComponents(btnSi, btnNo);

    const mensaje = await interaction.followUp({
        embeds: [embed],
        components: [rowBtns],
        fetchReply: true
    });

    const collector = mensaje.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
    });

    collector.on('collect', async i => {
        await i.deferUpdate();

        if (i.customId === "vender_item_si") {
            try {
                await db.execute({
                    sql: "DELETE FROM inventario_economia WHERE user_id = ? AND item_id = ?",
                    args: [userId, itemNombre]
                });

                await db.execute({
                    sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
              VALUES (?, ?, 0, 1) 
              ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
                    args: [userId, totalMonedas]
                });

                await i.editReply({
                    content: `🤝 ¡Vendido! Te he sumado **${totalMonedas} moneditas** por tus **${qty}x ${itemNombre}**.`,
                    embeds: [],
                    components: []
                });
                progresarMision(interaction.user.id, "vender").catch(() => {});
            } catch (err) {
                console.error("Error al vender item:", err);
                await i.editReply({
                    content: `Uy... me quedé sin vuelto en la caja, perdoncito. (Error técnico)`,
                    embeds: [],
                    components: []
                });
            }
        } else {
            await i.editReply({
                content: `Está bien tesoro, guárdalo para más tardecito.`,
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
                content: `${bostezo}Me quedé esperando tu respuesta... vuelve cuando quieras.`
            }).catch(() => { });
        }
    });
}

export const data = new SlashCommandBuilder()
    .setName("vender")
    .setDescription("Véndele a Annie lo que has farmeado (Piedritas, peces, manzanas) por moneditas.")
    .addStringOption(option =>
        option.setName("item")
            .setDescription("¿Qué quieres vender? Déjalo vacío para vender todo lo farmeable")
            .setRequired(false)
            .setAutocomplete(true)
    )
    .addBooleanOption(option =>
        option.setName("incluir_favoritos")
            .setDescription("Incluir también items marcados como favoritos al vender todo")
            .setRequired(false)
    )
    .addBooleanOption(option =>
        option.setName("vender_favorito")
            .setDescription("Permite vender un item favorito específico (requiere item)")
            .setRequired(false)
    )
    .addStringOption(option =>
        option.setName("favorito_accion")
            .setDescription("Gestionar favoritos: agregar o quitar")
            .setRequired(false)
            .addChoices(
                { name: "Agregar favorito", value: "agregar" },
                { name: "Quitar favorito", value: "quitar" },
            )
    )
    .addStringOption(option =>
        option.setName("favorito_item")
            .setDescription("Item vendible para favoritos")
            .setRequired(false)
            .setAutocomplete(true)
    );

export async function execute(interaction, bostezo) {
    const userId = interaction.user.id;
    const itemElegido = interaction.options.getString("item");
    const incluirFavoritos = interaction.options.getBoolean("incluir_favoritos") ?? false;
    const venderFavorito = interaction.options.getBoolean("vender_favorito") ?? false;
    const favoritoAccion = interaction.options.getString("favorito_accion");
    const favoritoItem = interaction.options.getString("favorito_item");

    await interaction.deferReply();

    try {
        if (favoritoAccion || favoritoItem) {
            if (!favoritoAccion || !favoritoItem) {
                return interaction.followUp(`${bostezo}Para gestionar favoritos debes indicar **favorito_accion** y **favorito_item** juntos.`);
            }

            const itemsVendiblesSet = await getItemsVendibles();
            if (!itemsVendiblesSet.has(favoritoItem)) {
                return interaction.followUp(`${bostezo}Ese item no es vendible, así que no puede marcarse como favorito.`);
            }

            if (favoritoAccion === "agregar") {
                await db.execute({
                    sql: `INSERT OR IGNORE INTO user_item_favoritos (user_id, item_id) VALUES (?, ?)`,
                    args: [userId, favoritoItem]
                });
                return interaction.followUp(`⭐ Listo, **${favoritoItem}** quedó protegido como favorito.`);
            }

            await db.execute({
                sql: `DELETE FROM user_item_favoritos WHERE user_id = ? AND item_id = ?`,
                args: [userId, favoritoItem]
            });

            return interaction.followUp(`🧺 He quitado **${favoritoItem}** de favoritos. Ya podrá venderse normalmente.`);
        }

        // Obtener inventario del usuario
        const resInv = await db.execute({
            sql: "SELECT item_id, cantidad FROM inventario_economia WHERE user_id = ? AND cantidad > 0",
            args: [userId]
        });

        if (resInv.rows.length === 0) {
            return interaction.followUp(`${bostezo}Revisé tus bolsillos pero no vi nada que pueda comprarte, tesoro. ¡Sal a pescar o a picar rocas primero!`);
        }

        // Filtrar solo items vendibles (que están en items_economia con precio_venta > 0)
        const itemsVendiblesSet = await getItemsVendibles();
        const itemsVendibles = resInv.rows.filter(row => {
            const item = String(row.item_id);
            return itemsVendiblesSet.has(item);
        });

        const resFav = await db.execute({
            sql: "SELECT item_id FROM user_item_favoritos WHERE user_id = ?",
            args: [userId]
        });
        const favoritos = new Set(resFav.rows.map(r => String(r.item_id)));

        if (itemsVendibles.length === 0) {
            return interaction.followUp(`${bostezo}Revisé tus cositas pero solo veo mascotas y tesoros que no puedo comprarte, corazón. ¡Sal a farmear piedritas, peces o bichos!`);
        }

        // Si especificó un item, verificar que lo tenga y sea vendible
        if (itemElegido) {
            const itemData = itemsVendibles.find(row => String(row.item_id) === itemElegido);
            
            if (!itemData) {
                const tieneItem = resInv.rows.find(row => String(row.item_id) === itemElegido);
                if (tieneItem) {
                    return interaction.followUp(`${bostezo}Ay tesoro, "${itemElegido}" no lo puedo comprar. Solo compro cositas farmeables como piedras, peces y bichos.`);
                } else {
                    return interaction.followUp(`${bostezo}No tienes "${itemElegido}" en tus bolsillos, corazón.`);
                }
            }

            if (favoritos.has(itemElegido) && !venderFavorito) {
                return interaction.followUp(`⭐ **${itemElegido}** está marcado como favorito y está protegido.\nSi realmente quieres venderlo, vuelve a ejecutar con **vender_favorito: true**.`);
            }

            // Vender solo ese item
            return await venderItemEspecifico(interaction, userId, itemElegido, itemData, bostezo);
        }

        // Si no especificó item, mostrar resumen de todo lo vendible
        const itemsParaVender = incluirFavoritos
            ? itemsVendibles
            : itemsVendibles.filter(row => !favoritos.has(String(row.item_id)));

        const favoritosSaltados = itemsVendibles.filter(row => favoritos.has(String(row.item_id)));

        if (itemsParaVender.length === 0) {
            return interaction.followUp(
                `${bostezo}Solo tienes items favoritos protegidos y no vendí ninguno.\n` +
                `Usa **incluir_favoritos: true** para incluirlos o gestiona favoritos con **favorito_accion**.`
            );
        }

        let textoResumen = "";
        let totalMonedas = 0;
        const itemDoris = getItemEnDemanda();
        let dorisAparecio = false;

        for (const row of itemsParaVender) {
            const item = String(row.item_id);
            const qty = Number(row.cantidad);
            let precioUnitario = await getPrecioVenta(item);
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

        if (!incluirFavoritos && favoritosSaltados.length > 0) {
            textoResumen += `\n\n⭐ **Favoritos protegidos (no vendidos):** ${favoritosSaltados.map(r => String(r.item_id)).join(", ")}`;
        }

        // Día de pago especial? (Ej: Doble ganancia los viernes)
        const hoyDate = new Date();
        const esViernes = hoyDate.getDay() === 5;

        if (esViernes) {
            totalMonedas = Math.floor(totalMonedas * 1.5);
            textoResumen += `\n✨ **¡Bonificación de Viernes Loco! (+50%)** ✨`;
        }

        const embed = crearEmbed(CONFIG.COLORES.DORADO)
            .setTitle("💰 La tiendita de compra de Annie")
            .setDescription(`*Annie saca la calculadora y se pone los lentecitos...*\n\n"A ver, mi niño, en tus bolsillos tienes todo esto:"\n\n${textoResumen}\n\n**Total a pagarte: 🪙 ${totalMonedas} moneditas.**\n¿Me lo vendes todo?`)
            .setFooter({ text: "Solo vendo items farmeables. Tus mascotas y otros tesoros quedan seguros ✨" });

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
            time: 60000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === "vender_si") {
                try {
                    // Solo eliminar items vendibles (que están en PRECIOS_ECONOMIA)
                    const itemsParaEliminar = itemsParaVender.map(row => String(row.item_id));
                    const placeholders = itemsParaEliminar.map(() => '?').join(',');
                    
                    await db.execute({
                        sql: `DELETE FROM inventario_economia WHERE user_id = ? AND item_id IN (${placeholders})`,
                        args: [userId, ...itemsParaEliminar]
                    });

                    await db.execute({
                        sql: `INSERT INTO usuarios (id, monedas, xp, nivel) 
                  VALUES (?, ?, 0, 1) 
                  ON CONFLICT(id) DO UPDATE SET monedas = usuarios.monedas + excluded.monedas`,
                        args: [userId, totalMonedas]
                    });

                    await i.editReply({
                        content: `🤝 ¡Trato hecho! Te he sumado **${totalMonedas} moneditas** con todo cariño. Tus items farmeables se vendieron, pero tus mascotas quedan a salvo.`,
                        embeds: [],
                        components: []
                    });
                    progresarMision(interaction.user.id, "vender").catch(() => {});
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

export async function autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const focusedOption = interaction.options.getFocused(true)?.name;
    const userId = interaction.user.id;

    try {
        const resInv = await db.execute({
            sql: "SELECT item_id, cantidad FROM inventario_economia WHERE user_id = ? AND cantidad > 0",
            args: [userId]
        });

        // Filtrar solo items vendibles
        const itemsVendiblesSet = await getItemsVendibles();
        const itemsConPrecio = [];
        
        for (const row of resInv.rows) {
            const itemId = String(row.item_id);
            if (itemsVendiblesSet.has(itemId)) {
                const precio = await getPrecioVenta(itemId);
                itemsConPrecio.push({
                    name: `${itemId} (x${row.cantidad}) - ${precio} c/u`,
                    value: itemId
                });
            }
        }
        
        const itemsVendibles = itemsConPrecio
            .filter(item => item.name.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        if (focusedOption === "favorito_item") {
            await interaction.respond(itemsVendibles.map(i => ({
                name: `⭐ ${i.name}`,
                value: i.value,
            })));
            return;
        }

        await interaction.respond(itemsVendibles);
    } catch (error) {
        console.error("Error en autocomplete /vender:", error);
        await interaction.respond([]);
    }
}
