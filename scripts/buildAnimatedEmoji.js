/**
 * One-off: writes src/utils/emoji/animatedSet.json, the codepoints that have a Google Noto animation.
 * Run `node scripts/buildAnimatedEmoji.js` when you want to refresh the list; the app never downloads the list.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

https.get('https://googlefonts.github.io/noto-emoji-animation/data/api.json', (res) => {
  let body = '';
  res.on('data', (c) => (body += c));
  res.on('end', () => {
    const icons = JSON.parse(body).icons || [];
    const set = icons.map((i) => i.codepoint).filter(Boolean).sort();
    fs.writeFileSync(path.join(__dirname, '../src/utils/emoji/animatedSet.json'), JSON.stringify(set));
    console.log(`wrote ${set.length} animated emoji`);
  });
}).on('error', (e) => { console.error(e); process.exit(1); });
