// Animation and particle effects: core feedback, floating numbers, Surge
// visuals, and the prestige collapse sequences. All effects respect both
// the system reduced-motion preference and the in-game setting.
//
// Every click effect lives in the reactor stage's own coordinate space and
// is clamped by effectPosition(), so effects can never appear in unrelated
// parts of the page (the v0.2 misplaced floating-number bug).

import { el } from './dom.js';
import { fmt } from '../utils/format.js';
import { effectPosition } from '../utils/geometry.js';

export const MAX_PARTICLES = 48;
export const MAX_FLOATS = 20;

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let getState = () => null;

export function initEffects(stateGetter) {
  getState = stateGetter;
  reducedMotionQuery.addEventListener?.('change', applyMotionPreference);
  applyMotionPreference();
}

export function shouldReduceMotion() {
  return reducedMotionQuery.matches || Boolean(getState()?.reducedMotion);
}

// Mirrors the effective motion preference onto <html> so CSS can react.
export function applyMotionPreference() {
  document.documentElement.setAttribute('data-reduced-motion', shouldReduceMotion() ? 'true' : 'false');
}

// Restarts the core click animation; criticals get a stronger pulse ring.
export function pulseCore(critical = false) {
  el.core.classList.remove('clicked', 'crit-hit');
  void el.core.offsetWidth;
  el.core.classList.add('clicked');
  if (critical) el.core.classList.add('crit-hit');

  if (!shouldReduceMotion()) {
    el.corePulseRing.classList.remove('pulse');
    void el.corePulseRing.offsetWidth;
    el.corePulseRing.classList.add('pulse');
  }
}

// Resolves a safe stage-relative position for a click effect.
function stagePosition(event) {
  const rect = el.floatContainer.getBoundingClientRect();
  return { rect, ...effectPosition(event, rect) };
}

// Creates the floating +energy text near the activation point.
export function spawnFloatNumber(amount, event, critical = false) {
  const { x, y } = stagePosition(event);

  while (el.floatContainer.querySelectorAll('.float-num').length >= MAX_FLOATS) {
    el.floatContainer.querySelector('.float-num').remove();
  }

  const span = document.createElement('span');
  span.className = critical ? 'float-num critical' : 'float-num';
  span.textContent = `${critical ? 'CRIT +' : '+'}${fmt(amount)}`;
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  el.floatContainer.appendChild(span);
  setTimeout(() => span.remove(), 1200);
}

// Spawns a small particle burst from the activation point. Particles share
// the stage coordinate space and are capped so rapid clicking can never
// build up endless DOM nodes.
export function spawnParticles(event, critical = false) {
  if (shouldReduceMotion()) return;

  const existing = el.floatContainer.querySelectorAll('.particle').length;
  if (existing >= MAX_PARTICLES) return;

  const { x, y } = stagePosition(event);
  const count = Math.min(critical ? 10 : 7, MAX_PARTICLES - existing);

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    particle.className = critical ? 'particle particle-crit' : 'particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty('--dx', `${Math.random() * 120 - 60}px`);
    particle.style.setProperty('--dy', `${Math.random() * -95 - 20}px`);
    el.floatContainer.appendChild(particle);
    setTimeout(() => particle.remove(), 800);
  }
}

// Small celebratory pop on a purchased upgrade card.
export function flashUpgradeCard(id) {
  const card = document.querySelector(`[data-upgrade="${id}"]`);
  if (!card) return;
  card.classList.remove('purchased');
  void card.offsetWidth;
  card.classList.add('purchased');
}

// Toggles the stronger reactor visuals while Neon Surge is running, and a
// readiness shimmer once the charge is full.
export function setSurgeVisual(active) {
  document.body.classList.toggle('surge-active', active);
}

export function setSurgeReadyVisual(ready) {
  document.body.classList.toggle('surge-ready', ready);
}

// Plays a prestige collapse sequence. Non-blocking: the overlay ignores
// pointer events and removes itself when finished. Reduced-motion users get
// a brief, gentle fade instead of the full collapse.
function playCollapse(label, variant, reducedDuration, fullDuration) {
  el.singularityLabel.textContent = label;
  const reduced = shouldReduceMotion();
  const overlay = el.singularityOverlay;

  overlay.classList.remove('active', 'reduced', 'variant-horizon');
  void overlay.offsetWidth;
  overlay.classList.add('active');
  if (variant === 'horizon') overlay.classList.add('variant-horizon');
  if (reduced) overlay.classList.add('reduced');

  clearTimeout(overlay._timer);
  overlay._timer = setTimeout(() => {
    overlay.classList.remove('active', 'reduced', 'variant-horizon');
  }, reduced ? reducedDuration : fullDuration);
}

export function playSingularity(count) {
  playCollapse(`SINGULARITY ${fmt(count)}`, 'singularity', 900, 2000);
}

export function playHorizon(shards) {
  playCollapse(`EVENT HORIZON +${fmt(shards)}◆`, 'horizon', 1000, 2600);
}
