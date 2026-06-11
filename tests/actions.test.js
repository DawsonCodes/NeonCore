import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/core/state.js';
import * as actions from '../src/core/actions.js';
import { costFor } from '../src/core/calc.js';

test('core click adds click power, counts the click, and charges surge', () => {
  const state = createInitialState();
  const result = actions.coreClick(state, { rng: () => 1 });
  assert.equal(result.critical, false);
  assert.equal(result.gain, 1);
  assert.equal(state.score, 1);
  assert.equal(state.totalClicks, 1);
  assert.equal(state.surgeCharge, 1.35);
});

test('critical clicks multiply the gain by 3', () => {
  const state = createInitialState();
  state.upgrades.crit.level = 10; // 30% chance
  const result = actions.coreClick(state, { rng: () => 0 });
  assert.equal(result.critical, true);
  assert.equal(result.gain, 3);
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

test('surge only activates at full charge and resets the bar', () => {
  const state = createInitialState();
  assert.equal(actions.activateSurge(state), false);

  state.surgeCharge = 100;
  const now = Date.now();
  assert.equal(actions.activateSurge(state, now), true);
  assert.equal(state.surgeCharge, 0);
  assert.equal(state.surgeEndsAt, now + 20000);
  assert.equal(state.surgesUsed, 1);

  state.surgeCharge = 100;
  assert.equal(actions.activateSurge(state, now + 1000), false, 'cannot re-activate while running');
});

test('singularity requires 100K and resets energy and upgrades only', () => {
  const state = createInitialState();
  state.score = 99999;
  assert.equal(actions.performSingularity(state), false);

  state.score = 100000;
  state.upgrades.auto.level = 12;
  state.unlockedAchievements = ['firstClick'];
  state.totalEarned = 500000;
  assert.equal(actions.performSingularity(state), true);
  assert.equal(state.prestige, 1);
  assert.equal(state.score, 0);
  assert.equal(state.upgrades.auto.level, 0);
  assert.deepEqual(state.unlockedAchievements, ['firstClick'], 'achievements survive');
  assert.equal(state.totalEarned, 500000, 'lifetime stats survive');
});

test('reset wipes progression but keeps interface preferences', () => {
  const state = createInitialState();
  state.score = 5000;
  state.prestige = 3;
  state.unlockedAchievements = ['firstClick'];
  state.theme = 'light';
  state.muted = true;
  state.reducedMotion = true;

  actions.resetState(state);
  assert.equal(state.score, 0);
  assert.equal(state.prestige, 0);
  assert.deepEqual(state.unlockedAchievements, []);
  assert.equal(state.theme, 'light');
  assert.equal(state.muted, true);
  assert.equal(state.reducedMotion, true);
});

test('passive tick applies energy per second scaled by elapsed time', () => {
  const state = createInitialState();
  state.upgrades.auto.level = 10;
  const gained = actions.tickPassive(state, 0.5);
  assert.ok(Math.abs(gained - 5) < 1e-9);
  assert.ok(Math.abs(state.score - 5) < 1e-9);
  assert.ok(Math.abs(state.surgeCharge - 0.025) < 1e-9);
  assert.ok(Math.abs(state.playSeconds - 0.5) < 1e-9);
});
