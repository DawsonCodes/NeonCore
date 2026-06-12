// Game actions: state transitions triggered by the player or the game loop.
// These mutate the state object and return result descriptors; the UI layer
// is responsible for sounds, notifications, and visual effects.

import {
  BUY_MAX_LIMIT,
  STARSEED_LEVELS,
  SURGE_CHARGE_PASSIVE,
  SURGE_EXTEND_CAP_RATIO,
  SURGE_EXTEND_PER_CLICK,
  SURGE_MAX
} from '../config/constants.js';
import { horizonRankCost, horizonUpgradeById } from '../config/horizon.js';
import {
  canHorizon,
  canPrestige,
  clickPower,
  costFor,
  criticalChance,
  criticalMult,
  energyPerSecond,
  horizonRank,
  horizonShardGain,
  isSurgeActive,
  surgeChargePerClick,
  surgeDuration
} from './calc.js';
import {
  addEnergy,
  createInitialState,
  defaultUpgrades,
  spendEnergy
} from './state.js';

// Runs once for every canonical reactor activation (pointer or keyboard).
export function coreClick(state, { rng = Math.random, now = Date.now() } = {}) {
  let gain = clickPower(state, true, now);
  const critical = rng() < criticalChance(state);
  if (critical) {
    gain = Math.floor(gain * criticalMult(state));
    state.totalCrits++;
  }

  addEnergy(state, gain);
  state.totalClicks++;
  state.biggestClick = Math.max(state.biggestClick, gain);

  let extended = false;
  if (isSurgeActive(state, now)) {
    // Momentum: clicking during a Surge sustains it, up to a capped total
    // extension per activation.
    const cap = surgeDuration(state) * SURGE_EXTEND_CAP_RATIO;
    if (state.surgeExtendedThisRun < cap) {
      const add = Math.min(SURGE_EXTEND_PER_CLICK, cap - state.surgeExtendedThisRun);
      state.surgeEndsAt += add;
      state.surgeExtendedThisRun += add;
      state.surgeExtendedMs = Math.max(state.surgeExtendedMs, state.surgeExtendedThisRun);
      extended = true;
    }
  } else {
    state.surgeCharge = Math.min(SURGE_MAX, state.surgeCharge + surgeChargePerClick(state));
  }

  return { gain, critical, extended };
}

// Buys one upgrade or as many as possible depending on buy mode.
export function purchaseUpgrade(state, id, mode = state.buyMode) {
  const targetAmount = mode === 'max' ? Infinity : 1;
  let bought = 0;
  let spent = 0;

  while (bought < targetAmount) {
    const cost = costFor(state, id);
    if (state.score < cost) break;
    spendEnergy(state, cost);
    state.upgrades[id].level++;
    spent += cost;
    bought++;

    if (bought > BUY_MAX_LIMIT) break;
  }

  return { bought, spent };
}

// Activates Neon Surge once the charge bar is full.
export function activateSurge(state, now = Date.now()) {
  if (state.surgeCharge < SURGE_MAX || isSurgeActive(state, now)) return false;
  state.surgeCharge = 0;
  state.surgeEndsAt = now + surgeDuration(state);
  state.surgeExtendedThisRun = 0;
  state.surgesUsed++;
  return true;
}

// Free starting levels granted by the Star Seed horizon upgrade.
function applyStarSeed(state) {
  const levels = horizonRank(state, 'starseed') * STARSEED_LEVELS;
  if (levels > 0) {
    state.upgrades.power.level = Math.max(state.upgrades.power.level, levels);
    state.upgrades.auto.level = Math.max(state.upgrades.auto.level, levels);
  }
}

// Prestige layer 1: collapse the core for a permanent global bonus.
// Resets energy and upgrades; achievements, stats, and Horizon progress stay.
export function performSingularity(state) {
  if (!canPrestige(state)) return false;
  state.prestige++;
  state.prestigeTotal++;
  state.score = 0;
  state.upgrades = defaultUpgrades();
  state.surgeCharge = 0;
  state.surgeEndsAt = 0;
  state.surgeExtendedThisRun = 0;
  applyStarSeed(state);
  return true;
}

// Prestige layer 2: cross the Event Horizon. Converts the current
// Singularity count into permanent Horizon Shards and resets the
// Singularity layer (energy, upgrades, and Singularity bonus).
export function performHorizon(state) {
  if (!canHorizon(state)) return false;
  const gained = horizonShardGain(state);

  state.horizons++;
  state.shards += gained;
  state.shardsEarnedTotal += gained;
  state.prestige = 0;
  state.score = 0;
  state.upgrades = defaultUpgrades();
  state.surgeCharge = 0;
  state.surgeEndsAt = 0;
  state.surgeExtendedThisRun = 0;
  applyStarSeed(state);
  return { gained };
}

// Spends shards on one rank of an Event Horizon upgrade.
export function purchaseHorizonUpgrade(state, id) {
  const def = horizonUpgradeById(id);
  if (!def) return false;
  const rank = horizonRank(state, id);
  if (rank >= def.maxRank) return false;
  const cost = horizonRankCost(rank);
  if (state.shards < cost) return false;
  state.shards -= cost;
  state.horizonUpgrades[id].rank = rank + 1;
  return { cost, rank: rank + 1 };
}

// Fully resets all progression, including prestige layers and save data.
// Interface preferences (theme, sound, volume, reduced animation) survive
// so accessibility choices are not lost. Documented in the README.
export function resetState(state) {
  const fresh = createInitialState();
  fresh.theme = state.theme;
  fresh.muted = state.muted;
  fresh.volume = state.volume;
  fresh.reducedMotion = state.reducedMotion;
  for (const key of Object.keys(state)) {
    if (!(key in fresh)) delete state[key];
  }
  Object.assign(state, fresh);
}

// Advances passive generation for one frame. Returns the energy gained.
export function tickPassive(state, dt, now = Date.now()) {
  const passiveGain = energyPerSecond(state, true, now) * dt;
  if (passiveGain > 0) {
    addEnergy(state, passiveGain);
  }
  if (isSurgeActive(state, now)) {
    state.surgeTimeTotal += dt;
  } else if (passiveGain > 0) {
    state.surgeCharge = Math.min(SURGE_MAX, state.surgeCharge + dt * SURGE_CHARGE_PASSIVE);
  }
  state.playSeconds += dt;
  return passiveGain;
}
