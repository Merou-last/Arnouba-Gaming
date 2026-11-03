const { PermissionFlagsBits: P } = require('discord.js');

const STAFF_PERMS = [
  P.ViewAuditLog, P.KickMembers, P.ModerateMembers, P.ManageMessages, P.MuteMembers,
  P.DeafenMembers, P.MoveMembers, P.ManageNicknames, P.ManageThreads,
];

// Creation order = hierarchy order (each new role is inserted just above @everyone,
// so the first role created ends up highest). Game roles are created after these.
const ROLES = [
  { key: 'management', name: '👑 Management', color: 0xe83fd1, hoist: true, permissions: [...STAFF_PERMS, P.BanMembers, P.ManageChannels, P.MentionEveryone] },
  { key: 'staff', name: '🛡️ Staff', color: 0x5865f2, hoist: true, permissions: STAFF_PERMS },
  { key: 'member', name: '✅ Member', color: 0x2ecc71, hoist: false, permissions: [] },
];

// Max squad size per game (0 = no limit). Used for the game's "Squad" voice room.
const SQUAD = {
  fivem: 0, gta5: 4, valorant: 5, cs2: 5, cod: 4, apex: 3, overwatch: 5, r6: 5, rocketleague: 3, lol: 5,
  eafc: 0, minecraft: 0, roblox: 0, fortnite: 4, pubg: 4, freefire: 4, mlbb: 5, genshin: 4, amongus: 10, fallguys: 0,
};

// One private category per game: visible only to members who hold that game's role (+ staff).
function gameCategory(g) {
  const k = g.key;
  return {
    key: `game_${k}`, name: `${g.emoji} ${g.name.toUpperCase()}`, access: 'gated', gameKey: k,
    channels: [
      { key: `game_${k}_chat`, name: '💬┃chat', type: 'text', topic: `${g.name} chat. Visible only to members with the ${g.name} role.`, primary: true },
      { key: `game_${k}_lfg`, name: '🎮┃looking-for-team', type: 'text', topic: `Find teammates for ${g.name}.` },
      { key: `game_${k}_clips`, name: '🏆┃clips', type: 'text', topic: `Your best ${g.name} plays.` },
      { key: `game_${k}_voice1`, name: '🔊 Voice 1', type: 'voice' },
      { key: `game_${k}_voice2`, name: '🔊 Voice 2', type: 'voice' },
      { key: `game_${k}_squad`, name: '🎧 Squad', type: 'voice', limit: SQUAD[k] || 0 },
    ],
  };
}

// access: public | readonly | staff | gated (gated = visible only to the game role + staff)
function buildLayout(gameRoles) {
  return [
    {
      key: 'info', name: '━━ 📌 INFORMATION ━━', access: 'readonly',
      channels: [
        { key: 'welcome', name: '👋┃welcome', type: 'text', topic: 'Welcome to Arnouba Gaming 🐰' },
        { key: 'rules', name: '📜┃rules', type: 'text', topic: 'Read the rules before you chat.' },
        { key: 'announcements', name: '📢┃announcements', type: 'text', topic: 'Official news and updates.' },
        { key: 'gameRoles', name: '🎭┃game-roles', type: 'text', topic: 'Press a button to get (or remove) a game role automatically.' },
        { key: 'ticketPanel', name: '🎫┃open-ticket', type: 'text', topic: 'Need help? Open a ticket from the menu below.' },
      ],
    },
    {
      key: 'community', name: '━━ 💬 COMMUNITY ━━', access: 'public',
      channels: [
        { key: 'general', name: '💬┃general-chat', type: 'text', topic: 'Talk about anything.' },
        { key: 'media', name: '📸┃media', type: 'text', topic: 'Share pictures and videos.' },
        { key: 'botCommands', name: '🤖┃bot-commands', type: 'text', topic: 'Use bot commands here.' },
        { key: 'suggestions', name: '💡┃suggestions', type: 'text', access: 'readonly', topic: 'Use /suggest in this channel to send an idea.' },
      ],
    },
    {
      key: 'gaming', name: '━━ 🎮 GAMING HUB ━━', access: 'public',
      channels: [
        { key: 'lfg', name: '🎮┃looking-for-team', type: 'text', access: 'readonly', topic: 'Use /lfg here to find teammates. The game role gets pinged.' },
        { key: 'clips', name: '🏆┃clips', type: 'text', topic: 'Your best plays.' },
      ],
    },
    {
      key: 'lounges', name: '━━ 🔊 VOICE LOUNGES ━━', access: 'public',
      channels: [
        { key: 'lounge', name: '🛋️ Lounge', type: 'voice' },
        { key: 'music', name: '🎵 Music', type: 'voice' },
        { key: 'squad1', name: '🎮 Squad 1', type: 'voice', limit: 5 },
        { key: 'squad2', name: '🎮 Squad 2', type: 'voice', limit: 5 },
        { key: 'afk', name: '😴 AFK', type: 'voice' },
      ],
    },
    {
      key: 'voiceCategory', name: '━━ 🎧 PRIVATE ROOMS ━━', access: 'public',
      channels: [
        { key: 'voiceCreator', name: '➕ Create Room', type: 'voice' },
      ],
    },
    ...gameRoles.map(gameCategory),
    {
      key: 'ticketCategory', name: '━━ 🎫 TICKETS ━━', access: 'staff', channels: [],
    },
    {
      key: 'staffCategory', name: '━━ 🛡️ STAFF ━━', access: 'staff',
      channels: [
        { key: 'staffChat', name: '💬┃staff-chat', type: 'text' },
        { key: 'staffCommands', name: '⚙️┃staff-commands', type: 'text', topic: '/panels, /announce, /clear' },
        { key: 'logs', name: '📋┃logs', type: 'text', topic: 'Ticket transcripts and system logs.' },
        { key: 'alerts', name: '🚨┃admin-alerts', type: 'text', topic: 'Voice room "Call Admins" requests.' },
      ],
    },
  ];
}

module.exports = { ROLES, buildLayout, STAFF_PERMS };
