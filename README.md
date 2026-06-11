# Neon Core

A neon sci-fi reactor clicker for the browser. Charge the core, stack upgrades, trigger Neon Surges, and collapse reality into a Singularity for permanent power.

**▶ Play now:** https://dawsoncodes.github.io/NeonCore/

> **Status:** alpha — `v0.2.0-alpha.1`. Progression is stable and saves are versioned, but balance and visuals are still evolving.

## Features

- **Reactor clicking** — click (or press `Space`) to generate energy, with satisfying pulse, particle, and floating-number feedback
- **Seven upgrades** — click amplifiers, passive generators, critical circuits, global multipliers, and cost-reduction tech
- **Critical clicks** — up to a 60% chance to triple a click
- **Neon Surge** — charge by clicking, then double all output for 20 seconds
- **Singularity prestige** — collapse the core at 100K energy for a permanent +10% global multiplier
- **15 achievements** — each one adds +2% global output
- **Milestones & Core Log** — major events are celebrated and kept in a recent-history log
- **Offline progress** — earn passive energy while away (capped at 2 hours)
- **Autosave + manual save** — plus JSON export/import for moving progress between browsers
- **Two themes** — a dark cyberpunk reactor command center and a bright solar-laboratory light mode
- **Mobile-first layout** — app-like bottom navigation on phones, full dashboard on desktop
- **Accessibility** — keyboard play, visible focus states, reduced-motion support, screen-reader-friendly notifications

## Controls

| Input | Action |
| --- | --- |
| Click / tap the core | Generate energy |
| `Space` | Click the core |
| `B` | Toggle Buy 1 / Buy Max |
| `S` | Save the game |
| `Esc` | Close panels and dialogs |

Buy mode applies to every upgrade card: **Buy 1** purchases a single level, **Buy Max** buys as many levels as you can afford.

## Saving

- The game autosaves every 15 seconds, and also saves when the tab is hidden or closed.
- Saves are stored in your browser's `localStorage` under a versioned key (`neonCoreSave_v3`). Saves from the original alpha (`neonCoreSave_v2` / `neonCoreSave_v1`) are detected and migrated automatically — existing progress is never lost.
- **Export / Import** lives in *Settings → Data*. Exports are plain JSON files that include the schema version and export timestamp. Imports are validated before they touch your progress, and a backup of your current save is written before a successful import overwrites it.
- **Reset** wipes all progress behind an explicit confirmation dialog. Interface preferences (theme, sound, reduced animation) are kept.

## Offline progress

While the game is closed you keep earning passive energy (no Surge bonus), up to a cap of **2 hours**. When you return, a summary shows how long you were away and what the reactor generated.

## Run locally

The game is plain HTML/CSS/JS with native ES modules — no build step. Because modules require HTTP, serve the folder with any static server:

```bash
# Python
python3 -m http.server 8080
# (also available as: npm start)
```

Then open http://localhost:8080.

## Tests

Gameplay math, formatting, and the save system are covered by Node's built-in test runner — zero dependencies:

```bash
npm test
```

## Project structure

```
index.html          App shell
styles/             tokens, base, layout, components, animations, responsive
src/
  main.js           Bootstrap + game controller
  config/           Constants, upgrades, achievements, milestones
  core/             State, pure calculations, actions, game loop
  systems/          Save/load/migration/import/export, audio
  ui/               DOM refs, rendering, notifications, effects, settings, events
  utils/            Formatting & sanitization helpers
tests/              Node test suite
```

## Accessibility

- Semantic HTML with labeled controls and native `<dialog>` modals
- Full keyboard support with visible focus states
- Notifications use polite/assertive live regions; routine autosave feedback stays subtle
- Honors the system `prefers-reduced-motion` setting, plus an in-game **Reduced animation** toggle
- Touch targets sized for phones; no hover-only interactions

## Deployment

The site is deployed with **GitHub Pages** straight from the repository root — no build output. All asset and module paths are relative, so it works under the `/NeonCore/` subdirectory.

## Roadmap

- More upgrade tiers and a second prestige layer
- Sound design pass
- Optional cloud-free save slots
- More achievements and stats

## License

[MIT](LICENSE)
