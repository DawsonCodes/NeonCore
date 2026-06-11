// Pure gameplay calculations. No DOM access, no side effects — every function
// derives a value from the state object so the math can be unit tested.

import {
  ACHIEVEMENT_BONUS,
  CRIT_CHANCE_CAP,
  CRIT_CHANCE_PER_LEVEL,
  EFFICIENCY_FLOOR,
  EFFICIENCY_RATE,
  OVERCLOCK_MULT,
  PRESTIGE_BONUS,
  REACTOR_BONUS,
  SURGE_MULT
} from '../config/constants.js';
import { upgradeDefs } from '../config/upgrades.js';

// Returns the current level of an upgrade.
export function level(state, id) {
  return state.upgrades[id]?.level || 0;
}

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

// Each multiplier helper returns one part of the total output multiplier.
export function overclockMult(state) {
  return Math.pow(OVERCLOCK_MULT, level(state, 'mult'));
}

export function reactorMult(state) {
  return 1 + level(state, 'reactor') * REACTOR_BONUS;
}

export function prestigeMult(state) {
  return 1 + state.prestige * PRESTIGE_BONUS;
}

export function achievementMult(state) {
  return 1 + state.unlockedAchievements.length * ACHIEVEMENT_BONUS;
}

// Checks if Neon Surge is currently active.
export function isSurgeActive(state, now = Date.now()) {
  return now < state.surgeEndsAt;
}

export function surgeMult(state, now = Date.now()) {
  return isSurgeActive(state, now) ? SURGE_MULT : 1;
}

// Combines all multipliers into one number used for clicks and passive energy.
export function globalMult(state, includeSurge = true, now = Date.now()) {
  const surge = includeSurge ? surgeMult(state, now) : 1;
  return overclockMult(state) * reactorMult(state) * prestigeMult(state) * achievementMult(state) * surge;
}

export function baseClickPower(state) {
  return 1 + level(state, 'power');
}

// Calculates how much energy one normal click gives.
export function clickPower(state, includeSurge = true, now = Date.now()) {
  return Math.max(1, Math.floor(baseClickPower(state) * globalMult(state, includeSurge, now)));
}

export function criticalChance(state) {
  return Math.min(CRIT_CHANCE_CAP, level(state, 'crit') * CRIT_CHANCE_PER_LEVEL);
}

// Calculates passive energy gained each second from automatic upgrades.
export function energyPerSecond(state, includeSurge = true, now = Date.now()) {
  const base = level(state, 'auto') + level(state, 'drone') * 8;
  return base * globalMult(state, includeSurge, now);
}
