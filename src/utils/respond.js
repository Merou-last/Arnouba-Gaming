const { EmbedBuilder, MessageFlags } = require('discord.js');
const theme = require('../config/theme');

const embed = (color, description) => new EmbedBuilder().setColor(color).setDescription(description);

// Always ephemeral. Picks reply or followUp automatically.
async function reply(interaction, payload) {
  const data = { ...payload, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) return interaction.followUp(data);
  return interaction.reply(data);
}

const ok = (interaction, text) => reply(interaction, { embeds: [embed(theme.colors.success, `✅ ${text}`)] });
const fail = (interaction, text) => reply(interaction, { embeds: [embed(theme.colors.danger, `❌ ${text}`)] });
const info = (interaction, text) => reply(interaction, { embeds: [embed(theme.colors.gold, text)] });

// Returns 0 when allowed, otherwise the number of seconds to wait.
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return Math.ceil((windowMs - (now - hits[0])) / 1000);
  }
  hits.push(now);
  buckets.set(key, hits);
  return 0;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (!v.some((t) => now - t < 3_600_000)) buckets.delete(k);
}, 600_000).unref();

module.exports = { embed, reply, ok, fail, info, rateLimit };
