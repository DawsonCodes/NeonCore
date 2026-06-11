// Animation and particle effects: core feedback, floating numbers, Surge
// visuals, and the Singularity collapse sequence. All effects respect both
// the system reduced-motion preference and the in-game setting.

import { el } from './dom.js';
import { fmt } from '../utils/format.js';

const MAX_PARTICLES = 48;
const MAX_FLOATS = 20;

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

// Creates the floating +energy text near the click location.
export function spawnFloatNumber(amount, event, critical = false) {
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

  while (el.floatContainer.children.length >= MAX_FLOATS) {
    el.floatContainer.firstElementChild.remove();
  }

  const span = document.createElement('span');
  span.className = critical ? 'float-num critical' : 'float-num';
  span.textContent = `${critical ? 'CRIT +' : '+'}${fmt(amount)}`;
  span.style.left = `${x}px`;
  span.style.top = `${y}px`;
  el.floatContainer.appendChild(span);
  setTimeout(() => span.remove(), 1200);
}

// Spawns a small particle burst from the click point. Particle count is
// capped globally so rapid clicking can never build up endless DOM nodes.
export function spawnParticles(event, critical = false) {
  if (shouldReduceMotion()) return;
  if (el.particleLayer.children.length >= MAX_PARTICLES) return;

  const coreRect = el.core.getBoundingClientRect();
  const centerX = event?.clientX ?? coreRect.left + coreRect.width / 2;
  const centerY = event?.clientY ?? coreRect.top + coreRect.height / 2;
  const count = critical ? 10 : 7;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    particle.className = critical ? 'particle particle-crit' : 'particle';
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    particle.style.setProperty('--dx', `${Math.random() * 120 - 60}px`);
    particle.style.setProperty('--dy', `${Math.random() * -95 - 20}px`);
    el.particleLayer.appendChild(particle);
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

// Toggles the stronger reactor visuals while Neon Surge is running.
export function setSurgeVisual(active) {
  document.body.classList.toggle('surge-active', active);
}

// Plays the Singularity collapse sequence. Non-blocking: the overlay ignores
// pointer events and removes itself when finished. Reduced-motion users get
// a brief, gentle fade instead of the full collapse.
export function playSingularity(count) {
  el.singularityNum.textContent = fmt(count);
  const reduced = shouldReduceMotion();
  const overlay = el.singularityOverlay;

  overlay.classList.remove('active', 'reduced');
  void overlay.offsetWidth;
  overlay.classList.add('active');
  if (reduced) overlay.classList.add('reduced');

  clearTimeout(overlay._timer);
  overlay._timer = setTimeout(() => {
    overlay.classList.remove('active', 'reduced');
  }, reduced ? 900 : 2000);
}
