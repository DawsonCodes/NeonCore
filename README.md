# Neon Core

A neon sci-fi reactor clicker for the browser. Charge the core, stack tiered upgrades, ride Neon Surges, collapse reality into Singularities — then cross the Event Horizon for permanent power.

**▶ Play now:** https://dawsoncodes.github.io/NeonCore/

> **Status:** alpha — `v0.4.0-alpha.1`. Progression is stable and saves are versioned; balance and visuals keep evolving.

## Interface

Neon Core plays inside a wide **cockpit-style dashboard**: the living reactor core sits center stage with its HUD (energy, per-click, per-second, multiplier, critical chance, Surge charge), the progression rail (Neon Surge, Singularity, Event Horizon) on the left, and a **category-tabbed Upgrade Shop** on the right. Activity, achievements, and stats live in a compact bottom strip — achievements and detailed stats are collapsible so the page stays short. The reactor itself evolves with progression: higher power tiers spin faster and glow harder, the outer orbit ring lights up gold when a Singularity is ready and violet at the Event Horizon, and Surge charge visibly energizes the rings.

On phones the same game becomes an app-like, reactor-first experience with bottom-tab navigation (Core / Shop / Awards / Stats / Settings).

## Features

- **Reactor clicking** — click (or press `Space`) with satisfying pulse, particle, and floating-number feedback
- **14 tiered upgrades** in a category-tabbed shop (Core Output, Passive Systems, Neon Surge, Economy, Singularity Tech) with affordability badges, NEW indicators, and unlock teasers
- **Critical clicks** — up to 60% chance, with an upgradeable critical multiplier
- **Neon Surge** — charge by clicking, unleash a temporary output boost, and keep clicking to *extend* it; upgradeable charge rate, duration, and strength
- **Singularity prestige** — collapse the core for a permanent +25% global multiplier; the requirement grows with each collapse
- **Event Horizon** — a second prestige layer: convert your Singularities into permanent Horizon Shards and spend them on five strategic shard upgrades
- **48 achievements** — each adds +2% global output; collapsible drawer with recent-unlock preview
- **Deep stats** — lifetime, session, surge, and prestige stats in a collapsible, grouped panel
- **Offline progress** — passive earnings while away (2 h cap, extendable via Temporal Cache)
- **Save slots** — three local manual slots with rename, restore, per-slot export/import, and automatic backups
- **Autosave + manual save** — plus JSON export/import for moving progress between browsers
- **Remastered procedural audio** — Web Audio sound design with a master volume slider (single-thumb, cyan-filled), throttled so rapid clicking never gets harsh
- **Two themes** — dark cyberpunk command center and a bright solar-laboratory light mode
- **Mobile-first layout** — app-like bottom navigation on phones, full dashboard on desktop
- **Accessibility** — keyboard play, visible focus, reduced-motion support, screen-reader-friendly notifications

## How progression works

1. **Click the core** to generate energy and buy your first upgrades within seconds.
2. **Unlock tiers** — new upgrades appear as you hit energy, level, Surge, and prestige milestones.
3. **Neon Surge** — clicking charges the Surge bar (~1 min of active play); activating it multiplies all output (base ×2 for 20 s). Clicking during a Surge extends it up to +50% of its duration.
4. **Singularity** — at 500K energy, collapse the core: energy and upgrades reset, you keep achievements/stats, and you gain a permanent +25% global multiplier. Each collapse raises the next requirement ×3.
5. **Event Horizon** — at 5 Singularities, cross the Horizon: the Singularity layer resets too, but every Singularity from the fifth onward becomes a permanent **Horizon Shard**. Spend shards on Event Lens (+50% output), Star Seed (head-start levels), Gravity Well (cheaper Singularities), Chrono Flux (better Surges), and Temporal Cache (longer offline cap).

Full formulas, pacing targets, and tuning history live in [`docs/BALANCE.md`](docs/BALANCE.md).

## Controls

| Input | Action |
| --- | --- |
| Click / tap the core | Generate energy |
| `Space` | Activate the reactor |
| `Enter` (core focused) | Activate the reactor |
| `B` | Toggle Buy 1 / Buy Max |
| `S` | Save the game |
| `Esc` | Close panels and dialogs |

Buy mode applies to every upgrade card: **Buy 1** purchases a single level, **Buy Max** buys as many levels as you can afford. One physical input always equals exactly one reactor activation — holding keys does not farm energy.

## Audio

Sound is fully procedural (Web Audio — no audio files or remote assets). The redesigned settings drawer has a sound toggle and a master volume slider; both persist. Rapid clicking is throttled so audio never piles up.

## Saving

- Autosaves every 15 seconds and on tab hide/close; manual save with `S` or *Settings → Data*.
- Saves use a versioned envelope under `neonCoreSave_v4`. Older saves (`neonCoreSave_v3`, `_v2`, `_v1`) migrate automatically — progress is never lost, and new fields get safe defaults.
- **Save slots** (*Settings → Save slots*): three local manual slots with naming, timestamps, progress summaries, per-slot export, and import-into-slot. Restoring or importing always backs up your active save first. Slots never leave your browser.
- **Export / Import** produces plain JSON including the schema version and export timestamp. Invalid files are rejected without touching your progress; exports from every previous alpha remain importable.
- **Reset** (*Settings → Data*) wipes active progress — including both prestige layers — behind an explicit confirmation. Interface preferences and save slots are kept.

## Offline progress

While the game is closed you earn passive energy (no Surge bonus) up to a **2-hour cap**; the Temporal Cache shard upgrade adds +2 h per rank. A welcome-back summary shows the time away and energy gained.

## Run locally

Plain HTML/CSS/JS with native ES modules — no build step. Modules require HTTP, so serve the folder with any static server:

```bash
python3 -m http.server 8080     # or: npm start
```

Then open http://localhost:8080.

## Tests & balance simulation

Zero dependencies — both use Node's built-ins:

```bash
npm test          # unit + regression tests (input, geometry, notifications, economy, saves, slots)
npm run simulate  # deterministic pacing simulation (active / hybrid / idle strategies)
```

## Project structure

```
index.html          App shell
styles/             tokens, base, layout, components, animations, responsive
src/
  main.js           Bootstrap + game controller
  config/           Constants, upgrades, horizon upgrades, achievements, milestones
  core/             State, pure calculations, actions, game loop
  systems/          Save/migration/slots/import/export, procedural audio
  ui/               DOM refs, input gate, rendering, notifications, effects, settings, events
  utils/            Formatting & geometry helpers
scripts/simulate.js Balance simulation
docs/BALANCE.md     Formulas, pacing goals, tuning history
tests/              Node test suite
```

## Accessibility

- Semantic HTML, labeled controls, and native `<dialog>` modals (focus trapping + Escape for free)
- Full keyboard support: reactor activation, buy-mode toggle, save, arrow-key shop tabs, collapsible sections with `aria-expanded`
- Notifications use polite/assertive live regions; routine autosave feedback stays subtle
- Honors `prefers-reduced-motion` plus an in-game **Reduced animation** toggle (persisted, survives resets)
- Touch targets sized for phones; no hover-only information; state badges use text, not color alone

## Deployment

Deployed with **GitHub Pages** straight from the repository root — no build output. All asset and module paths are relative, so it works under the `/NeonCore/` subdirectory.

## Roadmap

- A third late-game prestige concept
- More Surge interactions and visual set-pieces
- Optional challenge modifiers
- Richer activity-log filtering

## License

© 2026 DawsonCodes

[MIT](LICENSE)
