// Central configuration for Neon Core.
// Gameplay balance values here are intentionally identical to the original
// alpha build — change them only when fixing a confirmed defect.

export const APP_VERSION = 'v0.2.0-alpha.1';

// Persistence keys. The v3 key is the current schema; the legacy keys are
// read (and migrated) so progress from the original alpha is never lost.
export const SAVE_KEY = 'neonCoreSave_v3';
export const LEGACY_SAVE_KEYS = ['neonCoreSave_v2', 'neonCoreSave_v1'];
export const BACKUP_SAVE_KEY = 'neonCoreSave_backup';
export const SAVE_SCHEMA = 3;

// Prestige (Singularity)
export const PRESTIGE_REQ = 100000;
export const PRESTIGE_BONUS = 0.1;

// Neon Surge
export const SURGE_MAX = 100;
export const SURGE_DURATION = 20000;
export const SURGE_MULT = 2;
export const SURGE_CHARGE_PER_CLICK = 1.35;
export const SURGE_CHARGE_PASSIVE = 0.05;

// Critical clicks
export const CRIT_MULT = 3;
export const CRIT_CHANCE_PER_LEVEL = 0.03;
export const CRIT_CHANCE_CAP = 0.6;

// Multiplier sources
export const ACHIEVEMENT_BONUS = 0.02;
export const REACTOR_BONUS = 0.12;
export const OVERCLOCK_MULT = 1.35;

// Efficiency Matrix discount
export const EFFICIENCY_RATE = 0.97;
export const EFFICIENCY_FLOOR = 0.55;

// Persistence timing
export const OFFLINE_CAP_SECONDS = 7200;
export const AUTOSAVE_INTERVAL_SECONDS = 15;

// Safety valve for Buy Max purchase loops
export const BUY_MAX_LIMIT = 2500;
