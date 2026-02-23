import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";

const OWNER_ID = "457299957955821569";

const ROLE_NAMES = {
  admin: "Admin",
  moderador: "Moderador",
  helper: "Helper",
};

export const data = new SlashCommandBuilder()
  .setName("quitar")
  .setDescription("(Owner) Quita rol staff a un usuario")
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addStringOption((o) =>
    o
      .setName("rol")
      .setDescription("Tipo de rol a quitar")
      .setRequired(true)
      .addChoices(
        { name: "Admin", value: "admin" },
        { name: "Moderador", value: "moderador" },
        { name: "Helper", value: "helper" }
      )
  )
  .addUserOption((o) =>
    o.setName("usuario").setDescription("Usuario objetivo").setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (interaction.user.id !== OWNER_ID) {
    return interaction.editReply("Este comando es solo para el owner del servidor.");
  }

  if (!interaction.inGuild() || !interaction.guild) {
    return interaction.editReply("Este comando solo funciona dentro de un servidor.");
  }

  const botMember = interaction.guild.members.me;
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply("Necesito permiso de **Gestionar Roles** para quitar roles.");
  }

  const key = interaction.options.getString("rol", true);
  const roleName = ROLE_NAMES[key];
  if (!roleName) {
    return interaction.editReply("Rol inválido.");
  }

  const role = interaction.guild.roles.cache.find((r) => r.name === roleName);
  if (!role) {
    return interaction.editReply(`No existe el rol **${roleName}** en este servidor.`);
  }

  if (role.position >= botMember.roles.highest.position) {
    return interaction.editReply(`No puedo gestionar **${roleName}** porque está igual o por encima de mi rol más alto.`);
  }

  const targetUser = interaction.options.getUser("usuario", true);
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply("No pude encontrar a ese usuario en el servidor.");
  }

  if (!targetMember.roles.cache.has(role.id)) {
    return interaction.editReply(`<@${targetUser.id}> no tiene el rol **${roleName}**.`);
  }

  await targetMember.roles.remove(role, `Removido por owner (${interaction.user.tag})`);
  return interaction.editReply(`✅ Rol **${roleName}** removido de <@${targetUser.id}>.`);
}
