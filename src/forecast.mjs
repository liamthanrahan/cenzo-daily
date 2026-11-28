// The Open-Meteo request and how its answer is read. No Node-only code here: the build
// (weather.mjs) and the live page (live.mjs, in the browser) both use it.

const FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'uv_index_max',
  'sunrise',
  'sunset',
  'wind_gusts_10m_max',
].join(',');

// Yesterday, today and tomorrow in the location's time zone: daily figures, plus hourly
// temperature and rain chance for working out "tonight" (see tonightFor).
export function forecastUrl(location) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', location.latitude);
  url.searchParams.set('longitude', location.longitude);
  url.searchParams.set('timezone', location.timezone);
  url.searchParams.set('past_days', '1');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('daily', FIELDS);
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability');
  return url;
}

// Fetches the forecast (Open-Meteo's raw answer), with retries. Pick days out of it with
// forecastFor and tonightFor. Returns null if it can't, so the paper still prints with a
// "weather desk out to lunch" story.
export async function fetchForecast(location, { attempts = 3, timeoutMs = 15000, pauseMs = 3000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(forecastUrl(location), { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      console.warn(`Weather fetch attempt ${attempt} failed: ${err.message}`);
      if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * pauseMs));
    }
  }
  console.error(`Giving up on weather: ${lastError?.message}`);
  return null;
}

// Picks one day ("YYYY-MM-DD", or the first day if none is given) out of a forecast.
export function forecastFor(raw, day) {
  const i = day ? raw.daily.time.indexOf(day) : 0;
  if (i < 0) throw new Error(`No forecast for ${day} (got ${raw.daily.time.join(', ')})`);
  return normalise(raw, i);
}

// The night before `day` (6 pm to 6 am): lowest temperature and highest chance of rain.
export function tonightFor(raw, day) {
  const h = raw.hourly;
  if (!h) return null;
  const from = `${addDays(day, -1)}T18:00`;
  const to = `${day}T06:00`;
  const hours = h.time.flatMap((t, i) => (t >= from && t <= to ? [i] : []));
  const temps = hours.map((i) => h.temperature_2m?.[i]).filter((v) => v != null);
  const rain = hours.map((i) => h.precipitation_probability?.[i]).filter((v) => v != null);
  if (!temps.length && !rain.length) return null;
  return {
    low: temps.length ? Math.round(Math.min(...temps)) : null,
    rainChance: rain.length ? Math.max(...rain) : null,
  };
}

function normalise(raw, i) {
  const d = raw.daily;
  return {
    code: d.weather_code[i],
    max: Math.round(d.temperature_2m_max[i]),
    min: Math.round(d.temperature_2m_min[i]),
    rainChance: d.precipitation_probability_max?.[i] ?? null,
    uv: d.uv_index_max?.[i] != null ? Math.round(d.uv_index_max[i]) : null,
    sunrise: d.sunrise?.[i] ?? null, // local time, e.g. "2026-11-24T05:41"
    sunset: d.sunset?.[i] ?? null,
    gusts: d.wind_gusts_10m_max?.[i] != null ? Math.round(d.wind_gusts_10m_max[i]) : null,
  };
}

// "2026-11-28" in the given time zone
export const localDate = (date, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

// "2026-11-28" plus n days -> "2026-11-29"
export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
