let audioContext = null;

function getContext() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }
  return audioContext;
}

function playTone({ freq, duration, type = 'sine', gain = 0.04 }) {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playSuccess() {
  playTone({ freq: 880, duration: 0.08, type: 'triangle' });
  setTimeout(() => playTone({ freq: 1175, duration: 0.08, type: 'triangle' }), 70);
}

export function playError() {
  playTone({ freq: 220, duration: 0.14, type: 'square', gain: 0.03 });
}

export function playTap() {
  playTone({ freq: 640, duration: 0.04, type: 'sine', gain: 0.02 });
}

export function playDiceRollTick() {
  playTone({ freq: 360, duration: 0.03, type: 'square', gain: 0.012 });
}

export function playDiceImpact() {
  playTone({ freq: 180, duration: 0.07, type: 'triangle', gain: 0.045 });
  setTimeout(() => playTone({ freq: 240, duration: 0.06, type: 'triangle', gain: 0.035 }), 50);
}

export function playDiceJackpot() {
  playTone({ freq: 988, duration: 0.09, type: 'triangle', gain: 0.04 });
  setTimeout(() => playTone({ freq: 1319, duration: 0.09, type: 'triangle', gain: 0.038 }), 80);
  setTimeout(() => playTone({ freq: 1568, duration: 0.11, type: 'triangle', gain: 0.035 }), 160);
}

export function playDiceUltraJackpot() {
  playTone({ freq: 880, duration: 0.08, type: 'sawtooth', gain: 0.03 });
  setTimeout(() => playTone({ freq: 1175, duration: 0.08, type: 'sawtooth', gain: 0.03 }), 70);
  setTimeout(() => playTone({ freq: 1568, duration: 0.1, type: 'triangle', gain: 0.034 }), 140);
  setTimeout(() => playTone({ freq: 2093, duration: 0.12, type: 'triangle', gain: 0.03 }), 230);
}

export function playReceiveSfx() {
  playTone({ freq: 700, duration: 0.05, type: 'triangle', gain: 0.03 });
  setTimeout(() => playTone({ freq: 930, duration: 0.07, type: 'triangle', gain: 0.03 }), 50);
}

export function playPaySfx() {
  playTone({ freq: 360, duration: 0.06, type: 'square', gain: 0.025 });
  setTimeout(() => playTone({ freq: 290, duration: 0.08, type: 'square', gain: 0.022 }), 55);
}

export function playTransferSfx() {
  playTone({ freq: 520, duration: 0.04, type: 'sine', gain: 0.028 });
  setTimeout(() => playTone({ freq: 650, duration: 0.05, type: 'sine', gain: 0.026 }), 40);
}

export function playHallOpenReverb() {
  playTone({ freq: 540, duration: 0.06, type: 'triangle', gain: 0.03 });
  setTimeout(() => playTone({ freq: 540, duration: 0.1, type: 'sine', gain: 0.012 }), 85);
  setTimeout(() => playTone({ freq: 720, duration: 0.12, type: 'sine', gain: 0.01 }), 155);
}
