const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  UserSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, EmbedBuilder,
  ChannelType, OverwriteType, PermissionFlagsBits: P,
} = require('discord.js');
const theme = require('../config/theme');
const TempVoice = require('../models/TempVoice');
const VoiceProfile = require('../models/VoiceProfile');
const { buildVoicePanel, getVoiceState } = require('../services/voicePanel');
const { baseOverwrites, refreshPanel, staffIds, MIN_BITRATE } = require('../services/voiceRooms');
const { getConfig, chId, roleId } = require('../utils/config');
const { reply, ok, fail, embed, rateLimit } = require('../utils/respond');

const ACCESS = { ViewChannel: true, Connect: true };
const MAX_TRUSTED = 25;

// ---------------------------------------------------------------- helpers
async function getRoom(i, { ownerOnly = true, mustBeInside = false } = {}) {
  const channel = i.channel || await i.guild.channels.fetch(i.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await fail(i, 'This panel only works inside a private voice room.');
    return null;
  }
  const temp = await TempVoice.findOne({ channelId: channel.id });
  if (!temp) {
    await fail(i, 'This is not an active private room.');
    return null;
  }
  const isOwner = temp.ownerId === i.user.id;
  const isAdmin = Boolean(i.memberPermissions && (i.memberPermissions.has(P.Administrator) || i.memberPermissions.has(P.ManageChannels)));
  if (ownerOnly && !isOwner && !isAdmin) {
    await fail(i, `Only the room owner (<@${temp.ownerId}>) can use this.`);
    return null;
  }
  if (mustBeInside && !channel.members.has(i.user.id)) {
    await fail(i, 'You must be inside this room to do that.');
    return null;
  }
  return { channel, temp, isOwner, isAdmin, config: await getConfig(i.guild.id) };
}

async function ownerOf(i, temp) {
  const member = await i.guild.members.fetch(temp.ownerId).catch(() => null);
  return member || i.client.users.fetch(temp.ownerId);
}

const mentions = (ids, prefix) => {
  if (!ids.length) return '—';
  const shown = ids.slice(0, 20).map((id) => `<${prefix}${id}>`).join(' ');
  return ids.length > 20 ? `${shown} +${ids.length - 20}` : shown;
};

function overwriteLists(channel, temp, config) {
  const botId = channel.client.user.id;
  const staff = staffIds(config);
  const everyone = channel.guild.id;
  const all = [...channel.permissionOverwrites.cache.values()];
  const members = all.filter((o) => o.type === OverwriteType.Member && o.id !== temp.ownerId && o.id !== botId);
  const roles = all.filter((o) => o.type === OverwriteType.Role && o.id !== everyone && !staff.includes(o.id));
  return {
    trusted: members.filter((o) => o.allow.has(P.Connect)).map((o) => o.id),
    blocked: members.filter((o) => o.deny.has(P.Connect)).map((o) => o.id),
    roles: roles.filter((o) => o.allow.has(P.Connect)).map((o) => o.id),
  };
}

const userPicker = (id, placeholder, max = 5) => new ActionRowBuilder().addComponents(
  new UserSelectMenuBuilder().setCustomId(`vc:${id}`).setPlaceholder(placeholder).setMinValues(1).setMaxValues(max),
);

const textModal = (id, title, label, { value, placeholder, max = 90 } = {}) => {
  const input = new TextInputBuilder().setCustomId('value').setLabel(label).setStyle(TextInputStyle.Short)
    .setMinLength(1).setMaxLength(max).setRequired(true);
  if (value) input.setValue(String(value).slice(0, max));
  if (placeholder) input.setPlaceholder(placeholder);
  return new ModalBuilder().setCustomId(`vc:${id}`).setTitle(title).addComponents(new ActionRowBuilder().addComponents(input));
};

// ---------------------------------------------------------------- buttons
const routes = {};

routes.lock = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, temp } = room;
  const state = getVoiceState(channel);
  const locked = !state.locked;
  await channel.permissionOverwrites.edit(i.guild.id, { Connect: locked ? false : null });
  await i.update(buildVoicePanel(channel, await ownerOf(i, temp), { ...state, locked }));
};

routes.hide = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, temp } = room;
  const state = getVoiceState(channel);
  const hidden = !state.hidden;
  if (hidden) {
    // Keep everyone who is currently inside able to see the room.
    const inside = [...channel.members.values()].filter((m) => m.id !== temp.ownerId && !m.user.bot).slice(0, 25);
    await Promise.all(inside.map((m) => channel.permissionOverwrites.edit(m.id, ACCESS).catch(() => {})));
  }
  await channel.permissionOverwrites.edit(i.guild.id, { ViewChannel: hidden ? false : null });
  await i.update(buildVoicePanel(channel, await ownerOf(i, temp), { ...state, hidden }));
};

routes.kick = async (i) => {
  if (!(await getRoom(i))) return;
  await reply(i, { content: '👢 Select the members to kick from this room:', components: [userPicker('kick:pick', 'Select members to kick')] });
};

routes.add = async (i) => {
  if (!(await getRoom(i))) return;
  await reply(i, { content: '➕ Select the members to invite (this room only):', components: [userPicker('add:pick', 'Select members to invite', 10)] });
};

routes.permit = async (i) => {
  if (!(await getRoom(i))) return;
  await reply(i, { content: '🛡️ Select the members to **trust permanently** (saved to your profile, applied to every room you create):', components: [userPicker('permit:pick', 'Select members to permit', 10)] });
};

routes.access = async (i) => {
  const room = await getRoom(i, { ownerOnly: false }); if (!room) return;
  const { channel, temp, config } = room;
  const state = getVoiceState(channel);
  const lists = overwriteLists(channel, temp, config);
  const e = new EmbedBuilder()
    .setColor(theme.colors.gold)
    .setTitle('👥 Access List')
    .addFields(
      { name: '👑 Owner', value: `<@${temp.ownerId}>`, inline: true },
      { name: '⚙️ Status', value: `${state.locked ? '🔒 Locked' : '🔓 Unlocked'}\n${state.hidden ? '🙈 Hidden' : '👁️ Visible'}\n👥 Limit: ${state.limit || '∞'}`, inline: true },
      { name: '✅ Allowed members', value: mentions(lists.trusted, '@') },
      { name: '🏷️ Allowed roles', value: mentions(lists.roles, '@&') },
      { name: '⛔ Blocked members', value: mentions(lists.blocked, '@') },
    )
    .setFooter({ text: theme.footer });
  await reply(i, { embeds: [e] });
};

routes.rename = async (i) => {
  const room = await getRoom(i); if (!room) return;
  await i.showModal(textModal('rename:modal', 'Rename Room', 'New room name', { value: room.channel.name }));
};

routes.limit = async (i) => {
  const room = await getRoom(i); if (!room) return;
  await i.showModal(textModal('limit:modal', 'User Limit', 'Limit (0 = unlimited, max 99)', { value: room.channel.userLimit, max: 2, placeholder: '0' }));
};

routes.roles = async (i) => {
  if (!(await getRoom(i))) return;
  const pick = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder().setCustomId('vc:roles:pick').setPlaceholder('Select roles that can join').setMinValues(1).setMaxValues(10),
  );
  const clear = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vc:roles:clear').setLabel('Clear role access').setEmoji('🧹').setStyle(ButtonStyle.Danger),
  );
  await reply(i, { content: '🏷️ Choose the roles allowed to see and join this room:', components: [pick, clear] });
};

routes.claim = async (i) => {
  const room = await getRoom(i, { ownerOnly: false }); if (!room) return;
  const { channel, temp } = room;
  if (i.user.id === temp.ownerId) {
    await reply(i, { content: '👑 Select the member who will become the new owner (they must be in the room):', components: [userPicker('transfer:pick', 'Select the new owner', 1)] });
    return;
  }
  if (!channel.members.has(i.user.id)) return fail(i, 'Join this room first.');
  if (channel.members.has(temp.ownerId)) return fail(i, `The owner (<@${temp.ownerId}>) is still in the room.`);
  await transferOwnership(i, room, i.user.id);
  await ok(i, 'You are now the owner of this room.');
};

routes.save = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, temp, config } = room;
  const state = getVoiceState(channel);
  const lists = overwriteLists(channel, temp, config);
  await VoiceProfile.findOneAndUpdate(
    { guildId: i.guild.id, userId: temp.ownerId },
    {
      $set: {
        name: channel.name, userLimit: channel.userLimit, bitrate: channel.bitrate,
        locked: state.locked, hidden: state.hidden,
        trusted: lists.trusted.slice(0, MAX_TRUSTED), blocked: lists.blocked.slice(0, MAX_TRUSTED), roles: lists.roles.slice(0, 10),
      },
    },
    { upsert: true },
  );
  await ok(i, 'Settings saved. They will be applied automatically next time you create a room.');
};

routes.reset = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, temp, config } = room;
  await i.deferReply({ flags: 64 });
  const owner = await ownerOf(i, temp);
  const defaultName = `🔊 ${owner.displayName || owner.username}`.slice(0, 100);

  await channel.permissionOverwrites.set(baseOverwrites(i.guild, temp.ownerId, config));
  const edit = { userLimit: 0, bitrate: Math.min(64000, i.guild.maximumBitrate), rtcRegion: null };
  if (channel.name !== defaultName && !rateLimit(`rename:${channel.id}`, 2, 600_000)) edit.name = defaultName;
  await channel.edit(edit);
  await VoiceProfile.deleteOne({ guildId: i.guild.id, userId: temp.ownerId });
  await refreshPanel(channel, temp, { locked: false, hidden: false, limit: 0 });
  await i.editReply({ embeds: [embed(theme.colors.success, '✅ Room reset to default and saved settings cleared.')] });
};

routes.admins = async (i) => {
  const room = await getRoom(i, { ownerOnly: false, mustBeInside: true }); if (!room) return;
  const { channel, config } = room;
  const alerts = chId(config, 'alerts') && i.guild.channels.cache.get(chId(config, 'alerts'));
  if (!alerts) return fail(i, 'The admin alerts channel is not configured. Run /setup first.');
  const wait = rateLimit(`admins:${channel.id}`, 1, 120_000);
  if (wait) return fail(i, `Admins were already called. Try again in ${wait}s.`);

  const staffRole = roleId(config, 'staff');
  await alerts.send({
    content: staffRole ? `<@&${staffRole}>` : undefined,
    allowedMentions: { roles: staffRole ? [staffRole] : [] },
    embeds: [new EmbedBuilder().setColor(theme.colors.danger).setTitle('🚨 Voice room assistance requested')
      .addFields(
        { name: 'Room', value: `${channel} (${channel.name})`, inline: true },
        { name: 'Requested by', value: `${i.user}`, inline: true },
        { name: 'Members inside', value: String(channel.members.size), inline: true },
      ).setTimestamp().setFooter({ text: theme.footer })],
  });
  await ok(i, 'The admins have been notified.');
};

routes.delete = async (i) => {
  const room = await getRoom(i); if (!room) return;
  await i.message.delete().catch(() => {});
  room.temp.panelMessageId = null;
  await room.temp.save();
  await ok(i, 'Panel deleted. Use **/voice** inside this room to bring it back.');
};

routes['roles:clear'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, config } = room;
  const roleOverwrites = [...channel.permissionOverwrites.cache.values()]
    .filter((o) => o.type === OverwriteType.Role && o.id !== i.guild.id && !staffIds(config).includes(o.id));
  await Promise.all(roleOverwrites.map((o) => channel.permissionOverwrites.delete(o.id).catch(() => {})));
  await i.update({ content: `🧹 Cleared ${roleOverwrites.length} role(s).`, components: [] });
};

// ---------------------------------------------------------------- select menus / modals
routes['kick:pick'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, temp } = room;
  const kicked = [];
  for (const id of i.values) {
    if (id === temp.ownerId || id === i.client.user.id) continue;
    const member = i.guild.members.cache.get(id) || await i.guild.members.fetch(id).catch(() => null);
    if (member && member.voice.channelId === channel.id) await member.voice.disconnect('Kicked by room owner').catch(() => {});
    await channel.permissionOverwrites.edit(id, { Connect: false, ViewChannel: null }).catch(() => {});
    kicked.push(id);
  }
  if (kicked.length) await VoiceProfile.updateOne({ guildId: i.guild.id, userId: temp.ownerId }, { $pull: { trusted: { $in: kicked } } });
  await i.update({ content: kicked.length ? `👢 Kicked and blocked: ${mentions(kicked, '@')}` : '⚠️ You cannot kick the owner or the bot.', components: [] });
};

routes['add:pick'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, temp } = room;
  const ids = i.values.filter((id) => id !== temp.ownerId);
  await Promise.all(ids.map((id) => channel.permissionOverwrites.edit(id, ACCESS).catch(() => {})));
  await i.update({ content: `✅ Invited: ${mentions(ids, '@')}`, components: [] });
  if (ids.length) {
    await channel.send({
      content: ids.map((id) => `<@${id}>`).join(' '),
      embeds: [embed(theme.colors.gold, `👋 <@${temp.ownerId}> invited you to join ${channel}.`)],
      allowedMentions: { users: ids },
    }).catch(() => {});
  }
};

routes['permit:pick'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, temp } = room;
  const ids = i.values.filter((id) => id !== temp.ownerId);
  const profile = await VoiceProfile.findOne({ guildId: i.guild.id, userId: temp.ownerId });
  const current = new Set(profile ? profile.trusted : []);
  const fresh = ids.filter((id) => !current.has(id));
  if (current.size + fresh.length > MAX_TRUSTED) {
    return i.update({ content: `❌ You can trust at most ${MAX_TRUSTED} members.`, components: [] });
  }
  await Promise.all(ids.map((id) => channel.permissionOverwrites.edit(id, ACCESS).catch(() => {})));
  await VoiceProfile.updateOne(
    { guildId: i.guild.id, userId: temp.ownerId },
    { $addToSet: { trusted: { $each: ids } }, $pull: { blocked: { $in: ids } } },
    { upsert: true },
  );
  await i.update({ content: `🛡️ Permitted permanently: ${mentions(ids, '@')}`, components: [] });
};

routes['roles:pick'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel } = room;
  const ids = i.values.filter((id) => id !== i.guild.id && !i.guild.roles.cache.get(id)?.managed);
  await Promise.all(ids.map((id) => channel.permissionOverwrites.edit(id, ACCESS).catch(() => {})));
  await i.update({ content: ids.length ? `🏷️ Allowed roles: ${mentions(ids, '@&')}` : '⚠️ Those roles cannot be added.', components: [] });
};

async function transferOwnership(i, room, newOwnerId) {
  const { channel, temp } = room;
  await channel.permissionOverwrites.edit(newOwnerId, { ViewChannel: true, Connect: true, Speak: true });
  temp.ownerId = newOwnerId;
  await temp.save();
  await refreshPanel(channel, temp);
  await channel.send({
    embeds: [embed(theme.colors.gold, `👑 <@${newOwnerId}> is now the owner of this room.`)],
    allowedMentions: { users: [] },
  }).catch(() => {});
}

routes['transfer:pick'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const { channel, temp } = room;
  const target = channel.members.get(i.values[0]);
  if (!target || target.user.bot) return i.update({ content: '❌ The new owner must be a (non-bot) member inside the room.', components: [] });
  if (target.id === temp.ownerId) return i.update({ content: '❌ That member is already the owner.', components: [] });
  if (await TempVoice.exists({ guildId: i.guild.id, ownerId: target.id })) {
    return i.update({ content: '❌ That member already owns another room.', components: [] });
  }
  await transferOwnership(i, room, target.id);
  await i.update({ content: `👑 Ownership transferred to ${target}.`, components: [] });
};

routes['rename:modal'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const name = i.fields.getTextInputValue('value').replace(/\s+/g, ' ').trim().slice(0, 90);
  if (!name) return fail(i, 'The name cannot be empty.');
  const wait = rateLimit(`rename:${room.channel.id}`, 2, 600_000);
  if (wait) return fail(i, `Discord limits renaming. Try again in ${Math.ceil(wait / 60)} min.`);
  await room.channel.setName(name);
  await ok(i, `Room renamed to **${name}**.`);
};

routes['limit:modal'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const n = Number.parseInt(i.fields.getTextInputValue('value'), 10);
  if (!Number.isInteger(n) || n < 0 || n > 99) return fail(i, 'Enter a number between 0 and 99.');
  await room.channel.setUserLimit(n);
  await refreshPanel(room.channel, room.temp, { limit: n });
  await ok(i, n ? `User limit set to **${n}**.` : 'User limit removed.');
};

routes['bitrate:modal'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const max = Math.floor(i.guild.maximumBitrate / 1000);
  const kbps = Number.parseInt(i.fields.getTextInputValue('value'), 10);
  if (!Number.isInteger(kbps) || kbps < MIN_BITRATE / 1000 || kbps > max) return fail(i, `Enter a value between ${MIN_BITRATE / 1000} and ${max} kbps.`);
  await room.channel.setBitrate(kbps * 1000);
  await ok(i, `Bitrate set to **${kbps} kbps**.`);
};

routes['slow:modal'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const s = Number.parseInt(i.fields.getTextInputValue('value'), 10);
  if (!Number.isInteger(s) || s < 0 || s > 21600) return fail(i, 'Enter a number of seconds between 0 and 21600.');
  await room.channel.setRateLimitPerUser(s);
  await ok(i, s ? `Chat slowmode set to **${s}s**.` : 'Chat slowmode disabled.');
};

routes['region:pick'] = async (i) => {
  const room = await getRoom(i); if (!room) return;
  const value = i.values[0];
  await room.channel.setRTCRegion(value === 'auto' ? null : value);
  await i.update({ content: `🌍 Region set to **${value === 'auto' ? 'Automatic' : value}**.`, components: [] });
};

routes.features = async (i) => {
  const choice = i.values[0];
  const room = await getRoom(i, { ownerOnly: choice !== 'info' }); if (!room) return;
  const { channel, temp } = room;

  // Re-render the panel components so the select menu goes back to its placeholder.
  const resetMenu = async () => {
    const owner = await ownerOf(i, temp).catch(() => null);
    if (owner) await i.message.edit({ components: buildVoicePanel(channel, owner, getVoiceState(channel)).components }).catch(() => {});
  };

  if (choice === 'bitrate') {
    const max = Math.floor(i.guild.maximumBitrate / 1000);
    await i.showModal(textModal('bitrate:modal', 'Bitrate', `Bitrate in kbps (${MIN_BITRATE / 1000}-${max})`, { value: Math.round(channel.bitrate / 1000), max: 3 }));
  } else if (choice === 'slowmode') {
    await i.showModal(textModal('slow:modal', 'Chat Slowmode', 'Seconds (0 = off, max 21600)', { value: channel.rateLimitPerUser || 0, max: 5 }));
  } else if (choice === 'region') {
    const regions = await i.client.fetchVoiceRegions().catch(() => null);
    const options = [{ label: 'Automatic', value: 'auto', emoji: '🌍' }];
    if (regions) {
      for (const r of regions.values()) {
        if (!r.deprecated && options.length < 25) options.push({ label: r.name.slice(0, 100), value: r.id });
      }
    }
    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('vc:region:pick').setPlaceholder('Select a voice region').addOptions(options),
    );
    await reply(i, { content: '🌍 Choose the voice region:', components: [menu] });
  } else if (choice === 'info') {
    const e = new EmbedBuilder().setColor(theme.colors.gold).setTitle('📊 Channel Info')
      .addFields(
        { name: 'Name', value: channel.name, inline: true },
        { name: 'Owner', value: `<@${temp.ownerId}>`, inline: true },
        { name: 'Members', value: `${channel.members.size}${channel.userLimit ? ` / ${channel.userLimit}` : ''}`, inline: true },
        { name: 'Bitrate', value: `${Math.round(channel.bitrate / 1000)} kbps`, inline: true },
        { name: 'Region', value: channel.rtcRegion || 'Automatic', inline: true },
        { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
      ).setFooter({ text: theme.footer });
    await reply(i, { embeds: [e] });
  }
  await resetMenu();
};

async function handle(i) {
  const key = i.customId.slice(3); // strip "vc:"
  const fn = routes[key];
  if (!fn) return fail(i, 'Unknown action.');
  await fn(i);
}

module.exports = { handle };
