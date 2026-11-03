const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder,
  ChannelType, PermissionFlagsBits: P,
} = require('discord.js');
const theme = require('../config/theme');
const { ticketPayload } = require('../services/panels');
const { getConfig, chId, roleId } = require('../utils/config');
const { reply, ok, fail, embed } = require('../utils/respond');

const TYPES = {
  support: { label: 'Technical Support', emoji: '🛠️' },
  report: { label: 'Report', emoji: '🚨' },
  apply: { label: 'Staff Application', emoji: '👑' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ticketButtons(claimed = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk:claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Success).setDisabled(claimed),
    new ButtonBuilder().setCustomId('tk:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
}

const parseTopic = (channel) => {
  const m = channel && channel.topic ? /^ticket:(\d+):(\w+)/.exec(channel.topic) : null;
  return m ? { openerId: m[1], type: m[2] } : null;
};

function isStaff(i, config) {
  if (i.memberPermissions && i.memberPermissions.has(P.Administrator)) return true;
  return [roleId(config, 'management'), roleId(config, 'staff')].filter(Boolean).some((id) => i.member.roles.cache.has(id));
}

async function open(i) {
  const type = i.values[0];
  const def = TYPES[type];
  const config = await getConfig(i.guild.id);
  const category = config && i.guild.channels.cache.get(chId(config, 'ticketCategory'));
  if (!def || !category) return fail(i, 'The ticket system is not set up. An admin must run /setup.');

  const existing = category.children.cache.find((c) => c.topic && c.topic.startsWith(`ticket:${i.user.id}:`));
  if (existing) return fail(i, `You already have an open ticket: ${existing}`);

  await i.deferReply({ flags: 64 });
  const staff = [roleId(config, 'management'), roleId(config, 'staff')].filter(Boolean);
  const safeName = i.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';

  const channel = await i.guild.channels.create({
    name: `${def.emoji}┃${type}-${safeName}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `ticket:${i.user.id}:${type}`,
    permissionOverwrites: [
      { id: i.guild.roles.everyone.id, deny: [P.ViewChannel] },
      { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
      ...staff.map((id) => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.ManageMessages] })),
      { id: i.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageChannels] },
    ],
    reason: `Ticket opened by ${i.user.tag}`,
  });

  const staffPing = roleId(config, 'staff');
  await channel.send({
    content: `${i.user}${staffPing ? ` <@&${staffPing}>` : ''}`,
    allowedMentions: { users: [i.user.id], roles: staffPing ? [staffPing] : [] },
    embeds: [new EmbedBuilder().setColor(theme.colors.gold)
      .setTitle(`${def.emoji} ${def.label}`)
      .setDescription('Please describe your request in detail. A staff member will be with you shortly.\nاشرح طلبك بالتفصيل وسيرد عليك أحد الإداريين قريباً.')
      .addFields({ name: 'Opened by', value: `${i.user}`, inline: true })
      .setFooter({ text: theme.footer }).setTimestamp()],
    components: [ticketButtons()],
  });

  // Reset the select menu of the panel back to its placeholder.
  await i.message.edit({ components: ticketPayload().components }).catch(() => {});
  await i.editReply({ embeds: [embed(theme.colors.success, `✅ Your ticket has been created: ${channel}`)] });
}

async function claim(i) {
  const config = await getConfig(i.guild.id);
  if (!isStaff(i, config)) return fail(i, 'Only staff members can claim tickets.');
  const current = i.message.embeds[0];
  if (!current || (current.fields || []).some((f) => f.name === 'Claimed by')) return fail(i, 'This ticket is already claimed.');
  const updated = EmbedBuilder.from(current).addFields({ name: 'Claimed by', value: `${i.user}`, inline: true });
  await i.update({ embeds: [updated], components: [ticketButtons(true)] });
}

async function close(i) {
  const info = parseTopic(i.channel);
  if (!info) return fail(i, 'This is not a ticket channel.');
  const config = await getConfig(i.guild.id);
  if (i.user.id !== info.openerId && !isStaff(i, config)) return fail(i, 'Only the ticket owner or staff can close it.');
  const confirm = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk:confirm').setLabel('Yes, close it').setEmoji('✅').setStyle(ButtonStyle.Danger),
  );
  await reply(i, { content: 'Are you sure you want to close this ticket?', components: [confirm] });
}

async function confirm(i) {
  const channel = i.channel;
  const info = parseTopic(channel);
  if (!info) return fail(i, 'This is not a ticket channel.');
  const config = await getConfig(i.guild.id);
  if (i.user.id !== info.openerId && !isStaff(i, config)) return fail(i, 'Only the ticket owner or staff can close it.');

  await i.update({ content: '🔒 Closing this ticket in 5 seconds...', components: [] });

  // Transcript (last 100 messages) -> logs channel
  const logs = i.guild.channels.cache.get(chId(config, 'logs'));
  if (logs) {
    const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (fetched) {
      const lines = [...fetched.values()].reverse().map((m) => {
        const files = m.attachments.size ? ` ${[...m.attachments.values()].map((a) => `[file: ${a.url}]`).join(' ')}` : '';
        return `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}${files}`;
      });
      const file = new AttachmentBuilder(Buffer.from(lines.join('\n') || '(empty)', 'utf8'), { name: `transcript-${channel.id}.txt` });
      await logs.send({
        embeds: [new EmbedBuilder().setColor(theme.colors.info).setTitle('🎫 Ticket closed')
          .addFields(
            { name: 'Ticket', value: channel.name, inline: true },
            { name: 'Opened by', value: `<@${info.openerId}>`, inline: true },
            { name: 'Closed by', value: `${i.user}`, inline: true },
          ).setTimestamp().setFooter({ text: theme.footer })],
        files: [file],
      }).catch(() => {});
    }
  }

  await sleep(5000);
  await channel.delete(`Ticket closed by ${i.user.tag}`).catch(() => {});
}

const routes = { open, claim, close, confirm };

async function handle(i) {
  const fn = routes[i.customId.slice(3)];
  if (!fn) return fail(i, 'Unknown action.');
  await fn(i);
}

module.exports = { handle };
