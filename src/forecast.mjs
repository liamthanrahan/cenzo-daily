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

// Today and tomorrow, in the location's time zone.
export function forecastUrl(location) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', location.latitude);
  url.searchParams.set('longitude', location.longitude);
  url.searchParams.set('timezone', location.timezone);
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('daily', FIELDS);
  return url;
}

// Fetches the forecast for `day` ("YYYY-MM-DD" in the location's time zone), with retries.
// Returns null if it can't, so the paper still prints with a "weather desk out to lunch" story.
export async function fetchForecast(location, day, { attempts = 3, timeoutMs = 15000, pauseMs = 3000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(forecastUrl(location), { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
      return forecastFor(await res.json(), day);
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
