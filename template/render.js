// Fills the template from a data object (see out/data.json for the shape).
// The build calls window.render(data); opening index.html directly renders sample-data.js instead.

window.render = function render(d) {
  const set = (id, text) => { document.getElementById(id).textContent = text ?? '–'; };
  const w = d.weather;

  document.documentElement.classList.add('rendered');
  document.body.classList.toggle('no-weather', !d.weather.available);
  set('masthead', d.masthead);
  document.title = d.masthead;
  set('issue', d.issue.label);
  set('date-en', d.date.en);
  set('date-it', d.date.it);
  set('edition', d.edition);

  set('w-headline', w.headline);
  set('w-caption', w.caption);
  set('t-max', w.max);
  set('t-min', w.min);
  set('cond-en', w.conditionEn);
  set('cond-it', w.conditionIt);
  set('s-rain', w.rainChance != null ? `${w.rainChance}%` : '–');
  set('s-uv', w.uv);
  set('s-uv-band', w.uvIt);
  set('s-sunrise', w.sunrise);
  set('s-sunset', w.sunset);

  set('f-title', d.fact.title);
  set('f-dateline', `${d.fact.place} · ${d.fact.era}`);
  set('f-text', d.fact.text);
  set('printed', `Stampato alle ${d.printed}`);
  set('f-number', `Storia ${d.fact.number} di ${d.fact.total}`);

  // Show only the sky icon for today's weather.
  document.querySelectorAll('[data-icons]').forEach((el) => {
    el.style.display = el.dataset.icons === w.icon ? '' : 'none';
  });

  // The avatar artwork for today's weather (none at all only if avatars/source/ is empty).
  const img = document.getElementById('avatar-img');
  img.hidden = !w.avatarImage;
  if (w.avatarImage) img.src = w.avatarImage;

  // Shrink text until it fits its box, so long headlines and stories never overflow.
  return {
    headline: fit(document.getElementById('w-head'), 24, 16),
    title: fit(document.getElementById('f-head'), 32, 20),
    body: fit(document.getElementById('f-body'), 21, 13),
  };
};

function fit(el, max, min) {
  for (let size = max; size >= min; size -= 0.5) {
    el.style.fontSize = `${size}px`;
    const inner = el.firstElementChild ?? el;
    const tooTall = el.scrollHeight > el.clientHeight + 1;
    const tooWide = el.scrollWidth > el.clientWidth + 1;
    // Flex-centred headings don't scroll; measure their text instead.
    const textTooTall = inner !== el && inner.getBoundingClientRect().height > el.clientHeight + 1;
    if (!tooTall && !tooWide && !textTooTall) return size;
  }
  return min;
}

if (!window.__EXTERNAL_DATA__) {
  document.addEventListener('DOMContentLoaded', () => document.fonts.ready.then(() => window.render(window.SAMPLE_DATA)));
}
