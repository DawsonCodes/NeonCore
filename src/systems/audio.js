// Sound effects generated with the Web Audio API — no audio files needed.
// Tone parameters are unchanged from the original alpha build.

let audioCtx = null;
let isMuted = () => false;

export function initAudio(mutedGetter) {
  isMuted = mutedGetter;
}

// Creates the browser audio context the first time a sound is needed.
function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    audioCtx = null;
  }
}

// Plays a short generated sound effect.
function playTone(freq, duration = 0.1, type = 'sine', vol = 0.1) {
  if (isMuted()) return;
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

export const sound = {
  click(critical = false) {
    playTone(critical ? 980 : 620 + Math.random() * 220, critical ? 0.13 : 0.06, 'sine', critical ? 0.11 : 0.07);
  },
  buy() {
    playTone(850, 0.09, 'triangle', 0.12);
    setTimeout(() => playTone(1280, 0.12, 'triangle', 0.09), 55);
  },
  milestone() {
    playTone(523.25, 0.13, 'sine', 0.11);
    setTimeout(() => playTone(659.25, 0.13, 'sine', 0.11), 110);
    setTimeout(() => playTone(783.99, 0.22, 'sine', 0.1), 220);
  },
  deny() {
    playTone(180, 0.11, 'sawtooth', 0.05);
  }
};
