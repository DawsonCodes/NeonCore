# Neon Core — Balance Notes (v0.3.0-alpha.1)

This document records the progression design, key formulas, and the
intentional balance changes made since `v0.2.0-alpha.1`. Keep it in sync with
`src/config/constants.js` and `src/config/upgrades.js`.

## Pacing goals

| Milestone | Target (engaged play) |
| --- | --- |
| First purchase | within 10–30 seconds |
| Several meaningful choices | first few minutes |
| First Neon Surge | ~1 minute of clicking |
| First Singularity | ~20–45 minutes depending on strategy |
| Repeat Singularities | faster, but not instant resets |
| Event Horizon (2nd prestige) | a later milestone: 5 Singularities, ~30 min–2 h |

The simulator (`npm run simulate`) plays *optimally* — perfect ROI purchases
every second at a sustained click rate — so its times are a lower bound.
Real play runs roughly 2–3× slower. Current simulated lower bounds:

| Strategy | First Surge | Singularity 1 | Event Horizon |
| --- | --- | --- | --- |
| Active (5 cps) | ~20 s | ~3 min | ~10 min |
| Hybrid (1.5 cps) | ~1 min | ~9 min | ~32 min |
| Mostly idle (0.15 cps) | ~5 min | ~30 min | ~1 h 45 m |

## Key formulas

```
click          = floor((1 + powerLvl + inductionLvl·0.02·basePassive) · globalMult)
critChance     = min(0.60, 0.03 · critLvl)
critMult       = 3 + 0.5 · critpowerLvl
basePassive    = autoLvl + 8·droneLvl + 60·fusionLvl + 250·antimatterLvl
energy/sec     = basePassive · globalMult

globalMult     = 1.35^overclockLvl
               · (1 + 0.12·reactorLvl)
               · (1 + 0.30·tachyonLvl)
               · (1 + 0.25·singularities)
               · (1 + 0.50·eventLensRank)
               · (1 + 0.02·achievements)
               · surgeMult (while active)

cost(id)       = floor(base · growth^level · max(0.55, 0.97^efficiencyLvl))
```

### Neon Surge

```
charge need    = 100
charge/click   = 1.0 · (1 + 0.12·surgecellLvl + 0.30·chronofluxRank)
charge/sec idle= 0.2 (only while passive generation is running, not during a Surge)
duration       = 20 s + 1 s·surgecoreLvl + 3 s·chronofluxRank
multiplier     = 2.0 + 0.25·surgecoreLvl
momentum       = each click during a Surge extends it by 0.1 s,
                 capped at +50% of the full duration per activation
```

### Prestige layer 1 — Singularity

```
requirement(n) = 500,000 · 3^n · (1 − 0.25·gravitywellRank)   [n = current count]
reward         = permanent +25% global output per Singularity
resets         = energy, upgrades, surge charge
keeps          = achievements, stats, milestones, Horizon progress
```

### Prestige layer 2 — Event Horizon

```
unlock         = 5 Singularities (module teased from 3)
shards gained  = singularities − 4   (5 → 1 shard, 8 → 4 shards)
resets         = energy, upgrades, surge charge, AND the Singularity count
keeps          = achievements, stats, shards, shard upgrades, lifetime records
rank cost      = rank + 1 shards (rank 1 costs 1, rank 2 costs 2, …)
```

Shard upgrades (strategic choices, not just multipliers):

| Upgrade | Max | Effect per rank |
| --- | --- | --- |
| Event Lens | 5 | +50% global output |
| Star Seed | 2 | start each Singularity with 5 free Click Amplifier + Auto Generator levels |
| Gravity Well | 3 | −25% Singularity requirement |
| Chrono Flux | 3 | +30% Surge charge rate, +3 s Surge duration |
| Temporal Cache | 3 | +2 h offline-progress cap |

### Offline progress

```
rate           = passive output (no Surge multiplier)
cap            = 2 h + 2 h·temporalcacheRank
```

## Upgrade unlock stages

| Upgrade | Category | Base | Growth | Unlock |
| --- | --- | --- | --- | --- |
| Click Amplifier | Core | 10 | 1.18 | start |
| Critical Circuit | Core | 180 | 1.28 | start |
| Overcrit Capacitor | Core | 2,000 | 1.60 | Critical Circuit lvl 3 |
| Induction Coil | Core | 5,000 | 1.60 | 10 combined Auto + Swarm levels |
| Auto Generator | Passive | 50 | 1.17 | start |
| Nano Swarm | Passive | 275 | 1.19 | 150 best energy |
| Fusion Lattice | Passive | 30,000 | 1.22 | 20K best energy |
| Antimatter Loop | Passive | 250,000 | 1.30 | first Singularity |
| Surge Capacitor | Surge | 1,500 | 1.35 | first Surge |
| Surge Reactor | Surge | 12,000 | 1.60 | 3 Surges |
| Pulse Reactor | Economy | 650 | 1.28 | 400 best energy |
| Efficiency Matrix | Economy | 1,200 | 1.40 | 800 best energy |
| Overclock | Economy | 2,500 | 1.55 | 1.5K best energy |
| Tachyon Injector | Singularity | 120,000 | 1.70 | first Singularity |

## Achievement rewards

Every achievement still grants a flat **+2% global output** (48 achievements,
up to +96%). A tiered reward structure was considered and rejected for now:
the flat rule is instantly understandable, and the larger catalog already
deepens the bonus curve. Revisit if the total ever feels mandatory-grindy.

## Intentional changes from v0.2.0-alpha.1

1. **Singularity requirement**: fixed 100K → 500K scaling ×3 per collapse
   (Gravity Well can lower it). Repeat collapses are no longer 100K spam.
2. **Singularity reward**: +10% → **+25%** per Singularity. Existing saves
   keep their count and get the stronger bonus retroactively.
3. **Neon Surge**: charge per click 1.35 → 1.0, idle trickle 0.05/s → 0.2/s,
   duration/multiplier now upgradeable, and clicking during a Surge extends
   it (momentum). Surge charge no longer accrues while a Surge is running.
4. **Critical hits**: multiplier upgradeable beyond ×3 via Overcrit
   Capacitor; crit Circuit growth 1.28 (unchanged from v0.2).
5. **Click economy**: Click Amplifier growth 1.16 → 1.18; Auto 1.18 → 1.17;
   Swarm 1.20 → 1.19; Pulse Reactor 1.30 → 1.28; Efficiency 1.42 → 1.40;
   Overclock 1.50 → 1.55 (it was dominant late).
6. **New systems**: 7 new upgrades, gradual tier unlocks, Event Horizon
   layer with 5 shard upgrades.
7. **Offline progress**: base behavior unchanged (passive rate, 2 h cap);
   the cap is now extendable only through Temporal Cache.
8. **Reset semantics**: reset wipes active progress *including both prestige
   layers*, keeps interface preferences (theme, sound, volume, reduced
   animation) and keeps manual save slots.
9. **Milestones**: 100K milestone re-worded; new milestones at 500K, 100M, 1B.

## Running the simulation

```bash
npm run simulate            # all strategies
node scripts/simulate.js hybrid
```

Strategies: `active` (5 clicks/s), `hybrid` (1.5 clicks/s), `idle`
(0.15 clicks/s). The simulator uses the real game modules with a virtual
clock, expected-value criticals, greedy ROI purchasing, automatic Surge
activation, and immediate prestiging — re-run it after any constant change
and update the table above.
