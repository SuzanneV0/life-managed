// Writes the website's PNG icons (browser tab, home-screen install) from the Life Managed icon.
// Run from native/: node scripts/make-web-icons.js
const fs = require('fs'), path = require('path');
const { render } = require('./icon-art');

const SITE = path.join(__dirname, '..', '..');
fs.writeFileSync(path.join(SITE, 'icon-192.png'), render(192, 192, 'launcher', 192));
fs.writeFileSync(path.join(SITE, 'icon-512.png'), render(512, 512, 'launcher', 512));
// Maskable: full-bleed background with the art inside the 80% safe zone.
fs.writeFileSync(path.join(SITE, 'icon-maskable-512.png'), render(512, 512, 'splash', 410, { opaque: true }));
// iOS rounds the corners itself, so the home-screen icon is a full square.
fs.writeFileSync(path.join(SITE, 'apple-touch-icon.png'), render(180, 180, 'splash', 180, { opaque: true }));
console.log('Wrote icon-192.png, icon-512.png, icon-maskable-512.png and apple-touch-icon.png');
