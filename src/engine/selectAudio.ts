import { getSharedAudioContext, playTone, playNoiseBurst } from './audioContext.ts';

/** エラー音 (所持金不足など) */
export function playErrSound() {
  try {
    playTone({ freq: 200, type: 'square', gain: 0.15, duration: 0.3 });
  } catch { /* audio not supported */ }
}

/** VS画面登場音 */
export function playVsSound() {
  try {
    [300, 450, 600].forEach((freq, i) => {
      const ctx = getSharedAudioContext();
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.15);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.15 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.15);
      o.stop(t + i * 0.15 + 0.4);
    });
  } catch { /* audio not supported */ }
}

/** 乾杯音 (衝撃 + チャイム) */
export function playKanpaiSound() {
  try {
    // impact
    playNoiseBurst({ gain: 0.3, duration: 0.2 });
    // chime
    [800, 1200, 1600].forEach((freq, i) => {
      playTone({ freq, type: 'sine', gain: 0.1, duration: 0.5, startAt: 0.05 + i * 0.08 });
    });
  } catch { /* audio not supported */ }
}
