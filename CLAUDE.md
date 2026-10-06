# mybitcointreasury

Static single-page site for www.mybitcointreasury.finance. Everything lives in `index.html` (inline CSS and JS, Chart.js and Tabler Icons from CDNs). There is no build step, no package.json and no test suite. Other files: `robots.txt`, `sitemap.xml`, favicon/touch icons, `og-share-image.png` and `founder-mining.png`.

## Standing decisions (do not re-flag)

- **June '26 log entry** is intentionally left as logged: a 2.8x floor-zone buy. Do not flag it, question it or change it, even though the site's own floor formula puts June's price outside the 8% band.
- **The decision log is fully open** to all visitors by design, including every entry's reasoning. Subscribers get The Fortnightly newsletter, the operators manual and founding member status (Foundation tier). Never describe the log or its reasoning as locked or subscriber-only.
- **The operators manual** is a free, ungated Google Drive download for now. Email capture is planned later. Every "manual" link points straight at the Drive file.
- **Floor values** quoted anywhere (log entries, notes) come from the site's power-law formula, `calculatePowerLawFloor(new Date(year, monthIndex, 15))`, rounded to the dollar. Never use manually sourced floor figures.
- **Execution price** is the open/low midpoint of the execution day. (Backtest entries before Jun 2026 use representative mid-month prices, as the log intro states.)
- **Timeline:** the operation began January 2025; live public documentation began June 2026. Don't conflate the two.
- **Copy rule:** never use double hyphens in visible copy. Use an em dash (`—` inside JS strings, `—` in HTML) or rephrase.

## Data model

`LOG_ENTRIES` (top of the main `<script>`) is the single source of truth. Each purchase entry carries:

| Field | Example | Notes |
|---|---|---|
| `year` | `'2026'` | string; drives the year headers in the log |
| `date` | `"Sep '26"` | `Mon 'YY`; becomes the chart label |
| `price` | `"$76.6k"` | `$NN.Nk`; the chart price is parsed from this string |
| `tag`, `tl` | `"dca"`, `"DCA"` | log tag style and label |
| `action`, `reasoning` | | headline and expandable reasoning |
| `impact` | `"+0.013055 ₿"` | display text only |
| `live` | `true` | true for entries from Jun 2026 on |
| `usd` | `1000` | fiat deployed |
| `btc` | `0.013055` | BTC acquired, 6 dp |

Derived from it automatically: chart months and prices, cumulative BTC (`btcActual`), running cost basis (`costBasis`), `BTC_HELD`, `TOTAL_FIAT_DEPLOYED`, average cost, the hero and KPI figures, current value and P&L, the log entry count, the power-law floor, midpoint and ceiling series, and the live line position.

The power-law series are pure date math for the 15th of each logged month (plus today for the "Now" point): `calculatePowerLawFloor`, `calculatePowerLawMidpoint` and `calculatePowerLawCeiling`. The ceiling is its own power law (`PL_CEIL_*` constants, fitted to two Bitbo "Resistance" readings), not a multiple of the midpoint. The Power Law chart tab uses a logarithmic y-axis (20k to 1M).

Not derived: `projectionLow` / `projectionHigh` (the shaded 2030 range) are published once and never revised.

## Monthly update procedure

1. **Append one object to the end of `LOG_ENTRIES`** with every field above. `live: true`; `usd` = fiat deployed; `btc` = BTC acquired to 6 dp; `price` = open/low midpoint in `$NN.Nk` form. If the reasoning quotes a floor, take it from the formula for the 15th of that month: add the entry, open the page and run `Math.round(calculatePowerLawFloor(new Date(2025, LOG_ENTRIES.length - 1, 15)))` in the browser console.
2. Nothing else needs editing for the numbers: every series, including the power-law floor, midpoint and ceiling, extends itself. Optionally refresh copy that names the latest execution: the dashboard note under the signal cards, and the hero "latest issue" callout and newsletter preview when a new issue goes out.
3. Verify in a browser (see below): the log count goes up by one, the new row is highlighted live, every chart shows the new month, and the hero/KPI figures match the new totals.

## Verifying changes

- Serve or open `index.html` directly. Check at 390px and 1280px, and keep the console free of errors on load, when opening the pricing modal, when switching chart tabs and when expanding log entries.
- The page must still render if a CDN fails: chart creation is guarded and shows "Chart unavailable".
- Mobile layout overrides live in the `PHONE LAYOUT` media queries at the end of the stylesheet. Check there is no horizontal overflow at 360px.

## Workflow

- One pull request per change. Never push to `main`.
- Keep each PR to what was asked; list anything noticed but out of scope in the PR description instead of fixing it.
