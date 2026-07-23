# Boilerplate Clicker

Reusable Phaser + Capacitor idle clicker foundation.

## Structure

- `src/config` — resolution, theme, UI text, buy amounts, `SAVE_KEY` / `SAVE_VERSION`
- `src/controllers` — `ListScrollController` (visual scrollbar + finger scroll)
- `src/data` — generators, click upgrades, `metaUpgrades.js`, `achievements.js`
- `src/lib` — formulas (`clickerMath`) + session controller (`clickerController`) + Auto Tap + `prestige.js` + `saveState.js`
- `src/services` — save I/O + versioned migrations, settings, feedback, storage adapter
- `src/ui` — Phaser builders (no buy rules) + `metaUpgradeCopy` + `achievementLines` + token badge
- `src/scenes` — `ClickerScene` + `scenes/clicker/*` helpers (page builders, lists, overlays)

## Naming glossary

| Concept | Code / UI | Persist / save |
| --- | --- | --- |
| Meta-upgrades (UPGRADE tab) | Catalog `META_UPGRADES`, UI `meta*` (`metaCamera`, `metaScroll`, `metaUpgradesView`) | Field **`boosts`** (legacy key — do not rename without a migration) |
| Ascension Tokens | `ascensionTokens`, purple badge | `ascensionTokens` (migrated from `stars` in v8) |
| Efficiency pips on STORE | Yellow ★ next to generator name | Derived from purchased efficiency meta (in `boosts`) |

Keep save field `boosts` stable so forks and old saves stay compatible. Rename UI/scene identifiers freely; bump `SAVE_VERSION` only if you change the JSON shape.

## Rebrand in 15 minutes

1. Theme: `src/config/theme.js` + title in `src/config/uiText.js`
2. Generators: `src/data/generators.js` (stable ids `upgrade-1` … `upgrade-20`)
3. Click / Auto Tap: `src/data/upgrades.js`
4. Meta-upgrades: `src/data/metaUpgrades.js`
5. Prestige curve / Ascension Tokens: `src/lib/prestige.js`
6. Loops / resolution: `src/config/gameConfig.js`
7. Optional env: copy `.env.example` → `.env` (`VITE_SAVE_KEY`). Native `appId` → `capacitor.config.json`
8. Run `npm test` and `npm run build`

### Changing save format without wiping players

1. Do **not** rename `SAVE_KEY` (or add the old key to `LEGACY_SAVE_KEYS`).
2. Bump `SAVE_VERSION` in `gameConfig.js`.
3. Add `{ from, to, migrate }` in `src/services/saveMigrations.js`.
4. If you rename an id, add it to `UPGRADE_ID_ALIASES` / `BOOST_ID_ALIASES` in `src/lib/saveState.js`.

## Core systems included

- Wall-clock idle + offline catch-up (`savedAt`, `maxOfflineSeconds`; `null` = uncapped)
- Decimal.js economy + Cookie Clicker–style formatting
- Versioned save + checksum + soft salvage
- Progressive catalog (`???` for next locked)
- STORE buy modes ×1 / ×10 / ×25 / MAX (no hold-to-buy)
- Auto Tap rings, color tiers, per-cursor floating gains
- Meta-upgrades (efficiency / global / tap-%-of-idle / base multiplier); UPGRADE list sorted by price asc (STORE keeps unlock order)
- Achievements → permanent idle %
- Prestige → Ascension Tokens (+1% idle each); confirm is red + 5s countdown before clickable
- STATUS tab (stats, multipliers, achievements; locked rows show `○ ???`)
- STORE idle share % on auto generators
- Bottom nav with full tab labels + ≥44px hit targets; overflow "…" only when tabs grow past 5
- Sound settings

## Suggested expansion points

- Missions / seasonal events: add `src/lib/objectivesEngine.js`
- Permanent charms / milk-style layers beyond achievements (if your genre needs them)

See [README.md](README.md) for full gameplay and save docs.
