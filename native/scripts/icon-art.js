// Life Managed's icon artwork (same geometry as ../../icon.svg), drawn pixel by pixel with anti-aliasing,
// and a tiny PNG encoder. Shared by the make-*-icons.js scripts. No dependencies.
const zlib = require('zlib');

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const NAVY = hex('#1E2A3B'), PAPER = hex('#FBF8F3'), MARIGOLD = hex('#F2A33A'), TEAL = hex('#1F6F6B'), WHITE = [255, 255, 255];

// Shapes in the 512-unit icon space.
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
};
const segDist = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};
const page = (x, y) => inRoundRect(x, y, 110, 128, 402, 400, 38);
const ring = (x, y) => inRoundRect(x, y, 170, 98, 196, 160, 13) || inRoundRect(x, y, 316, 98, 342, 160, 13);
const check = (x, y) => Math.min(segDist(x, y, 184, 300, 234, 348), segDist(x, y, 234, 348, 328, 246)) <= 18;

function art(x, y, bg) {
  if (ring(x, y)) return PAPER;
  if (page(x, y)) return check(x, y) ? TEAL : y < 206 ? MARIGOLD : PAPER;
  return bg;
}
const insideLauncher = (x, y) => inRoundRect(x, y, 0, 0, 512, 512, 112);

/** Colour at a point in icon space, or null for transparent. */
const STYLES = {
  launcher: (x, y) => (insideLauncher(x, y) ? art(x, y, NAVY) : null),
  round: (x, y) => (Math.hypot(x - 256, y - 256) <= 256 ? art(x, y, NAVY) : null),
  foreground: (x, y) => art(x, y, null),                                         // adaptive icon: background colour comes from XML
  status: (x, y) => ((ring(x, y) || page(x, y)) && !check(x, y) ? WHITE : null), // single-colour silhouette for the status bar
  splash: (x, y) => art(x, y, NAVY),
};

/** Render a w×h image; the 512-unit icon is scaled to `iconPx` and centred. Transparent outside the art for non-splash styles. */
function render(w, h, style, iconPx, { opaque = false } = {}) {
  const S = 3, px = Buffer.alloc(w * h * 4), k = 512 / iconPx, ox = (w - iconPx) / 2, oy = (h - iconPx) / 2, fill = STYLES[style];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const X = (x + (sx + .5) / S - ox) * k, Y = (y + (sy + .5) / S - oy) * k;
      const c = style === 'splash' && (X < 0 || Y < 0 || X > 512 || Y > 512) ? NAVY : fill(X, Y);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const i = (y * w + x) * 4;
    if (a) { px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a; }
    px[i + 3] = Math.round(255 * a / (S * S));
  }
  return png(w, h, px, opaque);
}

function png(w, h, rgba, opaque = false) {
  const ch = opaque ? 3 : 4, raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < ch; c++) raw[y * (w * ch + 1) + 1 + x * ch + c] = rgba[(y * w + x) * 4 + c];
  const table = [...Array(256)].map((_, n) => { let c = n; for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { render, png };
