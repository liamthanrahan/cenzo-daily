// Builds today's front page.
//
//   npm run build            live weather -> out/dashboard.png, out/data.json, out/index.html
//   npm run sample           same, using fixtures/open-meteo-sample.json (no network)
//   npm run gallery          one image per avatar mood -> out/gallery/*.png
//
// Options: --sample, --gallery, --mood=<mood>, --date=YYYY-MM-DD
import { mkdir, readFile, writeFile, access, cp } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { getWeather } from './weather.mjs';
import { buildContent, withAvatar } from './content.mjs';
import { localDate } from './forecast.mjs';
import { prepareAvatars } from './prepare-avatars.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const WIDTH = 800;
const HEIGHT = 480;
// The reTerminal E1001 panel shows 4 shades. Every pixel is snapped to one of these.
const GREYS = [0x00, 0x55, 0xaa, 0xff];
// Made-up weather for each mood, so every gallery page is self-consistent.
const GALLERY = {
  sunny: { code: 0, max: 26, min: 17, rainChance: 0, uv: 10, gusts: 20 },
  partly: { code: 2, max: 23, min: 16, rainChance: 10, uv: 8, gusts: 25 },
  cloudy: { code: 3, max: 20, min: 15, rainChance: 20, uv: 4, gusts: 25 },
  fog: { code: 45, max: 19, min: 12, rainChance: 10, uv: 5, gusts: 10 },
  rain: { code: 63, max: 21, min: 16, rainChance: 90, uv: 3, gusts: 35 },
  storm: { code: 95, max: 27, min: 19, rainChance: 95, uv: 6, gusts: 60 },
  snow: { code: 73, max: 1, min: -4, rainChance: 80, uv: 1, gusts: 30 },
  hot: { code: 0, max: 39, min: 24, rainChance: 0, uv: 13, gusts: 30 },
  cold: { code: 3, max: 11, min: 3, rainChance: 10, uv: 2, gusts: 20 },
  windy: { code: 2, max: 22, min: 14, rainChance: 10, uv: 7, gusts: 75 },
  unknown: null,
};
const MOODS = Object.keys(GALLERY);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

// The live page (out/live/): the same front page, but drawn in the browser each time it's
// loaded, with that moment's date and forecast. See src/live.mjs.
async function publishLivePage({ config, facts, copy, artwork }) {
  const dir = path.join(OUT, 'live');
  await mkdir(path.join(dir, 'fonts'), { recursive: true });

  // Fonts: point the stylesheet at copies next to it instead of node_modules.
  const fonts = [];
  const css = (await readFile(path.join(ROOT, 'template/style.css'), 'utf8')).replace(
    /url\('(\.\.\/node_modules\/[^']+\/([^'/]+\.woff2))'\)/g,
    (_, rel, file) => { fonts.push([rel, file]); return `url('fonts/${file}')`; },
  );
  for (const [rel, file] of fonts) await cp(path.join(ROOT, 'template', rel), path.join(dir, 'fonts', file));
  await writeFile(path.join(dir, 'style.css'), css);

  // The template, minus the sample data, plus the script that fills it in.
  const swaps = [
    ['<script src="sample-data.js"></script>', '<script>window.__EXTERNAL_DATA__ = true;</script>'],
    ['<script src="render.js" defer></script>', '<script src="render.js" defer></script>\n  <script type="module" src="live.mjs"></script>'],
  ];
  let html = await readFile(path.join(ROOT, 'template/index.html'), 'utf8');
  for (const [from, to] of swaps) {
    if (!html.includes(from)) throw new Error(`template/index.html no longer has ${from}`);
    html = html.replace(from, to);
  }
  await writeFile(path.join(dir, 'index.html'), html);

  await cp(path.join(ROOT, 'template/render.js'), path.join(dir, 'render.js'));
  for (const file of ['live.mjs', 'content.mjs', 'forecast.mjs']) await cp(path.join(ROOT, 'src', file), path.join(dir, file));
  await mkdir(path.join(dir, 'avatars'), { recursive: true });
  for (const mood of artwork) await cp(path.join(ROOT, 'template/avatars', `${mood}.png`), path.join(dir, 'avatars', `${mood}.png`));
  await writeFile(path.join(dir, 'paper.json'), JSON.stringify({ config, facts, copy, artwork: [...artwork] }));
}

const readJson = async (rel) => JSON.parse(await readFile(path.join(ROOT, rel), 'utf8'));

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    try { await access(c); return c; } catch {}
  }
  throw new Error('Chrome not found. Set CHROME_PATH to your Chrome or Chromium executable.');
}

// Snap the screenshot to the panel's 4 greys so what you see in out/ is what the device shows.
async function toEpaper(png) {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    data[i] = GREYS.reduce((best, g) => (Math.abs(g - v) < Math.abs(best - v) ? g : best));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function renderPage(browser, content) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { window.__EXTERNAL_DATA__ = true; });
  await page.goto(pathToFileURL(path.join(ROOT, 'template/index.html')).href, { waitUntil: 'load' });
  await page.evaluate(async (data) => {
    await document.fonts.ready;
    window.render(data);
  }, content);
  await page.evaluate(async () => {
    const img = document.getElementById('avatar-img');
    if (!img.hidden) await img.decode();
  });
  const shot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  await page.close();
  return toEpaper(shot);
}

// Runs from this hour (local time) onwards print tomorrow's issue.
const NEXT_DAY_FROM_HOUR = 18;

const localHour = (date, timeZone) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date));

async function main() {
  const config = await readJson('config.json');
  const facts = await readJson('data/italy-facts.json');
  const copy = await readJson('data/weather-copy.json');
  const tz = config.location.timezone;
  const printedAt = new Date();
  // The day this issue is for. From the evening on, a run prints the next morning's paper,
  // so the daily slot can be scheduled the night before (GitHub often runs it hours late).
  const now = args.date
    ? new Date(`${args.date}T06:00:00Z`)
    : localHour(printedAt, tz) >= NEXT_DAY_FROM_HOUR
      ? new Date(printedAt.getTime() + 86400000)
      : printedAt;
  const artwork = new Set(await prepareAvatars());
  if (artwork.size) console.log(`Avatar artwork: ${[...artwork].join(', ')}`);
  const weather = await getWeather(config.location, { sample: Boolean(args.sample || args.gallery), day: args.date ? undefined : localDate(now, tz) });

  const browser = await puppeteer.launch({
    executablePath: await findChrome(),
    args: ['--no-sandbox', '--font-render-hinting=none', '--allow-file-access-from-files'],
  });

  try {
    await mkdir(OUT, { recursive: true });

    if (args.gallery) {
      const dir = path.join(OUT, 'gallery');
      await mkdir(dir, { recursive: true });
      for (const [i, mood] of MOODS.entries()) {
        // Step the date too, so each image also shows a different fact.
        const day = new Date(now.getTime() + i * 86400000);
        const fake = GALLERY[mood] && { ...weather, ...GALLERY[mood] };
        const content = withAvatar(buildContent({ config, weather: fake, facts, copy, now: day }), artwork);
        await writeFile(path.join(dir, `${mood}.png`), await renderPage(browser, content));
        console.log(`gallery/${mood}.png`);
      }
      return;
    }

    const content = withAvatar(buildContent({ config, weather, facts, copy, now, printedAt, moodOverride: args.mood }), artwork);
    await writeFile(path.join(OUT, 'dashboard.png'), await renderPage(browser, content));
    await writeFile(path.join(OUT, 'data.json'), JSON.stringify({ generatedAt: new Date().toISOString(), ...content }, null, 2));
    await writeFile(
      path.join(OUT, 'index.html'),
      `<!doctype html><meta charset="utf-8"><title>${content.masthead}</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#ddd">
<img src="dashboard.png" width="800" height="480" alt="${content.masthead}, ${content.date.en}" style="box-shadow:0 4px 24px #0003">`,
    );
    await publishLivePage({ config, facts, copy, artwork });
    // Extra pages published as they are, e.g. static/render-test.html
    await cp(path.join(ROOT, 'static'), OUT, { recursive: true }).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
    console.log(`Printed ${content.issue.label}: "${content.weather.headline}" / "${content.fact.title}"`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
