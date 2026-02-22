import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from "discord.js";

const OWNER_ID = "457299957955821569";

export const data = new SlashCommandBuilder()
  .setName("lock")
  .setDescription("(Owner) Bloquea un canal para @everyone")
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addChannelOption((o) =>
    o
      .setName("canal")
      .setDescription("Canal a bloquear (por defecto: canal actual)")
      .setRequired(false)
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
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.editReply("Necesito permiso de **Gestionar Canales** para bloquear canales.");
  }

  const channel = interaction.options.getChannel("canal") || interaction.channel;
  if (!channel) return interaction.editReply("No pude resolver el canal.");

  const lockPerms = {
    SendMessages: false,
    AddReactions: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    SendMessagesInThreads: false,
    Connect: false,
    Speak: false,
  };

  if (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.GuildForum ||
    channel.type === ChannelType.GuildVoice ||
    channel.type === ChannelType.GuildStageVoice
  ) {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, lockPerms, {
      reason: `Bloqueado por owner (${interaction.user.tag}) con /lock`,
    });
    return interaction.editReply(`🔒 Canal bloqueado: <#${channel.id}>`);
  }

  return interaction.editReply("Ese tipo de canal no soporta lock con este comando.");
}
