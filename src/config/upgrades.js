// Upgrade catalog. Costs, growth rates, and effects are unchanged from the
// original alpha build; only display copy may be adjusted.

export const upgradeDefs = [
  {
    id: 'power',
    name: 'Click Amplifier',
    short: 'Click',
    desc: '+1 base energy per click.',
    baseCost: 10,
    growth: 1.16,
    icon: '⚡'
  },
  {
    id: 'auto',
    name: 'Auto Generator',
    short: 'Auto',
    desc: '+1 base energy per second.',
    baseCost: 50,
    growth: 1.18,
    icon: '🔋'
  },
  {
    id: 'drone',
    name: 'Nano Swarm',
    short: 'Swarm',
    desc: '+8 base energy per second.',
    baseCost: 275,
    growth: 1.2,
    icon: '🛸'
  },
  {
    id: 'crit',
    name: 'Critical Circuit',
    short: 'Crit',
    desc: '+3% critical click chance per level.',
    baseCost: 180,
    growth: 1.28,
    icon: '✦'
  },
  {
    id: 'reactor',
    name: 'Pulse Reactor',
    short: 'Pulse',
    desc: '+12% global output per level.',
    baseCost: 650,
    growth: 1.3,
    icon: '◎'
  },
  {
    id: 'efficiency',
    name: 'Efficiency Matrix',
    short: 'Save',
    desc: 'Lowers future upgrade costs by 3% per level.',
    baseCost: 1200,
    growth: 1.42,
    icon: '◇'
  },
  {
    id: 'mult',
    name: 'Overclock',
    short: 'Boost',
    desc: 'Stacks a x1.35 global multiplier.',
    baseCost: 2500,
    growth: 1.5,
    icon: '⨯'
  }
];
