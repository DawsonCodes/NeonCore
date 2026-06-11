// =====================================================================
// NEON CORE DELUXE
// This file controls the clicker game logic, including score changes,
// upgrades, achievements, saving/loading, keyboard shortcuts, sound,
// the reset button, and the main game loop.
// =====================================================================


// Save keys are used by localStorage so the browser can remember progress.
const SAVE_KEY = 'neonCoreSave_v2';
const OLD_SAVE_KEY = 'neonCoreSave_v1';
const PRESTIGE_REQ = 100000;
const SURGE_MAX = 100;
const SURGE_DURATION = 20000;
const CRIT_MULT = 3;

// This list defines every upgrade card shown in the shop.
// Changing these values updates the shop without rewriting the shop code.
const upgradeDefs = [
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

// This list defines the achievements and the condition needed to unlock each one.
const achievementDefs = [
  { id: 'firstClick', name: 'First Spark', desc: 'Click the core once.', check: () => state.totalClicks >= 1 },
  { id: 'hundredEnergy', name: 'Ignition', desc: 'Reach 100 energy.', check: () => state.bestScore >= 100 },
  { id: 'thousandEnergy', name: 'Stable Core', desc: 'Reach 1K energy.', check: () => state.bestScore >= 1000 },
  { id: 'tenK', name: 'Neon Engine', desc: 'Reach 10K energy.', check: () => state.bestScore >= 10000 },
  { id: 'hundredK', name: 'Reality Crack', desc: 'Reach 100K energy.', check: () => state.bestScore >= 100000 },
  { id: 'clicker100', name: 'Button Masher', desc: 'Click 100 times.', check: () => state.totalClicks >= 100 },
  { id: 'clicker1000', name: 'Machine Hands', desc: 'Click 1,000 times.', check: () => state.totalClicks >= 1000 },
  { id: 'cps50', name: 'Passive Income', desc: 'Reach 50 energy per second.', check: () => energyPerSecond(false) >= 50 },
  { id: 'cps500', name: 'Power Plant', desc: 'Reach 500 energy per second.', check: () => energyPerSecond(false) >= 500 },
  { id: 'upgrades25', name: 'Shopping Spree', desc: 'Buy 25 total upgrades.', check: () => totalUpgradeLevels() >= 25 },
  { id: 'upgrades100', name: 'Maxed Mindset', desc: 'Buy 100 total upgrades.', check: () => totalUpgradeLevels() >= 100 },
  { id: 'firstPrestige', name: 'Singularity', desc: 'Collapse the core once.', check: () => state.prestige >= 1 },
  { id: 'threePrestige', name: 'Beyond Reality', desc: 'Reach 3 singularities.', check: () => state.prestige >= 3 },
  { id: 'surgeUse', name: 'Surge Master', desc: 'Activate Neon Surge.', check: () => state.surgesUsed >= 1 },
  { id: 'millionaire', name: 'Millionaire Core', desc: 'Earn 1M total energy.', check: () => state.totalEarned >= 1000000 }
];

// Milestones are bigger pop-up messages that happen at important score goals.
const milestoneDefs = [
  { threshold: 100, text: 'First ignition. 100 energy reached.' },
  { threshold: 1000, text: 'Core stabilized. 1K energy reached.' },
  { threshold: 10000, text: 'Resonance detected. 10K energy reached.' },
  { threshold: 100000, text: 'Singularity unlocked. Collapse when ready.' },
  { threshold: 1000000, text: 'One million energy. The core is yours.' },
  { threshold: 10000000, text: 'Ten million energy. Reality is overheating.' }
];

// Builds a fresh upgrade object with every upgrade set to level 0.
function defaultUpgrades() {
  return Object.fromEntries(upgradeDefs.map(def => [def.id, { level: 0 }]));
}

// Creates the starting game state.
// The reset button also uses this so every value can return to ground zero.
function createInitialState() {
  return {
    score: 0,
    bestScore: 0,
    totalEarned: 0,
    totalSpent: 0,
    totalClicks: 0,
    playSeconds: 0,
    upgrades: defaultUpgrades(),
    prestige: 0,
    unlockedAchievements: [],
    reachedMilestones: [],
    muted: false,
    theme: 'dark',
    buyMode: 'one',
    surgeCharge: 0,
    surgeEndsAt: 0,
    surgesUsed: 0,
    lastSavedAt: Date.now()
  };
}

// The state object stores everything that changes while the game runs.
const state = createInitialState();

// Small shortcut for grabbing elements from the HTML by id.
const $ = id => document.getElementById(id);
// All important HTML elements are stored here so the code can update them easily.
const el = {
  score: $('score'),
  cps: $('cps'),
  perClick: $('perClick'),
  multiplier: $('multiplier'),
  critChance: $('critChance'),
  prestigeProgress: $('prestigeProgress'),
  prestigeProgressText: $('prestigeProgressText'),
  core: $('coreBtn'),
  floatContainer: $('floatContainer'),
  upgradeGrid: $('upgradeGrid'),
  achievementGrid: $('achievementGrid'),
  achievementCount: $('achievementCount'),
  achievementBonus: $('achievementBonus'),
  buyModeBtn: $('buyModeBtn'),
  surgeBtn: $('surgeBtn'),
  surgeText: $('surgeText'),
  surgeCharge: $('surgeCharge'),
  prestigeBtn: $('prestigeBtn'),
  prestigeStatus: $('prestigeStatus'),
  prestigeCount: $('prestigeCount'),
  prestigeBonus: $('prestigeBonus'),
  totalClicks: $('totalClicks'),
  totalEarned: $('totalEarned'),
  totalSpent: $('totalSpent'),
  timePlayed: $('timePlayed'),
  bestScore: $('bestScore'),
  milestone: $('milestone'),
  saveIndicator: $('saveIndicator'),
  toast: $('toast'),
  eventLog: $('eventLog'),
  saveBtn: $('saveBtn'),
  exportBtn: $('exportBtn'),
  importBtn: $('importBtn'),
  importFile: $('importFile'),
  muteBtn: $('muteBtn'),
  themeBtn: $('themeBtn'),
  resetBtn: $('resetBtn')
};

let audioCtx;
let lastTick = performance.now();
let autoSaveTimer = 0;

// Returns the current level of an upgrade.
function level(id) {
  return state.upgrades[id]?.level || 0;
}

// Counts all upgrade levels combined for achievement checks.
function totalUpgradeLevels() {
  return Object.values(state.upgrades).reduce((sum, upgrade) => sum + upgrade.level, 0);
}

// Calculates the discount from Efficiency Matrix upgrades.
function costDiscountMult() {
  return Math.max(0.55, Math.pow(0.97, level('efficiency')));
}

// Calculates the current price of an upgrade based on its level and growth rate.
function costFor(id) {
  const def = upgradeDefs.find(item => item.id === id);
  const raw = def.baseCost * Math.pow(def.growth, level(id));
  return Math.max(1, Math.floor(raw * costDiscountMult()));
}

// Each multiplier helper returns one part of the total output multiplier.
function overclockMult() {
  return Math.pow(1.35, level('mult'));
}

function reactorMult() {
  return 1 + level('reactor') * 0.12;
}

function prestigeMult() {
  return 1 + state.prestige * 0.1;
}

function achievementMult() {
  return 1 + state.unlockedAchievements.length * 0.02;
}

function surgeMult() {
  return isSurgeActive() ? 2 : 1;
}

// Combines all multipliers into one number used for clicks and passive energy.
function globalMult(includeSurge = true) {
  const surge = includeSurge ? surgeMult() : 1;
  return overclockMult() * reactorMult() * prestigeMult() * achievementMult() * surge;
}

function baseClickPower() {
  return 1 + level('power');
}

// Calculates how much energy one normal click gives.
function clickPower(includeSurge = true) {
  return Math.max(1, Math.floor(baseClickPower() * globalMult(includeSurge)));
}

function criticalChance() {
  return Math.min(0.6, level('crit') * 0.03);
}

// Calculates passive energy gained each second from automatic upgrades.
function energyPerSecond(includeSurge = true) {
  const base = level('auto') + level('drone') * 8;
  return base * globalMult(includeSurge);
}

// Formats large numbers so the display stays readable.
function fmt(num) {
  if (!Number.isFinite(num)) return '0';
  const n = Math.max(0, num);
  const units = [
    { value: 1e15, suffix: 'Qa' },
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' }
  ];

  for (const unit of units) {
    if (n >= unit.value) return `${trimNumber(n / unit.value)}${unit.suffix}`;
  }
  return Math.floor(n).toString();
}

function trimNumber(num) {
  return num >= 100 ? num.toFixed(0) : num >= 10 ? num.toFixed(1) : num.toFixed(2);
}

// Converts seconds into a readable time display.
function fmtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Adds energy and updates total earned and best score.
function addScore(amount) {
  const gain = Math.max(0, amount);
  state.score += gain;
  state.totalEarned += gain;
  state.bestScore = Math.max(state.bestScore, state.score);
}

// Removes energy when buying upgrades and tracks total spent.
function spendScore(amount) {
  state.score -= amount;
  state.totalSpent += amount;
}

// Runs every time the core is clicked or space is pressed once.
function handleClick(event) {
  let gain = clickPower();
  const critical = Math.random() < criticalChance();

  if (critical) gain *= CRIT_MULT;

  addScore(gain);
  state.totalClicks++;
  state.surgeCharge = Math.min(SURGE_MAX, state.surgeCharge + 1.35);

  pulseCore();
  spawnFloatNumber(gain, event, critical);
  spawnParticles(event);
  soundClick(critical);
  checkMilestones();
  checkAchievements();
  updateDisplay();
}

// Restarts the core click animation on every click.
function pulseCore() {
  el.core.classList.remove('clicked');
  void el.core.offsetWidth;
  el.core.classList.add('clicked');
}

// Buys one upgrade or as many as possible depending on buy mode.
function buyUpgrade(id) {
  const targetAmount = state.buyMode === 'max' ? Infinity : 1;
  let bought = 0;
  let spent = 0;

  while (bought < targetAmount) {
    const cost = costFor(id);
    if (state.score < cost) break;
    spendScore(cost);
    state.upgrades[id].level++;
    spent += cost;
    bought++;

    if (bought > 2500) break;
  }

  if (bought === 0) {
    toast('Not enough energy yet.');
    soundDeny();
    return;
  }

  const def = upgradeDefs.find(item => item.id === id);
  soundBuy();
  addLog(`Bought ${bought} ${def.short} upgrade${bought === 1 ? '' : 's'} for ${fmt(spent)} energy.`);
  checkAchievements();
  updateDisplay();
  save();
}

// Switches between buying one upgrade and buying the max affordable amount.
function toggleBuyMode() {
  state.buyMode = state.buyMode === 'one' ? 'max' : 'one';
  el.buyModeBtn.textContent = state.buyMode === 'one' ? 'Buy 1' : 'Buy Max';
  toast(`Buy mode: ${state.buyMode === 'one' ? '1' : 'Max'}`);
  updateDisplay();
  save();
}

// Checks if Neon Surge is currently active.
function isSurgeActive() {
  return Date.now() < state.surgeEndsAt;
}

// Activates Neon Surge once the charge bar is full.
function activateSurge() {
  if (state.surgeCharge < SURGE_MAX || isSurgeActive()) return;
  state.surgeCharge = 0;
  state.surgeEndsAt = Date.now() + SURGE_DURATION;
  state.surgesUsed++;
  showMilestone('Neon Surge activated. Output doubled for 20 seconds.');
  addLog('Neon Surge activated. Output doubled.');
  soundMilestone();
  checkAchievements();
  updateDisplay();
  save();
}

// Handles the prestige system called Singularity.
function doPrestige() {
  if (state.score < PRESTIGE_REQ) return;

  const ok = confirm('Collapse the core? This resets energy and upgrades, but adds a permanent +10% global multiplier. Achievements stay unlocked.');
  if (!ok) return;

  state.prestige++;
  state.score = 0;
  state.upgrades = defaultUpgrades();
  state.surgeCharge = 0;
  state.surgeEndsAt = 0;

  showMilestone(`Singularity ${state.prestige} achieved.`);
  addLog(`Singularity ${state.prestige} achieved. Permanent bonus increased.`);
  soundMilestone();
  checkAchievements();
  updateDisplay();
  save();
}

// Builds the upgrade cards from the upgrade definition list.
function renderUpgrades() {
  el.upgradeGrid.innerHTML = upgradeDefs.map(def => `
    <article class="upgrade" data-upgrade="${def.id}">
      <div class="upg-top">
        <div class="upg-icon" aria-hidden="true">${def.icon}</div>
        <div>
          <h3 class="upg-name">${def.name}</h3>
          <p class="upg-desc">${def.desc}</p>
        </div>
      </div>
      <div class="upg-meta">
        <span id="${def.id}Level">Lv 0</span>
        <span id="${def.id}Effect">Ready</span>
      </div>
      <button class="buy-btn" type="button" data-buy="${def.id}">
        <span class="buy-label">BUY</span>
        <span class="buy-cost" id="${def.id}Cost">0</span>
      </button>
    </article>
  `).join('');
}

// Builds the achievement cards from the achievement definition list.
function renderAchievements() {
  el.achievementGrid.innerHTML = achievementDefs.map(achievement => `
    <article id="achievement-${achievement.id}" class="achievement locked">
      <span class="achievement-icon" aria-hidden="true">★</span>
      <div>
        <h3>${achievement.name}</h3>
        <p>${achievement.desc}</p>
      </div>
    </article>
  `).join('');
}

// Updates upgrade prices, levels, descriptions, and disabled buttons.
function updateUpgradeCards() {
  for (const def of upgradeDefs) {
    const cost = costFor(def.id);
    const card = document.querySelector(`[data-upgrade="${def.id}"]`);
    const btn = document.querySelector(`[data-buy="${def.id}"]`);
    const costEl = $(`${def.id}Cost`);
    const levelEl = $(`${def.id}Level`);
    const effectEl = $(`${def.id}Effect`);

    if (!card || !btn || !costEl || !levelEl || !effectEl) continue;

    costEl.textContent = fmt(cost);
    levelEl.textContent = `Lv ${level(def.id)}`;
    effectEl.textContent = effectText(def.id);
    btn.disabled = state.score < cost;
    card.classList.toggle('can-buy', state.score >= cost);
  }
}

// Shows a short current-effect summary for each upgrade card.
function effectText(id) {
  const effects = {
    power: `Base click ${fmt(baseClickPower())}`,
    auto: `Base/sec ${fmt(level('auto'))}`,
    drone: `Swarm/sec ${fmt(level('drone') * 8)}`,
    crit: `${Math.round(criticalChance() * 100)}% crit chance`,
    reactor: `x${reactorMult().toFixed(2)} output`,
    efficiency: `${Math.round((1 - costDiscountMult()) * 100)}% cheaper`,
    mult: `x${overclockMult().toFixed(2)} output`
  };
  return effects[id] || 'Ready';
}

// Updates achievement card styles and the unlocked count.
function updateAchievements() {
  const unlocked = new Set(state.unlockedAchievements);

  for (const achievement of achievementDefs) {
    const isUnlocked = unlocked.has(achievement.id);
    const card = $(`achievement-${achievement.id}`);
    if (!card) continue;
    card.classList.toggle('locked', !isUnlocked);
    card.classList.toggle('unlocked', isUnlocked);
  }

  el.achievementCount.textContent = `${state.unlockedAchievements.length}/${achievementDefs.length} unlocked`;
}

// Checks every achievement condition and unlocks new achievements.
function checkAchievements() {
  let foundNew = false;

  for (const achievement of achievementDefs) {
    if (!state.unlockedAchievements.includes(achievement.id) && achievement.check()) {
      state.unlockedAchievements.push(achievement.id);
      showMilestone(`Achievement unlocked: ${achievement.name}`);
      addLog(`Achievement unlocked: ${achievement.name}.`);
      foundNew = true;
    }
  }

  if (foundNew) {
    soundMilestone();
    updateAchievements();
  }
}

// Checks if the player reached score milestones.
function checkMilestones() {
  for (const milestone of milestoneDefs) {
    if (state.bestScore >= milestone.threshold && !state.reachedMilestones.includes(milestone.threshold)) {
      state.reachedMilestones.push(milestone.threshold);
      showMilestone(milestone.text);
      addLog(milestone.text);
      soundMilestone();
    }
  }
}

// Displays the large center pop-up for events and achievements.
function showMilestone(text) {
  el.milestone.innerHTML = `
    <div class="milestone-label">CORE EVENT</div>
    <div class="milestone-text">${escapeHTML(text)}</div>
  `;
  el.milestone.classList.remove('show');
  void el.milestone.offsetWidth;
  el.milestone.classList.add('show');
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 450);
}

// Adds a message to the core log and keeps only the newest five.
function addLog(message) {
  const item = document.createElement('li');
  item.textContent = message;
  el.eventLog.prepend(item);

  while (el.eventLog.children.length > 5) {
    el.eventLog.lastElementChild.remove();
  }
}

// Creates the floating +energy text near the click location.
function spawnFloatNumber(amount, event, critical = false) {
  const containerRect = el.floatContainer.getBoundingClientRect();
  const coreRect = el.core.getBoundingClientRect();

  let x;
  let y;

  if (event && Number.isFinite(event.clientX)) {
    x = event.clientX - containerRect.left;
    y = event.clientY - containerRect.top;
  } else {
    x = coreRect.left + coreRect.width / 2 - containerRect.left;
    y = coreRect.top + coreRect.height / 2 - containerRect.top;
  }

  const span = document.createElement('span');
  span.className = critical ? 'float-num critical' : 'float-num';
  span.textContent = `${critical ? 'CRIT +' : '+'}${fmt(amount)}`;
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  el.floatContainer.appendChild(span);
  setTimeout(() => span.remove(), 1200);
}

// Creates small particle effects when the core is clicked.
function spawnParticles(event) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const coreRect = el.core.getBoundingClientRect();
  const centerX = event?.clientX ?? coreRect.left + coreRect.width / 2;
  const centerY = event?.clientY ?? coreRect.top + coreRect.height / 2;

  for (let i = 0; i < 7; i++) {
    const particle = document.createElement('span');
    particle.className = 'particle';
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    particle.style.setProperty('--dx', `${Math.random() * 120 - 60}px`);
    particle.style.setProperty('--dy', `${Math.random() * -95 - 20}px`);
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 800);
  }
}

// Pushes the current state values onto the page.
function updateDisplay() {
  const progress = Math.min(100, state.score / PRESTIGE_REQ * 100);
  const activeSurge = isSurgeActive();
  const surgeLeft = Math.max(0, Math.ceil((state.surgeEndsAt - Date.now()) / 1000));

  el.score.textContent = fmt(state.score);
  el.cps.textContent = `${fmt(energyPerSecond())}/sec`;
  el.perClick.textContent = `+${fmt(clickPower())}/click`;
  el.multiplier.textContent = `x${globalMult().toFixed(2)}`;
  el.critChance.textContent = `${Math.round(criticalChance() * 100)}%`;

  el.prestigeProgress.style.width = `${progress}%`;
  el.prestigeProgressText.textContent = `${Math.floor(progress)}% to Singularity`;

  el.surgeCharge.style.width = `${state.surgeCharge}%`;
  el.surgeBtn.disabled = state.surgeCharge < SURGE_MAX || activeSurge;
  el.surgeBtn.textContent = activeSurge ? `${surgeLeft}s LEFT` : state.surgeCharge >= SURGE_MAX ? 'ACTIVATE' : 'CHARGING';
  el.surgeText.textContent = activeSurge ? 'Output is doubled right now. Go wild.' : `Charge ${Math.floor(state.surgeCharge)}%. Click the core to fill it.`;

  const canPrestige = state.score >= PRESTIGE_REQ;
  el.prestigeBtn.disabled = !canPrestige;
  el.prestigeStatus.textContent = canPrestige ? 'Collapse the core' : `Need ${fmt(Math.max(0, PRESTIGE_REQ - state.score))} more`;
  el.prestigeCount.textContent = fmt(state.prestige);
  el.prestigeBonus.textContent = `x${prestigeMult().toFixed(2)}`;

  el.totalClicks.textContent = fmt(state.totalClicks);
  el.totalEarned.textContent = fmt(state.totalEarned);
  el.totalSpent.textContent = fmt(state.totalSpent);
  el.timePlayed.textContent = fmtTime(state.playSeconds);
  el.bestScore.textContent = fmt(state.bestScore);
  el.achievementBonus.textContent = `x${achievementMult().toFixed(2)}`;

  el.buyModeBtn.textContent = state.buyMode === 'one' ? 'Buy 1' : 'Buy Max';
  document.documentElement.setAttribute('data-theme', state.theme);
  el.themeBtn.textContent = state.theme === 'dark' ? '☾' : '☀';
  el.muteBtn.textContent = state.muted ? '🔇' : '🔊';

  updateUpgradeCards();
  updateAchievements();
}

// Main game loop. It runs constantly to add passive energy and update the screen.
function tick(now = performance.now()) {
  const dt = Math.min(1, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;

  const passiveGain = energyPerSecond() * dt;
  if (passiveGain > 0) {
    addScore(passiveGain);
    state.surgeCharge = Math.min(SURGE_MAX, state.surgeCharge + dt * 0.05);
  }

  state.playSeconds += dt;
  autoSaveTimer += dt;

  checkMilestones();
  checkAchievements();
  updateDisplay();

  if (autoSaveTimer >= 15) {
    autoSaveTimer = 0;
    save(false);
  }

  requestAnimationFrame(tick);
}

// Saves the whole game state in the browser.
function save(showFlash = true) {
  try {
    state.lastSavedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (showFlash) flashSaveIndicator();
  } catch (error) {
    console.warn('Save failed:', error);
    toast('Save failed. Browser storage may be blocked.');
  }
}

// Loads saved data from the browser if it exists.
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_SAVE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    applySaveData(data);
    applyOfflineProgress(data.lastSavedAt || data.savedAt);
  } catch (error) {
    console.warn('Load failed:', error);
    toast('Save file could not load. Starting fresh.');
  }
}

// Copies saved values into the current state while checking for bad values.
function applySaveData(data) {
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
  state.surgeCharge = clampNumber(data.surgeCharge, 0, SURGE_MAX);
  state.surgeEndsAt = clampNumber(data.surgeEndsAt, 0);
  state.surgesUsed = clampNumber(data.surgesUsed, 0);
  state.lastSavedAt = clampNumber(data.lastSavedAt || data.savedAt, Date.now());
  state.unlockedAchievements = Array.isArray(data.unlockedAchievements) ? data.unlockedAchievements : [];
  state.reachedMilestones = Array.isArray(data.reachedMilestones) ? data.reachedMilestones : [];

  const upgraded = defaultUpgrades();
  for (const def of upgradeDefs) {
    const loadedLevel = data.upgrades?.[def.id]?.level;
    upgraded[def.id].level = Math.max(0, Math.floor(Number(loadedLevel) || 0));
  }
  state.upgrades = upgraded;
}

// Gives limited passive energy for time away from the game.
function applyOfflineProgress(savedAt) {
  if (!savedAt) return;

  const awaySeconds = Math.min(7200, Math.max(0, (Date.now() - savedAt) / 1000));
  const offlineGain = energyPerSecond(false) * awaySeconds;

  if (offlineGain > 0) {
    addScore(offlineGain);
    addLog(`Offline gain: ${fmt(offlineGain)} energy.`);
    toast(`Offline gain: ${fmt(offlineGain)} energy.`);
  }
}

// Fully resets the game to a brand-new state.
// This clears energy, upgrades, achievements, prestige, stats, surge, and saved data.
function resetGame() {
  const ok = confirm('Wipe all progress including prestige and achievements? This cannot be undone.');
  if (!ok) return;

  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(OLD_SAVE_KEY);

  const freshState = createInitialState();
  Object.assign(state, freshState);

  lastTick = performance.now();
  autoSaveTimer = 0;
  el.eventLog.innerHTML = '';

  renderUpgrades();
  renderAchievements();
  addLog('Progress reset. Core online.');
  updateDisplay();
  save();
  toast('Everything reset to zero.');
}

// Downloads the current save as a JSON file.
function exportSave() {
  save(false);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `neon-core-save-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast('Save exported.');
}

// Loads a save file the player exported earlier.
function importSave(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => {
    try {
      const data = JSON.parse(event.target.result);
      applySaveData(data);
      save();
      toast('Save imported.');
      addLog('Save imported successfully.');
      updateDisplay();
    } catch (error) {
      console.warn('Import failed:', error);
      toast('That save file did not work.');
    }
  };
  reader.readAsText(file);
}

// Switches between dark mode and light mode.
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  updateDisplay();
  save();
}

// Turns sound effects on and off.
function toggleMute() {
  state.muted = !state.muted;
  updateDisplay();
  save();
}

// Briefly shows the SAVED message.
function flashSaveIndicator() {
  el.saveIndicator.classList.add('show');
  setTimeout(() => el.saveIndicator.classList.remove('show'), 900);
}

// Shows a small temporary message near the bottom of the screen.
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('show');
  void el.toast.offsetWidth;
  el.toast.classList.add('show');
}

// Creates the browser audio context the first time a sound is needed.
function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (error) {
    audioCtx = null;
  }
}

// Plays a short generated sound effect without needing audio files.
function playTone(freq, duration = 0.1, type = 'sine', vol = 0.1) {
  if (state.muted) return;
  ensureAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function soundClick(critical = false) {
  playTone(critical ? 980 : 620 + Math.random() * 220, critical ? 0.13 : 0.06, 'sine', critical ? 0.11 : 0.07);
}

function soundBuy() {
  playTone(850, 0.09, 'triangle', 0.12);
  setTimeout(() => playTone(1280, 0.12, 'triangle', 0.09), 55);
}

function soundMilestone() {
  playTone(523.25, 0.13, 'sine', 0.11);
  setTimeout(() => playTone(659.25, 0.13, 'sine', 0.11), 110);
  setTimeout(() => playTone(783.99, 0.22, 'sine', 0.1), 220);
}

function soundDeny() {
  playTone(180, 0.11, 'sawtooth', 0.05);
}

// Keeps loaded numbers safe and inside an allowed range.
function clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
}

// Escapes text before adding it to innerHTML to avoid unsafe HTML injection.
function escapeHTML(text) {
  return String(text).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  })[char]);
}

// Connects buttons and keyboard shortcuts to their functions.
function initEvents() {
  el.core.addEventListener('click', handleClick);
  el.upgradeGrid.addEventListener('click', event => {
    const btn = event.target.closest('[data-buy]');
    if (btn) buyUpgrade(btn.dataset.buy);
  });
  el.buyModeBtn.addEventListener('click', toggleBuyMode);
  el.surgeBtn.addEventListener('click', activateSurge);
  el.prestigeBtn.addEventListener('click', doPrestige);
  el.saveBtn.addEventListener('click', () => {
    save();
    toast('Game saved.');
  });
  el.exportBtn.addEventListener('click', exportSave);
  el.importBtn.addEventListener('click', () => el.importFile.click());
  el.importFile.addEventListener('change', () => importSave(el.importFile.files[0]));
  el.muteBtn.addEventListener('click', toggleMute);
  el.themeBtn.addEventListener('click', toggleTheme);
  el.resetBtn.addEventListener('click', resetGame);

  document.addEventListener('keydown', event => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (typing) return;

    // Holding a key can fire repeated keydown events.
    // This prevents holding space from rapidly farming energy.
    if (event.repeat) {
      if (event.code === 'Space') event.preventDefault();
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      handleClick();
    }
    if (event.key.toLowerCase() === 'b') toggleBuyMode();
    if (event.key.toLowerCase() === 's') {
      save();
      toast('Game saved.');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save(false);
  });

  window.addEventListener('beforeunload', () => save(false));
}

// Starts the game after the page has loaded.
function init() {
  renderUpgrades();
  renderAchievements();
  load();
  initEvents();
  addLog('Core online. Begin charging.');
  checkAchievements();
  updateDisplay();
  lastTick = performance.now();
  requestAnimationFrame(tick);
}

// Waits for the HTML to load before running the game.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
