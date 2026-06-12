// Event Horizon: the second prestige layer.
//
// Collapsing the Event Horizon resets the Singularity layer (energy,
// upgrades, and Singularity count) and converts Singularities into Horizon
// Shards — a rare permanent currency spent on the upgrades below.
// Shards and shard upgrades survive every reset except a full manual reset.
//
// Each upgrade is bought in ranks; rank N costs N shards.

export const horizonUpgradeDefs = [
  {
    id: 'eventlens',
    name: 'Event Lens',
    desc: '+50% global output per rank.',
    maxRank: 5,
    icon: '◉'
  },
  {
    id: 'starseed',
    name: 'Star Seed',
    desc: 'Start every Singularity with 5 free levels of Click Amplifier and Auto Generator per rank.',
    maxRank: 2,
    icon: '✶'
  },
  {
    id: 'gravitywell',
    name: 'Gravity Well',
    desc: 'Singularity requirements are 25% lower per rank.',
    maxRank: 3,
    icon: '⌾'
  },
  {
    id: 'chronoflux',
    name: 'Chrono Flux',
    desc: 'Surge charges 30% faster and lasts +3s per rank.',
    maxRank: 3,
    icon: '⧖'
  },
  {
    id: 'temporalcache',
    name: 'Temporal Cache',
    desc: 'Offline progress cap +2 hours per rank.',
    maxRank: 3,
    icon: '⏣'
  }
];

export function horizonUpgradeById(id) {
  return horizonUpgradeDefs.find(def => def.id === id);
}

// Cost of the next rank for an upgrade currently at `rank`.
export function horizonRankCost(rank) {
  return rank + 1;
}
