// Achievement catalog. Conditions are unchanged from the original alpha
// build. Each check is a pure function of the state object.

import { energyPerSecond } from '../core/calc.js';
import { totalUpgradeLevels } from '../core/state.js';

export const achievementDefs = [
  { id: 'firstClick', name: 'First Spark', desc: 'Click the core once.', check: state => state.totalClicks >= 1 },
  { id: 'hundredEnergy', name: 'Ignition', desc: 'Reach 100 energy.', check: state => state.bestScore >= 100 },
  { id: 'thousandEnergy', name: 'Stable Core', desc: 'Reach 1K energy.', check: state => state.bestScore >= 1000 },
  { id: 'tenK', name: 'Neon Engine', desc: 'Reach 10K energy.', check: state => state.bestScore >= 10000 },
  { id: 'hundredK', name: 'Reality Crack', desc: 'Reach 100K energy.', check: state => state.bestScore >= 100000 },
  { id: 'clicker100', name: 'Button Masher', desc: 'Click 100 times.', check: state => state.totalClicks >= 100 },
  { id: 'clicker1000', name: 'Machine Hands', desc: 'Click 1,000 times.', check: state => state.totalClicks >= 1000 },
  { id: 'cps50', name: 'Passive Income', desc: 'Reach 50 energy per second.', check: state => energyPerSecond(state, false) >= 50 },
  { id: 'cps500', name: 'Power Plant', desc: 'Reach 500 energy per second.', check: state => energyPerSecond(state, false) >= 500 },
  { id: 'upgrades25', name: 'Shopping Spree', desc: 'Buy 25 total upgrades.', check: state => totalUpgradeLevels(state) >= 25 },
  { id: 'upgrades100', name: 'Maxed Mindset', desc: 'Buy 100 total upgrades.', check: state => totalUpgradeLevels(state) >= 100 },
  { id: 'firstPrestige', name: 'Singularity', desc: 'Collapse the core once.', check: state => state.prestige >= 1 },
  { id: 'threePrestige', name: 'Beyond Reality', desc: 'Reach 3 singularities.', check: state => state.prestige >= 3 },
  { id: 'surgeUse', name: 'Surge Master', desc: 'Activate Neon Surge.', check: state => state.surgesUsed >= 1 },
  { id: 'millionaire', name: 'Millionaire Core', desc: 'Earn 1M total energy.', check: state => state.totalEarned >= 1000000 }
];
