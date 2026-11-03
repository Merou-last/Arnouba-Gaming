const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const theme = require('../config/theme');
const Suggestion = require('../models/Suggestion');
const { suggestionRows } = require('../handlers/suggestions');
const { ok, fail, rateLimit } = require('../utils/respond');

module.exports = {
  channelKey: 'suggestions',
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Send a suggestion to the community')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('idea').setDescription('Your suggestion').setRequired(true).setMaxLength(1000)),

  async execute(i) {
    const wait = rateLimit(`suggest:${i.user.id}`, 1, 60_000);
    if (wait) return fail(i, `Please wait ${wait}s before sending another suggestion.`);

    const embed = new EmbedBuilder()
      .setColor(theme.colors.gold)
      .setAuthor({ name: i.member.displayName, iconURL: i.user.displayAvatarURL() })
      .setTitle('💡 New Suggestion')
      .setDescription(i.options.getString('idea'))
      .addFields({ name: 'Status', value: '⏳ Pending' })
      .setFooter({ text: theme.footer }).setTimestamp();

    const msg = await i.channel.send({ embeds: [embed], components: suggestionRows({ up: [], down: [] }) });
    await Suggestion.create({ guildId: i.guild.id, messageId: msg.id, authorId: i.user.id });
    return ok(i, 'Your suggestion has been posted.');
  },
};
