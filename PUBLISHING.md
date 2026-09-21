# Publish Olive Power Flow

## Repository

Publish the contents of this directory as a **public** repository named `Olive-Power-Flow` (`hacs.json` explicitly selects `olive-power-flow.js`). Target owner: `JPOliveGit`. Target repository: `https://github.com/JPOliveGit/Olive-Power-Flow`. Do not upload the parent workspace with its personal sensor configurations.

Suggested description: `Responsive Home Assistant power flow card with visual configuration, solar, grid, optional battery and individual consumers.`

Suggested topics: `home-assistant`, `hacs`, `lovelace`, `custom-card`, `energy`, `solar`.

## Validate and release

1. Run `npm run build`, `npm run check`, and `npm test`.
2. Run the browser smoke test if Playwright is installed: `PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs BROWSER_EXECUTABLE=/path/to/chrome node test/browser-smoke.mjs`. These tests stub the Home Assistant icon element; they test layout and editor events, not actual HA icon rendering.
3. Test the module in Home Assistant: pick real W/kW sensors, verify sign conventions, add/remove the battery, change consumer counts, resize the card, and verify icons and more-info dialogs.
4. Push to GitHub and inspect the Validate workflow, including the HACS validator. Local tests cannot validate the remote repository's visibility, description or topics.
5. Set the version in `package.json`, source banner and changelog. Build and commit. Push tag `v0.1.0` to run the Release workflow; it publishes a GitHub release with the single JavaScript asset.
6. Add the public repository URL to HACS as a custom Dashboard repository and test installation/upgrades.

HACS custom-repository compatibility is distinct from inclusion in its default catalogue. Default inclusion requires a separate submission to HACS; nothing here automatically submits one.

## Migrating the prototype

Use `type: custom:olive-power-flow`, replace `solar` with the `production` list, and remove the `home` sensor. The new home value is computed. Confirm the old solar-to-home sensor really measures total production before reusing it. Old `home-power-distribution`/`v3` resources are separate elements and can coexist during migration.
