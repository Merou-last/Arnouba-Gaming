const { Events, EmbedBuilder } = require('discord.js');
const theme = require('../config/theme');
const { getConfig, chId, roleId } = require('../utils/config');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.user.bot) return;
    const config = await getConfig(member.guild.id);
    if (!config) return;

    const autoRole = roleId(config, 'member');
    if (autoRole) await member.roles.add(autoRole, 'Auto role').catch(() => {});

    const channel = member.guild.channels.cache.get(chId(config, 'welcome'));
    if (!channel) return;
    const rules = chId(config, 'rules');
    const roles = chId(config, 'gameRoles');

    const embed = new EmbedBuilder()
      .setColor(theme.colors.gold)
      .setTitle('🐰 Welcome to Arnouba Gaming 🐰')
      .setDescription([
        `Welcome ${member}! We hope you enjoy your time with us.`,
        `مرحباً بك ${member} في المجتمع، نتمنى لك وقتاً ممتعاً معنا.`,
        '',
        rules ? `📜 Read the rules: <#${rules}>` : null,
        roles ? `🎭 Pick your game roles: <#${roles}>` : null,
      ].filter((l) => l !== null).join('\n'))
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields({ name: '👤 Member Count', value: `\`#${member.guild.memberCount}\``, inline: true })
      .setFooter({ text: theme.footer, iconURL: member.guild.iconURL() || undefined })
      .setTimestamp();

    await channel.send({ content: `${member}`, embeds: [embed], allowedMentions: { users: [member.id] } }).catch(() => {});
  },
};
