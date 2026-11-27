// Gets the forecast for the build: live from Open-Meteo (free, no API key), or the sample
// fixture for offline builds. The request itself lives in forecast.mjs, shared with the live page.
import { readFile } from 'node:fs/promises';
import { fetchForecast, forecastFor } from './forecast.mjs';

// `day` is "YYYY-MM-DD" in the location's time zone.
export async function getWeather(location, { sample = false, day } = {}) {
  if (sample) {
    const raw = JSON.parse(await readFile(new URL('../fixtures/open-meteo-sample.json', import.meta.url)));
    return forecastFor(raw);
  }
  return fetchForecast(location, day);
}
