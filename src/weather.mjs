// Gets the forecast for the build: live from Open-Meteo (free, no API key), or the sample
// fixture for offline builds. Returns Open-Meteo's raw answer (or null); weatherForEdition in
// content.mjs picks the right days out of it. The request itself lives in forecast.mjs.
import { readFile } from 'node:fs/promises';
import { fetchForecast } from './forecast.mjs';

export async function getWeather(location, { sample = false } = {}) {
  if (sample) return JSON.parse(await readFile(new URL('../fixtures/open-meteo-sample.json', import.meta.url)));
  return fetchForecast(location);
}
