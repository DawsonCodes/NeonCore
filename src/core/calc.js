// Pure gameplay calculations. No DOM access, no side effects — every function
// derives a value from the state object so the math can be unit tested.
// Formulas are documented in docs/BALANCE.md.

import {
  ACHIEVEMENT_BONUS,
  CACHE_OFFLINE_BONUS_SECONDS,
  CHRONO_DURATION_BONUS,
  CHRONO_RATE_BONUS,
  CRIT_BASE_MULT,
  CRIT_CHANCE_CAP,
  CRIT_CHANCE_PER_LEVEL,
  CRITPOWER_PER_LEVEL,
  EFFICIENCY_FLOOR,
  EFFICIENCY_RATE,
  GRAVITY_DISCOUNT,
  HORIZON_MIN_PRESTIGE,
  INDUCTION_PER_LEVEL,
  LENS_BONUS,
  OFFLINE_BASE_CAP_SECONDS,
  OVERCLOCK_MULT,
  PRESTIGE_BASE_REQ,
  PRESTIGE_BONUS,
  PRESTIGE_REQ_GROWTH,
  REACTOR_BONUS,
  SURGE_BASE_DURATION,
  SURGE_BASE_MULT,
  SURGE_CHARGE_PER_CLICK,
  SURGECELL_RATE_PER_LEVEL,
  SURGECORE_DURATION_PER_LEVEL,
  SURGECORE_MULT_PER_LEVEL,
  TACHYON_BONUS
} from '../config/constants.js';
import { upgradeDefs } from '../config/upgrades.js';

// Returns the current level of an upgrade.
export function level(state, id) {
  return state.upgrades[id]?.level || 0;
}

// Returns the current rank of an Event Horizon upgrade.
export function horizonRank(state, id) {
  return state.horizonUpgrades?.[id]?.rank || 0;
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

// Calculates the discount from Efficiency Matrix upgrades.
export function costDiscountMult(state) {
  return Math.max(EFFICIENCY_FLOOR, Math.pow(EFFICIENCY_RATE, level(state, 'efficiency')));
}

// Calculates the current price of an upgrade based on its level and growth.
export function costFor(state, id) {
  const def = upgradeDefs.find(item => item.id === id);
  const raw = def.baseCost * Math.pow(def.growth, level(state, id));
  return Math.max(1, Math.floor(raw * costDiscountMult(state)));
}

// True when an upgrade's unlock condition has been met.
export function isUpgradeUnlocked(state, def) {
  return def.unlock(state);
}

// ---------------------------------------------------------------------------
// Multipliers
// ---------------------------------------------------------------------------

export function overclockMult(state) {
  return Math.pow(OVERCLOCK_MULT, level(state, 'mult'));
}

export function reactorMult(state) {
  return 1 + level(state, 'reactor') * REACTOR_BONUS;
}

export function tachyonMult(state) {
  return 1 + level(state, 'tachyon') * TACHYON_BONUS;
}

export function prestigeMult(state) {
  return 1 + state.prestige * PRESTIGE_BONUS;
}

export function horizonMult(state) {
  return 1 + horizonRank(state, 'eventlens') * LENS_BONUS;
}

export function achievementMult(state) {
  return 1 + state.unlockedAchievements.length * ACHIEVEMENT_BONUS;
}

// Checks if Neon Surge is currently active.
export function isSurgeActive(state, now = Date.now()) {
  return now < state.surgeEndsAt;
}

export function surgeMult(state, now = Date.now()) {
  if (!isSurgeActive(state, now)) return 1;
  return SURGE_BASE_MULT + level(state, 'surgecore') * SURGECORE_MULT_PER_LEVEL;
}

// Combines all multipliers into one number used for clicks and passive energy.
export function globalMult(state, includeSurge = true, now = Date.now()) {
  const surge = includeSurge ? surgeMult(state, now) : 1;
  return overclockMult(state) * reactorMult(state) * tachyonMult(state) *
    prestigeMult(state) * horizonMult(state) * achievementMult(state) * surge;
}

// ---------------------------------------------------------------------------
// Click and passive output
// ---------------------------------------------------------------------------

export function baseClickPower(state) {
  return 1 + level(state, 'power');
}

// Base passive output before any global multiplier.
export function basePassive(state) {
  return level(state, 'auto') + level(state, 'drone') * 8 +
    level(state, 'fusion') * 60 + level(state, 'antimatter') * 250;
}

// Calculates how much energy one normal click gives. Induction Coil feeds a
// share of base passive output into every click.
export function clickPower(state, includeSurge = true, now = Date.now()) {
  const induction = level(state, 'induction') * INDUCTION_PER_LEVEL * basePassive(state);
  return Math.max(1, Math.floor((baseClickPower(state) + induction) * globalMult(state, includeSurge, now)));
}

export function criticalChance(state) {
  return Math.min(CRIT_CHANCE_CAP, level(state, 'crit') * CRIT_CHANCE_PER_LEVEL);
}

// Critical hit multiplier, improved by Overcrit Capacitor.
export function criticalMult(state) {
  return CRIT_BASE_MULT + level(state, 'critpower') * CRITPOWER_PER_LEVEL;
}

// Calculates passive energy gained each second.
export function energyPerSecond(state, includeSurge = true, now = Date.now()) {
  return basePassive(state) * globalMult(state, includeSurge, now);
}

// ---------------------------------------------------------------------------
// Neon Surge
// ---------------------------------------------------------------------------

// Charge gained per click, scaled by Surge Capacitor and Chrono Flux.
export function surgeChargeRate(state) {
  return 1 + level(state, 'surgecell') * SURGECELL_RATE_PER_LEVEL +
    horizonRank(state, 'chronoflux') * CHRONO_RATE_BONUS;
}

export function surgeChargePerClick(state) {
  return SURGE_CHARGE_PER_CLICK * surgeChargeRate(state);
}

// Full Surge duration in ms, extended by Surge Reactor and Chrono Flux.
export function surgeDuration(state) {
  return SURGE_BASE_DURATION +
    level(state, 'surgecore') * SURGECORE_DURATION_PER_LEVEL +
    horizonRank(state, 'chronoflux') * CHRONO_DURATION_BONUS;
}

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

// Energy required for the next Singularity. Grows with each collapse and is
// reduced by the Gravity Well horizon upgrade.
export function prestigeRequirement(state) {
  const base = PRESTIGE_BASE_REQ * Math.pow(PRESTIGE_REQ_GROWTH, state.prestige);
  const discount = Math.max(0.25, 1 - horizonRank(state, 'gravitywell') * GRAVITY_DISCOUNT);
  return Math.floor(base * discount);
}

export function canPrestige(state) {
  return state.score >= prestigeRequirement(state);
}

// Event Horizon availability and reward.
export function canHorizon(state) {
  return state.prestige >= HORIZON_MIN_PRESTIGE;
}

// Shards gained on collapse: one per Singularity from the fifth onward.
export function horizonShardGain(state) {
  if (!canHorizon(state)) return 0;
  return state.prestige - (HORIZON_MIN_PRESTIGE - 1);
}

// ---------------------------------------------------------------------------
// Offline progress
// ---------------------------------------------------------------------------

// Offline cap in seconds, extended by the Temporal Cache horizon upgrade.
export function offlineCapSeconds(state) {
  return OFFLINE_BASE_CAP_SECONDS + horizonRank(state, 'temporalcache') * CACHE_OFFLINE_BONUS_SECONDS;
}
