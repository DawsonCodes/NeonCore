// Procedural sound design built on the Web Audio API — no audio files, no
// remote assets. All output runs through a master gain node controlled by
// the in-game volume slider. Rapid clicking is throttled so sound never
// piles up into noise.

let audioCtx = null;
let masterGain = null;
let isMuted = () => false;
let getVolume = () => 0.7;

let lastClickAt = 0;
let lastChargeAt = 0;
const CLICK_THROTTLE_MS = 35;
const CHARGE_THROTTLE_MS = 450;

export function initAudio({ muted, volume }) {
  isMuted = muted;
  getVolume = volume;
}

// Creates the audio context lazily. Browsers require a user gesture before
// audio can start; unlockAudio() is wired to the first pointer/key event.
function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
  } catch {
    audioCtx = null;
  }
}

export function unlockAudio() {
  ensureAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function ready() {
  if (isMuted()) return false;
  ensureAudio();
  if (!audioCtx) return false;
  masterGain.gain.value = Math.max(0, Math.min(1, getVolume()));
  return true;
}

// Core synth helper: one enveloped oscillator, optional pitch slide.
function tone(freq, { dur = 0.1, type = 'sine', vol = 0.1, delay = 0, slideTo = 0, attack = 0.004 } = {}) {
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Short filtered-noise burst used to add texture to big events.
function noiseBurst({ dur = 0.3, vol = 0.08, delay = 0, from = 2400, to = 200 } = {}) {
  const t0 = audioCtx.currentTime + delay;
  const length = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(t0);
}

export const sound = {
  // Routine click: soft blip with subtle random variation; throttled so
  // rapid clicking layers gently instead of stacking into harshness.
  click(critical = false) {
    if (!ready()) return;
    const now = performance.now();
    if (now - lastClickAt < CLICK_THROTTLE_MS) return;
    lastClickAt = now;

    if (critical) {
      tone(960 + Math.random() * 60, { dur: 0.12, vol: 0.1 });
      tone(1440, { dur: 0.16, vol: 0.07, delay: 0.02, type: 'triangle' });
    } else {
      tone(580 + Math.random() * 240, { dur: 0.055, vol: 0.055 });
    }
  },

  buy() {
    if (!ready()) return;
    tone(840, { dur: 0.08, type: 'triangle', vol: 0.1 });
    tone(1260, { dur: 0.11, type: 'triangle', vol: 0.08, delay: 0.055 });
  },

  deny() {
    if (!ready()) return;
    tone(170, { dur: 0.1, type: 'sawtooth', vol: 0.045 });
  },

  achievement() {
    if (!ready()) return;
    tone(660, { dur: 0.1, type: 'triangle', vol: 0.09 });
    tone(880, { dur: 0.1, type: 'triangle', vol: 0.09, delay: 0.09 });
    tone(1320, { dur: 0.2, type: 'triangle', vol: 0.08, delay: 0.18 });
  },

  milestone() {
    if (!ready()) return;
    tone(523.25, { dur: 0.14, vol: 0.09 });
    tone(659.25, { dur: 0.14, vol: 0.09, delay: 0.1 });
    tone(783.99, { dur: 0.24, vol: 0.08, delay: 0.2 });
  },

  // Soft ping the moment Surge charge reaches 100%.
  surgeReady() {
    if (!ready()) return;
    tone(1100, { dur: 0.14, type: 'triangle', vol: 0.08 });
    tone(1650, { dur: 0.18, type: 'sine', vol: 0.05, delay: 0.06 });
  },

  // Occasional rising tick while charging (heavily throttled by caller use).
  surgeCharge(progress) {
    if (!ready()) return;
    const now = performance.now();
    if (now - lastChargeAt < CHARGE_THROTTLE_MS) return;
    lastChargeAt = now;
    tone(300 + progress * 500, { dur: 0.04, type: 'sine', vol: 0.025 });
  },

  surgeActivate() {
    if (!ready()) return;
    tone(220, { dur: 0.5, type: 'sawtooth', vol: 0.07, slideTo: 880 });
    tone(440, { dur: 0.4, type: 'sine', vol: 0.08, delay: 0.08, slideTo: 1320 });
    noiseBurst({ dur: 0.35, vol: 0.05, from: 600, to: 4000 });
  },

  surgeEnd() {
    if (!ready()) return;
    tone(660, { dur: 0.3, type: 'sine', vol: 0.06, slideTo: 220 });
  },

  singularity() {
    if (!ready()) return;
    tone(180, { dur: 0.9, type: 'sine', vol: 0.12, slideTo: 40 });
    tone(880, { dur: 0.5, type: 'sine', vol: 0.06, slideTo: 110 });
    noiseBurst({ dur: 0.8, vol: 0.07, from: 3200, to: 80 });
    tone(523.25, { dur: 0.3, type: 'triangle', vol: 0.07, delay: 0.75 });
    tone(783.99, { dur: 0.4, type: 'triangle', vol: 0.06, delay: 0.9 });
  },

  horizon() {
    if (!ready()) return;
    tone(120, { dur: 1.4, type: 'sine', vol: 0.13, slideTo: 30 });
    tone(1760, { dur: 0.9, type: 'sine', vol: 0.05, slideTo: 220 });
    noiseBurst({ dur: 1.1, vol: 0.08, from: 5000, to: 60 });
    tone(659.25, { dur: 0.3, type: 'triangle', vol: 0.07, delay: 1.0 });
    tone(987.77, { dur: 0.35, type: 'triangle', vol: 0.06, delay: 1.15 });
    tone(1318.5, { dur: 0.5, type: 'triangle', vol: 0.05, delay: 1.3 });
  },

  save() {
    if (!ready()) return;
    tone(990, { dur: 0.06, type: 'sine', vol: 0.04 });
  },

  error() {
    if (!ready()) return;
    tone(160, { dur: 0.16, type: 'sawtooth', vol: 0.06 });
    tone(120, { dur: 0.2, type: 'sawtooth', vol: 0.05, delay: 0.12 });
  },

  // Soft notice for newly unlocked upgrades.
  unlock() {
    if (!ready()) return;
    tone(740, { dur: 0.09, type: 'triangle', vol: 0.07 });
    tone(1110, { dur: 0.14, type: 'triangle', vol: 0.06, delay: 0.07 });
  }
};
