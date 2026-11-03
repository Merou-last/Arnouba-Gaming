const { Schema, model } = require('mongoose');

const tempVoiceSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true, index: true },
  panelMessageId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model('TempVoice', tempVoiceSchema);
