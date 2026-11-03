const { Schema, model } = require('mongoose');

// channels / roles / gameRoles / gameChannels: { key -> discord id }
const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  channels: { type: Map, of: String, default: {} },
  roles: { type: Map, of: String, default: {} },
  gameRoles: { type: Map, of: String, default: {} },
  gameChannels: { type: Map, of: String, default: {} },
  setupAt: { type: Date, default: null },
}, { minimize: false });

module.exports = model('GuildConfig', guildConfigSchema);
