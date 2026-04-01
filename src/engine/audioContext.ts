/** 共有 AudioContext シングルトン */
let _ctx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

/**
 * 単音を簡潔に鳴らすヘルパー。
 * オシレーター生成 → ゲイン設定 → 接続 → 再生の定型処理を1行で呼べる。
 */
export interface ToneParams {
  freq: number;
  type?: OscillatorType;
  gain?: number;
  duration?: number;
  /** 再生開始オフセット（ctx.currentTime からの秒数） */
  startAt?: number;
  /** 周波数のランプ先（exponentialRampToValueAtTime） */
  freqRamp?: number;
}

export function playTone(params: ToneParams): void {
  const ctx = getSharedAudioContext();
  const t = ctx.currentTime + (params.startAt ?? 0);
  const dur = params.duration ?? 0.2;

  const o = ctx.createOscillator();
  o.type = params.type ?? 'sine';
  o.frequency.setValueAtTime(params.freq, t);
  if (params.freqRamp !== undefined) {
    o.frequency.exponentialRampToValueAtTime(params.freqRamp, t + dur);
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(params.gain ?? 0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);

  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

/**
 * ホワイトノイズバーストを鳴らすヘルパー。
 * 衝撃音・液体音などに使用。
 */
export function playNoiseBurst(opts: {
  gain?: number;
  duration?: number;
  startAt?: number;
  decay?: number;
}): void {
  const ctx = getSharedAudioContext();
  const t = ctx.currentTime + (opts.startAt ?? 0);
  const dur = opts.duration ?? 0.15;

  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const decayRate = opts.decay ?? 1;
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decayRate);
  }

  const ns = ctx.createBufferSource();
  ns.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  ns.connect(g).connect(ctx.destination);
  ns.start(t);
}
