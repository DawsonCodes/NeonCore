// Versioned save system: serialization, validation, migration from legacy
// alpha saves, import/export payloads, and offline progress.
//
// Storage is injected (any object with getItem/setItem/removeItem) so the
// whole module can be unit tested in Node without a browser.

import {
  APP_VERSION,
  BACKUP_SAVE_KEY,
  LEGACY_SAVE_KEYS,
  OFFLINE_CAP_SECONDS,
  SAVE_KEY,
  SAVE_SCHEMA,
  SURGE_MAX
} from '../config/constants.js';
import { achievementDefs } from '../config/achievements.js';
import { milestoneDefs } from '../config/milestones.js';
import { upgradeDefs } from '../config/upgrades.js';
import { energyPerSecond } from '../core/calc.js';
import { createInitialState } from '../core/state.js';
import { clampNumber } from '../utils/format.js';

const KNOWN_ACHIEVEMENTS = new Set(achievementDefs.map(def => def.id));
const KNOWN_MILESTONES = new Set(milestoneDefs.map(def => def.threshold));

// Returns true when an object looks like a usable state payload. Legacy alpha
// saves and exports always stored `score` as a plain number.
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
// Supports the current wrapped schema and legacy flat alpha saves/exports.
export function extractStatePayload(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (isStatePayload(parsed.state)) return parsed.state;
  if (isStatePayload(parsed)) return parsed;
  return null;
}

// Builds a complete, safe state object from an untrusted payload. Unknown
// fields are dropped, numbers are clamped, and lists are filtered to known
// achievement ids and milestone thresholds.
export function sanitizeState(data) {
  const state = createInitialState();
  if (!data || typeof data !== 'object') return state;

  state.score = clampNumber(data.score, 0);
  state.bestScore = clampNumber(data.bestScore ?? data.score, 0);
  state.totalEarned = clampNumber(data.totalEarned, 0);
  state.totalSpent = clampNumber(data.totalSpent, 0);
  state.totalClicks = clampNumber(data.totalClicks, 0);
  state.playSeconds = clampNumber(data.playSeconds, 0);
  state.prestige = clampNumber(data.prestige, 0);
  state.muted = Boolean(data.muted);
  state.theme = data.theme === 'light' ? 'light' : 'dark';
  state.buyMode = data.buyMode === 'max' ? 'max' : 'one';
  state.reducedMotion = Boolean(data.reducedMotion);
  state.surgeCharge = clampNumber(data.surgeCharge, 0, SURGE_MAX);
  state.surgeEndsAt = clampNumber(data.surgeEndsAt, 0);
  state.surgesUsed = clampNumber(data.surgesUsed, 0);
  state.lastSavedAt = clampNumber(data.lastSavedAt ?? data.savedAt, 0) || Date.now();

  state.unlockedAchievements = Array.isArray(data.unlockedAchievements)
    ? [...new Set(data.unlockedAchievements.filter(id => KNOWN_ACHIEVEMENTS.has(id)))]
    : [];
  state.reachedMilestones = Array.isArray(data.reachedMilestones)
    ? [...new Set(data.reachedMilestones.filter(threshold => KNOWN_MILESTONES.has(threshold)))]
    : [];

  for (const def of upgradeDefs) {
    const loadedLevel = data.upgrades?.[def.id]?.level;
    state.upgrades[def.id].level = Math.max(0, Math.floor(Number(loadedLevel) || 0));
  }

  return state;
}

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
// the legacy alpha keys. Returns { state, savedAt, source } or null.
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

// Validates raw import text (or a parsed object) from an exported save file.
// Accepts current exports and legacy alpha exports. Returns either
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

// Copies the current stored save into a backup slot before an import
// overwrites it, so a bad import can never destroy real progress.
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

// Removes every stored save, including legacy keys and the import backup.
export function clearAllSaves(storage) {
  for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS, BACKUP_SAVE_KEY]) {
    storage.removeItem(key);
  }
}

// Seconds the player was away, capped at the offline-progress limit.
export function offlineSeconds(savedAt, now = Date.now()) {
  if (!savedAt) return 0;
  return Math.min(OFFLINE_CAP_SECONDS, Math.max(0, (now - savedAt) / 1000));
}

// Energy earned while away. Surge never applies to offline progress.
export function computeOfflineGain(state, savedAt, now = Date.now()) {
  const seconds = offlineSeconds(savedAt, now);
  return {
    seconds,
    gain: energyPerSecond(state, false, now) * seconds
  };
}
