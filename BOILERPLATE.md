# Boilerplate Clicker

This project is organized to reuse a Phaser clicker game foundation.

## Structure

- `src/config`: game settings, visual theme and UI text.
- `src/controllers`: stateful interaction controllers.
- `src/data`: separate generator, upgrade and boost catalogs.
- `src/lib`: pure economy functions and clicker controller.
- `src/services`: persistence, preferences and device feedback.
- `src/ui`: Phaser UI builders without economy rules.
- `src/scenes`: scene orchestration and game lifecycle.

## How To Create A New Clicker With This Base

1. Update generators in `src/data/generators.js`.
2. Update click upgrades and boosts in `src/data`.
3. Change colors/fonts in `src/config/theme.js` and labels in `src/config/uiText.js`.
4. Tweak formulas in `src/lib/clickerMath.js`.
5. Adjust aspect ratio and loops in `src/config/gameConfig.js`.
6. Run `npm test` and `npm run build`.

## Recommended Expansion Points

- Prestige: create a pure module in `src/lib/prestigeMath.js`.
- Bonus system: create `src/data/modifiers.js`.
- Offline progress: already implemented with savedAt in snapshot and cap by LOOP_CONFIG.maxOfflineSeconds
- Missions and achievements: create `src/lib/objectivesEngine.js`.

## Core Idle Systems Included

- Offline progress loop:
  - Uses direct math (single formula block), never frame-by-frame simulation for offline time.
  - `applyOfflineProgress` applies production from elapsed time in one step.
- Big number math:
  - Uses `decimal.js` for large-scale idle progression values.
  - Supports short suffix formatting and scientific notation fallback for very large numbers.
- Save and basic anti-cheat:
  - Autosaves in background every 10 seconds.
  - Save payload is wrapped with a checksum (basic tamper detection).
- Progressive catalog disclosure:
  - Shows unlocked generators plus only the next locked entry as `???`.
  - Uses the catalog order and `unlockAfter`, so future entries stay hidden automatically.
- Mobile purchase input:
  - A tap buys one unit.
  - Holding a buy button starts after 550 ms and accelerates exponentially up to 10 purchases per second.
  - Scrolling, swiping, leaving the game, or releasing outside cancels the hold safely.
- Device feedback:
  - Purchases use a generated Web Audio cue and light vibration when supported.
  - Milestones use a distinct audio frequency and vibration pattern.
  - Players can disable sound and vibration from the settings tab.
