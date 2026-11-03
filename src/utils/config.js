const GuildConfig = require('../models/GuildConfig');

const cache = new Map();
const TTL_MS = 30_000;

async function getConfig(guildId) {
  const hit = cache.get(guildId);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await GuildConfig.findOne({ guildId }).lean();
  cache.set(guildId, { value, exp: Date.now() + TTL_MS });
  return value;
}

function invalidateConfig(guildId) {
  cache.delete(guildId);
}

const chId = (config, key) => (config && config.channels ? config.channels[key] : undefined);
const roleId = (config, key) => (config && config.roles ? config.roles[key] : undefined);

module.exports = { getConfig, invalidateConfig, chId, roleId };
