# The Cenzo Daily

A newspaper front page for an 800 × 480 ePaper display, printed fresh every morning.

Each issue has:

- **Il Meteo**: today's forecast, with a little Cenzo dressed for the weather (sunnies, umbrella, beanie and so on)
- **Dagli Archivi**: a short story from Italian history, a different one each day
- the date in English and Italian, and a running issue number that starts from the day the paper was first given

## How it works

```
GitHub Actions (every morning)
  ├─ fetches the forecast from Open-Meteo (free, no API key)
  ├─ fills template/index.html with the weather, the day's story and the right avatar
  ├─ screenshots it at 800 × 480 in headless Chrome
  ├─ snaps every pixel to the panel's 4 greys
  └─ publishes to GitHub Pages:
        /dashboard.png   ← the device downloads this
        /data.json       ← the same content as data, if you'd rather draw it on-device
        /index.html      ← preview in a browser
```

The display only has to wake up, download one PNG, show it and go back to sleep. All the logic lives here, so changing the paper never means reflashing the device.

## Make it yours

| To change | Edit |
| --- | --- |
| Location, name, masthead, first issue date | `config.json` |
| Layout, fonts, sizes | `template/index.html`, `template/style.css` |
| The avatar artwork | `avatars/source/<mood>.jpg` (see below) |
| The drawn fallback avatar | the `<g id="person">` group in `template/index.html` |
| What makes it "hot", "cold" or "windy" | `thresholds` in `config.json` |
| Weather headlines and photo captions | `data/weather-copy.json` |
| History stories | `data/italy-facts.json` |

**Stories** are shown in order, one per issue, looping when they run out. Write plain `'` and `"`; they're converted to curly quotes when printed. Long stories shrink to fit, but around 200–290 characters looks best.

**Avatar artwork:** drop a square image named after a mood (`sunny.jpg`, `rain.png`, ...) into `avatars/source/`. Each build crops it in on the face, converts it to the 4 greys and uses it on that mood's days. Keep the face centred and props close to the head, because the outer edges get cropped. Adjust the framing per mood in `avatars/crops.json` (`{"rain": {"zoom": 0.8, "top": 0.3}}`). Missing moods borrow a close one (cold uses snow, hot uses sunny), and fall back to the drawn SVG if there's nothing close.

**Avatar moods** are `sunny partly cloudy fog rain storm snow hot cold windy unknown`. Any SVG element with `data-moods="rain storm"` only appears in those moods, and `data-hide-moods` does the opposite. Mood picking is in `pickMood()` in `src/content.mjs`.

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
3. Run the **Print today's paper** workflow once by hand from the **Actions** tab.
4. The image is now at `https://<user>.github.io/<repo>/dashboard.png`.

A few things to know:

- **GitHub Pages is public**, even if the repo is private. Keep the location in `config.json` to suburb level (two decimal places is about 1 km), and remember the avatar is public too.
- **The schedule runs in UTC.** `18:23` UTC is 5:23 am in Sydney during daylight saving and 4:23 am outside it. Change the cron line in `.github/workflows/daily.yml` for another time zone.
- **GitHub turns off scheduled workflows after 60 days of repo inactivity.** The workflow re-enables itself on each run to prevent that. If the paper ever stops updating, check the Actions tab first.
- If the weather API is down, the paper still prints, with the weather desk "out to lunch".

## The device

Built for the Seeed Studio **reTerminal E1001** (ESP32-S3, 7.5" 800 × 480, 4-grey ePaper). The firmware just needs to:

1. connect to Wi-Fi
2. fetch `dashboard.png`
3. draw it
4. deep sleep until tomorrow morning, or until a button is pressed

The device can equally run Seeed's SenseCraft HMI, ESPHome/Home Assistant or TRMNL instead. Nothing here locks it in.

## Credits

Forecasts from [Open-Meteo](https://open-meteo.com) (CC BY 4.0). Fonts: UnifrakturMaguntia, Old Standard TT and Libre Caslon Text, all under the SIL Open Font License, via Fontsource.
