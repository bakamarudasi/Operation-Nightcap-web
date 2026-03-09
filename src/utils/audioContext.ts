/**
 * 共通 AudioContext 管理
 * 全コンポーネントで単一の AudioContext を再利用する
 */

let _sharedCtx: AudioContext | null = null;

/** 共有 AudioContext を取得（必要に応じて作成・再開） */
export function getAudioContext(): AudioContext {
  if (!_sharedCtx || _sharedCtx.state === 'closed') {
    _sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_sharedCtx.state === 'suspended') {
    _sharedCtx.resume();
  }
  return _sharedCtx;
}

// ─── BattleScreen 用効果音 ───

export function playBattleSound(type: 'slam' | 'flip') {
  try {
    const x = getAudioContext();
    if (type === 'slam') {
      const o = x.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(180, x.currentTime);
      o.frequency.exponentialRampToValueAtTime(50, x.currentTime + 0.15);
      const g = x.createGain();
      g.gain.setValueAtTime(0.12, x.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, x.currentTime + 0.2);
      o.connect(g); g.connect(x.destination);
      o.start(); o.stop(x.currentTime + 0.2);
      const b = x.createBuffer(1, x.sampleRate * 0.08, x.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.15));
      const n = x.createBufferSource();
      n.buffer = b;
      const ng = x.createGain();
      ng.gain.value = 0.08;
      n.connect(ng); ng.connect(x.destination);
      n.start();
    } else if (type === 'flip') {
      const o = x.createOscillator();
      o.type = 'sine';
      o.frequency.value = 2000;
      const g = x.createGain();
      g.gain.setValueAtTime(0.04, x.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, x.currentTime + 0.12);
      o.connect(g); g.connect(x.destination);
      o.start(); o.stop(x.currentTime + 0.12);
    }
  } catch (_) { /* ignore */ }
}

// ─── SelectScreen 用効果音 ───

export function playErrSound() {
  const ctx = getAudioContext();
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = 200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.3);
}

export function playVsSound() {
  const ctx = getAudioContext();
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
}

export function playKanpaiSound() {
  const ctx = getAudioContext();
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
}

// ─── GachaScreen 用効果音 ───

/** 注ぎ音: ノイズ + 低音の持続音 */
export function playPourSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const ns = ctx.createBufferSource();
    ns.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.08, t + 0.2);
    ng.gain.setValueAtTime(0.08, t + 0.8);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    ns.connect(bp).connect(ng).connect(ctx.destination);
    ns.start(t); ns.stop(t + 1.2);
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 80;
    o.frequency.setValueAtTime(80, t);
    o.frequency.linearRampToValueAtTime(120, t + 0.5);
    o.frequency.linearRampToValueAtTime(80, t + 1.0);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.04, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(og).connect(ctx.destination);
    o.start(t); o.stop(t + 1.2);
  } catch { /* audio not supported */ }
}

/** グロー音: レアリティに応じた上昇音 */
export function playGlowSound(rarity: number) {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    if (rarity >= 5) {
      const freqs = rarity >= 6 ? [400, 600, 800, 1000] : [350, 525, 700];
      freqs.forEach((freq, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq * 0.7, t + i * 0.12);
        o.frequency.exponentialRampToValueAtTime(freq, t + i * 0.12 + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + i * 0.12);
        g.gain.linearRampToValueAtTime(rarity >= 6 ? 0.1 : 0.07, t + i * 0.12 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.8);
        o.connect(g).connect(ctx.destination);
        o.start(t + i * 0.12);
        o.stop(t + i * 0.12 + 0.8);
      });
    } else {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 300 + rarity * 60;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.4);
    }
  } catch { /* audio not supported */ }
}

/** カード出現音: レアリティで音が変わる */
export function playRevealSound(rarity: number) {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    if (rarity >= 6) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const ns = ctx.createBufferSource(); ns.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.25, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      ns.connect(ng).connect(ctx.destination);
      ns.start(t);
      [1000, 1500, 2000].forEach((freq, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, t + 0.05 + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + i * 0.06 + 0.6);
        o.connect(g).connect(ctx.destination);
        o.start(t + 0.05 + i * 0.06);
        o.stop(t + 0.05 + i * 0.06 + 0.6);
      });
    } else if (rarity >= 4) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const baseFreq = rarity >= 5 ? 1200 : 800;
      o.frequency.setValueAtTime(baseFreq * 0.6, t);
      o.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(rarity >= 5 ? 0.08 : 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.3);
    } else {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(500 + rarity * 80, t);
      o.frequency.exponentialRampToValueAtTime(200, t + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.12);
    }
  } catch { /* audio not supported */ }
}

/** 結果表示音: 全カード揃った時の締め音 */
export function playResultSound(highestRarity: number) {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    if (highestRarity >= 5) {
      const chords = highestRarity >= 6
        ? [[523, 659, 784], [659, 784, 1047]]
        : [[440, 554, 659]];
      chords.forEach((freqs, ci) => {
        freqs.forEach((freq, fi) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
          const g = ctx.createGain();
          const start = t + ci * 0.25 + fi * 0.03;
          g.gain.setValueAtTime(0.07, start);
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
          o.connect(g).connect(ctx.destination);
          o.start(start); o.stop(start + 0.8);
        });
      });
    } else {
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = 600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.25);
    }
  } catch { /* audio not supported */ }
}
