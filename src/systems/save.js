// Versioned save system: serialization, validation, migration from legacy
// alpha saves, import/export payloads, offline progress, and local save
// slots. Storage is injected (any object with getItem/setItem/removeItem)
// so the whole module can be unit tested in Node without a browser.

import {
  APP_VERSION,
  BACKUP_SAVE_KEY,
  DEFAULT_VOLUME,
  LEGACY_SAVE_KEYS,
  SAVE_KEY,
  SAVE_SCHEMA,
  SLOT_COUNT,
  SLOTS_KEY,
  SURGE_MAX
} from '../config/constants.js';
import { achievementDefs } from '../config/achievements.js';
import { milestoneDefs } from '../config/milestones.js';
import { upgradeDefs } from '../config/upgrades.js';
import { horizonUpgradeDefs } from '../config/horizon.js';
import { energyPerSecond, offlineCapSeconds } from '../core/calc.js';
import { createInitialState } from '../core/state.js';
import { clampNumber } from '../utils/format.js';

const KNOWN_ACHIEVEMENTS = new Set(achievementDefs.map(def => def.id));
const KNOWN_MILESTONES = new Set(milestoneDefs.map(def => def.threshold));
const KNOWN_UPGRADES = new Set(upgradeDefs.map(def => def.id));

// ---------------------------------------------------------------------------
// Payload recognition
// ---------------------------------------------------------------------------

// Returns true when an object looks like a usable state payload. Every save
// format so far has stored `score` as a plain number.
export function isStatePayload(data) {
  return Boolean(
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    typeof data.score === 'number' &&
    Number.isFinite(data.score)
  );
}

// Given any parsed save JSON, find the raw state object inside it.
// Supports v3/v4 wrapped envelopes and legacy flat alpha saves/exports.
export function extractStatePayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (isStatePayload(parsed.state)) return parsed.state;
  if (isStatePayload(parsed)) return parsed;
  return null;
}

// ---------------------------------------------------------------------------
// Sanitization / migration
// ---------------------------------------------------------------------------

// Builds a complete, safe state object from an untrusted payload. Unknown
// fields are dropped, numbers are clamped, lists are filtered to known ids,
// and fields introduced after the payload's era get safe defaults.
export function sanitizeState(data) {
  const state = createInitialState();
  if (!data || typeof data !== 'object') return state;

  state.score = clampNumber(data.score, 0);
  state.bestScore = clampNumber(data.bestScore ?? data.score, 0);
  state.totalEarned = clampNumber(data.totalEarned, 0);
  state.totalSpent = clampNumber(data.totalSpent, 0);
  state.totalClicks = clampNumber(data.totalClicks, 0);
  state.totalCrits = clampNumber(data.totalCrits, 0);
  state.biggestClick = clampNumber(data.biggestClick, 0);
  state.playSeconds = clampNumber(data.playSeconds, 0);

  state.prestige = clampNumber(data.prestige, 0);
  // prestigeTotal is new in v4; older saves only tracked the current count.
  state.prestigeTotal = Math.max(clampNumber(data.prestigeTotal, 0), state.prestige);

  state.horizons = clampNumber(data.horizons, 0);
  state.shards = clampNumber(data.shards, 0);
  state.shardsEarnedTotal = Math.max(clampNumber(data.shardsEarnedTotal, 0), state.shards);

  state.bestEps = clampNumber(data.bestEps, 0);
  state.offlineEarnedTotal = clampNumber(data.offlineEarnedTotal, 0);
  state.exportsCount = clampNumber(data.exportsCount, 0);
  state.importsCount = clampNumber(data.importsCount, 0);
  state.manualSaves = clampNumber(data.manualSaves, 0);
  state.slotSaves = clampNumber(data.slotSaves, 0);
  state.slotRestores = clampNumber(data.slotRestores, 0);

  state.muted = Boolean(data.muted);
  state.volume = clampNumber(data.volume ?? DEFAULT_VOLUME, 0, 1);
  state.theme = data.theme === 'light' ? 'light' : 'dark';
  state.buyMode = data.buyMode === 'max' ? 'max' : 'one';
  state.reducedMotion = Boolean(data.reducedMotion);

  state.surgeCharge = clampNumber(data.surgeCharge, 0, SURGE_MAX);
  state.surgeEndsAt = clampNumber(data.surgeEndsAt, 0);
  state.surgeExtendedThisRun = clampNumber(data.surgeExtendedThisRun, 0);
  state.surgeExtendedMs = clampNumber(data.surgeExtendedMs, 0);
  state.surgesUsed = clampNumber(data.surgesUsed, 0);
  state.surgeTimeTotal = clampNumber(data.surgeTimeTotal, 0);

  state.lastSavedAt = clampNumber(data.lastSavedAt ?? data.savedAt, 0) || Date.now();

  state.unlockedAchievements = Array.isArray(data.unlockedAchievements)
    ? [...new Set(data.unlockedAchievements.filter(id => KNOWN_ACHIEVEMENTS.has(id)))]
    : [];
  state.reachedMilestones = Array.isArray(data.reachedMilestones)
    ? [...new Set(data.reachedMilestones.filter(threshold => KNOWN_MILESTONES.has(threshold)))]
    : [];
  state.seenUpgrades = Array.isArray(data.seenUpgrades)
    ? [...new Set(data.seenUpgrades.filter(id => KNOWN_UPGRADES.has(id)))]
    : [];

  for (const def of upgradeDefs) {
    const loadedLevel = data.upgrades?.[def.id]?.level;
    state.upgrades[def.id].level = Math.max(0, Math.floor(Number(loadedLevel) || 0));
  }

  for (const def of horizonUpgradeDefs) {
    const loadedRank = data.horizonUpgrades?.[def.id]?.rank;
    state.horizonUpgrades[def.id].rank = Math.min(
      def.maxRank,
      Math.max(0, Math.floor(Number(loadedRank) || 0))
    );
  }

  return state;
}

// ---------------------------------------------------------------------------
// Active-save persistence
// ---------------------------------------------------------------------------

// Builds the versioned envelope written to storage.
export function serializeSave(state, now = Date.now()) {
  return {
    schema: SAVE_SCHEMA,
    savedAt: now,
    state
  };
}

// Persists the state under the current schema key.
export function saveToStorage(storage, state, now = Date.now()) {
  state.lastSavedAt = now;
  storage.setItem(SAVE_KEY, JSON.stringify(serializeSave(state, now)));
}

// Loads the newest available save, checking the current key first and then
// the legacy keys (v3, v2, v1). Returns { state, savedAt, source } or null.
export function loadFromStorage(storage) {
  for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
    const raw = storage.getItem(key);
    if (!raw) continue;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const payload = extractStatePayload(parsed);
    if (!payload) continue;

    const savedAt = clampNumber(
      parsed.savedAt ?? payload.lastSavedAt ?? payload.savedAt,
      0
    );
    return { state: sanitizeState(payload), savedAt, source: key };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

// Validates raw import text (or a parsed object) from an exported save file.
// Accepts current and all legacy export shapes. Returns either
// { ok: true, state } or { ok: false, error } without touching storage.
export function validateImport(input) {
  let parsed = input;

  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch {
      return { ok: false, error: 'The file is not valid JSON.' };
    }
  }

  const payload = extractStatePayload(parsed);
  if (!payload) {
    return { ok: false, error: 'The file is not a recognizable Neon Core save.' };
  }

  return { ok: true, state: sanitizeState(payload) };
}

// Copies the current stored save into a backup slot before anything
// overwrites active progress (imports and slot restores).
export function backupCurrentSave(storage) {
  for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
    const raw = storage.getItem(key);
    if (raw) {
      storage.setItem(BACKUP_SAVE_KEY, raw);
      return true;
    }
  }
  return false;
}

// Builds the JSON payload for an exported save file.
export function buildExportPayload(state, now = Date.now()) {
  return {
    schema: SAVE_SCHEMA,
    game: 'Neon Core',
    appVersion: APP_VERSION,
    exportedAt: new Date(now).toISOString(),
    savedAt: now,
    state
  };
}

// Removes the active save, legacy keys, and the import backup.
// Save slots are intentionally preserved — resetting active progress should
// never destroy deliberate manual backups.
export function clearActiveSave(storage) {
  for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS, BACKUP_SAVE_KEY]) {
    storage.removeItem(key);
  }
}

// ---------------------------------------------------------------------------
// Save slots (local, manual)
// ---------------------------------------------------------------------------

function emptySlots() {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

// Loads the slot list, tolerating missing or corrupted slot storage.
export function loadSlots(storage) {
  const raw = storage.getItem(SLOTS_KEY);
  if (!raw) return emptySlots();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptySlots();
  }

  const list = Array.isArray(parsed?.slots) ? parsed.slots : [];
  return emptySlots().map((empty, index) => {
    const slot = list[index];
    if (!slot || typeof slot !== 'object') return null;
    const payload = extractStatePayload(slot.save);
    if (!payload) return null;
    return {
      name: typeof slot.name === 'string' && slot.name.trim()
        ? slot.name.trim().slice(0, 40)
        : `Slot ${index + 1}`,
      createdAt: clampNumber(slot.createdAt, 0),
      updatedAt: clampNumber(slot.updatedAt, 0),
      save: { schema: SAVE_SCHEMA, savedAt: clampNumber(slot.save?.savedAt, 0), state: payload }
    };
  });
}

function persistSlots(storage, slots) {
  storage.setItem(SLOTS_KEY, JSON.stringify({ version: 1, slots }));
}

// Stores a snapshot of the given state into a slot. Returns the slot list.
export function writeSlot(storage, index, state, name, now = Date.now()) {
  const slots = loadSlots(storage);
  if (index < 0 || index >= SLOT_COUNT) return slots;
  const existing = slots[index];
  slots[index] = {
    name: (name ?? existing?.name ?? `Slot ${index + 1}`).slice(0, 40),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    save: { schema: SAVE_SCHEMA, savedAt: now, state: sanitizeState(state) }
  };
  persistSlots(storage, slots);
  return slots;
}

// Renames a slot without touching its save data.
export function renameSlot(storage, index, name, now = Date.now()) {
  const slots = loadSlots(storage);
  const slot = slots[index];
  if (!slot) return slots;
  const trimmed = String(name ?? '').trim();
  slot.name = (trimmed || `Slot ${index + 1}`).slice(0, 40);
  slot.updatedAt = now;
  persistSlots(storage, slots);
  return slots;
}

// Reads a sanitized state out of a slot, or null if the slot is empty.
export function readSlot(storage, index) {
  const slot = loadSlots(storage)[index];
  if (!slot) return null;
  return { state: sanitizeState(slot.save.state), savedAt: slot.save.savedAt, name: slot.name };
}

// Deletes a slot. Returns the slot list.
export function deleteSlot(storage, index) {
  const slots = loadSlots(storage);
  if (index >= 0 && index < SLOT_COUNT) slots[index] = null;
  persistSlots(storage, slots);
  return slots;
}

// Compact summary used by the slot UI.
export function slotSummary(slot) {
  if (!slot) return null;
  const state = slot.save.state;
  return {
    name: slot.name,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt,
    score: clampNumber(state.score, 0),
    bestScore: clampNumber(state.bestScore ?? state.score, 0),
    prestige: clampNumber(state.prestige, 0),
    horizons: clampNumber(state.horizons, 0),
    schema: slot.save.schema
  };
}

// ---------------------------------------------------------------------------
// Offline progress
// ---------------------------------------------------------------------------

// Seconds the player was away, capped by the state's offline cap (the
// Temporal Cache horizon upgrade can raise it).
export function offlineSeconds(state, savedAt, now = Date.now()) {
  if (!savedAt) return 0;
  return Math.min(offlineCapSeconds(state), Math.max(0, (now - savedAt) / 1000));
}

// Energy earned while away. Surge never applies to offline progress.
export function computeOfflineGain(state, savedAt, now = Date.now()) {
  const seconds = offlineSeconds(state, savedAt, now);
  return {
    seconds,
    gain: energyPerSecond(state, false, now) * seconds
  };
}
