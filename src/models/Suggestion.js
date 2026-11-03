const { Schema, model } = require('mongoose');

const suggestionSchema = new Schema({
  guildId: { type: String, required: true },
  messageId: { type: String, required: true, unique: true },
  authorId: { type: String, required: true },
  up: { type: [String], default: [] },
  down: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
}, { timestamps: true });

module.exports = model('Suggestion', suggestionSchema);
