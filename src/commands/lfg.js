const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const theme = require('../config/theme');
const GAME_ROLES = require('../config/gameRoles');
const { getConfig } = require('../utils/config');
const { gameLogo } = require('../utils/images');
const { ok, fail, rateLimit } = require('../utils/respond');

module.exports = {
  channelKey: 'lfg',
  data: new SlashCommandBuilder()
    .setName('lfg')
    .setDescription('Looking for teammates: pings the game role')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('game').setDescription('The game').setRequired(true)
      .addChoices(...GAME_ROLES.map((g) => ({ name: g.name, value: g.key }))))
    .addIntegerOption((o) => o.setName('players').setDescription('How many players do you need?').setMinValue(1).setMaxValue(10))
    .addStringOption((o) => o.setName('note').setDescription('Extra details').setMaxLength(200)),

  async execute(i) {
    const config = await getConfig(i.guild.id);
    const game = GAME_ROLES.find((g) => g.key === i.options.getString('game', true));
    const roleId = config && config.gameRoles && config.gameRoles[game.key];
    if (!roleId) return fail(i, 'Game roles are not set up. An admin must run /setup.');

    const wait = rateLimit(`lfg:${i.user.id}`, 1, 90_000);
    if (wait) return fail(i, `Please wait ${wait}s before posting again.`);

    const players = i.options.getInteger('players');
    const note = i.options.getString('note');
    const voice = i.member.voice && i.member.voice.channel;

    const logo = gameLogo(game.key);
    const embed = new EmbedBuilder()
      .setColor(game.color)
      .setAuthor({ name: i.member.displayName, iconURL: i.user.displayAvatarURL({ size: 128 }) })
      .setTitle(`${game.emoji} ${game.name} — Looking for team`)
      .addFields({ name: 'Host', value: `${i.user}`, inline: true });
    if (players) embed.addFields({ name: 'Players needed', value: String(players), inline: true });
    if (voice) embed.addFields({ name: 'Voice', value: `${voice}`, inline: true });
    if (note) embed.addFields({ name: 'Note', value: note });
    if (logo) embed.setThumbnail(logo.url);
    embed.setFooter({ text: theme.footer }).setTimestamp();

    await i.channel.send({
      content: `<@&${roleId}>`,
      embeds: [embed],
      files: logo ? [logo.file] : [],
      allowedMentions: { roles: [roleId] },
    });
    return ok(i, 'Your request has been posted.');
  },
};
