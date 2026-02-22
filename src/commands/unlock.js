import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from "discord.js";

const OWNER_ID = "457299957955821569";

export const data = new SlashCommandBuilder()
  .setName("unlock")
  .setDescription("(Owner) Desbloquea un canal para @everyone")
  .setDMPermission(false)
  .setDefaultMemberPermissions(0n)
  .addChannelOption((o) =>
    o
      .setName("canal")
      .setDescription("Canal a desbloquear (por defecto: canal actual)")
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
    return interaction.editReply("Necesito permiso de **Gestionar Canales** para desbloquear canales.");
  }

  const channel = interaction.options.getChannel("canal") || interaction.channel;
  if (!channel) return interaction.editReply("No pude resolver el canal.");

  const unlockPerms = {
    SendMessages: null,
    AddReactions: null,
    CreatePublicThreads: null,
    CreatePrivateThreads: null,
    SendMessagesInThreads: null,
    Connect: null,
    Speak: null,
  };

  if (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.GuildForum ||
    channel.type === ChannelType.GuildVoice ||
    channel.type === ChannelType.GuildStageVoice
  ) {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, unlockPerms, {
      reason: `Desbloqueado por owner (${interaction.user.tag}) con /unlock`,
    });
    return interaction.editReply(`🔓 Canal desbloqueado: <#${channel.id}>`);
  }

  return interaction.editReply("Ese tipo de canal no soporta unlock con este comando.");
}
