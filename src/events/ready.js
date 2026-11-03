const { Events, ActivityType } = require('discord.js');
const { sweepStaleRooms } = require('../services/voiceRooms');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`🐰 Arnouba Gaming Bot is online as ${client.user.tag}`);
    client.user.setPresence({
      activities: [{ name: 'Arnouba Gaming 🐰', type: ActivityType.Watching }],
      status: 'dnd',
    });

    try {
      const json = [...client.commands.values()].map((c) => c.data.toJSON());
      if (process.env.GUILD_ID) {
        await client.application.commands.set(json, process.env.GUILD_ID);
        console.log(`✅ ${json.length} slash commands registered in guild ${process.env.GUILD_ID}`);
      } else {
        await client.application.commands.set(json);
        console.log(`✅ ${json.length} slash commands registered globally (can take a while to appear)`);
      }
    } catch (err) {
      console.error('❌ Could not register slash commands:', err);
    }

    sweepStaleRooms(client).catch((err) => console.error('[voice] sweep failed:', err));
  },
};
