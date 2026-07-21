# Boilerplate Clicker

Reusable Phaser + Capacitor idle clicker foundation.

## Structure

- `src/config` — resolution, theme, UI text, `SAVE_KEY` / `SAVE_VERSION`
- `src/controllers` — `ListScrollController` (visual scrollbar + finger scroll)
- `src/data` — generators, click upgrades, `metaUpgrades.js`
- `src/lib` — pure economy (`clickerMath`) + Auto Tap progress math
- `src/services` — save/migrations, settings, feedback, storage adapter
- `src/ui` — Phaser builders (no buy rules) + `metaUpgradeCopy`
- `src/scenes` — thin `ClickerScene` + `scenes/clicker/*` helpers

## Rebrand in 15 minutes

1. Theme: `src/config/theme.js` + title in `src/config/uiText.js`
2. Generators: `src/data/generators.js` (ids like `generator-1`)
3. Click / Auto Tap: `src/data/upgrades.js`
4. Meta-upgrades: `src/data/metaUpgrades.js`
5. Loops / resolution: `src/config/gameConfig.js`
6. Optional env: copy `.env.example` → `.env` (`VITE_APP_ID`, `VITE_SAVE_KEY`)
7. Run `npm test` and `npm run build`

### Changing save format without wiping players

1. Do **not** rename `SAVE_KEY` (or add the old key to `LEGACY_SAVE_KEYS`).
2. Bump `SAVE_VERSION` in `gameConfig.js`.
3. Add `{ from, to, migrate }` in `src/services/saveMigrations.js`.
4. If you rename an id, add it to `UPGRADE_ID_ALIASES` / `BOOST_ID_ALIASES`.

## Recommended expansion points

- Prestige: add `src/lib/prestigeMath.js` (not shipped).
- Modifiers: add `src/data/modifiers.js` (not shipped).
- Missions: add `src/lib/objectivesEngine.js` (not shipped).

## Core systems included

- Wall-clock idle + offline catch-up (`savedAt`, `maxOfflineSeconds`)
- Decimal.js economy + Cookie Clicker–style formatting
- Versioned save + checksum + soft salvage
- Progressive catalog (`???` for next locked)
- Hold-to-buy on STORE
- Auto Tap rings, color tiers, per-cursor floating gains
- Sound / vibration settings

See [README.md](README.md) for full gameplay and save docs.
