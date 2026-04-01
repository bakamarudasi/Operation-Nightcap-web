import { getSharedAudioContext, playTone } from './audioContext.ts';

/** 注ぎ音: ノイズ + 低音の持続音 */
export function playPourSound() {
  try {
    const ctx = getSharedAudioContext();
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
    if (rarity >= 5) {
      // 高レア: 和音で上昇するファンファーレ
      const freqs = rarity >= 6 ? [400, 600, 800, 1000] : [350, 525, 700];
      freqs.forEach((freq, i) => {
        const ctx = getSharedAudioContext();
        const t = ctx.currentTime;
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
      // 低レア: 短い確認音
      playTone({ freq: 300 + rarity * 60, gain: 0.06, duration: 0.4 });
    }
  } catch { /* audio not supported */ }
}

/** カード出現音: レアリティで音が変わる */
export function playRevealSound(rarity: number) {
  try {
    if (rarity >= 6) {
      // ★6: 衝撃音 + 高音チャイム
      const ctx = getSharedAudioContext();
      const t = ctx.currentTime;
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
        playTone({ freq, gain: 0.08, duration: 0.6, startAt: 0.05 + i * 0.06 });
      });
    } else if (rarity >= 4) {
      // ★4-5: キラッと光る音
      const baseFreq = rarity >= 5 ? 1200 : 800;
      playTone({ freq: baseFreq * 0.6, freqRamp: baseFreq, gain: rarity >= 5 ? 0.08 : 0.06, duration: 0.3 });
    } else {
      // ★1-3: 軽い「ポン」
      playTone({ freq: 500 + rarity * 80, freqRamp: 200, gain: 0.04, duration: 0.12 });
    }
  } catch { /* audio not supported */ }
}

/** 結果表示音: 全カード揃った時の締め音 */
export function playResultSound(highestRarity: number) {
  try {
    if (highestRarity >= 5) {
      // 高レア入り: 祝福チャイム
      const chords = highestRarity >= 6
        ? [[523, 659, 784], [659, 784, 1047]] // C5-E5-G5 → E5-G5-C6
        : [[440, 554, 659]]; // A4-C#5-E5
      chords.forEach((freqs, ci) => {
        freqs.forEach((freq, fi) => {
          playTone({ freq, gain: 0.07, duration: 0.8, startAt: ci * 0.25 + fi * 0.03 });
        });
      });
    } else {
      // 通常: 短い完了音
      playTone({ freq: 600, type: 'triangle', gain: 0.05, duration: 0.25 });
    }
  } catch { /* audio not supported */ }
}
