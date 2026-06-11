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
  particleLayer: $('particleLayer'),

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
  prestigeCount: $('prestigeCount'),
  prestigeBonus: $('prestigeBonus'),
  singularityOverlay: $('singularityOverlay'),
  singularityNum: $('singularityNum'),

  // Upgrades
  upgradeGrid: $('upgradeGrid'),
  buyOneBtn: $('buyOneBtn'),
  buyMaxBtn: $('buyMaxBtn'),

  // Achievements
  achievementGrid: $('achievementGrid'),
  achievementCount: $('achievementCount'),

  // Stats + log
  totalClicks: $('totalClicks'),
  totalEarned: $('totalEarned'),
  totalSpent: $('totalSpent'),
  timePlayed: $('timePlayed'),
  achievementBonus: $('achievementBonus'),
  bestScore: $('bestScore'),
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
  lastSavedText: $('lastSavedText'),
  saveNowBtn: $('saveNowBtn'),
  exportBtn: $('exportBtn'),
  importBtn: $('importBtn'),
  importFile: $('importFile'),
  resetBtn: $('resetBtn'),
  appVersionText: $('appVersionText'),

  // Dialogs
  confirmDialog: $('confirmDialog'),
  confirmTitle: $('confirmTitle'),
  confirmMessage: $('confirmMessage'),
  confirmAcceptBtn: $('confirmAcceptBtn'),
  confirmCancelBtn: $('confirmCancelBtn'),
  offlineDialog: $('offlineDialog'),
  offlineSummary: $('offlineSummary'),
  offlineCloseBtn: $('offlineCloseBtn'),

  // Notifications
  notificationStack: $('notificationStack')
};
