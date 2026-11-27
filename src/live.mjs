// The live front page. Runs in the browser each time the page is loaded (for the device,
// each time Seeedash refreshes it): works out today's date in Sydney, fetches the forecast
// and draws the paper with the same code the build uses for dashboard.png.
//
// The build copies this file, content.mjs, forecast.mjs and the template into out/live/,
// plus paper.json (config, stories, weather copy and which avatar moods have artwork).
import { buildContent, withAvatar } from './content.mjs';
import { fetchForecast, localDate } from './forecast.mjs';

async function main() {
  const res = await fetch('paper.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`paper.json: ${res.status}`);
  const { config, facts, copy, artwork } = await res.json();

  const now = new Date();
  // Kept short: the renderer takes its picture after about 30 seconds.
  const weather = await fetchForecast(config.location, localDate(now, config.location.timezone), {
    attempts: 2,
    timeoutMs: 8000,
    pauseMs: 1000,
  });
  const content = withAvatar(buildContent({ config, weather, facts, copy, now }), new Set(artwork));

  await document.fonts.ready;
  window.render(content);
  const img = document.getElementById('avatar-img');
  if (!img.hidden) await img.decode().catch(() => {});
  document.documentElement.dataset.ready = 'true';
}

main().catch(async (err) => {
  // Something broke before the paper could be drawn. Show the last paper the build printed
  // (dashboard.png) instead of a half-empty template, with the reason in a small note.
  console.error(err);
  const img = new Image(800, 480);
  img.src = '../dashboard.png';
  img.style.cssText = 'position:fixed;inset:0;';
  const note = document.createElement('div');
  note.textContent = `Last printed paper. Live page failed: ${err.message}`;
  note.style.cssText = 'position:fixed;right:8px;bottom:4px;padding:2px 6px;background:#fff;border:1px solid #000;font:11px Arial,sans-serif;';
  document.body.append(img, note);
  await img.decode().catch(() => {});
  document.documentElement.dataset.ready = 'error';
});
