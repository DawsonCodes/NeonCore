import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  backupCurrentSave,
  buildExportPayload,
  clearActiveSave,
  computeOfflineGain,
  deleteSlot,
  loadFromStorage,
  loadSlots,
  offlineSeconds,
  readSlot,
  renameSlot,
  sanitizeState,
  saveToStorage,
  slotSummary,
  validateImport,
  writeSlot
} from '../src/systems/save.js';
import { createInitialState } from '../src/core/state.js';
import {
  BACKUP_SAVE_KEY,
  OFFLINE_BASE_CAP_SECONDS,
  SAVE_KEY,
  SAVE_SCHEMA,
  SLOTS_KEY
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

// A save exactly as the original alpha builds wrote it: a flat state object.
function legacyFlatSave() {
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
    prestige: 2,
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

// A save as v0.2.0-alpha.1 wrote it: schema-3 envelope around the flat state.
function v3EnvelopeSave() {
  return { schema: 3, savedAt: Date.now() - 60000, state: legacyFlatSave() };
}

test('save round-trips through storage under the v4 schema', () => {
  const storage = fakeStorage();
  const state = createInitialState();
  state.score = 999;
  state.upgrades.power.level = 4;
  state.shards = 2;
  state.horizonUpgrades.eventlens.rank = 1;

  saveToStorage(storage, state, 1000000);
  const stored = JSON.parse(storage.getItem(SAVE_KEY));
  assert.equal(stored.schema, SAVE_SCHEMA);
  assert.equal(stored.savedAt, 1000000);

  const loaded = loadFromStorage(storage);
  assert.equal(loaded.source, SAVE_KEY);
  assert.equal(loaded.state.score, 999);
  assert.equal(loaded.state.upgrades.power.level, 4);
  assert.equal(loaded.state.shards, 2);
  assert.equal(loaded.state.horizonUpgrades.eventlens.rank, 1);
  assert.equal(loaded.savedAt, 1000000);
});

test('v3 envelope saves (v0.2.0-alpha.1) migrate with new-field defaults', () => {
  const storage = fakeStorage();
  storage.setItem('neonCoreSave_v3', JSON.stringify(v3EnvelopeSave()));

  const loaded = loadFromStorage(storage);
  assert.equal(loaded.source, 'neonCoreSave_v3');
  assert.equal(loaded.state.score, 12345);
  assert.equal(loaded.state.prestige, 2);
  assert.equal(loaded.state.prestigeTotal, 2, 'prestigeTotal backfills from prestige');
  assert.equal(loaded.state.theme, 'light');
  assert.equal(loaded.state.upgrades.power.level, 5);
  // Fields that did not exist in v3 get safe defaults.
  assert.equal(loaded.state.horizons, 0);
  assert.equal(loaded.state.shards, 0);
  assert.equal(loaded.state.totalCrits, 0);
  assert.equal(loaded.state.volume, 0.7);
  assert.equal(loaded.state.upgrades.fusion.level, 0, 'new upgrades default to level 0');
  assert.equal(loaded.state.horizonUpgrades.gravitywell.rank, 0);
});

test('legacy v2 and v1 flat saves migrate cleanly', () => {
  for (const key of ['neonCoreSave_v2', 'neonCoreSave_v1']) {
    const storage = fakeStorage();
    const legacy = legacyFlatSave();
    storage.setItem(key, JSON.stringify(legacy));

    const loaded = loadFromStorage(storage);
    assert.equal(loaded.source, key);
    assert.equal(loaded.state.score, 12345);
    assert.equal(loaded.state.buyMode, 'max');
    assert.deepEqual(loaded.state.unlockedAchievements, ['firstClick', 'hundredEnergy']);
    assert.equal(loaded.savedAt, legacy.lastSavedAt);
  }
});

test('the newest schema wins when multiple keys exist', () => {
  const storage = fakeStorage();
  storage.setItem('neonCoreSave_v2', JSON.stringify(legacyFlatSave()));
  storage.setItem('neonCoreSave_v3', JSON.stringify(v3EnvelopeSave()));
  const state = createInitialState();
  state.score = 1;
  saveToStorage(storage, state);
  assert.equal(loadFromStorage(storage).source, SAVE_KEY);
});

test('import accepts legacy flat, v3 envelope, and current exports', () => {
  assert.equal(validateImport(JSON.stringify(legacyFlatSave())).ok, true);
  assert.equal(validateImport(JSON.stringify(v3EnvelopeSave())).ok, true);

  const payload = buildExportPayload(legacyFlatSave(), 5000);
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

test('sanitizeState clamps unsafe numbers, filters unknown ids, ignores unknown fields', () => {
  const state = sanitizeState({
    score: -50,
    totalEarned: Infinity,
    totalClicks: 'lots',
    surgeCharge: 5000,
    prestige: -2,
    shards: -5,
    volume: 9,
    unknownFutureField: { weird: true },
    unlockedAchievements: ['firstClick', 'fakeCheat', 42],
    reachedMilestones: [100, 999999999],
    upgrades: { power: { level: '7' }, auto: { level: -3 }, hacked: { level: 99 } },
    horizonUpgrades: { eventlens: { rank: 99 }, bogus: { rank: 3 } }
  });
  assert.equal(state.score, 0);
  assert.equal(state.totalEarned, 0);
  assert.equal(state.totalClicks, 0);
  assert.equal(state.surgeCharge, 100);
  assert.equal(state.prestige, 0);
  assert.equal(state.shards, 0);
  assert.equal(state.volume, 1, 'volume clamps to [0,1]');
  assert.equal('unknownFutureField' in state, false, 'unknown fields are dropped');
  assert.deepEqual(state.unlockedAchievements, ['firstClick']);
  assert.deepEqual(state.reachedMilestones, [100]);
  assert.equal(state.upgrades.power.level, 7);
  assert.equal(state.upgrades.auto.level, 0);
  assert.equal('hacked' in state.upgrades, false);
  assert.equal(state.horizonUpgrades.eventlens.rank, 5, 'ranks clamp to maxRank');
  assert.equal('bogus' in state.horizonUpgrades, false);
});

test('a backup of the current save is written before overwrites', () => {
  const storage = fakeStorage();
  const state = createInitialState();
  state.score = 4242;
  saveToStorage(storage, state);

  assert.equal(backupCurrentSave(storage), true);
  const backup = JSON.parse(storage.getItem(BACKUP_SAVE_KEY));
  assert.equal(backup.state.score, 4242);
});

test('offline progress is capped and ignores surge', () => {
  const now = Date.now();
  const state = createInitialState();
  assert.equal(offlineSeconds(state, now - 60_000, now), 60);
  assert.equal(offlineSeconds(state, now - 10 * 3600 * 1000, now), OFFLINE_BASE_CAP_SECONDS);
  assert.equal(offlineSeconds(state, now + 60_000, now), 0, 'future timestamps grant nothing');

  state.upgrades.auto.level = 10;
  state.surgeEndsAt = now + 10000; // active surge must not count
  const { seconds, gain } = computeOfflineGain(state, now - 100_000, now);
  assert.equal(seconds, 100);
  assert.ok(Math.abs(gain - 10 * 100) < 1e-9);

  // Temporal Cache raises the cap.
  state.horizonUpgrades.temporalcache.rank = 1;
  assert.equal(offlineSeconds(state, now - 4 * 3600 * 1000, now), 4 * 3600);
});

test('clearActiveSave removes active, legacy, and backup keys but keeps slots', () => {
  const storage = fakeStorage();
  storage.setItem(SAVE_KEY, '{}');
  storage.setItem('neonCoreSave_v3', '{}');
  storage.setItem('neonCoreSave_v2', '{}');
  storage.setItem('neonCoreSave_v1', '{}');
  storage.setItem(BACKUP_SAVE_KEY, '{}');
  storage.setItem(SLOTS_KEY, '{"version":1,"slots":[]}');
  clearActiveSave(storage);
  assert.deepEqual([...storage.map.keys()], [SLOTS_KEY], 'slots survive a reset');
});

// ---------------------------------------------------------------------------
// Save slots
// ---------------------------------------------------------------------------

test('slots start empty and tolerate corrupted slot storage', () => {
  const storage = fakeStorage();
  assert.deepEqual(loadSlots(storage), [null, null, null]);
  storage.setItem(SLOTS_KEY, 'corrupted{{{');
  assert.deepEqual(loadSlots(storage), [null, null, null]);
});

test('writeSlot stores a sanitized snapshot with timestamps and summary', () => {
  const storage = fakeStorage();
  const state = createInitialState();
  state.score = 5000;
  state.bestScore = 9000;
  state.prestige = 2;
  state.horizons = 1;

  writeSlot(storage, 1, state, 'My run', 111111);
  const slots = loadSlots(storage);
  assert.equal(slots[0], null);
  assert.equal(slots[2], null);
  assert.equal(slots[1].name, 'My run');
  assert.equal(slots[1].createdAt, 111111);
  assert.equal(slots[1].updatedAt, 111111);

  const summary = slotSummary(slots[1]);
  assert.equal(summary.score, 5000);
  assert.equal(summary.bestScore, 9000);
  assert.equal(summary.prestige, 2);
  assert.equal(summary.horizons, 1);
  assert.equal(summary.schema, SAVE_SCHEMA);
});

test('overwriting a slot keeps its creation time and name by default', () => {
  const storage = fakeStorage();
  const state = createInitialState();
  writeSlot(storage, 0, state, 'Alpha', 1000);
  state.score = 777;
  writeSlot(storage, 0, state, undefined, 2000);

  const slot = loadSlots(storage)[0];
  assert.equal(slot.name, 'Alpha');
  assert.equal(slot.createdAt, 1000);
  assert.equal(slot.updatedAt, 2000);
  assert.equal(readSlot(storage, 0).state.score, 777);
});

test('slots can be renamed, restored, and deleted', () => {
  const storage = fakeStorage();
  const state = createInitialState();
  state.score = 123;
  writeSlot(storage, 2, state, 'Old name');

  renameSlot(storage, 2, '  Renamed run  ');
  assert.equal(loadSlots(storage)[2].name, 'Renamed run');

  const restored = readSlot(storage, 2);
  assert.equal(restored.state.score, 123);
  assert.equal(restored.name, 'Renamed run');

  deleteSlot(storage, 2);
  assert.equal(loadSlots(storage)[2], null);
  assert.equal(readSlot(storage, 2), null);
});

test('slot data is sanitized on read so tampered slots cannot break the game', () => {
  const storage = fakeStorage();
  storage.setItem(SLOTS_KEY, JSON.stringify({
    version: 1,
    slots: [
      { name: 42, createdAt: 'x', updatedAt: null, save: { schema: 4, state: { score: 100, surgeCharge: 99999 } } },
      { totally: 'broken' },
      null
    ]
  }));
  const slots = loadSlots(storage);
  assert.equal(slots[0].name, 'Slot 1', 'invalid name falls back');
  assert.equal(slots[1], null, 'slot without a save payload reads as empty');
  const restored = readSlot(storage, 0);
  assert.equal(restored.state.score, 100);
  assert.equal(restored.state.surgeCharge, 100, 'restored slot state is clamped');
});
