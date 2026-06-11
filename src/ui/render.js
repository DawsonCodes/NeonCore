// UI rendering: builds the upgrade and achievement cards once, then updates
// them (and every live readout) each frame. Text writes are cached so the
// DOM is only touched when a value actually changes.

import { PRESTIGE_REQ, SURGE_MAX } from '../config/constants.js';
import { upgradeDefs } from '../config/upgrades.js';
import { achievementDefs } from '../config/achievements.js';
import * as calc from '../core/calc.js';
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

// Builds the upgrade cards from the upgrade definition list.
export function renderUpgrades() {
  el.upgradeGrid.innerHTML = upgradeDefs.map(def => `
    <article class="upgrade" data-upgrade="${def.id}">
      <div class="upg-top">
        <div class="upg-icon" aria-hidden="true">${def.icon}</div>
        <div class="upg-copy">
          <h3 class="upg-name">${def.name}</h3>
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
  `).join('');
}

// Builds the achievement cards from the achievement definition list.
export function renderAchievements() {
  el.achievementGrid.innerHTML = achievementDefs.map(achievement => `
    <article id="achievement-${achievement.id}" class="achievement locked">
      <span class="achievement-icon" aria-hidden="true">★</span>
      <div>
        <h3>${achievement.name}</h3>
        <p>${achievement.desc}</p>
        <span class="achievement-state visually-hidden">Locked</span>
      </div>
    </article>
  `).join('');
}

// Shows a short current-effect summary for each upgrade card.
function effectText(state, id) {
  const effects = {
    power: `Base click ${fmt(calc.baseClickPower(state))}`,
    auto: `${fmt(calc.level(state, 'auto'))} base/sec`,
    drone: `${fmt(calc.level(state, 'drone') * 8)} swarm/sec`,
    crit: `${Math.round(calc.criticalChance(state) * 100)}% crit chance`,
    reactor: `x${calc.reactorMult(state).toFixed(2)} output`,
    efficiency: `${Math.round((1 - calc.costDiscountMult(state)) * 100)}% cheaper`,
    mult: `x${calc.overclockMult(state).toFixed(2)} output`
  };
  return effects[id] || 'Ready';
}

// Updates upgrade prices, levels, effect text, and affordability state.
function updateUpgradeCards(state) {
  for (const def of upgradeDefs) {
    const cost = calc.costFor(state, def.id);
    const card = document.querySelector(`[data-upgrade="${def.id}"]`);
    const btn = document.querySelector(`[data-buy="${def.id}"]`);
    const costEl = document.getElementById(`${def.id}Cost`);
    const levelEl = document.getElementById(`${def.id}Level`);
    const effectEl = document.getElementById(`${def.id}Effect`);
    const affordEl = document.getElementById(`${def.id}Afford`);

    if (!card || !btn || !costEl || !levelEl || !effectEl) continue;

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

// Updates achievement card styles and the unlocked count.
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
}

// Applies the current theme to the document and header toggle.
export function applyTheme(state) {
  document.documentElement.setAttribute('data-theme', state.theme);
  setText(el.themeBtnIcon, state.theme === 'dark' ? '☾' : '☀');
  el.themeBtn.setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  for (const radio of el.themeRadios) {
    radio.checked = radio.value === state.theme;
  }
}

// Reflects the current buy mode on the segmented control.
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
export function updateDisplay(state, now = Date.now()) {
  const progress = Math.min(100, state.score / PRESTIGE_REQ * 100);
  const activeSurge = calc.isSurgeActive(state, now);
  const surgeLeft = Math.max(0, Math.ceil((state.surgeEndsAt - now) / 1000));
  const surgeReady = state.surgeCharge >= SURGE_MAX;

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
    ? Math.max(0, ((state.surgeEndsAt - now) / 20000) * 100)
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
      ? 'Output is doubled right now. Go wild.'
      : surgeReady
        ? 'Charge complete. Activate to double all output for 20 seconds.'
        : `Charge ${Math.floor(state.surgeCharge)}% — click the core to fill it.`
  );

  // Singularity module
  const canPrestige = state.score >= PRESTIGE_REQ;
  el.prestigeBtn.disabled = !canPrestige;
  setText(el.prestigeStatus, canPrestige ? 'Collapse the core' : `Need ${fmt(Math.max(0, PRESTIGE_REQ - state.score))} more`);
  setText(el.prestigeBadge, canPrestige ? 'READY' : 'LOCKED');
  el.prestigeBadge.classList.toggle('is-ready', canPrestige);
  el.prestigeBtn.classList.toggle('is-ready', canPrestige);
  setText(el.prestigeCount, fmt(state.prestige));
  setText(el.prestigeBonus, `x${calc.prestigeMult(state).toFixed(2)}`);

  // Stats
  setText(el.totalClicks, fmt(state.totalClicks));
  setText(el.totalEarned, fmt(state.totalEarned));
  setText(el.totalSpent, fmt(state.totalSpent));
  setText(el.timePlayed, fmtTime(state.playSeconds));
  setText(el.bestScore, fmt(state.bestScore));
  setText(el.achievementBonus, `x${calc.achievementMult(state).toFixed(2)}`);

  // Settings panel live values
  setText(el.lastSavedText, lastSavedLabel(state, now));
  el.soundToggle.checked = !state.muted;
  el.motionToggle.checked = state.reducedMotion;

  updateBuyMode(state);
  updateUpgradeCards(state);
}
