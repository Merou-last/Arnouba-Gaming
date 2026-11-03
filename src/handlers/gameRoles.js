const GAME_ROLES = require('../config/gameRoles');
const { getConfig } = require('../utils/config');
const { ok, fail, rateLimit } = require('../utils/respond');

async function handle(i) {
  const key = i.customId.slice(3);
  if (rateLimit(`gr:${i.user.id}`, 8, 10_000)) return fail(i, 'Slow down a little.');

  const config = await getConfig(i.guild.id);
  if (!config || !config.gameRoles) return fail(i, 'Game roles are not set up yet. An admin must run /setup.');
  const member = await i.guild.members.fetch(i.user.id);

  if (key === 'clear') {
    const owned = Object.values(config.gameRoles).filter((id) => member.roles.cache.has(id));
    if (!owned.length) return fail(i, 'You do not have any game roles.');
    await member.roles.remove(owned, 'Game roles: remove all');
    return ok(i, `Removed **${owned.length}** game role(s).`);
  }

  const game = GAME_ROLES.find((g) => g.key === key);
  const roleId = config.gameRoles[key];
  if (!game || !roleId || !i.guild.roles.cache.has(roleId)) return fail(i, 'This role no longer exists. An admin must run /setup again.');

  try {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, 'Game roles button');
      return ok(i, `Removed ${game.emoji} **${game.name}**.`);
    }
    await member.roles.add(roleId, 'Game roles button');
    return ok(i, `You got ${game.emoji} **${game.name}**! The game's chat and voice rooms are now unlocked.`);
  } catch {
    return fail(i, 'I could not change your role. Make sure my role is above the game roles.');
  }
}

module.exports = { handle };
