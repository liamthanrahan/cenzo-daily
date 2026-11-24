// Fetches today's forecast from Open-Meteo (free, no API key) and normalises it.
import { readFile } from 'node:fs/promises';

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

export async function getWeather(location, { sample = false } = {}) {
  if (sample) {
    const raw = JSON.parse(await readFile(new URL('../fixtures/open-meteo-sample.json', import.meta.url)));
    return normalise(raw);
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', location.latitude);
  url.searchParams.set('longitude', location.longitude);
  url.searchParams.set('timezone', location.timezone);
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('daily', FIELDS);

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
      return normalise(await res.json());
    } catch (err) {
      lastError = err;
      console.warn(`Weather fetch attempt ${attempt} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  // Don't fail the whole build: the paper still prints, with a "weather desk out to lunch" story.
  console.error(`Giving up on weather: ${lastError?.message}`);
  return null;
}

function normalise(raw) {
  const d = raw.daily;
  return {
    code: d.weather_code[0],
    max: Math.round(d.temperature_2m_max[0]),
    min: Math.round(d.temperature_2m_min[0]),
    rainChance: d.precipitation_probability_max?.[0] ?? null,
    uv: d.uv_index_max?.[0] != null ? Math.round(d.uv_index_max[0]) : null,
    sunrise: d.sunrise?.[0] ?? null, // local time, e.g. "2026-11-24T05:41"
    sunset: d.sunset?.[0] ?? null,
    gusts: d.wind_gusts_10m_max?.[0] != null ? Math.round(d.wind_gusts_10m_max[0]) : null,
  };
}
