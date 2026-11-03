const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const TempVoice = require('../models/TempVoice');
const { sendPanel } = require('../services/voiceRooms');
const { ok, fail } = require('../utils/respond');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Bring back the control panel of your private voice room (use it inside the room chat)')
    .setContexts(InteractionContextType.Guild),

  async execute(i) {
    const channel = i.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) return fail(i, 'Use this command inside the chat of your private voice room.');
    const temp = await TempVoice.findOne({ channelId: channel.id });
    if (!temp) return fail(i, 'This is not an active private room.');
    const isAdmin = i.memberPermissions.has(PermissionFlagsBits.Administrator) || i.memberPermissions.has(PermissionFlagsBits.ManageChannels);
    if (temp.ownerId !== i.user.id && !isAdmin) return fail(i, 'Only the room owner can bring the panel back.');
    await sendPanel(channel, temp);
    return ok(i, 'Panel sent.');
  },
};
