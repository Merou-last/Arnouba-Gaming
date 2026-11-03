const { Schema, model } = require('mongoose');

// Saved room settings per user ("Save Settings" button) + permanently trusted users ("Permit").
const voiceProfileSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  name: { type: String, default: null },
  userLimit: { type: Number, default: 0 },
  bitrate: { type: Number, default: null },
  locked: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  trusted: { type: [String], default: [] },
  blocked: { type: [String], default: [] },
  roles: { type: [String], default: [] },
}, { timestamps: true });

voiceProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('VoiceProfile', voiceProfileSchema);
