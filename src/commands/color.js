import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { CONFIG } from "../config.js";
import { db } from "../db.js";
import { crearEmbed } from "../utils.js";

// Lista de colores pre-hechos. Si el usuario compró esto, le asignamos el HEX real.
const COLORES_BASE = {
    "color_rosa": "#FFB7C5",
    "color_celeste": "#A8DADC",
    "color_dorado": "#FFD700"
};

export const data = new SlashCommandBuilder()
    .setName("color")
    .setDescription("Modifica el color premium de tu rol (si lo compraste en /tienda)")
    .addStringOption(o => o.setName("hex").setDescription("Código Hexadecimal (ej: #FF00aa)").setRequired(true));

export async function execute(interaction, bostezo) {
    if (!interaction.guild) {
        return interaction.reply({ content: "Este comando solo funciona dentro del servidor.", flags: MessageFlags.Ephemeral });
    }

    const colorHex = interaction.options.getString("hex").trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
        return interaction.reply({ content: `${bostezo} Eyy... ese formato de color no me sirve. Tiene que ser como \`#AABBCC\`, con el gatito adelante.`, flags: MessageFlags.Ephemeral });
    }

    // Check if the user bought the custom color item
    const result = await db.execute({
        sql: "SELECT color_rol_id FROM usuarios WHERE id = ?",
        args: [interaction.user.id]
    });

    if (result.rows.length === 0) {
        return interaction.reply({ content: `${bostezo} Aún no sales a pasear por el pueblito... usa la \`/tienda\` primero.`, flags: MessageFlags.Ephemeral });
    }

    const userData = result.rows[0];

    // Si su color_rol_id no existe O si compró un rol de servidor predeterminado (los base names en vez de ID), rechazar
    if (!userData.color_rol_id || userData.color_rol_id === "color_rosa" || userData.color_rol_id === "color_celeste" || userData.color_rol_id === "color_dorado") {
        return interaction.reply({ content: `¡Ahí! No has comprado el **Pincel Mágico** en la \`/tienda\` todavía para poder poner puros colores personalizados.`, flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();

    const roleName = `🎀 Color ${interaction.user.username}`;
    let role;

    try {
        // Find existing custom role by ID if they already used this command once
        if (userData.color_rol_id !== "color_custom") { // "color_custom" is the token they get from the shop
            role = await interaction.guild.roles.fetch(userData.color_rol_id);
        }

        if (role) {
            // Edit existing role
            await role.setColor(colorHex);
            await role.setName(roleName);
        } else {
            // Create a brand new role
            // Se asume que el bot tiene un rol con un z-index / posición alta para que el color sobresalga
            role = await interaction.guild.roles.create({
                name: roleName,
                color: colorHex,
                reason: `Rol comprado por XP de ${interaction.user.username}`,
            });

            // Update database with the actual Role ID now
            await db.execute({
                sql: "UPDATE usuarios SET color_rol_id = ? WHERE id = ?",
                args: [role.id, interaction.user.id]
            });
        }

        // Make sure the user has the role assigned
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }

        const embed = crearEmbed(colorHex)
            .setTitle("🖌️ Color Pintadito")
            .setDescription(`¡Listo corazón! Tu rol personal ha sido pintado con el color **${colorHex}**.`);

        await interaction.followUp({ content: bostezo, embeds: [embed] });

    } catch (e) {
        console.error("Error creando/modificando rol de color:", e);
        await interaction.followUp({ content: "Pucha, no pude crear el rol. Dile a mis creadores que revisen mis permisos de Administrar Roles, tienen que estar por encima de los usuarios base.", flags: MessageFlags.Ephemeral });
    }
}
