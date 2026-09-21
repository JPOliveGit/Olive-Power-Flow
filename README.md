# Olive Power Flow

A responsive Home Assistant dashboard card showing **production + grid + optional battery → home → individual consumers**, always in watts. Includes a visual editor; no runtime dependencies or cloud access.

**Version 0.1.0 — initial release candidate.** Local calculation and browser layout tests are provided. End-to-end validation with real Home Assistant sensors is still required before declaring a stable release. This repository is prepared for HACS custom-repository installation; it is not yet listed in the default HACS catalogue.

## Install with HACS

Repository: [JPOliveGit/Olive-Power-Flow](https://github.com/JPOliveGit/Olive-Power-Flow).

1. Open HACS → menu → Custom repositories.
2. Paste `https://github.com/JPOliveGit/Olive-Power-Flow` and select **Dashboard**.
3. Find **Olive Power Flow** and download it.
4. Reload the browser. Add **Olive Power Flow** from the dashboard card picker.
5. If your dashboard manages resources manually, add `/hacsfiles/Olive-Power-Flow/olive-power-flow.js` as a JavaScript module.

For manual installation, copy `dist/olive-power-flow.js` to `/config/www/olive-power-flow.js`, register `/local/olive-power-flow.js?v=0.1.0` as a JavaScript module and reload. Create `www` and restart Home Assistant first if the folder did not exist.

## Visual configuration

The editor currently uses Portuguese labels:

1. Set **Sensores de produção** and select each production sensor.
2. Select **Ligação à rede**.
3. Enable **Tenho bateria** if applicable and select its net power sensor.
4. Set **Sensores de consumo**; that many sensor selectors appear. Add names and optional `mdi:` icons.
5. The home circle is calculated automatically. There is no home sensor to configure.

Changing a count preserves the first existing entries. Reducing it removes the trailing entries. Empty entries display unavailable until configured. The editor suggests sensors whose units are W or kW; an entity ID can also be typed directly. Production supports 0–50 and consumption 0–100 entries in the editor.

## Correct power accounting

```text
Home = sum(production) + grid + battery
Grid:    positive = importing; negative = exporting
Battery: positive = discharging; negative = charging
```

Use **Inverter sinal** / `invert: true` when an entity uses the opposite convention. Example: solar 2500 W, grid −800 W, battery −500 W → home **1200 W**. Without a battery the battery term is zero. With no production configured, its term is zero.

Use **total AC production**, not just solar-to-home. Do not combine total inverter output including battery with a separate battery contribution, or combine overlapping production meters. Grid and battery must represent net flow; if your integration exposes import/export or charge/discharge separately, create a template power sensor that subtracts them first. DC battery readings may include conversion losses compared with AC meters.

Unavailable, unknown, non-numeric or non-W/kW configured sources make the home total unavailable (`—`), rather than silently undercounting. Unavailable consumer readings do not invalidate the home total. Negative totals are preserved to make sign errors or asynchronous readings visible. Different sensor update intervals can cause short-lived discrepancies.

Consumer values are independent readings, not subtracted from the home total. Their sum may differ from the home reading, and circuits may overlap. No unmeasured remainder or percentage is inferred.

## YAML

See [examples/card.yaml](examples/card.yaml). Core format:

```yaml
type: custom:olive-power-flow
production:
  - entity: sensor.solar_production_power
grid:
  entity: sensor.grid_power
  invert: false
battery:
  entity: sensor.battery_power
  invert: false
devices:
  - entity: sensor.office_power
    name: Escritório
    icon: mdi:desktop-tower-monitor
grid_options:
  columns: full
  rows: auto
```

Omit `battery` when absent. `production` and `devices` may be empty arrays. Optional `title`, `home_name`, and source `name` labels are supported. Each device adds one consumer; YAML does not need a separate count.

## Responsive layout

Circles stay **96 px** and icons **28 px**. Additional width creates more columns, not larger circles. Six consumers fit in one row at approximately 900 px card width. Narrow screens automatically create additional rows, for both sources and consumers.

In a Sections dashboard, place the card directly in a section, use `columns: full` and `rows: auto`, and widen the containing section if needed. A Masonry column cannot be widened by this card. Animations indicate direction, not relative power. Reduced-motion preferences hide animated dots. Clicking a sensor circle opens its Home Assistant details; the computed home circle has no entity.

## Development and publishing

Node.js 20+ is sufficient; no npm installation is needed:

```sh
npm run build
npm run check
npm test
```

`src/olive-power-flow.js` is the source; the build copies it to the single distributable `dist/olive-power-flow.js`. Commit the distribution file as well. Pure logic tests run without Home Assistant; the browser smoke test can be run with Playwright as described in [PUBLISHING.md](PUBLISHING.md).

See [PUBLISHING.md](PUBLISHING.md) for publication, HACS validation and release steps. License: [MIT](LICENSE).

References: [Home Assistant custom cards](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/), [HACS Dashboard requirements](https://www.hacs.dev/docs/publish/plugin/).
