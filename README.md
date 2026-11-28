# The Cenzo Daily

A newspaper front page for an 800 × 480 ePaper display, drawn fresh every time the display refreshes.

Each issue has:

- **Il Meteo**: today's forecast, with a little Cenzo dressed for the weather (sunnies, umbrella, beanie and so on)
- **Dagli Archivi**: a short story from Italian history, a different one each day
- the date in English and Italian, and a running issue number that starts from the day the paper was first given

## How it works

The device shows a web page, `/live/`, through Seeedash's HTML widget. Seeed's servers load the page at every refresh and send the device a picture of it. Each time it's loaded, the page:

1. works out today's date in Sydney time (whatever time zone the renderer is in)
2. fetches the forecast from Open-Meteo (free, no API key)
3. fills `template/index.html` with the weather, the day's story and the right avatar

So every refresh shows that moment's paper, and nothing needs to run on a schedule. The browser code is `src/live.mjs`, using the same `src/content.mjs` and `src/forecast.mjs` as the build.

If the forecast can't be fetched, the paper still prints, with the weather desk "out to lunch". If the page can't load its own data at all, it shows the masthead, today's date and "Edizione in ritardo · Today's edition is delayed", with the reason in small type, rather than an old paper.

GitHub Actions publishes the site to GitHub Pages whenever `main` changes:

```
/live/           ← the live page: point the device here
/dashboard.png   ← the paper as printed at publish time, snapped to the panel's 4 greys
/data.json       ← the same content as data
/index.html      ← dashboard.png in a browser
```

`dashboard.png` is printed by screenshotting the same template in headless Chrome. It's handy for previews, or for firmware that can only show an image, but it only changes when the site is published.

## Make it yours

| To change | Edit |
| --- | --- |
| Location, name, masthead, first issue date | `config.json` |
| Layout, fonts, sizes | `template/index.html`, `template/style.css` |
| The avatar artwork | `avatars/source/<mood>.jpg` (see below) |
| Weather icons | the `#sky-icon` glyphs in `template/index.html` ([Weather Icons](https://erikflowers.github.io/weather-icons/) font) |
| What makes it "hot", "cold" or "windy" | `thresholds` in `config.json` |
| Weather headlines and photo captions | `data/weather-copy.json` |
| History stories | `data/italy-facts.json` |

**Stories** are shown in order, one per issue, looping when they run out. Write plain `'` and `"`; they're converted to curly quotes when printed. Long stories shrink to fit, but around 200–290 characters looks best.

**Avatar artwork:** drop a square image named after a mood (`sunny.jpg`, `rain.png`, ...) into `avatars/source/`. Each build crops it in on the face, converts it to the 4 greys and uses it on that mood's days. Keep the face centred and props close to the head, because the outer edges get cropped. Adjust the framing per mood in `avatars/crops.json` (`{"rain": {"zoom": 0.8, "top": 0.3}}`). Missing moods borrow a close one (cold uses snow, hot uses sunny), and otherwise the paper uses `cloudy`.

**Avatar moods** are `sunny partly cloudy fog rain storm snow hot cold windy unknown`. Mood picking is in `pickMood()` in `src/content.mjs`.

**Colours:** stick to `#000`, `#555`, `#aaa` and `#fff`. The panel can only show those four, and anything else is rounded to the nearest one.

## Run it locally

You need Node 20+ and Chrome. If Chrome isn't found automatically, set `CHROME_PATH`.

```sh
npm install
npm run sample      # print using sample weather (offline) -> out/dashboard.png
npm run build       # print using live weather
npm run gallery     # one page per avatar mood -> out/gallery/
```

For live layout tweaking, open `template/index.html` straight in Chrome. It renders `template/sample-data.js`.

Extra flags: `--date=2027-01-01` prints a given day, and `--mood=storm` forces an avatar mood.

## Setting up the repo

1. Push to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Run the **Publish the paper** workflow once by hand from the **Actions** tab (later pushes to `main` publish automatically).
4. The live page is now at `https://<user>.github.io/<repo>/live/`.

**GitHub Pages is public**, even if the repo is private. Keep the location in `config.json` to suburb level (two decimal places is about 1 km), and remember the avatar is public too.

## The device

Built for the Seeed Studio **reTerminal E1001** (ESP32-S3, 7.5" 800 × 480, 4-grey ePaper), running Seeed's stock firmware:

1. In Seeedash, add an **HTML** widget to the canvas, set its URL to `https://<user>.github.io/<repo>/live/` and apply the design to the device.
2. Set the device's **Interval** (we use 6 hours). Each refresh, Seeed loads the page, waits for it and sends the device a picture; pressing the device's refresh button does the same straight away.
3. Choose the **4-Level Grayscale** option. The page only uses `#000`, `#555`, `#aaa` and `#fff`, the panel's four shades.

Other firmware (ESPHome/Home Assistant, TRMNL, or your own) can show `dashboard.png` instead, but that image only changes when the site is published.

## Credits

Forecasts from [Open-Meteo](https://open-meteo.com) (CC BY 4.0). Fonts: UnifrakturMaguntia, Old Standard TT and Libre Caslon Text, all under the SIL Open Font License, via Fontsource. Weather icons: [Weather Icons](https://erikflowers.github.io/weather-icons/) by Erik Flowers, SIL Open Font License.
