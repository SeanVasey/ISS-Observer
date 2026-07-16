#!/usr/bin/env node
/**
 * Rasterize the app icon (public/iss-icon-ios.svg) into the PNG sizes that
 * iOS Home Screen, the PWA manifest, and legacy favicons require.
 *
 * SVG apple-touch-icons are ignored by iOS, so a real PNG must be shipped.
 * The source SVG uses gradients + Gaussian-blur filters, so it is rendered
 * through headless Chromium (Playwright) for pixel-accurate output rather
 * than a lightweight SVG library that would drop the blur/glow.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Playwright is installed globally in this environment.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const svgPath = join(publicDir, 'iss-icon-ios.svg');
const svg = readFileSync(svgPath, 'utf8');
const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

// Darkest tone of the icon body — used as an opaque backdrop for app-tile
// icons so there is never transparency for iOS to fill with black.
const APP_BG = '#030809';
// Flat backdrop for the maskable icon (mid-body tone).
const MASKABLE_BG = '#06141A';

/**
 * name        output file (in public/)
 * size        square pixel dimension
 * background  opaque colour, or null for transparent
 * scale       fraction of the canvas the icon occupies (padding for maskable)
 */
const TARGETS = [
  { name: 'apple-touch-icon.png', size: 180, background: APP_BG, scale: 1 },
  { name: 'icon-192.png', size: 192, background: APP_BG, scale: 1 },
  { name: 'icon-512.png', size: 512, background: APP_BG, scale: 1 },
  { name: 'icon-maskable-512.png', size: 512, background: MASKABLE_BG, scale: 0.8 },
  { name: 'favicon-96.png', size: 96, background: null, scale: 1 },
  { name: 'favicon-32.png', size: 32, background: null, scale: 1 },
  { name: 'favicon-16.png', size: 16, background: null, scale: 1 }
];

const pageHtml = (size, background, scale) => {
  const inset = Math.round((size * (1 - scale)) / 2);
  const iconSize = size - inset * 2;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    #stage{width:${size}px;height:${size}px;${background ? `background:${background};` : ''}
      display:flex;align-items:center;justify-content:center}
    #stage img{width:${iconSize}px;height:${iconSize}px;display:block}
  </style></head><body>
    <div id="stage"><img src="${svgDataUri}" width="${iconSize}" height="${iconSize}"></div>
  </body></html>`;
};

const run = async () => {
  const browser = await chromium.launch();
  try {
    for (const t of TARGETS) {
      const page = await browser.newPage({
        viewport: { width: t.size, height: t.size },
        deviceScaleFactor: 1
      });
      await page.setContent(pageHtml(t.size, t.background, t.scale), {
        waitUntil: 'networkidle'
      });
      const el = await page.$('#stage');
      await el.screenshot({
        path: join(publicDir, t.name),
        omitBackground: t.background === null
      });
      await page.close();
      console.log(`✓ ${t.name} (${t.size}×${t.size})`);
    }
  } finally {
    await browser.close();
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
