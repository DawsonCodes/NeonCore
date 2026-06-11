// Game actions: state transitions triggered by the player or the game loop.
// These mutate the state object and return result descriptors; the UI layer
// is responsible for sounds, notifications, and visual effects.

import {
  BUY_MAX_LIMIT,
  CRIT_MULT,
  PRESTIGE_REQ,
  SURGE_CHARGE_PASSIVE,
  SURGE_CHARGE_PER_CLICK,
  SURGE_DURATION,
  SURGE_MAX
} from '../config/constants.js';
import { clickPower, criticalChance, costFor, energyPerSecond, isSurgeActive } from './calc.js';
import { addEnergy, createInitialState, defaultUpgrades, spendEnergy } from './state.js';

// Runs every time the core is clicked or Space is pressed once.
export function coreClick(state, { rng = Math.random, now = Date.now() } = {}) {
  let gain = clickPower(state, true, now);
  const critical = rng() < criticalChance(state);
  if (critical) gain *= CRIT_MULT;

  addEnergy(state, gain);
  state.totalClicks++;
  state.surgeCharge = Math.min(SURGE_MAX, state.surgeCharge + SURGE_CHARGE_PER_CLICK);
  return { gain, critical };
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
  state.surgeEndsAt = now + SURGE_DURATION;
  state.surgesUsed++;
  return true;
}

// Collapses the core: resets energy and upgrades for a permanent bonus.
export function performSingularity(state) {
  if (state.score < PRESTIGE_REQ) return false;
  state.prestige++;
  state.score = 0;
  state.upgrades = defaultUpgrades();
  state.surgeCharge = 0;
  state.surgeEndsAt = 0;
  return true;
}

// Fully resets progression. Interface preferences (theme, sound, reduced
// animation) survive a reset so accessibility choices are not lost.
export function resetState(state) {
  const fresh = createInitialState();
  fresh.theme = state.theme;
  fresh.muted = state.muted;
  fresh.reducedMotion = state.reducedMotion;
  Object.assign(state, fresh);
}

// Advances passive generation for one frame. Returns the energy gained.
export function tickPassive(state, dt, now = Date.now()) {
  const passiveGain = energyPerSecond(state, true, now) * dt;
  if (passiveGain > 0) {
    addEnergy(state, passiveGain);
    state.surgeCharge = Math.min(SURGE_MAX, state.surgeCharge + dt * SURGE_CHARGE_PASSIVE);
  }
  state.playSeconds += dt;
  return passiveGain;
}
