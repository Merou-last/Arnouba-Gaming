const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const theme = require('../config/theme');
const GAME_ROLES = require('../config/gameRoles');
const { chId } = require('../utils/config');
const { gameRolesBanner } = require('../utils/images');

const base = () => new EmbedBuilder().setColor(theme.colors.gold).setFooter({ text: theme.footer });

function rulesPayload() {
  return {
    embeds: [base()
      .setTitle('📜 Server Rules | قوانين السيرفر')
      .setDescription([
        '**1.** Respect everyone. No insults, racism or harassment.',
        '**2.** No spam, flooding or unwanted advertising.',
        '**3.** No NSFW, gore or illegal content.',
        '**4.** Use each channel for its purpose.',
        '**5.** Follow staff instructions and Discord\'s Terms of Service.',
        '',
        '**١.** احترم الجميع، ممنوع السب والعنصرية والتحرش.',
        '**٢.** ممنوع السبام والإعلانات بدون إذن.',
        '**٣.** ممنوع المحتوى الإباحي أو الدموي أو غير القانوني.',
        '**٤.** استعمل كل روم في مكانه الصحيح.',
        '**٥.** اتبع تعليمات الإدارة وشروط ديسكورد.',
      ].join('\n'))],
  };
}

function gameRolesPayload() {
  const embed = base()
    .setTitle('🎭 Game Roles | رتب الألعاب')
    .setDescription([
      'Press a button to **get the role instantly**. Press it again to remove it.',
      'اضغط على الزر لتحصل على الرتبة **تلقائياً**، واضغط مرة أخرى لإزالتها.',
      '',
      "Each game role unlocks that game's private category (chat, voice rooms, looking-for-team) and lets teammates ping you.",
    ].join('\n'));

  const banner = gameRolesBanner();
  if (banner) embed.setImage(banner.url);

  const rows = [];
  for (let i = 0; i < GAME_ROLES.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(
      GAME_ROLES.slice(i, i + 5).map((g) => new ButtonBuilder()
        .setCustomId(`gr:${g.key}`).setLabel(g.name).setEmoji(g.emoji).setStyle(ButtonStyle.Secondary)),
    ));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gr:clear').setLabel('Remove all game roles').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  ));
  const payload = { embeds: [embed], components: rows };
  if (banner) payload.files = [banner.file];
  return payload;
}

function ticketPayload() {
  const embed = base()
    .setTitle('🎫 Arnouba Gaming | Support Center')
    .setDescription('Choose the ticket type from the menu below to contact the staff team.\nاختر نوع التذكرة من القائمة للتواصل مع الإدارة.');
  const menu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('tk:open')
      .setPlaceholder('📩 Select a ticket type...')
      .addOptions(
        { label: 'Technical Support', value: 'support', description: 'Need help with something?', emoji: '🛠️' },
        { label: 'Report', value: 'report', description: 'Report a member or an issue', emoji: '🚨' },
        { label: 'Staff Application', value: 'apply', description: 'Apply to join the team', emoji: '👑' },
      ),
  );
  return { embeds: [embed], components: [menu] };
}

function guidePayload(config) {
  const c = (k) => (chId(config, k) ? `<#${chId(config, k)}>` : '`not set`');
  return {
    embeds: [base()
      .setTitle('🤖 Bot Guide')
      .setDescription([
        `🎭 **Game roles** → ${c('gameRoles')}`,
        `🎫 **Tickets** → ${c('ticketPanel')}`,
        `💡 **/suggest** → ${c('suggestions')}`,
        `🎮 **/lfg** → ${c('lfg')}`,
        `🎧 **Private rooms** → join **➕ Create Room** and a panel appears in your room chat. Lost the panel? Use **/voice** inside your room.`,
        '',
        `⚙️ **Staff commands** (/panels, /announce) → ${c('staffCommands')}`,
      ].join('\n'))],
  };
}

async function clearBotMessages(channel, client) {
  const msgs = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!msgs) return;
  for (const m of msgs.filter((x) => x.author.id === client.user.id).values()) await m.delete().catch(() => {});
}

// which: all | rules | gameRoles | tickets | guide
async function postPanels(guild, client, config, which = 'all') {
  const jobs = [
    { name: 'rules', channel: 'rules', payload: () => rulesPayload() },
    { name: 'gameRoles', channel: 'gameRoles', payload: () => gameRolesPayload() },
    { name: 'tickets', channel: 'ticketPanel', payload: () => ticketPayload() },
    { name: 'guide', channel: 'botCommands', payload: () => guidePayload(config) },
  ];
  const posted = [];
  for (const job of jobs) {
    if (which !== 'all' && which !== job.name) continue;
    const channel = guild.channels.cache.get(chId(config, job.channel));
    if (!channel) continue;
    await clearBotMessages(channel, client);
    await channel.send(job.payload());
    posted.push(`<#${channel.id}>`);
  }
  return posted;
}

module.exports = { postPanels, ticketPayload, gameRolesPayload };
