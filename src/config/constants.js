// Central configuration for Neon Core.
// Balance values are documented in docs/BALANCE.md — keep both in sync.

export const APP_VERSION = 'v0.4.0-alpha.1';

// Persistence keys. The v4 key is the current schema; legacy keys are read
// (and migrated) so progress from earlier alphas is never lost.
export const SAVE_KEY = 'neonCoreSave_v4';
export const LEGACY_SAVE_KEYS = ['neonCoreSave_v3', 'neonCoreSave_v2', 'neonCoreSave_v1'];
export const BACKUP_SAVE_KEY = 'neonCoreSave_backup';
export const SLOTS_KEY = 'neonCoreSlots_v1';
export const SAVE_SCHEMA = 4;
export const SLOT_COUNT = 3;

// Prestige layer 1: Singularity.
// First collapse needs PRESTIGE_BASE_REQ; each further collapse multiplies
// the requirement by PRESTIGE_REQ_GROWTH. Each Singularity grants a
// permanent additive PRESTIGE_BONUS to the global multiplier.
export const PRESTIGE_BASE_REQ = 500000;
export const PRESTIGE_REQ_GROWTH = 3;
export const PRESTIGE_BONUS = 0.25;

// Prestige layer 2: Event Horizon.
// Unlocks at HORIZON_MIN_PRESTIGE Singularities; collapsing converts
// Singularities into Horizon Shards (1 per Singularity beyond
// HORIZON_MIN_PRESTIGE - 1) and resets the Singularity layer.
export const HORIZON_MIN_PRESTIGE = 5;
export const HORIZON_TEASE_PRESTIGE = 3;

// Neon Surge.
export const SURGE_MAX = 100;
export const SURGE_BASE_DURATION = 20000;
export const SURGE_BASE_MULT = 2;
export const SURGE_CHARGE_PER_CLICK = 1.0;
export const SURGE_CHARGE_PASSIVE = 0.2;
// Clicking during a Surge sustains it: each click extends the timer, up to
// a cap of half the full duration in total extensions.
export const SURGE_EXTEND_PER_CLICK = 100;
export const SURGE_EXTEND_CAP_RATIO = 0.5;

// Critical clicks.
export const CRIT_BASE_MULT = 3;
export const CRIT_CHANCE_PER_LEVEL = 0.03;
export const CRIT_CHANCE_CAP = 0.6;

// Multiplier sources.
export const ACHIEVEMENT_BONUS = 0.02;
export const REACTOR_BONUS = 0.12;
export const OVERCLOCK_MULT = 1.35;
export const TACHYON_BONUS = 0.3;

// Per-level upgrade effects.
export const CRITPOWER_PER_LEVEL = 0.5;
export const SURGECELL_RATE_PER_LEVEL = 0.12;
export const SURGECORE_MULT_PER_LEVEL = 0.25;
export const SURGECORE_DURATION_PER_LEVEL = 1000;
export const INDUCTION_PER_LEVEL = 0.02;

// Efficiency Matrix discount.
export const EFFICIENCY_RATE = 0.97;
export const EFFICIENCY_FLOOR = 0.55;

// Event Horizon upgrade effects (per rank).
export const LENS_BONUS = 0.5;
export const GRAVITY_DISCOUNT = 0.25;
export const CACHE_OFFLINE_BONUS_SECONDS = 7200;
export const STARSEED_LEVELS = 5;
export const CHRONO_RATE_BONUS = 0.3;
export const CHRONO_DURATION_BONUS = 3000;

// Persistence timing.
export const OFFLINE_BASE_CAP_SECONDS = 7200;
export const AUTOSAVE_INTERVAL_SECONDS = 15;

// Safety valve for Buy Max purchase loops.
export const BUY_MAX_LIMIT = 2500;

// Default audio volume (0..1).
export const DEFAULT_VOLUME = 0.7;
