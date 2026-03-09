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

// ─── ヘルパーファクトリ ───

/** 単音オシレーターを作成して自動接続 */
function tone(
  ctx: AudioContext, t: number,
  type: OscillatorType, freq: number, gain: number, duration: number,
  delay = 0,
  freqEnv?: (o: OscillatorNode, start: number) => void,
  gainEnv?: (g: GainNode, start: number) => void,
) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  const start = t + delay;
  if (gainEnv) {
    gainEnv(g, start);
  } else {
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + duration);
  }
  if (freqEnv) freqEnv(o, start);
  o.connect(g).connect(ctx.destination);
  o.start(start);
  o.stop(start + duration);
}

/** ノイズバッファ生成 */
function noiseBurst(ctx: AudioContext, t: number, duration: number, gain: number, decay = 1) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (decay < 1 ? Math.exp(-i / (d.length * decay)) : (1 - i / d.length));
  const ns = ctx.createBufferSource();
  ns.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  ns.connect(g).connect(ctx.destination);
  ns.start(t);
  return ns;
}

/** 和音を鳴らす */
function chord(ctx: AudioContext, t: number, freqs: number[], type: OscillatorType, gain: number, duration: number, stagger = 0.03) {
  freqs.forEach((freq, i) => {
    tone(ctx, t, type, freq, gain, duration, i * stagger);
  });
}

// ─── BattleScreen 用効果音 ───

export function playBattleSound(type: 'slam' | 'flip') {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    if (type === 'slam') {
      tone(ctx, t, 'sine', 180, 0.12, 0.2, 0, (o, s) => {
        o.frequency.setValueAtTime(180, s);
        o.frequency.exponentialRampToValueAtTime(50, s + 0.15);
      });
      noiseBurst(ctx, t, 0.08, 0.08, 0.15);
    } else {
      tone(ctx, t, 'sine', 2000, 0.04, 0.12);
    }
  } catch { /* ignore */ }
}

// ─── SelectScreen 用効果音 ───

export function playErrSound() {
  try {
    const ctx = getAudioContext();
    tone(ctx, ctx.currentTime, 'square', 200, 0.15, 0.3);
  } catch { /* ignore */ }
}

export function playVsSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    [300, 450, 600].forEach((freq, i) => {
      tone(ctx, t, 'sawtooth', freq, 0, 0.4, i * 0.15, undefined, (g, s) => {
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.08, s + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.4);
      });
    });
  } catch { /* ignore */ }
}

export function playKanpaiSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    noiseBurst(ctx, t, 0.2, 0.3);
    chord(ctx, t + 0.05, [800, 1200, 1600], 'sine', 0.1, 0.5, 0.08);
  } catch { /* ignore */ }
}

// ─── GachaScreen 用効果音 ───

export function playPourSound() {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    // ノイズ (液体感)
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
    // 低いうなり (とくとく感)
    tone(ctx, t, 'sine', 80, 0.04, 1.2, 0, (o, s) => {
      o.frequency.setValueAtTime(80, s);
      o.frequency.linearRampToValueAtTime(120, s + 0.5);
      o.frequency.linearRampToValueAtTime(80, s + 1.0);
    });
  } catch { /* ignore */ }
}

export function playGlowSound(rarity: number) {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    if (rarity >= 5) {
      const freqs = rarity >= 6 ? [400, 600, 800, 1000] : [350, 525, 700];
      const vol = rarity >= 6 ? 0.1 : 0.07;
      freqs.forEach((freq, i) => {
        tone(ctx, t, 'sine', freq, 0, 0.8, i * 0.12, (o, s) => {
          o.frequency.setValueAtTime(freq * 0.7, s);
          o.frequency.exponentialRampToValueAtTime(freq, s + 0.2);
        }, (g, s) => {
          g.gain.setValueAtTime(0, s);
          g.gain.linearRampToValueAtTime(vol, s + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, s + 0.8);
        });
      });
    } else {
      tone(ctx, t, 'sine', 300 + rarity * 60, 0.06, 0.4);
    }
  } catch { /* ignore */ }
}

export function playRevealSound(rarity: number) {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    if (rarity >= 6) {
      noiseBurst(ctx, t, 0.15, 0.25);
      chord(ctx, t + 0.05, [1000, 1500, 2000], 'sine', 0.08, 0.6, 0.06);
    } else if (rarity >= 4) {
      const baseFreq = rarity >= 5 ? 1200 : 800;
      tone(ctx, t, 'sine', baseFreq, rarity >= 5 ? 0.08 : 0.06, 0.3, 0, (o, s) => {
        o.frequency.setValueAtTime(baseFreq * 0.6, s);
        o.frequency.exponentialRampToValueAtTime(baseFreq, s + 0.08);
      });
    } else {
      tone(ctx, t, 'sine', 500 + rarity * 80, 0.04, 0.12, 0, (o, s) => {
        o.frequency.setValueAtTime(500 + rarity * 80, s);
        o.frequency.exponentialRampToValueAtTime(200, s + 0.1);
      });
    }
  } catch { /* ignore */ }
}

export function playResultSound(highestRarity: number) {
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    if (highestRarity >= 5) {
      const chords = highestRarity >= 6
        ? [[523, 659, 784], [659, 784, 1047]]
        : [[440, 554, 659]];
      chords.forEach((freqs, ci) => {
        chord(ctx, t + ci * 0.25, freqs, 'sine', 0.07, 0.8, 0.03);
      });
    } else {
      tone(ctx, t, 'triangle', 600, 0.05, 0.25);
    }
  } catch { /* ignore */ }
}
