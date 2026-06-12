import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, totalUpgradeLevels } from '../src/core/state.js';
import * as calc from '../src/core/calc.js';
import { upgradeDefs } from '../src/config/upgrades.js';
import { achievementDefs } from '../src/config/achievements.js';
import {
  CRIT_BASE_MULT,
  HORIZON_MIN_PRESTIGE,
  PRESTIGE_BASE_REQ,
  PRESTIGE_BONUS,
  PRESTIGE_REQ_GROWTH
} from '../src/config/constants.js';

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
  assert.equal(state.horizons, 0);
  assert.equal(state.shards, 0);
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
  const def = upgradeDefs.find(d => d.id === 'power');
  const expected = Math.max(1, Math.floor(def.baseCost * Math.pow(def.growth, 5)));
  assert.equal(calc.costFor(state, 'power'), expected);
});

test('efficiency discount reduces costs by 3% per level with a 0.55 floor', () => {
  const state = stateWith({ efficiency: 3 });
  assert.ok(Math.abs(calc.costDiscountMult(state) - Math.pow(0.97, 3)) < 1e-12);
  assert.equal(calc.costDiscountMult(stateWith({ efficiency: 50 })), 0.55);
});

test('tier unlock rules gate upgrades by progression', () => {
  const fresh = createInitialState();
  const byId = id => upgradeDefs.find(d => d.id === id);

  assert.equal(calc.isUpgradeUnlocked(fresh, byId('power')), true);
  assert.equal(calc.isUpgradeUnlocked(fresh, byId('drone')), false);
  assert.equal(calc.isUpgradeUnlocked(stateWith({}, { bestScore: 150 }), byId('drone')), true);
  assert.equal(calc.isUpgradeUnlocked(fresh, byId('critpower')), false);
  assert.equal(calc.isUpgradeUnlocked(stateWith({ crit: 3 }), byId('critpower')), true);
  assert.equal(calc.isUpgradeUnlocked(fresh, byId('induction')), false);
  assert.equal(calc.isUpgradeUnlocked(stateWith({ auto: 6, drone: 4 }), byId('induction')), true);
  assert.equal(calc.isUpgradeUnlocked(fresh, byId('surgecell')), false);
  assert.equal(calc.isUpgradeUnlocked(stateWith({}, { surgesUsed: 1 }), byId('surgecell')), true);
  assert.equal(calc.isUpgradeUnlocked(fresh, byId('tachyon')), false);
  assert.equal(calc.isUpgradeUnlocked(stateWith({}, { prestige: 1 }), byId('tachyon')), true);
  assert.equal(calc.isUpgradeUnlocked(stateWith({}, { prestige: 1 }), byId('antimatter')), true);
});

test('click power combines base power and global multipliers', () => {
  const state = stateWith({ power: 4, reactor: 2 }, { prestige: 1 });
  const mult = (1 + 2 * 0.12) * (1 + PRESTIGE_BONUS);
  assert.equal(calc.clickPower(state, false), Math.max(1, Math.floor(5 * mult)));
});

test('induction feeds a share of base passive output into clicks', () => {
  const state = stateWith({ power: 0, auto: 50, induction: 5 });
  // base click 1 + 5 * 2% of 50 base passive = 1 + 5 = 6
  assert.equal(calc.clickPower(state, false), 6);
});

test('passive generation sums all generator types', () => {
  const state = stateWith({ auto: 3, drone: 2, fusion: 1, antimatter: 1 });
  assert.equal(calc.basePassive(state), 3 + 16 + 60 + 250);
});

test('global multiplier stacks every source', () => {
  const state = stateWith({ mult: 2, reactor: 3, tachyon: 1 }, {
    prestige: 2,
    horizonUpgrades: Object.assign(createInitialState().horizonUpgrades, { eventlens: { rank: 2 } }),
    unlockedAchievements: ['a', 'b', 'c'],
    surgeEndsAt: Date.now() + 10000
  });
  const expected = Math.pow(1.35, 2) * (1 + 3 * 0.12) * (1 + 0.3) *
    (1 + 2 * PRESTIGE_BONUS) * (1 + 2 * 0.5) * (1 + 3 * 0.02) * 2;
  assert.ok(Math.abs(calc.globalMult(state) - expected) < 1e-9);
});

test('achievement reward is +2% global output each', () => {
  const state = stateWith({}, { unlockedAchievements: ['x', 'y', 'z', 'w'] });
  assert.ok(Math.abs(calc.achievementMult(state) - 1.08) < 1e-12);
});

test('critical chance is 3% per level and caps at 60%', () => {
  assert.ok(Math.abs(calc.criticalChance(stateWith({ crit: 5 })) - 0.15) < 1e-12);
  assert.equal(calc.criticalChance(stateWith({ crit: 30 })), 0.6);
  assert.equal(calc.criticalChance(stateWith({ crit: 999 })), 0.6);
});

test('critical multiplier starts at 3x and grows with Overcrit', () => {
  assert.equal(calc.criticalMult(createInitialState()), CRIT_BASE_MULT);
  assert.equal(calc.criticalMult(stateWith({ critpower: 4 })), CRIT_BASE_MULT + 2);
});

test('surge multiplier and duration scale with Surge Reactor', () => {
  const base = createInitialState();
  base.surgeEndsAt = Date.now() + 5000;
  assert.equal(calc.surgeMult(base), 2);
  assert.equal(calc.surgeDuration(base), 20000);

  const upgraded = stateWith({ surgecore: 2 }, { surgeEndsAt: Date.now() + 5000 });
  assert.equal(calc.surgeMult(upgraded), 2.5);
  assert.equal(calc.surgeDuration(upgraded), 22000);
});

test('surge charge rate scales with Surge Capacitor and Chrono Flux', () => {
  const state = stateWith({ surgecell: 2 });
  state.horizonUpgrades.chronoflux.rank = 1;
  assert.ok(Math.abs(calc.surgeChargeRate(state) - (1 + 0.24 + 0.3)) < 1e-12);
  assert.ok(Math.abs(calc.surgeChargePerClick(state) - 1.0 * (1.54)) < 1e-12);
});

test('chrono flux extends surge duration', () => {
  const state = createInitialState();
  state.horizonUpgrades.chronoflux.rank = 2;
  assert.equal(calc.surgeDuration(state), 20000 + 6000);
});

test('singularity requirement scales with each collapse', () => {
  const state = createInitialState();
  assert.equal(calc.prestigeRequirement(state), PRESTIGE_BASE_REQ);
  state.prestige = 2;
  assert.equal(calc.prestigeRequirement(state), PRESTIGE_BASE_REQ * PRESTIGE_REQ_GROWTH ** 2);
});

test('gravity well lowers the singularity requirement', () => {
  const state = createInitialState();
  state.horizonUpgrades.gravitywell.rank = 2;
  assert.equal(calc.prestigeRequirement(state), Math.floor(PRESTIGE_BASE_REQ * 0.5));
});

test('event horizon unlocks at 5 singularities and converts the excess', () => {
  const state = createInitialState();
  state.prestige = HORIZON_MIN_PRESTIGE - 1;
  assert.equal(calc.canHorizon(state), false);
  assert.equal(calc.horizonShardGain(state), 0);

  state.prestige = 5;
  assert.equal(calc.canHorizon(state), true);
  assert.equal(calc.horizonShardGain(state), 1);

  state.prestige = 9;
  assert.equal(calc.horizonShardGain(state), 5);
});

test('temporal cache raises the offline cap', () => {
  const state = createInitialState();
  assert.equal(calc.offlineCapSeconds(state), 7200);
  state.horizonUpgrades.temporalcache.rank = 3;
  assert.equal(calc.offlineCapSeconds(state), 7200 + 3 * 7200);
});

test('achievement catalog is well-formed', () => {
  const ids = achievementDefs.map(def => def.id);
  assert.equal(new Set(ids).size, ids.length, 'achievement ids are unique');
  assert.ok(achievementDefs.length >= 30 && achievementDefs.length <= 50);

  // Every check runs cleanly against a fresh state and only firstClick-style
  // zero-threshold checks may pass immediately.
  const fresh = createInitialState();
  for (const def of achievementDefs) {
    assert.equal(typeof def.check(fresh), 'boolean', `${def.id} check returns boolean`);
    assert.equal(def.check(fresh), false, `${def.id} not unlocked at start`);
  }

  // Legacy v0.2 ids survive so old unlocks stay valid.
  for (const legacy of ['firstClick', 'hundredEnergy', 'thousandEnergy', 'tenK', 'hundredK',
    'clicker100', 'clicker1000', 'cps50', 'cps500', 'upgrades25', 'upgrades100',
    'firstPrestige', 'threePrestige', 'surgeUse', 'millionaire']) {
    assert.ok(ids.includes(legacy), `legacy achievement ${legacy} preserved`);
  }
});
