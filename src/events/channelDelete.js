const { Events } = require('discord.js');
const TempVoice = require('../models/TempVoice');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    await TempVoice.deleteOne({ channelId: channel.id }).catch(() => {});
  },
};
