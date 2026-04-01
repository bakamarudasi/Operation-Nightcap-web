import { getSharedAudioContext, playTone, playNoiseBurst } from './audioContext.ts';

/** カード叩きつけ音 */
export function playSlamSound() {
  try {
    playTone({ freq: 180, freqRamp: 50, gain: 0.12, duration: 0.15 });
    playNoiseBurst({ gain: 0.08, duration: 0.08, decay: 0.15 });
  } catch { /* audio not supported */ }
}

/** カードめくり音 */
export function playFlipSound() {
  try {
    playTone({ freq: 2000, gain: 0.04, duration: 0.12 });
  } catch { /* audio not supported */ }
}
