const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType } = require('discord.js');
const theme = require('../config/theme');
const { getConfig, chId } = require('../utils/config');
const { ok, fail } = require('../utils/respond');

module.exports = {
  channelKey: 'staffCommands',
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an announcement in the announcements channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('title').setDescription('Announcement title').setRequired(true).setMaxLength(200))
    .addStringOption((o) => o.setName('message').setDescription('Text (use \\n for a new line)').setRequired(true).setMaxLength(2000))
    .addStringOption((o) => o.setName('ping').setDescription('Who to ping').addChoices(
      { name: 'Nobody', value: 'none' },
      { name: '@here', value: 'here' },
      { name: '@everyone', value: 'everyone' },
    )),

  async execute(i) {
    const config = await getConfig(i.guild.id);
    const channel = config && i.guild.channels.cache.get(chId(config, 'announcements'));
    if (!channel) return fail(i, 'The announcements channel was not found. Run /setup.');

    const ping = i.options.getString('ping') || 'none';
    const embed = new EmbedBuilder()
      .setColor(theme.colors.gold)
      .setTitle(`📢 ${i.options.getString('title')}`)
      .setDescription(i.options.getString('message').replace(/\\n/g, '\n'))
      .setFooter({ text: `${theme.footer} • ${i.member.displayName}` }).setTimestamp();

    await channel.send({
      content: ping === 'none' ? undefined : `@${ping}`,
      embeds: [embed],
      allowedMentions: { parse: ping === 'none' ? [] : ['everyone'] },
    });
    return ok(i, `Announcement posted in ${channel}.`);
  },
};
