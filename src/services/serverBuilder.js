const { ChannelType, PermissionFlagsBits: P, GuildFeature } = require('discord.js');
const GAME_ROLES = require('../config/gameRoles');
const { ROLES, buildLayout } = require('../config/layout');
const GuildConfig = require('../models/GuildConfig');
const TempVoice = require('../models/TempVoice');
const { invalidateConfig } = require('../utils/config');

const READ = [P.ViewChannel, P.ReadMessageHistory];
const BOT_ALLOW = [
  P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory,
  P.ManageMessages, P.ManageChannels, P.ManageRoles, P.MoveMembers, P.Connect,
];

// Builds the permission overwrites for one channel/category.
function overwritesFor(access, ctx, gameRoleId) {
  const { guild, botId, staffIds } = ctx;
  const everyone = guild.roles.everyone.id;
  const staffAllow = staffIds.map((id) => ({ id, allow: [...READ, P.SendMessages, P.Connect, P.Speak] }));
  const bot = { id: botId, allow: BOT_ALLOW };

  switch (access) {
    case 'readonly':
      return [
        {
          id: everyone,
          allow: READ,
          deny: [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads, P.AddReactions],
        },
        ...staffIds.map((id) => ({ id, allow: [P.SendMessages, P.AddReactions] })),
        bot,
      ];
    case 'staff':
      return [{ id: everyone, deny: [P.ViewChannel] }, ...staffAllow, bot];
    case 'gated':
      return [
        { id: everyone, deny: [P.ViewChannel] },
        ...(gameRoleId ? [{
          id: gameRoleId,
          allow: [...READ, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.AddReactions, P.Connect, P.Speak, P.Stream, P.UseVAD],
        }] : []),
        ...staffAllow,
        bot,
      ];
    default:
      return [];
  }
}

async function ensureRole(guild, def) {
  const existing = guild.roles.cache.find((r) => r.name === def.name && !r.managed);
  const data = {
    name: def.name,
    color: def.color,
    hoist: Boolean(def.hoist),
    mentionable: Boolean(def.mentionable),
    permissions: def.permissions || [],
    reason: 'Arnouba setup',
  };
  if (existing) return existing.edit(data);
  return guild.roles.create(data);
}

// Reuses a channel/category this bot created before (found by the id saved in the config);
// otherwise creates it. Existing channels that the bot did not create are never touched.
async function ensureChannel(guild, savedId, data) {
  const existing = savedId && guild.channels.cache.get(savedId);
  if (existing && existing.type === data.type) {
    const { name, parent, permissionOverwrites, topic, userLimit } = data;
    await existing.edit({
      name, parent: parent || null, permissionOverwrites, ...(topic !== undefined ? { topic } : {}), ...(userLimit !== undefined ? { userLimit } : {}),
      reason: 'Arnouba setup (update)',
    }).catch(() => {});
    return existing;
  }
  return guild.channels.create({ ...data, reason: 'Arnouba setup' });
}

/**
 * Builds the server: roles -> categories/channels -> config.
 * NOTHING is deleted: existing channels, categories and messages are left exactly as they are.
 * Running it again updates the bot's own channels instead of duplicating them.
 * `progress(text)` is called after each phase.
 */
async function buildServer({ guild, client, progress }) {
  const me = guild.members.me;
  if (!me.permissions.has(P.Administrator)) {
    throw new Error('The bot needs the **Administrator** permission to build the server.');
  }

  await guild.roles.fetch();
  await guild.channels.fetch();
  const prev = (await GuildConfig.findOne({ guildId: guild.id }).lean()) || {};
  const saved = prev.channels || {};

  // 1) Roles -------------------------------------------------------------
  await progress('🎭 Creating roles...');
  const roles = {};
  for (const def of ROLES) roles[def.key] = (await ensureRole(guild, def)).id;

  const gameRoles = {};
  for (const g of GAME_ROLES) {
    const role = await ensureRole(guild, { name: `${g.emoji} ${g.name}`, color: g.color, mentionable: true, permissions: [] });
    gameRoles[g.key] = role.id;
  }

  // 2) Categories + channels --------------------------------------------
  const ctx = { guild, botId: client.user.id, staffIds: [roles.management, roles.staff] };
  const channels = {};
  const gameChannels = {};
  const layout = buildLayout(GAME_ROLES);

  for (const cat of layout) {
    await progress(`📁 ${cat.name}...`);
    const catGameRole = cat.gameKey ? gameRoles[cat.gameKey] : undefined;
    const category = await ensureChannel(guild, saved[cat.key], {
      name: cat.name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwritesFor(cat.access, ctx, catGameRole),
    });
    channels[cat.key] = category.id;

    for (const ch of cat.channels) {
      const access = ch.access || cat.access;
      const gameRoleId = ch.gameKey ? gameRoles[ch.gameKey] : catGameRole;
      const base = {
        name: ch.name,
        parent: category.id,
        permissionOverwrites: overwritesFor(access, ctx, gameRoleId),
      };
      const data = ch.type === 'voice'
        ? { ...base, type: ChannelType.GuildVoice, userLimit: ch.limit || 0 }
        : { ...base, type: ChannelType.GuildText, topic: ch.topic };
      const created = await ensureChannel(guild, saved[ch.key], data);
      channels[ch.key] = created.id;
      if (cat.gameKey && ch.primary) gameChannels[cat.gameKey] = created.id;
    }
  }

  // 3) Save config -------------------------------------------------------
  await GuildConfig.findOneAndUpdate(
    { guildId: guild.id },
    { $set: { channels, roles, gameRoles, gameChannels, setupAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  );
  invalidateConfig(guild.id);
  await TempVoice.deleteMany({ guildId: guild.id });

  // 4) Guild settings: only fill what is not already set (never override the server's own choices)
  await progress('⚙️ Updating server settings...');
  const get = (key) => guild.channels.cache.get(channels[key]);
  const safe = (p) => Promise.resolve(p).catch(() => {});
  if (guild.features.includes(GuildFeature.Community)) {
    if (!guild.rulesChannelId) await safe(guild.setRulesChannel(get('rules')));
    if (!guild.publicUpdatesChannelId) await safe(guild.setPublicUpdatesChannel(get('announcements')));
    if (typeof guild.setSafetyAlertsChannel === 'function' && !guild.safetyAlertsChannelId) {
      await safe(guild.setSafetyAlertsChannel(get('alerts')));
    }
  }
  if (!guild.systemChannelId) await safe(guild.setSystemChannel(get('welcome')));
  if (!guild.afkChannelId) await safe(guild.setAFKChannel(get('afk')));

  return { channels, roles, gameRoles, gameChannels };
}

module.exports = { buildServer };
