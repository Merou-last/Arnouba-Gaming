const { Events } = require('discord.js');
const { getConfig, chId } = require('../utils/config');
const { fail } = require('../utils/respond');

const handlers = {
  vc: require('../handlers/voice'),
  gr: require('../handlers/gameRoles'),
  tk: require('../handlers/tickets'),
  sg: require('../handlers/suggestions'),
};

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    try {
      if (!interaction.inGuild()) return;

      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        if (command.channelKey) {
          const config = await getConfig(interaction.guildId);
          const target = chId(config, command.channelKey);
          if (target && interaction.channelId !== target) {
            return void (await fail(interaction, `Use this command in <#${target}>.`));
          }
        }
        return void (await command.execute(interaction, client));
      }

      if (!interaction.customId) return;
      const prefix = interaction.customId.split(':')[0];
      if (prefix === 'setup') return void (await client.commands.get('setup').handleButton(interaction));
      const handler = handlers[prefix];
      if (handler) await handler.handle(interaction);
    } catch (err) {
      console.error(`[interaction] ${interaction.customId || interaction.commandName}:`, err);
      try {
        await fail(interaction, 'Something went wrong. Please try again.');
      } catch {
        /* interaction already answered or expired */
      }
    }
  },
};
