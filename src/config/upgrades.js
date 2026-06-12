// Upgrade catalog, organized into categories that unlock gradually.
// The seven original ids (power, auto, drone, crit, reactor, efficiency,
// mult) are preserved so old saves keep their levels.
//
// `unlock(state)` decides visibility; `hint` explains a locked upgrade.
// Balance values are documented in docs/BALANCE.md.

export const upgradeCategories = [
  { id: 'core', name: 'Core Output' },
  { id: 'passive', name: 'Passive Systems' },
  { id: 'surge', name: 'Neon Surge' },
  { id: 'economy', name: 'Economy' },
  { id: 'singularity', name: 'Singularity Tech' }
];

export const upgradeDefs = [
  // --- Core Output ---
  {
    id: 'power',
    category: 'core',
    name: 'Click Amplifier',
    short: 'Click',
    desc: '+1 base energy per click.',
    baseCost: 10,
    growth: 1.18,
    icon: '⚡',
    unlock: () => true
  },
  {
    id: 'crit',
    category: 'core',
    name: 'Critical Circuit',
    short: 'Crit',
    desc: '+3% critical click chance per level.',
    baseCost: 180,
    growth: 1.28,
    icon: '✦',
    unlock: () => true
  },
  {
    id: 'critpower',
    category: 'core',
    name: 'Overcrit Capacitor',
    short: 'Overcrit',
    desc: 'Critical clicks hit +0.5x harder per level.',
    baseCost: 2000,
    growth: 1.6,
    icon: '✸',
    unlock: state => (state.upgrades.crit?.level || 0) >= 3,
    hint: 'Reach Critical Circuit level 3'
  },
  {
    id: 'induction',
    category: 'core',
    name: 'Induction Coil',
    short: 'Induction',
    desc: 'Clicks also gain 2% of your passive output per level.',
    baseCost: 5000,
    growth: 1.6,
    icon: '∿',
    unlock: state => (state.upgrades.auto?.level || 0) + (state.upgrades.drone?.level || 0) >= 10,
    hint: 'Own 10 combined Auto Generator and Nano Swarm levels'
  },

  // --- Passive Systems ---
  {
    id: 'auto',
    category: 'passive',
    name: 'Auto Generator',
    short: 'Auto',
    desc: '+1 base energy per second.',
    baseCost: 50,
    growth: 1.17,
    icon: '🔋',
    unlock: () => true
  },
  {
    id: 'drone',
    category: 'passive',
    name: 'Nano Swarm',
    short: 'Swarm',
    desc: '+8 base energy per second.',
    baseCost: 275,
    growth: 1.19,
    icon: '🛸',
    unlock: state => state.bestScore >= 150,
    hint: 'Reach 150 best energy'
  },
  {
    id: 'fusion',
    category: 'passive',
    name: 'Fusion Lattice',
    short: 'Fusion',
    desc: '+60 base energy per second.',
    baseCost: 30000,
    growth: 1.22,
    icon: '✺',
    unlock: state => state.bestScore >= 20000,
    hint: 'Reach 20K best energy'
  },
  {
    id: 'antimatter',
    category: 'passive',
    name: 'Antimatter Loop',
    short: 'Antimatter',
    desc: '+250 base energy per second.',
    baseCost: 250000,
    growth: 1.3,
    icon: '∞',
    unlock: state => state.prestige >= 1,
    hint: 'Reach your first Singularity'
  },

  // --- Neon Surge ---
  {
    id: 'surgecell',
    category: 'surge',
    name: 'Surge Capacitor',
    short: 'Capacitor',
    desc: 'Surge charges 12% faster per level.',
    baseCost: 1500,
    growth: 1.35,
    icon: '▲',
    unlock: state => state.surgesUsed >= 1,
    hint: 'Activate Neon Surge once'
  },
  {
    id: 'surgecore',
    category: 'surge',
    name: 'Surge Reactor',
    short: 'Surge+',
    desc: 'Surge is +0.25x stronger and lasts +1s per level.',
    baseCost: 12000,
    growth: 1.6,
    icon: '◭',
    unlock: state => state.surgesUsed >= 3,
    hint: 'Activate Neon Surge 3 times'
  },

  // --- Economy ---
  {
    id: 'reactor',
    category: 'economy',
    name: 'Pulse Reactor',
    short: 'Pulse',
    desc: '+12% global output per level.',
    baseCost: 650,
    growth: 1.28,
    icon: '◎',
    unlock: state => state.bestScore >= 400,
    hint: 'Reach 400 best energy'
  },
  {
    id: 'efficiency',
    category: 'economy',
    name: 'Efficiency Matrix',
    short: 'Save',
    desc: 'Lowers future upgrade costs by 3% per level.',
    baseCost: 1200,
    growth: 1.4,
    icon: '◇',
    unlock: state => state.bestScore >= 800,
    hint: 'Reach 800 best energy'
  },
  {
    id: 'mult',
    category: 'economy',
    name: 'Overclock',
    short: 'Boost',
    desc: 'Stacks a x1.35 global multiplier.',
    baseCost: 2500,
    growth: 1.55,
    icon: '⨯',
    unlock: state => state.bestScore >= 1500,
    hint: 'Reach 1.5K best energy'
  },

  // --- Singularity Tech ---
  {
    id: 'tachyon',
    category: 'singularity',
    name: 'Tachyon Injector',
    short: 'Tachyon',
    desc: '+30% global output per level.',
    baseCost: 120000,
    growth: 1.7,
    icon: '➤',
    unlock: state => state.prestige >= 1,
    hint: 'Reach your first Singularity'
  }
];

export function upgradeById(id) {
  return upgradeDefs.find(def => def.id === id);
}
