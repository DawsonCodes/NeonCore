// Central DOM reference map. Every element the UI updates is looked up once.

const $ = id => document.getElementById(id);

export const el = {
  // Header
  versionBadge: $('versionBadge'),
  saveChip: $('saveChip'),
  themeBtn: $('themeBtn'),
  themeBtnIcon: $('themeBtnIcon'),
  settingsBtn: $('settingsBtn'),

  // Energy block
  score: $('score'),
  perClick: $('perClick'),
  cps: $('cps'),
  multiplier: $('multiplier'),
  critChance: $('critChance'),
  surgeChip: $('surgeChip'),
  surgeChipWrap: $('surgeChipWrap'),
  prestigeProgress: $('prestigeProgress'),
  prestigeProgressShell: $('prestigeProgressShell'),
  prestigeProgressText: $('prestigeProgressText'),

  // Reactor
  core: $('coreBtn'),
  corePulseRing: $('corePulseRing'),
  floatContainer: $('floatContainer'),

  // Surge
  surgeBtn: $('surgeBtn'),
  surgeText: $('surgeText'),
  surgeBadge: $('surgeBadge'),
  surgeCharge: $('surgeCharge'),
  surgeChargeShell: $('surgeChargeShell'),

  // Singularity
  prestigeBtn: $('prestigeBtn'),
  prestigeStatus: $('prestigeStatus'),
  prestigeBadge: $('prestigeBadge'),
  prestigeDesc: $('prestigeDesc'),
  prestigeCount: $('prestigeCount'),
  prestigeBonus: $('prestigeBonus'),
  singularityOverlay: $('singularityOverlay'),
  singularityLabel: $('singularityLabel'),

  // Event Horizon
  horizonModule: $('horizonModule'),
  horizonBadge: $('horizonBadge'),
  horizonDesc: $('horizonDesc'),
  horizonBtn: $('horizonBtn'),
  horizonStatus: $('horizonStatus'),
  horizonShop: $('horizonShop'),
  shardCount: $('shardCount'),
  horizonCount: $('horizonCount'),

  // Upgrades
  upgradeGrid: $('upgradeGrid'),
  buyOneBtn: $('buyOneBtn'),
  buyMaxBtn: $('buyMaxBtn'),

  // Achievements
  achievementGrid: $('achievementGrid'),
  achievementCount: $('achievementCount'),
  achievementToggle: $('achievementToggle'),
  achievementPreview: $('achievementPreview'),
  achievementBody: $('achievementBody'),

  // Stats + log
  totalClicks: $('totalClicks'),
  totalCrits: $('totalCrits'),
  biggestClick: $('biggestClick'),
  bestScore: $('bestScore'),
  totalEarned: $('totalEarned'),
  totalSpent: $('totalSpent'),
  statEps: $('statEps'),
  statBestEps: $('statBestEps'),
  statOffline: $('statOffline'),
  statUpgrades: $('statUpgrades'),
  statSurges: $('statSurges'),
  statSurgeTime: $('statSurgeTime'),
  statPrestige: $('statPrestige'),
  statPrestigeTotal: $('statPrestigeTotal'),
  statHorizons: $('statHorizons'),
  statShardsTotal: $('statShardsTotal'),
  timePlayed: $('timePlayed'),
  sessionTime: $('sessionTime'),
  achievementBonus: $('achievementBonus'),
  statManualSaves: $('statManualSaves'),
  statExports: $('statExports'),
  statImports: $('statImports'),
  eventLog: $('eventLog'),

  // Navigation
  dashboard: $('dashboard'),
  navButtons: [...document.querySelectorAll('.mobile-nav [data-nav]')],
  navSettingsBtn: $('navSettingsBtn'),
  tabPanels: [...document.querySelectorAll('.tab-panel')],

  // Settings sheet
  settingsDialog: $('settingsDialog'),
  settingsCloseBtn: $('settingsCloseBtn'),
  themeRadios: [...document.querySelectorAll('input[name="themeChoice"]')],
  motionToggle: $('motionToggle'),
  soundToggle: $('soundToggle'),
  volumeSlider: $('volumeSlider'),
  lastSavedText: $('lastSavedText'),
  saveNowBtn: $('saveNowBtn'),
  exportBtn: $('exportBtn'),
  importBtn: $('importBtn'),
  importFile: $('importFile'),
  resetBtn: $('resetBtn'),
  slotList: $('slotList'),
  appVersionText: $('appVersionText'),

  // Dialogs
  confirmDialog: $('confirmDialog'),
  confirmTitle: $('confirmTitle'),
  confirmMessage: $('confirmMessage'),
  confirmAcceptBtn: $('confirmAcceptBtn'),
  confirmCancelBtn: $('confirmCancelBtn'),
  offlineDialog: $('offlineDialog'),
  offlineSummary: $('offlineSummary'),
  offlineCapNote: $('offlineCapNote'),
  offlineCloseBtn: $('offlineCloseBtn'),

  // Notifications
  notificationStack: $('notificationStack')
};
