const {
  SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionContextType,
} = require('discord.js');
const theme = require('../config/theme');
const { buildServer } = require('../services/serverBuilder');
const { postPanels } = require('../services/panels');
const { getConfig, chId } = require('../utils/config');
const { reply, fail, embed } = require('../utils/respond');

const running = new Set();
const CONFIRM_WINDOW_MS = 120_000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Build the server (roles, game categories, channels, panels). Does NOT delete existing channels.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(i) {
    if (running.has(i.guild.id)) return fail(i, 'A setup is already running in this server.');
    const e = new EmbedBuilder()
      .setColor(theme.colors.gold)
      .setTitle('🛠️ Server setup')
      .setDescription([
        'This will:',
        '• create the staff / member / **game roles**',
        '• create the info / community / voice / staff categories',
        '• create **one private category per game** (chat, looking-for-team, clips, 2 voice rooms + a squad room), visible only to members who have that game\'s role',
        '• post the rules, game roles, ticket and guide panels',
        '',
        '**✅ Nothing is deleted:** your existing channels, categories, messages, members and roles stay untouched.',
        'Running it again updates the bot\'s own channels instead of duplicating them.',
        '',
        `Confirm within ${CONFIRM_WINDOW_MS / 60_000} minutes.`,
      ].join('\n'));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`setup:confirm:${Date.now()}:${i.user.id}`).setLabel('Yes, build the server').setEmoji('🛠️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`setup:cancel:0:${i.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    await reply(i, { embeds: [e], components: [row] });
  },

  async handleButton(i) {
    const [, action, ts, userId] = i.customId.split(':');
    if (i.user.id !== userId) return fail(i, 'Only the admin who ran /setup can use these buttons.');
    if (action === 'cancel') return i.update({ embeds: [embed(theme.colors.dark, 'Setup cancelled.')], components: [] });

    if (Date.now() - Number(ts) > CONFIRM_WINDOW_MS) {
      return i.update({ embeds: [embed(theme.colors.warn, '⌛ This confirmation expired. Run /setup again.')], components: [] });
    }
    if (running.has(i.guild.id)) return fail(i, 'A setup is already running in this server.');

    running.add(i.guild.id);
    await i.update({ embeds: [embed(theme.colors.gold, '🛠️ Starting...')], components: [] });
    const progress = (text) => i.editReply({ embeds: [embed(theme.colors.gold, `🛠️ ${text}`)] }).catch(() => {});

    try {
      const result = await buildServer({ guild: i.guild, client: i.client, progress });
      const config = await getConfig(i.guild.id);
      await postPanels(i.guild, i.client, config, 'all');

      const report = new EmbedBuilder()
        .setColor(theme.colors.success)
        .setTitle('✅ Server setup complete')
        .addFields(
          { name: 'Roles', value: `${Object.keys(result.roles).length} staff/member + ${Object.keys(result.gameRoles).length} game roles`, inline: true },
          { name: 'Channels', value: `${Object.keys(result.channels).length} created`, inline: true },
          { name: 'Old channels', value: 'Kept (nothing deleted)', inline: true },
          { name: 'Next steps', value: 'Give yourself the **👑 Management** role to see the staff channels, then test **➕ Create Room**.' },
        )
        .setFooter({ text: theme.footer }).setTimestamp();

      const staffChannel = i.guild.channels.cache.get(chId(config, 'staffCommands'));
      if (staffChannel) await staffChannel.send({ content: `${i.user}`, embeds: [report] }).catch(() => {});
      await i.user.send({ embeds: [report] }).catch(() => {});
      await i.editReply({ embeds: [report] }).catch(() => {});
    } catch (err) {
      console.error('[setup] failed:', err);
      await i.editReply({ embeds: [embed(theme.colors.danger, `❌ Setup failed: ${err.message}`)] }).catch(() => {});
      await i.user.send(`❌ Setup failed in **${i.guild.name}**: ${err.message}`).catch(() => {});
    } finally {
      running.delete(i.guild.id);
    }
  },
};
