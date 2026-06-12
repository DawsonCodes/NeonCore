// Deterministic balance simulation for Neon Core.
//
//   npm run simulate            — run all strategies
//   node scripts/simulate.js active|hybrid|idle
//
// The simulation drives the real game modules (calc/actions/state) with a
// virtual clock, expected-value clicking (no RNG), greedy ROI purchasing,
// automatic Surge activation, and automatic prestiging. It reports pacing
// milestones used to evaluate the progression curve in docs/BALANCE.md.

import {
  canHorizon,
  canPrestige,
  clickPower,
  costFor,
  criticalChance,
  criticalMult,
  energyPerSecond,
  horizonShardGain,
  isSurgeActive,
  isUpgradeUnlocked,
  prestigeRequirement,
  surgeChargePerClick,
  surgeDuration
} from '../src/core/calc.js';
import { activateSurge, performHorizon, performSingularity, purchaseHorizonUpgrade } from '../src/core/actions.js';
import { addEnergy, createInitialState, spendEnergy } from '../src/core/state.js';
import { SURGE_MAX } from '../src/config/constants.js';
import { upgradeDefs } from '../src/config/upgrades.js';
import { fmt } from '../src/utils/format.js';

const STRATEGIES = {
  active: { clicksPerSecond: 5, label: 'Active clicker (5 cps)' },
  hybrid: { clicksPerSecond: 1.5, label: 'Hybrid player (1.5 cps)' },
  idle: { clicksPerSecond: 0.15, label: 'Mostly idle (0.15 cps)' }
};

const MAX_SIM_SECONDS = 6 * 3600;
const DT = 1; // 1-second steps

function fmtT(seconds) {
  if (seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${s}s`;
}

// Expected energy per click (crit chance folded in as expected value).
function expectedClick(state, now) {
  const base = clickPower(state, true, now);
  const chance = criticalChance(state);
  return base * (1 - chance) + Math.floor(base * criticalMult(state)) * chance;
}

// Average total output rate including expected Surge uptime, used to rank
// purchases. Surge upgrades gain value through the uptime model.
function averageRate(state, cps, now) {
  const baseRate = energyPerSecond(state, false, now) + expectedClick({ ...state, surgeEndsAt: 0 }, now) * cps;
  const chargePerSec = surgeChargePerClick(state) * cps + 0.2;
  const secondsToCharge = SURGE_MAX / chargePerSec;
  const surgeSec = surgeDuration(state) / 1000;
  const surgeUptime = surgeSec / (surgeSec + secondsToCharge);
  const surgeMultAvg = 1 + surgeUptime * (2 + (state.upgrades.surgecore?.level || 0) * 0.25 - 1);
  return baseRate * surgeMultAvg;
}

// Greedy purchasing: repeatedly buy the affordable unlocked upgrade with the
// best rate-gain per energy spent. Efficiency gets a small pseudo-value
// since its benefit (cheaper future buys) is indirect.
function buyGreedy(state, cps, now) {
  let bought = true;
  const buys = [];
  while (bought) {
    bought = false;
    let best = null;

    for (const def of upgradeDefs) {
      if (!isUpgradeUnlocked(state, def)) continue;
      const cost = costFor(state, def.id);
      if (cost > state.score) continue;

      const before = averageRate(state, cps, now);
      state.upgrades[def.id].level++;
      let delta = averageRate(state, cps, now) - before;
      state.upgrades[def.id].level--;

      if (def.id === 'efficiency') delta = before * 0.012;
      const roi = delta / cost;
      if (delta > 0 && (!best || roi > best.roi)) best = { def, cost, roi };
    }

    if (best) {
      spendEnergy(state, best.cost);
      state.upgrades[best.def.id].level++;
      buys.push(best.def.id);
      bought = true;
    }
  }
  return buys;
}

function simulate(strategyKey) {
  const { clicksPerSecond, label } = STRATEGIES[strategyKey];
  const state = createInitialState();
  const marks = {};
  const unlockTimes = {};
  const singularities = [];
  let horizonAt;
  let postHorizonSingularityAt;
  let now = 0; // virtual ms

  for (let t = 0; t < MAX_SIM_SECONDS; t += DT) {
    now = t * 1000;

    // Clicking (expected value, charge accrual, surge extension ignored for
    // a conservative estimate).
    if (clicksPerSecond > 0) {
      const clicks = clicksPerSecond * DT;
      addEnergy(state, expectedClick(state, now) * clicks);
      state.totalClicks += clicks;
      if (!isSurgeActive(state, now)) {
        state.surgeCharge = Math.min(SURGE_MAX, state.surgeCharge + surgeChargePerClick(state) * clicks);
      }
    }

    // Passive generation + idle charge trickle.
    addEnergy(state, energyPerSecond(state, true, now) * DT);
    if (!isSurgeActive(state, now)) {
      state.surgeCharge = Math.min(SURGE_MAX, state.surgeCharge + 0.2 * DT);
    }

    // Auto-activate surge.
    if (state.surgeCharge >= SURGE_MAX && !isSurgeActive(state, now)) {
      activateSurge(state, now);
      if (marks.firstSurge === undefined) marks.firstSurge = t;
    }

    if (marks.firstPurchase === undefined && state.totalSpent === 0) {
      // handled after buying below
    }

    const buys = buyGreedy(state, clicksPerSecond, now);
    if (buys.length && marks.firstPurchase === undefined) marks.firstPurchase = t;

    for (const def of upgradeDefs) {
      if (unlockTimes[def.id] === undefined && isUpgradeUnlocked(state, def)) {
        unlockTimes[def.id] = t;
      }
    }

    // Prestige as soon as available.
    if (canPrestige(state)) {
      const req = prestigeRequirement(state);
      if (performSingularity(state)) {
        singularities.push({ t, req });
        if (horizonAt !== undefined && postHorizonSingularityAt === undefined) {
          postHorizonSingularityAt = t;
        }
      }
    }

    // Cross the horizon once, then spend shards greedily.
    if (horizonAt === undefined && canHorizon(state)) {
      const gained = horizonShardGain(state);
      performHorizon(state);
      horizonAt = t;
      marks.horizonShards = gained;
      for (const id of ['eventlens', 'chronoflux', 'starseed', 'gravitywell', 'temporalcache']) {
        purchaseHorizonUpgrade(state, id);
      }
    }

    if (horizonAt !== undefined && postHorizonSingularityAt !== undefined && singularities.length >= 8) break;
  }

  return { label, state, marks, unlockTimes, singularities, horizonAt, postHorizonSingularityAt };
}

function report(result) {
  const { label, marks, unlockTimes, singularities, horizonAt, postHorizonSingularityAt } = result;
  console.log(`\n=== ${label} ===`);
  console.log(`First purchase:        ${fmtT(marks.firstPurchase)}`);
  console.log(`First Neon Surge:      ${fmtT(marks.firstSurge)}`);

  const interesting = ['drone', 'reactor', 'critpower', 'efficiency', 'surgecell', 'mult', 'induction', 'surgecore', 'fusion', 'tachyon', 'antimatter'];
  for (const id of interesting) {
    console.log(`Unlock ${id.padEnd(12)}   ${fmtT(unlockTimes[id])}`);
  }

  singularities.slice(0, 8).forEach((s, i) => {
    console.log(`Singularity ${i + 1} (req ${fmt(s.req).padEnd(7)}) ${fmtT(s.t)}`);
  });
  console.log(`Event Horizon:         ${fmtT(horizonAt)}${marks.horizonShards ? ` (+${marks.horizonShards} shards)` : ''}`);
  console.log(`Next Singularity after Horizon: ${fmtT(postHorizonSingularityAt)}`);
}

const requested = process.argv[2];
const keys = requested ? [requested] : Object.keys(STRATEGIES);
for (const key of keys) {
  if (!STRATEGIES[key]) {
    console.error(`Unknown strategy "${key}". Use: ${Object.keys(STRATEGIES).join(', ')}`);
    process.exit(1);
  }
  report(simulate(key));
}
