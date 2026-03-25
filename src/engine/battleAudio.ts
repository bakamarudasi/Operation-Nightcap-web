import { getSharedAudioContext } from './audioContext.ts';

/** カード叩きつけ音 */
export function playSlamSound() {
  try {
    const x = getSharedAudioContext();
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
  } catch { /* audio not supported */ }
}

/** カードめくり音 */
export function playFlipSound() {
  try {
    const x = getSharedAudioContext();
    const o = x.createOscillator();
    o.type = 'sine';
    o.frequency.value = 2000;
    const g = x.createGain();
    g.gain.setValueAtTime(0.04, x.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, x.currentTime + 0.12);
    o.connect(g); g.connect(x.destination);
    o.start(); o.stop(x.currentTime + 0.12);
  } catch { /* audio not supported */ }
}
