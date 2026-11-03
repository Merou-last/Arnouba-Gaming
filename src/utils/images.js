const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const ASSETS = path.join(__dirname, '..', '..', 'assets');

// Returns { file, name, url } for an asset that exists on disk, otherwise null.
// `url` is the attachment:// reference to use inside an embed; `file` must be sent in `files`.
function asset(relPath, name) {
  const full = path.join(ASSETS, relPath);
  if (!fs.existsSync(full)) return null;
  return { file: new AttachmentBuilder(full, { name }), name, url: `attachment://${name}` };
}

const gameLogo = (key) => asset(path.join('games', `${key}.png`), `${key}.png`);
const gameRolesBanner = () => asset('game-roles-banner.png', 'game-roles-banner.png');

module.exports = { asset, gameLogo, gameRolesBanner };
