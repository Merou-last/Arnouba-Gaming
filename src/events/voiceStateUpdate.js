const { Events } = require('discord.js');
const { getConfig, chId } = require('../utils/config');
const { createRoom, cleanupIfEmpty } = require('../services/voiceRooms');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      if (oldState.channelId === newState.channelId) return;
      const config = await getConfig(newState.guild.id);
      if (!config) return;

      if (newState.channelId && newState.channelId === chId(config, 'voiceCreator') && newState.member && !newState.member.user.bot) {
        await createRoom(newState.member, config);
      }
      if (oldState.channelId) await cleanupIfEmpty(oldState.channel);
    } catch (err) {
      console.error('[voiceStateUpdate]', err);
    }
  },
};
