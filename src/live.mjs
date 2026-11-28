// The live front page. Runs in the browser each time the page is loaded (for the device,
// each time Seeedash refreshes it): works out today's date in Sydney, fetches the forecast
// and draws the paper with the same code the build uses for dashboard.png.
//
// The build copies this file, content.mjs, forecast.mjs and the template into out/live/,
// plus paper.json (config, stories, weather copy and which avatar moods have artwork).
import { buildContent, withAvatar } from './content.mjs';
import { fetchForecast, localDate } from './forecast.mjs';

// Used for the "delayed" notice if paper.json (which holds the real setting) didn't load.
let timeZone = 'Australia/Sydney';

async function main() {
  const res = await fetch('paper.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`paper.json: ${res.status}`);
  const { config, facts, copy, artwork } = await res.json();
  timeZone = config.location.timezone;

  const now = new Date();
  // Kept short: the renderer takes its picture after about 30 seconds.
  const weather = await fetchForecast(config.location, localDate(now, timeZone), {
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

// Something broke before the paper could be drawn. Keep the masthead, put today's date in
// the dateline (that needs no data) and say the edition is delayed, with the reason in
// small type. Never shows an old paper, so nothing on screen is out of date.
async function showDelayed(err) {
  const now = new Date();
  const fmt = (locale, opts) => new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(now);
  document.documentElement.classList.add('rendered');
  document.getElementById('issue').textContent = 'Edizione in ritardo';
  document.getElementById('date-en').textContent = fmt('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('date-it').textContent = fmt('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('edition').textContent = 'Delayed edition';

  const dateline = document.querySelector('.dateline');
  for (let el = dateline.nextElementSibling; el; el = el.nextElementSibling) el.style.display = 'none';

  const notice = document.createElement('section');
  notice.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;';
  notice.innerHTML = `
    <div style="font:700 44px/1.1 'Headline',Georgia,serif">Edizione in ritardo</div>
    <div style="font:italic 26px/1.3 'Body',Georgia,serif">Today's edition is delayed.<br>The presses will try again at the next refresh.</div>
    <div style="font:12px/1.3 Arial,sans-serif;color:#555;max-width:640px" id="delayed-reason"></div>`;
  notice.querySelector('#delayed-reason').textContent = `Reason: ${err.message}`;
  dateline.after(notice);

  await document.fonts.ready;
  document.documentElement.dataset.ready = 'error';
}

main().catch((err) => {
  console.error(err);
  return showDelayed(err);
});
