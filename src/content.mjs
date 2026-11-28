// Turns config + weather + the fact list into the data object the template renders.

// WMO weather codes -> English / Italian wording and a sky icon.
const CONDITIONS = {
  0: ['Sunny', 'soleggiato', 'sun'],
  1: ['Mostly sunny', 'per lo più soleggiato', 'sun'],
  2: ['Partly cloudy', 'parzialmente nuvoloso', 'partly'],
  3: ['Overcast', 'coperto', 'cloud'],
  45: ['Fog', 'nebbia', 'fog'],
  48: ['Icy fog', 'nebbia gelata', 'fog'],
  51: ['Light drizzle', 'pioviggine debole', 'rain'],
  53: ['Drizzle', 'pioviggine', 'rain'],
  55: ['Heavy drizzle', 'pioviggine intensa', 'rain'],
  56: ['Freezing drizzle', 'pioviggine gelata', 'rain'],
  57: ['Freezing drizzle', 'pioviggine gelata', 'rain'],
  61: ['Light rain', 'pioggia debole', 'rain'],
  63: ['Rain', 'pioggia', 'rain'],
  65: ['Heavy rain', 'pioggia forte', 'rain'],
  66: ['Freezing rain', 'pioggia gelata', 'rain'],
  67: ['Freezing rain', 'pioggia gelata', 'rain'],
  71: ['Light snow', 'neve debole', 'snow'],
  73: ['Snow', 'neve', 'snow'],
  75: ['Heavy snow', 'neve forte', 'snow'],
  77: ['Snow grains', 'nevischio', 'snow'],
  80: ['Showers', 'rovesci', 'rain'],
  81: ['Showers', 'rovesci', 'rain'],
  82: ['Heavy showers', 'rovesci forti', 'rain'],
  85: ['Snow showers', 'rovesci di neve', 'snow'],
  86: ['Snow showers', 'rovesci di neve', 'snow'],
  95: ['Thunderstorms', 'temporali', 'storm'],
  96: ['Storms with hail', 'temporali con grandine', 'storm'],
  99: ['Storms with hail', 'temporali con grandine', 'storm'],
};

const UV = [
  [11, 'Extreme', 'estremo'],
  [8, 'Very high', 'molto alto'],
  [6, 'High', 'alto'],
  [3, 'Moderate', 'moderato'],
  [0, 'Low', 'basso'],
];

// Which outfit the avatar wears. Order matters: the first match wins.
export function pickMood(w, t) {
  if (!w) return 'unknown';
  const sky = (CONDITIONS[w.code] ?? CONDITIONS[3])[2];
  if (sky === 'storm') return 'storm';
  if (sky === 'snow') return 'snow';
  if (sky === 'rain' || (w.rainChance ?? 0) >= t.rainChancePct) return 'rain';
  if (w.max >= t.hotMaxC) return 'hot';
  if (w.max <= t.coldMaxC) return 'cold';
  if ((w.gusts ?? 0) >= t.windyGustKmh) return 'windy';
  if (sky === 'fog') return 'fog';
  if (sky === 'cloud') return 'cloudy';
  if (sky === 'partly') return 'partly';
  return 'sunny';
}

// Calendar date in the dashboard's time zone, as a whole day number.
function localDay(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day) / 86400000;
}

function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

// "2026-11-24T05:42" -> "5:42 am" (Open-Meteo already gives local time)
function clock(iso) {
  if (!iso) return '–';
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// Typographer's quotes, so the JSON can be written with plain ' and ".
export const smartQuotes = (s) =>
  s
    .replace(/(^|[\s(\[—–-])'/g, '$1\u2018')
    .replace(/'/g, '\u2019')
    .replace(/(^|[\s(\[—–-])"/g, '$1\u201C')
    .replace(/"/g, '\u201D');

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export function buildContent({ config, weather, facts, copy, now = new Date(), moodOverride }) {
  const tz = config.location.timezone;
  const today = localDay(now, tz);
  const first = Date.parse(config.firstIssue) / 86400000;
  const issueNumber = today - first + 1;
  const isPreview = issueNumber < 1;

  // Issue 1 gets fact 1, issue 2 gets fact 2, and so on, looping when we run out.
  const factIndex = (((isPreview ? today : issueNumber - 1) % facts.length) + facts.length) % facts.length;
  const fact = facts[factIndex];

  const mood = moodOverride ?? pickMood(weather, config.thresholds);
  const moodCopy = copy[mood] ?? copy.unknown;
  const vars = { name: config.name, place: config.location.label };
  const headline = smartQuotes(fill(moodCopy.headlines[today % moodCopy.headlines.length], vars));

  const [condEn, condIt, icon] = weather ? CONDITIONS[weather.code] ?? CONDITIONS[3] : ['No forecast', 'nessuna previsione', 'cloud'];
  const uvBand = weather?.uv != null ? UV.find(([min]) => weather.uv >= min) : null;

  const fmt = (locale, opts) => new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts }).format(now);

  return {
    masthead: config.masthead,
    name: config.name,
    issue: isPreview
      ? { label: 'Anteprima · Preview edition' }
      : { label: `Vol. ${toRoman(Math.floor((issueNumber - 1) / 365) + 1)} · No. ${issueNumber}`, number: issueNumber },
    date: {
      en: fmt('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      it: fmt('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
    },
    edition: `${config.location.label} Edition`,
    printed: fmt('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, ' ').toLowerCase(),
    weather: {
      mood,
      icon,
      headline,
      caption: smartQuotes(fill(moodCopy.caption, vars)),
      available: Boolean(weather),
      max: weather?.max ?? null,
      min: weather?.min ?? null,
      conditionEn: condEn,
      conditionIt: condIt,
      rainChance: weather?.rainChance ?? null,
      uv: weather?.uv ?? null,
      uvEn: uvBand?.[1] ?? '',
      uvIt: uvBand?.[2] ?? '',
      sunrise: clock(weather?.sunrise),
      sunset: clock(weather?.sunset),
    },
    fact: { ...fact, title: smartQuotes(fact.title), text: smartQuotes(fact.text), number: factIndex + 1, total: facts.length },
  };
}

// If there's no artwork for today's mood, borrow a close one, then the default, then any at all.
const DEFAULT_AVATAR = 'cloudy';
const AVATAR_FALLBACKS = {
  sunny: ['hot', 'partly'],
  partly: ['sunny', 'cloudy'],
  cloudy: ['partly', 'fog'],
  fog: ['cloudy'],
  rain: ['storm'],
  storm: ['rain'],
  snow: ['cold'],
  hot: ['sunny'],
  cold: ['snow'],
  windy: ['cloudy', 'partly'],
  unknown: ['cloudy', 'partly'],
};
// `artwork` is the set of moods that have an image in avatars/.
export function withAvatar(content, artwork) {
  const mood = content.weather.mood;
  const pick = [mood, ...(AVATAR_FALLBACKS[mood] ?? []), DEFAULT_AVATAR, ...artwork].find((m) => artwork.has(m));
  content.weather.avatarImage = pick ? `avatars/${pick}.png` : null;
  return content;
}
