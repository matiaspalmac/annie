import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from "discord.js";

const OWNER_ID = "457299957955821569";

const ROLE_PRESETS = {
  admin: {
    name: "Admin",
    color: 0xE74C3C,
    permissions: [PermissionFlagsBits.Administrator],
  },
  moderador: {
    name: "Moderador",
    color: 0x3498DB,
    permissions: [
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.ManageNicknames,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.DeafenMembers,
      PermissionFlagsBits.MuteMembers,
    ],
  },
  helper: {
    name: "Helper",
    color: 0x2ECC71,
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.MuteMembers,
      PermissionFlagsBits.MoveMembers,
      PermissionFlagsBits.ChangeNickname,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseExternalEmojis,
    ],
  },
};

export const data = new SlashCommandBuilder()
  .setName("dar")
  .setDescription("(Owner) Crea rol staff y lo asigna a un usuario")
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addStringOption((o) =>
    o
      .setName("rol")
      .setDescription("Tipo de rol a asignar")
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
    return interaction.editReply("Necesito permiso de **Gestionar Roles** para crear/asignar roles.");
  }

  const key = interaction.options.getString("rol", true);
  const preset = ROLE_PRESETS[key];
  if (!preset) {
    return interaction.editReply("Rol inválido.");
  }

  const targetUser = interaction.options.getUser("usuario", true);
  const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    return interaction.editReply("No pude encontrar a ese usuario en el servidor.");
  }

  let role = interaction.guild.roles.cache.find((r) => r.name === preset.name) || null;
  if (!role) {
    role = await interaction.guild.roles.create({
      name: preset.name,
      color: preset.color,
      hoist: true,
      mentionable: true,
      permissions: preset.permissions,
      reason: `Creado por owner (${interaction.user.tag}) con /dar`,
    });
  } else {
    await role.setPermissions(preset.permissions, `Sync permisos de ${preset.name} por ${interaction.user.tag}`);
  }

  if (role.position >= botMember.roles.highest.position) {
    return interaction.editReply(`No puedo asignar **${preset.name}** porque está igual o por encima de mi rol más alto.`);
  }

  if (!targetMember.roles.cache.has(role.id)) {
    await targetMember.roles.add(role, `Asignado por owner (${interaction.user.tag})`);
  }

  return interaction.editReply(`✅ Rol **${preset.name}** listo y asignado a <@${targetUser.id}>.`);
}
