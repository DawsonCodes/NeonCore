import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/core/state.js';
import * as actions from '../src/core/actions.js';
import { costFor, prestigeRequirement, surgeDuration } from '../src/core/calc.js';
import { PRESTIGE_BASE_REQ, SURGE_MAX } from '../src/config/constants.js';

test('core click adds click power, counts the click, and charges surge', () => {
  const state = createInitialState();
  const result = actions.coreClick(state, { rng: () => 1 });
  assert.equal(result.critical, false);
  assert.equal(result.gain, 1);
  assert.equal(state.score, 1);
  assert.equal(state.totalClicks, 1);
  assert.equal(state.surgeCharge, 1.0);
  assert.equal(state.biggestClick, 1);
});

test('critical clicks use the critical multiplier and are counted', () => {
  const state = createInitialState();
  state.upgrades.crit.level = 10; // 30% chance
  state.upgrades.critpower.level = 2; // x4 crits
  const result = actions.coreClick(state, { rng: () => 0 });
  assert.equal(result.critical, true);
  assert.equal(result.gain, 4);
  assert.equal(state.totalCrits, 1);
  assert.equal(state.biggestClick, 4);
});

test('clicking during an active surge extends it up to the cap', () => {
  const state = createInitialState();
  const now = Date.now();
  state.surgeCharge = SURGE_MAX;
  actions.activateSurge(state, now);
  const endsBefore = state.surgeEndsAt;

  const result = actions.coreClick(state, { rng: () => 1, now: now + 1000 });
  assert.equal(result.extended, true);
  assert.equal(state.surgeEndsAt, endsBefore + 100);

  // Cap: total extension limited to half the full duration.
  const cap = surgeDuration(state) * 0.5;
  for (let i = 0; i < 300; i++) {
    actions.coreClick(state, { rng: () => 1, now: now + 2000 });
  }
  assert.ok(state.surgeEndsAt - endsBefore <= cap + 1e-9);
  assert.equal(state.surgeExtendedThisRun, cap);

  // No charge accrues while the surge is running.
  assert.equal(state.surgeCharge, 0);
});

test('buy one purchases a single level and spends the cost', () => {
  const state = createInitialState();
  state.score = 100;
  const cost = costFor(state, 'power');
  const result = actions.purchaseUpgrade(state, 'power', 'one');
  assert.equal(result.bought, 1);
  assert.equal(result.spent, cost);
  assert.equal(state.upgrades.power.level, 1);
  assert.equal(state.totalSpent, cost);
});

test('buy max purchases until the next level is unaffordable', () => {
  const state = createInitialState();
  state.score = 100;
  const result = actions.purchaseUpgrade(state, 'power', 'max');
  assert.ok(result.bought >= 2);
  assert.ok(state.score < costFor(state, 'power'));
  assert.equal(state.upgrades.power.level, result.bought);
});

test('purchases fail cleanly without enough energy', () => {
  const state = createInitialState();
  state.score = 5;
  const result = actions.purchaseUpgrade(state, 'power', 'one');
  assert.equal(result.bought, 0);
  assert.equal(state.score, 5);
});

test('surge only activates at full charge and uses the scaled duration', () => {
  const state = createInitialState();
  assert.equal(actions.activateSurge(state), false);

  state.upgrades.surgecore.level = 2;
  state.surgeCharge = SURGE_MAX;
  const now = Date.now();
  assert.equal(actions.activateSurge(state, now), true);
  assert.equal(state.surgeCharge, 0);
  assert.equal(state.surgeEndsAt, now + 22000);
  assert.equal(state.surgesUsed, 1);

  state.surgeCharge = SURGE_MAX;
  assert.equal(actions.activateSurge(state, now + 1000), false, 'cannot re-activate while running');
});

test('singularity requires the scaled threshold and grants the bonus', () => {
  const state = createInitialState();
  state.score = PRESTIGE_BASE_REQ - 1;
  assert.equal(actions.performSingularity(state), false);

  state.score = PRESTIGE_BASE_REQ;
  state.upgrades.auto.level = 12;
  state.unlockedAchievements = ['firstClick'];
  state.totalEarned = 5e6;
  assert.equal(actions.performSingularity(state), true);
  assert.equal(state.prestige, 1);
  assert.equal(state.prestigeTotal, 1);
  assert.equal(state.score, 0);
  assert.equal(state.upgrades.auto.level, 0);
  assert.deepEqual(state.unlockedAchievements, ['firstClick'], 'achievements survive');
  assert.equal(state.totalEarned, 5e6, 'lifetime stats survive');

  // The next requirement scales up.
  assert.equal(prestigeRequirement(state), PRESTIGE_BASE_REQ * 3);
});

test('event horizon converts singularities into shards and resets the layer', () => {
  const state = createInitialState();
  state.prestige = 4;
  assert.equal(actions.performHorizon(state), false);

  state.prestige = 7;
  state.prestigeTotal = 7;
  state.score = 1e9;
  state.upgrades.power.level = 50;
  const result = actions.performHorizon(state);
  assert.equal(result.gained, 3);
  assert.equal(state.horizons, 1);
  assert.equal(state.shards, 3);
  assert.equal(state.shardsEarnedTotal, 3);
  assert.equal(state.prestige, 0, 'singularity layer resets');
  assert.equal(state.prestigeTotal, 7, 'lifetime count survives');
  assert.equal(state.score, 0);
  assert.equal(state.upgrades.power.level, 0);
});

test('horizon upgrades cost rank+1 shards and respect max ranks', () => {
  const state = createInitialState();
  state.shards = 3;

  const first = actions.purchaseHorizonUpgrade(state, 'eventlens');
  assert.deepEqual(first, { cost: 1, rank: 1 });
  assert.equal(state.shards, 2);

  const second = actions.purchaseHorizonUpgrade(state, 'eventlens');
  assert.deepEqual(second, { cost: 2, rank: 2 });
  assert.equal(state.shards, 0);

  assert.equal(actions.purchaseHorizonUpgrade(state, 'eventlens'), false, 'cannot afford rank 3');

  state.shards = 100;
  actions.purchaseHorizonUpgrade(state, 'eventlens'); // 3
  actions.purchaseHorizonUpgrade(state, 'eventlens'); // 4
  actions.purchaseHorizonUpgrade(state, 'eventlens'); // 5 (max)
  assert.equal(actions.purchaseHorizonUpgrade(state, 'eventlens'), false, 'max rank reached');
  assert.equal(state.horizonUpgrades.eventlens.rank, 5);
});

test('star seed grants free starting levels after a collapse', () => {
  const state = createInitialState();
  state.horizonUpgrades.starseed.rank = 2;
  state.prestige = 0;
  state.score = prestigeRequirement(state);
  actions.performSingularity(state);
  assert.equal(state.upgrades.power.level, 10);
  assert.equal(state.upgrades.auto.level, 10);
});

test('reset wipes progression and prestige layers but keeps preferences', () => {
  const state = createInitialState();
  state.score = 5000;
  state.prestige = 3;
  state.horizons = 2;
  state.shards = 4;
  state.horizonUpgrades.eventlens.rank = 2;
  state.unlockedAchievements = ['firstClick'];
  state.theme = 'light';
  state.muted = true;
  state.volume = 0.3;
  state.reducedMotion = true;

  actions.resetState(state);
  assert.equal(state.score, 0);
  assert.equal(state.prestige, 0);
  assert.equal(state.horizons, 0);
  assert.equal(state.shards, 0);
  assert.equal(state.horizonUpgrades.eventlens.rank, 0);
  assert.deepEqual(state.unlockedAchievements, []);
  assert.equal(state.theme, 'light');
  assert.equal(state.muted, true);
  assert.equal(state.volume, 0.3);
  assert.equal(state.reducedMotion, true);
});

test('passive tick applies energy per second and tracks surge time', () => {
  const state = createInitialState();
  state.upgrades.auto.level = 10;
  const gained = actions.tickPassive(state, 0.5);
  assert.ok(Math.abs(gained - 5) < 1e-9);
  assert.ok(Math.abs(state.score - 5) < 1e-9);
  assert.ok(Math.abs(state.surgeCharge - 0.1) < 1e-9, 'passive trickle charges surge');
  assert.ok(Math.abs(state.playSeconds - 0.5) < 1e-9);

  state.surgeEndsAt = Date.now() + 10000;
  actions.tickPassive(state, 0.5);
  assert.ok(Math.abs(state.surgeTimeTotal - 0.5) < 1e-9, 'surge time accumulates while active');
  assert.ok(Math.abs(state.surgeCharge - 0.1) < 1e-9, 'no charge while surging');
});
