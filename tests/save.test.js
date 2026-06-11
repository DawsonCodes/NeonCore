import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  backupCurrentSave,
  buildExportPayload,
  clearAllSaves,
  computeOfflineGain,
  loadFromStorage,
  offlineSeconds,
  sanitizeState,
  saveToStorage,
  validateImport
} from '../src/systems/save.js';
import { createInitialState } from '../src/core/state.js';
import {
  BACKUP_SAVE_KEY,
  OFFLINE_CAP_SECONDS,
  SAVE_KEY,
  SAVE_SCHEMA
} from '../src/config/constants.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    map
  };
}

// A save exactly as the original alpha build wrote it: the flat state object.
function legacyAlphaSave() {
  return {
    score: 12345,
    bestScore: 20000,
    totalEarned: 50000,
    totalSpent: 30000,
    totalClicks: 777,
    playSeconds: 3600,
    upgrades: {
      power: { level: 5 },
      auto: { level: 3 },
      drone: { level: 1 },
      crit: { level: 2 },
      reactor: { level: 1 },
      efficiency: { level: 0 },
      mult: { level: 0 }
    },
    prestige: 1,
    unlockedAchievements: ['firstClick', 'hundredEnergy'],
    reachedMilestones: [100, 1000],
    muted: true,
    theme: 'light',
    buyMode: 'max',
    surgeCharge: 42,
    surgeEndsAt: 0,
    surgesUsed: 2,
    lastSavedAt: Date.now() - 60000
  };
}

test('save round-trips through storage under the v3 schema', () => {
  const storage = fakeStorage();
  const state = createInitialState();
  state.score = 999;
  state.upgrades.power.level = 4;

  saveToStorage(storage, state, 1000000);
  const stored = JSON.parse(storage.getItem(SAVE_KEY));
  assert.equal(stored.schema, SAVE_SCHEMA);
  assert.equal(stored.savedAt, 1000000);

  const loaded = loadFromStorage(storage);
  assert.equal(loaded.source, SAVE_KEY);
  assert.equal(loaded.state.score, 999);
  assert.equal(loaded.state.upgrades.power.level, 4);
  assert.equal(loaded.savedAt, 1000000);
});

test('legacy neonCoreSave_v2 saves migrate cleanly', () => {
  const storage = fakeStorage();
  const legacy = legacyAlphaSave();
  storage.setItem('neonCoreSave_v2', JSON.stringify(legacy));

  const loaded = loadFromStorage(storage);
  assert.equal(loaded.source, 'neonCoreSave_v2');
  assert.equal(loaded.state.score, 12345);
  assert.equal(loaded.state.prestige, 1);
  assert.equal(loaded.state.theme, 'light');
  assert.equal(loaded.state.buyMode, 'max');
  assert.equal(loaded.state.upgrades.power.level, 5);
  assert.deepEqual(loaded.state.unlockedAchievements, ['firstClick', 'hundredEnergy']);
  assert.equal(loaded.savedAt, legacy.lastSavedAt);
});

test('legacy neonCoreSave_v1 saves migrate cleanly', () => {
  const storage = fakeStorage();
  storage.setItem('neonCoreSave_v1', JSON.stringify(legacyAlphaSave()));
  const loaded = loadFromStorage(storage);
  assert.equal(loaded.source, 'neonCoreSave_v1');
  assert.equal(loaded.state.totalClicks, 777);
});

test('the newest schema wins when multiple keys exist', () => {
  const storage = fakeStorage();
  storage.setItem('neonCoreSave_v2', JSON.stringify(legacyAlphaSave()));
  const state = createInitialState();
  state.score = 1;
  saveToStorage(storage, state);
  assert.equal(loadFromStorage(storage).source, SAVE_KEY);
});

test('import accepts a legacy alpha exported JSON file', () => {
  const result = validateImport(JSON.stringify(legacyAlphaSave()));
  assert.equal(result.ok, true);
  assert.equal(result.state.score, 12345);
  assert.equal(result.state.surgesUsed, 2);
});

test('import accepts a current wrapped export', () => {
  const payload = buildExportPayload(legacyAlphaSave(), 5000);
  assert.equal(payload.schema, SAVE_SCHEMA);
  assert.ok(payload.exportedAt);
  const result = validateImport(JSON.stringify(payload));
  assert.equal(result.ok, true);
  assert.equal(result.state.score, 12345);
});

test('import rejects malformed input without throwing', () => {
  assert.equal(validateImport('not json at all').ok, false);
  assert.equal(validateImport('[]').ok, false);
  assert.equal(validateImport('{"hello": 1}').ok, false);
  assert.equal(validateImport('{"score": "abc"}').ok, false);
  assert.equal(validateImport('null').ok, false);
  assert.equal(validateImport('42').ok, false);
});

test('sanitizeState clamps unsafe numbers and filters unknown ids', () => {
  const state = sanitizeState({
    score: -50,
    totalEarned: Infinity,
    totalClicks: 'lots',
    surgeCharge: 5000,
    prestige: -2,
    unlockedAchievements: ['firstClick', 'fakeCheat', 42],
    reachedMilestones: [100, 999999999],
    upgrades: { power: { level: '7' }, auto: { level: -3 } }
  });
  assert.equal(state.score, 0);
  assert.equal(state.totalEarned, 0);
  assert.equal(state.totalClicks, 0);
  assert.equal(state.surgeCharge, 100);
  assert.equal(state.prestige, 0);
  assert.deepEqual(state.unlockedAchievements, ['firstClick']);
  assert.deepEqual(state.reachedMilestones, [100]);
  assert.equal(state.upgrades.power.level, 7);
  assert.equal(state.upgrades.auto.level, 0);
});

test('a backup of the current save is written before imports overwrite it', () => {
  const storage = fakeStorage();
  const state = createInitialState();
  state.score = 4242;
  saveToStorage(storage, state);

  assert.equal(backupCurrentSave(storage), true);
  const backup = JSON.parse(storage.getItem(BACKUP_SAVE_KEY));
  assert.equal(backup.state.score, 4242);
});

test('offline progress is capped at two hours', () => {
  const now = Date.now();
  assert.equal(offlineSeconds(now - 60_000, now), 60);
  assert.equal(offlineSeconds(now - 10 * 3600 * 1000, now), OFFLINE_CAP_SECONDS);
  assert.equal(offlineSeconds(now + 60_000, now), 0, 'future timestamps grant nothing');
});

test('offline gain uses passive output without the surge multiplier', () => {
  const state = createInitialState();
  state.upgrades.auto.level = 10;
  state.surgeEndsAt = Date.now() + 10000; // active surge must not count
  const now = Date.now();
  const { seconds, gain } = computeOfflineGain(state, now - 100_000, now);
  assert.equal(seconds, 100);
  assert.ok(Math.abs(gain - 10 * 100) < 1e-9);
});

test('clearAllSaves removes current, legacy, and backup keys', () => {
  const storage = fakeStorage();
  storage.setItem(SAVE_KEY, '{}');
  storage.setItem('neonCoreSave_v2', '{}');
  storage.setItem('neonCoreSave_v1', '{}');
  storage.setItem(BACKUP_SAVE_KEY, '{}');
  clearAllSaves(storage);
  assert.equal(storage.map.size, 0);
});
