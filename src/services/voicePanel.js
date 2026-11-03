const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder,
  StringSelectMenuBuilder, PermissionFlagsBits: P,
} = require('discord.js');
const theme = require('../config/theme');

const BANNER_PATH = path.join(__dirname, '..', '..', 'assets', theme.voiceBannerFile);

function getVoiceState(channel) {
  const ow = channel.permissionOverwrites.cache.get(channel.guild.id);
  return {
    locked: Boolean(ow && ow.deny.has(P.Connect)),
    hidden: Boolean(ow && ow.deny.has(P.ViewChannel)),
    limit: channel.userLimit,
  };
}

const btn = (id, label, emoji, style = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId(`vc:${id}`).setLabel(label).setEmoji(emoji).setStyle(style);

function buildVoicePanel(channel, owner, state, { withFiles = false } = {}) {
  const hasBanner = fs.existsSync(BANNER_PATH);
  const ownerName = owner.displayName || owner.username;

  const embed = new EmbedBuilder()
    .setColor(theme.colors.gold)
    .setTitle(`✨ ${ownerName}'s Voice Channel`)
    .setDescription(`Owned by <@${owner.id}>. Use the buttons and menu below to manage this channel.`)
    .setThumbnail(owner.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `${state.locked ? '🔒 Locked' : '🔓 Unlocked'}  •  ${state.hidden ? '🙈 Hidden' : '👁️ Visible'}  •  Limit: ${state.limit || '∞'}` });
  if (hasBanner) embed.setImage(`attachment://${theme.voiceBannerFile}`);

  const components = [
    new ActionRowBuilder().addComponents(
      state.locked ? btn('lock', 'Unlock', '🔓') : btn('lock', 'Lock', '🔒'),
      state.hidden ? btn('hide', 'Unhide', '👁️') : btn('hide', 'Hide', '🙈'),
      btn('kick', 'Kick', '👢'),
      btn('add', 'Add', '➕'),
      btn('permit', 'Permit', '🛡️'),
    ),
    new ActionRowBuilder().addComponents(
      btn('access', 'Access List', '👥'),
      btn('rename', 'Rename', '✏️'),
      btn('limit', 'User Limit', '🔢'),
      btn('roles', 'Roles', '🏷️'),
      btn('claim', 'Claim / Transfer', '👑'),
    ),
    new ActionRowBuilder().addComponents(
      btn('save', 'Save Settings', '💾'),
      btn('reset', 'Reset Settings', '🔄'),
      btn('admins', 'Call Admins', '🚨'),
      btn('delete', 'Delete Message', '🗑️', ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('vc:features')
        .setPlaceholder('Channel features')
        .addOptions(
          { label: 'Bitrate', value: 'bitrate', description: 'Change the audio quality', emoji: '🔊' },
          { label: 'Region', value: 'region', description: 'Change the voice region', emoji: '🌍' },
          { label: 'Chat Slowmode', value: 'slowmode', description: 'Slowmode for this channel chat', emoji: '🐌' },
          { label: 'Channel Info', value: 'info', description: 'Show the channel details', emoji: '📊' },
        ),
    ),
  ];

  const payload = { embeds: [embed], components };
  if (withFiles && hasBanner) payload.files = [new AttachmentBuilder(BANNER_PATH, { name: theme.voiceBannerFile })];
  return payload;
}

module.exports = { buildVoicePanel, getVoiceState };
