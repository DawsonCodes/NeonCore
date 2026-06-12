// UI rendering. Card structure is rebuilt only when unlock states change;
// per-frame updates touch existing nodes through a text cache so the DOM is
// only written when a value actually changes.

import { SURGE_MAX } from '../config/constants.js';
import { upgradeCategories, upgradeDefs } from '../config/upgrades.js';
import { achievementCategories, achievementDefs, achievementById } from '../config/achievements.js';
import { horizonUpgradeDefs, horizonRankCost } from '../config/horizon.js';
import * as calc from '../core/calc.js';
import { totalUpgradeLevels } from '../core/state.js';
import { fmt, fmtTime } from '../utils/format.js';
import { el } from './dom.js';

const textCache = new Map();

function setText(node, value) {
  if (textCache.get(node) !== value) {
    textCache.set(node, value);
    node.textContent = value;
  }
}

function setWidth(node, value) {
  const key = `w:${value}`;
  if (textCache.get(node) !== key) {
    textCache.set(node, key);
    node.style.width = value;
  }
}

// ---------------------------------------------------------------------------
// Upgrades (grouped, tiered, with locked hints)
// ---------------------------------------------------------------------------

let upgradeSignature = '';

function upgradeCardHTML(def, isNew) {
  return `
    <article class="upgrade${isNew ? ' is-new' : ''}" data-upgrade="${def.id}">
      <div class="upg-top">
        <div class="upg-icon" aria-hidden="true">${def.icon}</div>
        <div class="upg-copy">
          <h3 class="upg-name">${def.name}${isNew ? ' <span class="new-badge">NEW</span>' : ''}</h3>
          <p class="upg-desc">${def.desc}</p>
        </div>
      </div>
      <div class="upg-meta">
        <span class="upg-level" id="${def.id}Level">Lv 0</span>
        <span class="upg-effect" id="${def.id}Effect">Ready</span>
      </div>
      <button class="buy-btn" type="button" data-buy="${def.id}" aria-label="Buy ${def.name}">
        <span class="buy-label">Buy</span>
        <span class="buy-cost" id="${def.id}Cost">0</span>
      </button>
      <div class="afford-track" aria-hidden="true"><div class="afford-bar" id="${def.id}Afford"></div></div>
    </article>
  `;
}

function lockedCardHTML(def) {
  return `
    <article class="upgrade upgrade-locked" data-locked="${def.id}">
      <div class="upg-top">
        <div class="upg-icon" aria-hidden="true">🔒</div>
        <div class="upg-copy">
          <h3 class="upg-name">${def.name}</h3>
          <p class="upg-desc">Locked — ${def.hint || 'keep progressing to unlock'}.</p>
        </div>
      </div>
    </article>
  `;
}

const categoryTeasers = {
  surge: 'Activate Neon Surge once to unlock Surge technology.',
  singularity: 'Reach your first Singularity to unlock Singularity technology.'
};

// Rebuilds the grouped upgrade list. Called when unlock states change.
export function renderUpgrades(state) {
  const sections = upgradeCategories.map(category => {
    const defs = upgradeDefs.filter(def => def.category === category.id);
    const unlocked = defs.filter(def => calc.isUpgradeUnlocked(state, def));
    const locked = defs.filter(def => !calc.isUpgradeUnlocked(state, def));

    if (unlocked.length === 0) {
      const teaser = categoryTeasers[category.id];
      if (!teaser) return '';
      return `
        <section class="upgrade-group">
          <h3 class="upgrade-group-title">${category.name}</h3>
          <p class="upgrade-teaser">🔒 ${teaser}</p>
        </section>
      `;
    }

    const cards = [
      ...unlocked.map(def => upgradeCardHTML(def, !state.seenUpgrades.includes(def.id))),
      ...locked.map(def => lockedCardHTML(def))
    ].join('');

    return `
      <section class="upgrade-group">
        <h3 class="upgrade-group-title">${category.name}</h3>
        <div class="upgrade-grid">${cards}</div>
      </section>
    `;
  });

  el.upgradeGrid.innerHTML = sections.join('');
}

// Detects unlock changes; rebuilds the structure when needed and returns the
// list of ids that just became visible for the first time.
export function syncUpgradeStructure(state) {
  const unlockedIds = upgradeDefs.filter(def => calc.isUpgradeUnlocked(state, def)).map(def => def.id);
  const signature = unlockedIds.join(',');
  if (signature === upgradeSignature) return [];
  upgradeSignature = signature;

  const fresh = unlockedIds.filter(id => !state.seenUpgrades.includes(id));
  renderUpgrades(state);
  return fresh;
}

// Marks newly unlocked upgrades as seen (clears the NEW badge next rebuild).
export function markUpgradesSeen(state, ids) {
  for (const id of ids) {
    if (!state.seenUpgrades.includes(id)) state.seenUpgrades.push(id);
  }
}

// Shows a short current-effect summary for each upgrade card.
function effectText(state, id) {
  const effects = {
    power: `Base click ${fmt(calc.baseClickPower(state))}`,
    crit: `${Math.round(calc.criticalChance(state) * 100)}% crit chance`,
    critpower: `x${calc.criticalMult(state).toFixed(1)} crit hits`,
    induction: `+${fmt(calc.level(state, 'induction') * 0.02 * calc.basePassive(state))}/click from passive`,
    auto: `${fmt(calc.level(state, 'auto'))} base/sec`,
    drone: `${fmt(calc.level(state, 'drone') * 8)} swarm/sec`,
    fusion: `${fmt(calc.level(state, 'fusion') * 60)} lattice/sec`,
    antimatter: `${fmt(calc.level(state, 'antimatter') * 250)} loop/sec`,
    surgecell: `x${calc.surgeChargeRate(state).toFixed(2)} charge rate`,
    surgecore: `x${(2 + calc.level(state, 'surgecore') * 0.25).toFixed(2)} for ${(calc.surgeDuration(state) / 1000).toFixed(0)}s`,
    reactor: `x${calc.reactorMult(state).toFixed(2)} output`,
    efficiency: `${Math.round((1 - calc.costDiscountMult(state)) * 100)}% cheaper`,
    mult: `x${calc.overclockMult(state).toFixed(2)} output`,
    tachyon: `x${calc.tachyonMult(state).toFixed(2)} output`
  };
  return effects[id] || 'Ready';
}

// Updates upgrade prices, levels, effect text, and affordability state.
function updateUpgradeCards(state) {
  for (const def of upgradeDefs) {
    const costEl = document.getElementById(`${def.id}Cost`);
    if (!costEl) continue; // locked or teased — no live card

    const cost = calc.costFor(state, def.id);
    const card = document.querySelector(`[data-upgrade="${def.id}"]`);
    const btn = document.querySelector(`[data-buy="${def.id}"]`);
    const levelEl = document.getElementById(`${def.id}Level`);
    const effectEl = document.getElementById(`${def.id}Effect`);
    const affordEl = document.getElementById(`${def.id}Afford`);

    const affordable = state.score >= cost;
    setText(costEl, fmt(cost));
    setText(levelEl, `Lv ${calc.level(state, def.id)}`);
    setText(effectEl, effectText(state, def.id));
    btn.disabled = !affordable;
    card.classList.toggle('can-buy', affordable);
    if (affordEl) {
      setWidth(affordEl, `${Math.min(100, Math.floor((state.score / cost) * 100))}%`);
    }
  }
}

// ---------------------------------------------------------------------------
// Achievements (grouped + collapsible preview)
// ---------------------------------------------------------------------------

export function renderAchievements() {
  el.achievementGrid.innerHTML = achievementCategories.map(category => {
    const defs = achievementDefs.filter(def => def.category === category.id);
    if (defs.length === 0) return '';
    const cards = defs.map(achievement => `
      <article id="achievement-${achievement.id}" class="achievement locked">
        <span class="achievement-icon" aria-hidden="true">★</span>
        <div>
          <h3>${achievement.name}</h3>
          <p>${achievement.desc}</p>
          <span class="achievement-state visually-hidden">Locked</span>
        </div>
      </article>
    `).join('');
    return `
      <section class="achievement-group">
        <h3 class="achievement-group-title">${category.name}</h3>
        <div class="achievement-grid">${cards}</div>
      </section>
    `;
  }).join('');
}

// Updates achievement card styles, the unlocked count, and the collapsed
// preview line.
export function updateAchievements(state) {
  const unlocked = new Set(state.unlockedAchievements);

  for (const achievement of achievementDefs) {
    const isUnlocked = unlocked.has(achievement.id);
    const card = document.getElementById(`achievement-${achievement.id}`);
    if (!card) continue;
    card.classList.toggle('locked', !isUnlocked);
    card.classList.toggle('unlocked', isUnlocked);
    const stateEl = card.querySelector('.achievement-state');
    if (stateEl) setText(stateEl, isUnlocked ? 'Unlocked' : 'Locked');
  }

  setText(el.achievementCount, `${state.unlockedAchievements.length}/${achievementDefs.length} unlocked`);

  const recent = state.unlockedAchievements.slice(-2)
    .map(id => achievementById(id)?.name)
    .filter(Boolean);
  setText(
    el.achievementPreview,
    recent.length ? `Recent: ${recent.join(', ')}` : 'No achievements unlocked yet.'
  );
}

export function setAchievementsExpanded(expanded) {
  el.achievementToggle.setAttribute('aria-expanded', String(expanded));
  el.achievementBody.hidden = !expanded;
  el.achievementToggle.classList.toggle('is-open', expanded);
}

export function achievementsExpanded() {
  return el.achievementToggle.getAttribute('aria-expanded') === 'true';
}

// ---------------------------------------------------------------------------
// Event Horizon
// ---------------------------------------------------------------------------

let horizonSignature = '';

function horizonShopHTML(state) {
  return `
    <h3 class="upgrade-group-title">Shard upgrades</h3>
    <div class="horizon-shop-grid">
      ${horizonUpgradeDefs.map(def => {
        const rank = calc.horizonRank(state, def.id);
        const maxed = rank >= def.maxRank;
        const cost = horizonRankCost(rank);
        const affordable = !maxed && state.shards >= cost;
        const pips = Array.from({ length: def.maxRank }, (_, i) =>
          `<span class="rank-pip${i < rank ? ' filled' : ''}" aria-hidden="true"></span>`).join('');
        return `
          <article class="horizon-upgrade${maxed ? ' maxed' : ''}">
            <div class="upg-top">
              <div class="upg-icon" aria-hidden="true">${def.icon}</div>
              <div class="upg-copy">
                <h4 class="upg-name">${def.name}</h4>
                <p class="upg-desc">${def.desc}</p>
              </div>
            </div>
            <div class="horizon-upgrade-foot">
              <span class="rank-pips" role="img" aria-label="Rank ${rank} of ${def.maxRank}">${pips}</span>
              <button class="buy-btn horizon-buy" type="button" data-horizon-buy="${def.id}"
                ${affordable ? '' : 'disabled'} aria-label="Buy ${def.name} rank ${rank + 1}">
                ${maxed ? 'MAX' : `${cost}◆`}
              </button>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

// Rebuilds the Horizon shop when shards or ranks change.
export function updateHorizon(state) {
  const teasing = state.prestigeTotal >= 3 || state.prestige >= 3;
  const unlockedEver = state.horizons > 0 || state.shards > 0 ||
    Object.values(state.horizonUpgrades).some(u => u.rank > 0);
  const visible = teasing || unlockedEver || calc.canHorizon(state);
  el.horizonModule.hidden = !visible;
  if (!visible) return;

  const ready = calc.canHorizon(state);
  const gain = calc.horizonShardGain(state);

  setText(el.shardCount, fmt(state.shards));
  setText(el.horizonCount, fmt(state.horizons));
  el.horizonBtn.disabled = !ready;
  setText(
    el.horizonStatus,
    ready ? `Cross the Horizon (+${fmt(gain)} shard${gain === 1 ? '' : 's'})` : `Reach 5 Singularities (${state.prestige}/5)`
  );
  setText(el.horizonBadge, ready ? 'READY' : state.horizons > 0 ? 'CHARGED' : 'DORMANT');
  el.horizonBadge.classList.toggle('is-ready', ready);
  el.horizonBtn.classList.toggle('is-ready', ready);

  const showShop = unlockedEver || ready;
  const signature = showShop
    ? `${state.shards}|${horizonUpgradeDefs.map(def => calc.horizonRank(state, def.id)).join(',')}`
    : 'hidden';
  if (signature !== horizonSignature) {
    horizonSignature = signature;
    el.horizonShop.innerHTML = showShop ? horizonShopHTML(state) : '';
  }
}

// ---------------------------------------------------------------------------
// Theme / buy mode / live display
// ---------------------------------------------------------------------------

export function applyTheme(state) {
  document.documentElement.setAttribute('data-theme', state.theme);
  setText(el.themeBtnIcon, state.theme === 'dark' ? '☾' : '☀');
  el.themeBtn.setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  for (const radio of el.themeRadios) {
    radio.checked = radio.value === state.theme;
  }
}

export function updateBuyMode(state) {
  const isOne = state.buyMode === 'one';
  el.buyOneBtn.classList.toggle('is-active', isOne);
  el.buyMaxBtn.classList.toggle('is-active', !isOne);
  el.buyOneBtn.setAttribute('aria-pressed', String(isOne));
  el.buyMaxBtn.setAttribute('aria-pressed', String(!isOne));
}

function lastSavedLabel(state, now) {
  const seconds = Math.max(0, Math.floor((now - state.lastSavedAt) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${fmtTime(seconds)} ago`;
}

// Pushes the current state values onto the page. Runs every frame.
export function updateDisplay(state, sessionStartAt, now = Date.now()) {
  const requirement = calc.prestigeRequirement(state);
  const progress = Math.min(100, state.score / requirement * 100);
  const activeSurge = calc.isSurgeActive(state, now);
  const surgeLeft = Math.max(0, Math.ceil((state.surgeEndsAt - now) / 1000));
  const surgeReady = state.surgeCharge >= SURGE_MAX;
  const surgeMultNow = (2 + calc.level(state, 'surgecore') * 0.25).toFixed(2).replace(/\.00$/, '');

  setText(el.score, fmt(state.score));
  setText(el.cps, `${fmt(calc.energyPerSecond(state, true, now))}/s`);
  setText(el.perClick, `+${fmt(calc.clickPower(state, true, now))}`);
  setText(el.multiplier, `x${calc.globalMult(state, true, now).toFixed(2)}`);
  setText(el.critChance, `${Math.round(calc.criticalChance(state) * 100)}%`);

  setWidth(el.prestigeProgress, `${progress}%`);
  setText(el.prestigeProgressText, `${Math.floor(progress)}% to Singularity`);
  el.prestigeProgressShell.setAttribute('aria-valuenow', String(Math.floor(progress)));

  // Surge chip + module
  setText(el.surgeChip, activeSurge ? `${surgeLeft}s` : surgeReady ? 'READY' : `${Math.floor(state.surgeCharge)}%`);
  el.surgeChipWrap.classList.toggle('is-active', activeSurge);
  el.surgeChipWrap.classList.toggle('is-ready', !activeSurge && surgeReady);

  const chargePct = activeSurge
    ? Math.max(0, Math.min(100, ((state.surgeEndsAt - now) / calc.surgeDuration(state)) * 100))
    : state.surgeCharge;
  setWidth(el.surgeCharge, `${chargePct}%`);
  el.surgeChargeShell.setAttribute('aria-valuenow', String(Math.floor(activeSurge ? chargePct : state.surgeCharge)));
  el.surgeBtn.disabled = !surgeReady || activeSurge;
  setText(el.surgeBtn, activeSurge ? `${surgeLeft}s remaining` : surgeReady ? 'Activate Surge' : 'Charging…');
  setText(el.surgeBadge, activeSurge ? 'ACTIVE' : surgeReady ? 'READY' : 'CHARGING');
  el.surgeBadge.classList.toggle('is-active', activeSurge);
  el.surgeBadge.classList.toggle('is-ready', !activeSurge && surgeReady);
  setText(
    el.surgeText,
    activeSurge
      ? `Output x${surgeMultNow}. Keep clicking to extend the surge!`
      : surgeReady
        ? `Charge complete. Activate to multiply all output by ${surgeMultNow} for ${(calc.surgeDuration(state) / 1000).toFixed(0)}s.`
        : `Charge ${Math.floor(state.surgeCharge)}% — click the core to fill it.`
  );

  // Singularity module
  const ready = calc.canPrestige(state);
  el.prestigeBtn.disabled = !ready;
  setText(el.prestigeStatus, ready ? 'Collapse the core' : `Need ${fmt(Math.max(0, requirement - state.score))} more`);
  setText(el.prestigeBadge, ready ? 'READY' : 'LOCKED');
  el.prestigeBadge.classList.toggle('is-ready', ready);
  el.prestigeBtn.classList.toggle('is-ready', ready);
  setText(el.prestigeCount, fmt(state.prestige));
  setText(el.prestigeBonus, `x${calc.prestigeMult(state).toFixed(2)}`);

  updateHorizon(state);

  // Stats
  setText(el.totalClicks, fmt(state.totalClicks));
  setText(el.totalCrits, fmt(state.totalCrits));
  setText(el.biggestClick, fmt(state.biggestClick));
  setText(el.bestScore, fmt(state.bestScore));
  setText(el.totalEarned, fmt(state.totalEarned));
  setText(el.totalSpent, fmt(state.totalSpent));
  setText(el.statEps, `${fmt(calc.energyPerSecond(state, false, now))}/s`);
  setText(el.statBestEps, `${fmt(state.bestEps)}/s`);
  setText(el.statOffline, fmt(state.offlineEarnedTotal));
  setText(el.statUpgrades, fmt(totalUpgradeLevels(state)));
  setText(el.statSurges, fmt(state.surgesUsed));
  setText(el.statSurgeTime, fmtTime(state.surgeTimeTotal));
  setText(el.statPrestige, fmt(state.prestige));
  setText(el.statPrestigeTotal, fmt(state.prestigeTotal));
  setText(el.statHorizons, fmt(state.horizons));
  setText(el.statShardsTotal, fmt(state.shardsEarnedTotal));
  setText(el.timePlayed, fmtTime(state.playSeconds));
  setText(el.sessionTime, fmtTime((now - sessionStartAt) / 1000));
  setText(el.achievementBonus, `x${calc.achievementMult(state).toFixed(2)}`);
  setText(el.statManualSaves, fmt(state.manualSaves));
  setText(el.statExports, fmt(state.exportsCount));
  setText(el.statImports, fmt(state.importsCount));

  // Settings panel live values
  setText(el.lastSavedText, lastSavedLabel(state, now));
  el.soundToggle.checked = !state.muted;
  el.motionToggle.checked = state.reducedMotion;

  updateBuyMode(state);
  updateUpgradeCards(state);
}
