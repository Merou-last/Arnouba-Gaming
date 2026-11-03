require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

for (const key of ['TOKEN', 'MONGODB_URI']) {
  if (!process.env[key]) {
    console.error(`❌ Missing ${key} in environment variables (.env).`);
    process.exit(1);
  }
}

// GuildMembers (privileged) is required for auto-role + welcome. MessageContent is NOT needed.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(__dirname, 'commands', file));
  if (command.data && command.execute) client.commands.set(command.data.name, command);
}

for (const file of fs.readdirSync(path.join(__dirname, 'events')).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(__dirname, 'events', file));
  const run = (...args) => Promise.resolve(event.execute(...args, client)).catch((err) => console.error(`[event:${event.name}]`, err));
  if (event.once) client.once(event.name, run);
  else client.on(event.name, run);
}

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

// Keep-alive endpoint (Render)
const app = express();
app.get('/', (req, res) => res.send('Arnouba Gaming Bot is Alive 🐰'));
app.listen(process.env.PORT || 3000, () => console.log(`🌐 Keep-Alive server on port ${process.env.PORT || 3000}`));

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });
    console.log('✅ Connected to MongoDB');
    await client.login(process.env.TOKEN);
  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
})();
