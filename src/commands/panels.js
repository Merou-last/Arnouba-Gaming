const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { postPanels } = require('../services/panels');
const { getConfig } = require('../utils/config');
const { fail } = require('../utils/respond');

module.exports = {
  channelKey: 'staffCommands',
  data: new SlashCommandBuilder()
    .setName('panels')
    .setDescription('Re-post the bot panels in their channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('panel').setDescription('Which panel (default: all)').addChoices(
      { name: 'All panels', value: 'all' },
      { name: 'Rules', value: 'rules' },
      { name: 'Game roles', value: 'gameRoles' },
      { name: 'Tickets', value: 'tickets' },
      { name: 'Bot guide', value: 'guide' },
    )),

  async execute(i, client) {
    const config = await getConfig(i.guild.id);
    if (!config) return fail(i, 'Run /setup first.');
    await i.deferReply({ flags: 64 });
    const posted = await postPanels(i.guild, client, config, i.options.getString('panel') || 'all');
    if (!posted.length) return i.editReply('❌ No panel channel found. Run /setup again.');
    return i.editReply(`✅ Panels posted in: ${posted.join(', ')}`);
  },
};
