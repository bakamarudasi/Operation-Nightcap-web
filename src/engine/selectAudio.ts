import { getSharedAudioContext } from './audioContext.ts';

/** エラー音 (所持金不足など) */
export function playErrSound() {
  try {
    const ctx = getSharedAudioContext();
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch { /* audio not supported */ }
}

/** VS画面登場音 */
export function playVsSound() {
  try {
    const ctx = getSharedAudioContext();
    [300, 450, 600].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.15 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch { /* audio not supported */ }
}

/** 乾杯音 (衝撃 + チャイム) */
export function playKanpaiSound() {
  try {
    const ctx = getSharedAudioContext();
    const t = ctx.currentTime;
    // impact
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(ng).connect(ctx.destination);
    n.start(t);
    // chime
    [800, 1200, 1600].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.1, t + 0.05 + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + i * 0.08 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t + 0.05 + i * 0.08);
      o.stop(t + 0.05 + i * 0.08 + 0.5);
    });
  } catch { /* audio not supported */ }
}
