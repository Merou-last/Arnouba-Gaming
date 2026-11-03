const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits: P } = require('discord.js');
const theme = require('../config/theme');
const Suggestion = require('../models/Suggestion');
const { getConfig, roleId } = require('../utils/config');
const { fail } = require('../utils/respond');

function suggestionRows(doc, decided = false) {
  const rows = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sg:up').setLabel(String(doc.up.length)).setEmoji('👍').setStyle(ButtonStyle.Secondary).setDisabled(decided),
    new ButtonBuilder().setCustomId('sg:down').setLabel(String(doc.down.length)).setEmoji('👎').setStyle(ButtonStyle.Secondary).setDisabled(decided),
  )];
  if (!decided) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sg:approve').setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('sg:deny').setLabel('Deny').setEmoji('⛔').setStyle(ButtonStyle.Danger),
    ));
  }
  return rows;
}

async function vote(i, side) {
  const doc = await Suggestion.findOne({ messageId: i.message.id });
  if (!doc) return fail(i, 'This suggestion is no longer tracked.');
  if (doc.status !== 'pending') return fail(i, 'Voting is closed for this suggestion.');
  const other = side === 'up' ? 'down' : 'up';
  if (doc[side].includes(i.user.id)) doc[side] = doc[side].filter((id) => id !== i.user.id);
  else {
    doc[side].push(i.user.id);
    doc[other] = doc[other].filter((id) => id !== i.user.id);
  }
  await doc.save();
  await i.update({ components: suggestionRows(doc) });
}

async function decide(i, status) {
  const config = await getConfig(i.guild.id);
  const staff = [roleId(config, 'management'), roleId(config, 'staff')].filter(Boolean);
  const allowed = i.memberPermissions.has(P.Administrator) || staff.some((id) => i.member.roles.cache.has(id));
  if (!allowed) return fail(i, 'Only staff members can decide on suggestions.');

  const doc = await Suggestion.findOne({ messageId: i.message.id });
  if (!doc) return fail(i, 'This suggestion is no longer tracked.');
  doc.status = status;
  await doc.save();

  const approved = status === 'approved';
  const embed = EmbedBuilder.from(i.message.embeds[0])
    .setColor(approved ? theme.colors.success : theme.colors.danger)
    .setFields({ name: 'Status', value: approved ? `✅ Approved by ${i.user}` : `⛔ Denied by ${i.user}` });
  await i.update({ embeds: [embed], components: suggestionRows(doc, true) });
}

const routes = {
  up: (i) => vote(i, 'up'),
  down: (i) => vote(i, 'down'),
  approve: (i) => decide(i, 'approved'),
  deny: (i) => decide(i, 'denied'),
};

async function handle(i) {
  const fn = routes[i.customId.slice(3)];
  if (!fn) return fail(i, 'Unknown action.');
  await fn(i);
}

module.exports = { handle, suggestionRows };
