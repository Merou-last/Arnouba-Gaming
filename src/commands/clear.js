const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');

// Moderation helper: intentionally usable in any channel (it cleans the channel it is used in).
module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete recent messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName('amount').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)),

  async execute(i) {
    await i.deferReply({ flags: 64 });
    const deleted = await i.channel.bulkDelete(i.options.getInteger('amount', true), true).catch(() => null);
    if (!deleted) return i.editReply('❌ I could not delete messages here (messages older than 14 days cannot be bulk deleted).');
    return i.editReply(`🧹 Deleted **${deleted.size}** message(s).`);
  },
};
