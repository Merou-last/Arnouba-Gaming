const { ChannelType, Collection, PermissionFlagsBits: P } = require('discord.js');
const TempVoice = require('../models/TempVoice');
const VoiceProfile = require('../models/VoiceProfile');
const { buildVoicePanel, getVoiceState } = require('./voicePanel');
const { chId, roleId } = require('../utils/config');
const { rateLimit } = require('../utils/respond');

const MIN_BITRATE = 8000;
const creating = new Set();

const ACCESS = [P.ViewChannel, P.Connect];

function staffIds(config) {
  return [roleId(config, 'management'), roleId(config, 'staff')].filter(Boolean);
}

// Owner + staff + bot (+ optional @everyone lock/hide). Used on create and on reset.
function baseOverwrites(guild, ownerId, config, { locked = false, hidden = false } = {}) {
  const deny = [];
  if (locked) deny.push(P.Connect);
  if (hidden) deny.push(P.ViewChannel);
  return [
    ...(deny.length ? [{ id: guild.roles.everyone.id, deny }] : []),
    { id: ownerId, allow: [P.ViewChannel, P.Connect, P.Speak] },
    ...staffIds(config).map((id) => ({ id, allow: [P.ViewChannel, P.Connect, P.MoveMembers, P.MuteMembers] })),
    { id: guild.client.user.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels, P.MoveMembers, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory, P.ManageRoles] },
  ];
}

async function profileOverwrites(guild, profile, ownerId) {
  const out = [];
  if (!profile) return out;
  const trusted = (profile.trusted || []).filter((id) => id !== ownerId);
  const blocked = (profile.blocked || []).filter((id) => id !== ownerId && !trusted.includes(id));
  const ids = [...trusted, ...blocked].slice(0, 60);
  let members = new Collection();
  if (ids.length) members = await guild.members.fetch({ user: ids }).catch(() => new Collection());
  for (const id of trusted) if (members.has(id)) out.push({ id, allow: ACCESS });
  for (const id of blocked) if (members.has(id)) out.push({ id, deny: [P.Connect] });
  for (const id of profile.roles || []) if (guild.roles.cache.has(id)) out.push({ id, allow: ACCESS });
  return out;
}

async function createRoom(member, config) {
  const guild = member.guild;
  if (creating.has(member.id)) return;
  creating.add(member.id);
  try {
    if (rateLimit(`vcCreate:${guild.id}:${member.id}`, 3, 20_000)) {
      await member.voice.disconnect('Creating rooms too fast').catch(() => {});
      return;
    }

    const existing = await TempVoice.findOne({ guildId: guild.id, ownerId: member.id });
    if (existing) {
      const alive = await guild.channels.fetch(existing.channelId).catch(() => null);
      if (alive) {
        await member.voice.setChannel(alive).catch(() => {});
        return;
      }
      await TempVoice.deleteOne({ _id: existing._id });
    }

    const profile = await VoiceProfile.findOne({ guildId: guild.id, userId: member.id }).lean();
    const name = (profile && profile.name ? profile.name : `🔊 ${member.displayName}`).slice(0, 100);
    const bitrate = profile && profile.bitrate
      ? Math.max(MIN_BITRATE, Math.min(profile.bitrate, guild.maximumBitrate))
      : undefined;

    const permissionOverwrites = [
      ...baseOverwrites(guild, member.id, config, { locked: profile && profile.locked, hidden: profile && profile.hidden }),
      ...(await profileOverwrites(guild, profile, member.id)),
    ];

    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: chId(config, 'voiceCategory') || undefined,
      userLimit: profile ? profile.userLimit || 0 : 0,
      bitrate,
      permissionOverwrites,
      reason: `Private room for ${member.user.tag}`,
    });

    const temp = await TempVoice.create({ guildId: guild.id, channelId: channel.id, ownerId: member.id });

    try {
      await member.voice.setChannel(channel);
    } catch {
      await channel.delete('Owner left before the move').catch(() => {});
      await TempVoice.deleteOne({ _id: temp._id });
      return;
    }

    await sendPanel(channel, temp, member);
  } catch (err) {
    console.error('[voice] createRoom failed:', err);
  } finally {
    creating.delete(member.id);
  }
}

async function sendPanel(channel, temp, ownerOverride) {
  const owner = ownerOverride
    || await channel.guild.members.fetch(temp.ownerId).catch(() => null)
    || await channel.client.users.fetch(temp.ownerId);

  if (temp.panelMessageId) {
    const old = await channel.messages.fetch(temp.panelMessageId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  }
  const msg = await channel.send(buildVoicePanel(channel, owner, getVoiceState(channel), { withFiles: true }));
  temp.panelMessageId = msg.id;
  await temp.save();
  return msg;
}

async function refreshPanel(channel, temp, stateOverride) {
  if (!temp.panelMessageId) return;
  const msg = await channel.messages.fetch(temp.panelMessageId).catch(() => null);
  if (!msg) return;
  const owner = await channel.guild.members.fetch(temp.ownerId).catch(() => null)
    || await channel.client.users.fetch(temp.ownerId).catch(() => null);
  if (!owner) return;
  const state = { ...getVoiceState(channel), ...(stateOverride || {}) };
  await msg.edit(buildVoicePanel(channel, owner, state)).catch(() => {});
}

async function cleanupIfEmpty(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return;
  const temp = await TempVoice.findOne({ channelId: channel.id });
  if (!temp) return;
  if (channel.members.size === 0) {
    await channel.delete('Private room is empty').catch(() => {});
    await TempVoice.deleteOne({ _id: temp._id });
  }
}

async function sweepStaleRooms(client) {
  const docs = await TempVoice.find({});
  for (const doc of docs) {
    const guild = client.guilds.cache.get(doc.guildId);
    if (!guild) continue;
    const channel = await guild.channels.fetch(doc.channelId).catch(() => null);
    if (!channel) {
      await TempVoice.deleteOne({ _id: doc._id });
    } else if (channel.members.size === 0) {
      await channel.delete('Stale private room').catch(() => {});
      await TempVoice.deleteOne({ _id: doc._id });
    }
  }
}

module.exports = {
  baseOverwrites, createRoom, sendPanel, refreshPanel, cleanupIfEmpty, sweepStaleRooms, staffIds, MIN_BITRATE,
};
