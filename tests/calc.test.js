import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, totalUpgradeLevels } from '../src/core/state.js';
import * as calc from '../src/core/calc.js';
import { upgradeDefs } from '../src/config/upgrades.js';

function stateWith(levels = {}, extra = {}) {
  const state = createInitialState();
  for (const [id, level] of Object.entries(levels)) {
    state.upgrades[id].level = level;
  }
  return Object.assign(state, extra);
}

test('initial state starts at ground zero', () => {
  const state = createInitialState();
  assert.equal(state.score, 0);
  assert.equal(state.prestige, 0);
  assert.equal(state.theme, 'dark');
  assert.equal(state.buyMode, 'one');
  assert.equal(state.surgeCharge, 0);
  assert.equal(totalUpgradeLevels(state), 0);
  for (const def of upgradeDefs) {
    assert.equal(state.upgrades[def.id].level, 0);
  }
});

test('upgrade costs match base cost at level 0', () => {
  const state = createInitialState();
  for (const def of upgradeDefs) {
    assert.equal(calc.costFor(state, def.id), Math.floor(def.baseCost));
  }
});

test('upgrade cost scales with the growth rate', () => {
  const state = stateWith({ power: 5 });
  const expected = Math.max(1, Math.floor(10 * Math.pow(1.16, 5)));
  assert.equal(calc.costFor(state, 'power'), expected);
});

test('efficiency discount reduces costs by 3% per level', () => {
  const state = stateWith({ efficiency: 3 });
  assert.ok(Math.abs(calc.costDiscountMult(state) - Math.pow(0.97, 3)) < 1e-12);
});

test('efficiency discount never drops below the 0.55 floor', () => {
  const state = stateWith({ efficiency: 50 });
  assert.equal(calc.costDiscountMult(state), 0.55);
});

test('click power combines base power and global multipliers', () => {
  const state = stateWith({ power: 4, reactor: 2 }, { prestige: 1 });
  const mult = (1 + 2 * 0.12) * (1 + 0.1);
  assert.equal(calc.clickPower(state, false), Math.max(1, Math.floor(5 * mult)));
});

test('passive energy combines generators with global multipliers', () => {
  const state = stateWith({ auto: 3, drone: 2, mult: 1 });
  const expected = (3 + 2 * 8) * 1.35;
  assert.ok(Math.abs(calc.energyPerSecond(state, false) - expected) < 1e-9);
});

test('global multiplier stacks every source', () => {
  const state = stateWith({ mult: 2, reactor: 3 }, {
    prestige: 2,
    unlockedAchievements: ['a', 'b', 'c'],
    surgeEndsAt: Date.now() + 10000
  });
  const expected = Math.pow(1.35, 2) * (1 + 3 * 0.12) * (1 + 2 * 0.1) * (1 + 3 * 0.02) * 2;
  assert.ok(Math.abs(calc.globalMult(state) - expected) < 1e-9);
});

test('surge multiplier only applies while active', () => {
  const state = createInitialState();
  state.surgeEndsAt = Date.now() - 1;
  assert.equal(calc.surgeMult(state), 1);
  state.surgeEndsAt = Date.now() + 5000;
  assert.equal(calc.surgeMult(state), 2);
});

test('critical chance is 3% per level and caps at 60%', () => {
  assert.ok(Math.abs(calc.criticalChance(stateWith({ crit: 5 })) - 0.15) < 1e-12);
  assert.equal(calc.criticalChance(stateWith({ crit: 30 })), 0.6);
  assert.equal(calc.criticalChance(stateWith({ crit: 999 })), 0.6);
});
