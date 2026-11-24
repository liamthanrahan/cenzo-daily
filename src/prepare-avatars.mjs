// Turns artwork in avatars/source/ into panel-ready avatars in template/avatars/.
//
// Drop a square image named after a mood (sunny.jpg, rain.png, ...) into avatars/source/.
// Each one is cropped in on the face, converted to greyscale, contrast-stretched, shrunk to the
// avatar box and snapped to the panel's 4 greys. Runs automatically at the start of every build.
//
// Optional per-mood framing in avatars/crops.json, e.g. { "rain": { "zoom": 0.8, "top": 0.3 } }
//   zoom: fraction of the image width to keep (smaller = closer on the face)
//   top:  where to take the crop vertically (0 = top edge, 1 = bottom edge)
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'avatars/source');
const OUT = path.join(ROOT, 'template/avatars');
export const AVATAR_W = 134; // the avatar box is 138 × 146 including its 2px border
export const AVATAR_H = 142;
const GREYS = [0x00, 0x55, 0xaa, 0xff];
const DEFAULT_CROP = { zoom: 0.86, top: 0.3, trim: 0.03 }; // trim removes any drawn frame

export async function prepareAvatars() {
  let files;
  try {
    files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  } catch {
    return []; // no avatars/source folder: the drawn SVG avatar is used
  }
  let crops = {};
  try { crops = JSON.parse(await readFile(path.join(ROOT, 'avatars/crops.json'), 'utf8')); } catch {}

  await mkdir(OUT, { recursive: true });
  const done = [];
  for (const file of files) {
    const mood = path.parse(file).name.toLowerCase();
    const { zoom, top, trim } = { ...DEFAULT_CROP, ...crops[mood] };
    const img = sharp(path.join(SRC, file));
    const { width, height } = await img.metadata();

    const m = Math.round(width * trim);
    const innerW = width - 2 * m;
    const innerH = height - 2 * m;
    // Never ask for a crop taller than the image, or the result would be stretched.
    const maxZoom = (innerH * AVATAR_W) / (innerW * AVATAR_H);
    const cw = Math.round(innerW * Math.min(zoom, maxZoom));
    const ch = Math.min(innerH, Math.round((cw * AVATAR_H) / AVATAR_W));
    const left = m + Math.round((innerW - cw) / 2);
    const topPx = m + Math.round((innerH - ch) * top);

    const { data, info } = await img
      .extract({ left, top: topPx, width: cw, height: ch })
      .greyscale()
      .normalise()
      .resize(AVATAR_W, AVATAR_H, { kernel: 'lanczos3' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      data[i] = GREYS.reduce((best, g) => (Math.abs(g - v) < Math.abs(best - v) ? g : best));
    }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } })
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT, `${mood}.png`));
    done.push(mood);
  }
  return done;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  prepareAvatars().then((moods) => console.log(moods.length ? `Prepared: ${moods.join(', ')}` : 'No artwork in avatars/source/'));
}
