// Achievement catalog. Every achievement grants a +2% global output bonus
// (see ACHIEVEMENT_BONUS). The original 15 ids are preserved so unlocks from
// older saves remain valid. Each check is a pure function of the state.

import { energyPerSecond } from '../core/calc.js';
import { distinctUpgradesOwned, totalUpgradeLevels } from '../core/state.js';

export const achievementCategories = [
  { id: 'clicks', name: 'Clicking' },
  { id: 'energy', name: 'Energy' },
  { id: 'crits', name: 'Critical Hits' },
  { id: 'passive', name: 'Passive Power' },
  { id: 'upgrades', name: 'Upgrades' },
  { id: 'surge', name: 'Neon Surge' },
  { id: 'prestige', name: 'Prestige' },
  { id: 'dedication', name: 'Dedication' }
];

export const achievementDefs = [
  // --- Clicking ---
  { id: 'firstClick', category: 'clicks', name: 'First Spark', desc: 'Click the core once.', check: s => s.totalClicks >= 1 },
  { id: 'clicker100', category: 'clicks', name: 'Button Masher', desc: 'Click 100 times.', check: s => s.totalClicks >= 100 },
  { id: 'clicker1000', category: 'clicks', name: 'Machine Hands', desc: 'Click 1,000 times.', check: s => s.totalClicks >= 1000 },
  { id: 'clicker5000', category: 'clicks', name: 'Carpal Reactor', desc: 'Click 5,000 times.', check: s => s.totalClicks >= 5000 },
  { id: 'clicker25000', category: 'clicks', name: 'One With The Core', desc: 'Click 25,000 times.', check: s => s.totalClicks >= 25000 },

  // --- Energy ---
  { id: 'hundredEnergy', category: 'energy', name: 'Ignition', desc: 'Reach 100 energy.', check: s => s.bestScore >= 100 },
  { id: 'thousandEnergy', category: 'energy', name: 'Stable Core', desc: 'Reach 1K energy.', check: s => s.bestScore >= 1000 },
  { id: 'tenK', category: 'energy', name: 'Neon Engine', desc: 'Reach 10K energy.', check: s => s.bestScore >= 10000 },
  { id: 'hundredK', category: 'energy', name: 'Reality Crack', desc: 'Reach 100K energy.', check: s => s.bestScore >= 100000 },
  { id: 'bestMillion', category: 'energy', name: 'Megacore', desc: 'Reach 1M energy.', check: s => s.bestScore >= 1e6 },
  { id: 'bestTenMillion', category: 'energy', name: 'Gigacore', desc: 'Reach 10M energy.', check: s => s.bestScore >= 1e7 },
  { id: 'bestHundredMillion', category: 'energy', name: 'Teracore', desc: 'Reach 100M energy.', check: s => s.bestScore >= 1e8 },
  { id: 'bestBillion', category: 'energy', name: 'Starheart', desc: 'Reach 1B energy.', check: s => s.bestScore >= 1e9 },
  { id: 'millionaire', category: 'energy', name: 'Millionaire Core', desc: 'Earn 1M total energy.', check: s => s.totalEarned >= 1e6 },
  { id: 'earnedHundredMillion', category: 'energy', name: 'Energy Tycoon', desc: 'Earn 100M total energy.', check: s => s.totalEarned >= 1e8 },
  { id: 'earnedBillion', category: 'energy', name: 'Galactic Grid', desc: 'Earn 1B total energy.', check: s => s.totalEarned >= 1e9 },

  // --- Critical Hits ---
  { id: 'crit100', category: 'crits', name: 'Lucky Streak', desc: 'Land 100 critical clicks.', check: s => s.totalCrits >= 100 },
  { id: 'crit2500', category: 'crits', name: 'Probability Engine', desc: 'Land 2,500 critical clicks.', check: s => s.totalCrits >= 2500 },
  { id: 'bigCrit10K', category: 'crits', name: 'Overload', desc: 'Land a single click worth 10K energy.', check: s => s.biggestClick >= 10000 },
  { id: 'bigCrit1M', category: 'crits', name: 'Critical Mass', desc: 'Land a single click worth 1M energy.', check: s => s.biggestClick >= 1e6 },

  // --- Passive Power ---
  { id: 'cps50', category: 'passive', name: 'Passive Income', desc: 'Reach 50 energy per second.', check: s => energyPerSecond(s, false) >= 50 },
  { id: 'cps500', category: 'passive', name: 'Power Plant', desc: 'Reach 500 energy per second.', check: s => energyPerSecond(s, false) >= 500 },
  { id: 'cps5000', category: 'passive', name: 'Fusion Grid', desc: 'Reach 5K energy per second.', check: s => energyPerSecond(s, false) >= 5000 },
  { id: 'cps50000', category: 'passive', name: 'Dyson Dream', desc: 'Reach 50K energy per second.', check: s => energyPerSecond(s, false) >= 50000 },
  { id: 'offlineMillion', category: 'passive', name: 'Night Shift', desc: 'Earn 1M total offline energy.', check: s => s.offlineEarnedTotal >= 1e6 },

  // --- Upgrades ---
  { id: 'upgrades25', category: 'upgrades', name: 'Shopping Spree', desc: 'Buy 25 total upgrades.', check: s => totalUpgradeLevels(s) >= 25 },
  { id: 'upgrades100', category: 'upgrades', name: 'Maxed Mindset', desc: 'Buy 100 total upgrades.', check: s => totalUpgradeLevels(s) >= 100 },
  { id: 'upgrades250', category: 'upgrades', name: 'Infrastructure', desc: 'Buy 250 total upgrades.', check: s => totalUpgradeLevels(s) >= 250 },
  { id: 'collector', category: 'upgrades', name: 'Collector', desc: 'Own at least one level of 10 different upgrades.', check: s => distinctUpgradesOwned(s) >= 10 },
  { id: 'critMaster', category: 'upgrades', name: 'Sharpened Odds', desc: 'Reach Critical Circuit level 20.', check: s => (s.upgrades.crit?.level || 0) >= 20 },
  { id: 'overclocker', category: 'upgrades', name: 'Redline', desc: 'Reach Overclock level 10.', check: s => (s.upgrades.mult?.level || 0) >= 10 },

  // --- Neon Surge ---
  { id: 'surgeUse', category: 'surge', name: 'Surge Master', desc: 'Activate Neon Surge.', check: s => s.surgesUsed >= 1 },
  { id: 'surge10', category: 'surge', name: 'Storm Rider', desc: 'Activate Neon Surge 10 times.', check: s => s.surgesUsed >= 10 },
  { id: 'surge50', category: 'surge', name: 'Living Lightning', desc: 'Activate Neon Surge 50 times.', check: s => s.surgesUsed >= 50 },
  { id: 'surgeTime10m', category: 'surge', name: 'Ride The Wave', desc: 'Spend 10 total minutes in Surge.', check: s => s.surgeTimeTotal >= 600 },
  { id: 'surgeExtend', category: 'surge', name: 'Momentum', desc: 'Extend a single Surge by 5 seconds of clicking.', check: s => s.surgeExtendedMs >= 5000 },

  // --- Prestige ---
  { id: 'firstPrestige', category: 'prestige', name: 'Singularity', desc: 'Collapse the core once.', check: s => s.prestigeTotal >= 1 },
  { id: 'threePrestige', category: 'prestige', name: 'Beyond Reality', desc: 'Reach 3 lifetime Singularities.', check: s => s.prestigeTotal >= 3 },
  { id: 'fivePrestige', category: 'prestige', name: 'Gravity Bender', desc: 'Reach 5 lifetime Singularities.', check: s => s.prestigeTotal >= 5 },
  { id: 'tenPrestige', category: 'prestige', name: 'Serial Collapser', desc: 'Reach 10 lifetime Singularities.', check: s => s.prestigeTotal >= 10 },
  { id: 'firstHorizon', category: 'prestige', name: 'Event Horizon', desc: 'Cross the Event Horizon once.', check: s => s.horizons >= 1 },
  { id: 'threeHorizon', category: 'prestige', name: 'Beyond The Veil', desc: 'Cross the Event Horizon 3 times.', check: s => s.horizons >= 3 },
  { id: 'shardCollector', category: 'prestige', name: 'Shard Collector', desc: 'Earn 10 lifetime Horizon Shards.', check: s => s.shardsEarnedTotal >= 10 },

  // --- Dedication ---
  { id: 'play1h', category: 'dedication', name: 'Reactor Technician', desc: 'Play for 1 hour total.', check: s => s.playSeconds >= 3600 },
  { id: 'play10h', category: 'dedication', name: 'Chief Engineer', desc: 'Play for 10 hours total.', check: s => s.playSeconds >= 36000 },
  { id: 'exporter', category: 'dedication', name: 'Backup Plan', desc: 'Export a save file.', check: s => s.exportsCount >= 1 },
  { id: 'importer', category: 'dedication', name: 'Time Traveler', desc: 'Import a save file.', check: s => s.importsCount >= 1 },
  { id: 'slotKeeper', category: 'dedication', name: 'Archivist', desc: 'Store a save in a slot.', check: s => s.slotSaves >= 1 },
  { id: 'restorer', category: 'dedication', name: 'Checkpoint', desc: 'Restore a save slot.', check: s => s.slotRestores >= 1 },
  { id: 'manualSaver', category: 'dedication', name: 'Trust Issues', desc: 'Save manually 10 times.', check: s => s.manualSaves >= 10 }
];

export function achievementById(id) {
  return achievementDefs.find(def => def.id === id);
}
