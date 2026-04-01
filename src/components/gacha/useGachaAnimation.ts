import { useState, useCallback, useRef, useEffect } from 'react';
import type { GachaResult } from '../../data/types.ts';
import { GACHA_SINGLE_COST, GACHA_MULTI_COST } from '../../data/gacha.ts';
import { playPourSound, playGlowSound, playRevealSound, playResultSound } from '../../engine/gachaAudio.ts';
import { RARITY_CONFIG } from './gachaConstants.ts';

export function useGachaAnimation(
  pullGacha: (count: 1 | 10) => GachaResult[] | null,
  money: number,
  particles: { burstCenter: (color: string, count: number) => void; rain: (color: string, count: number) => void }
) {
  const { burstCenter, rain } = particles;

  const [animPhase, setAnimPhase] = useState<'idle' | 'pour' | 'glow' | 'reveal' | 'result'>('idle');
  const [results, setResults] = useState<GachaResult[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [selected, setSelected] = useState<GachaResult | null>(null);
  const [refundTotal, setRefundTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState<1 | 10>(1);
  const [glowColor, setGlowColor] = useState('#ffaa44');
  const [liquidFill, setLiquidFill] = useState(0);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pullCount, setPullCount] = useState(0);
  const [manualReveal, setManualReveal] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fillRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gachaPulledRef = useRef(false);

  const isIdle = animPhase === 'idle' || animPhase === 'result';

  const clearAll = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (fillRef.current) { clearInterval(fillRef.current); fillRef.current = null; }
  };

  const triggerShake = (intensity = 1) => {
    setShake(true);
    const t = setTimeout(() => setShake(false), 300 + intensity * 100);
    timers.current.push(t);
  };

  const triggerFlash = (color: string, duration = 200) => {
    setFlash(color);
    const t = setTimeout(() => setFlash(null), duration);
    timers.current.push(t);
  };

  const skipToResult = useCallback(() => {
    if (animPhase === 'idle' || animPhase === 'result') return;
    clearAll();
    if (animPhase === 'pour') {
      if (gachaPulledRef.current) { setAnimPhase('idle'); return; }
      gachaPulledRef.current = true;
      const count = pendingCount;
      const res = pullGacha(count);
      if (!res) { setAnimPhase('idle'); return; }
      const refund = res.filter(r => r.isDuplicate).reduce((s, r) => s + r.refund, 0);
      const highest = Math.max(...res.map(r => r.rarity));
      setResults(res); setRefundTotal(refund);
      setPullCount(p => p + count);
      setRevealedCount(res.length);
      setAnimPhase('result');
      playResultSound(highest);
    } else {
      setRevealedCount(results.length);
      setAnimPhase('result');
      if (results.length > 0) playResultSound(Math.max(...results.map(r => r.rarity)));
    }
  }, [animPhase, pendingCount, pullGacha, results]);

  const revealNext = useCallback(() => {
    if (!manualReveal || animPhase !== 'reveal') return;
    if (revealedCount < results.length) {
      const r = results[revealedCount];
      setRevealedCount(c => c + 1);
      playRevealSound(r.rarity);
      if (r.rarity >= 4) triggerShake(r.rarity >= 6 ? 2 : 0.5);
      if (revealedCount + 1 >= results.length) {
        const t = setTimeout(() => {
          setAnimPhase('result');
          playResultSound(Math.max(...results.map(rr => rr.rarity)));
        }, 600);
        timers.current.push(t);
      }
    }
  }, [manualReveal, animPhase, revealedCount, results]);

  const startGacha = useCallback((count: 1 | 10) => {
    const cost = count === 1 ? GACHA_SINGLE_COST : GACHA_MULTI_COST;
    if (money < cost || !isIdle) return;
    clearAll();
    gachaPulledRef.current = false;
    setPendingCount(count);
    setSelected(null); setLiquidFill(0);
    setAnimPhase('pour');
    playPourSound();

    let fill = 0;
    fillRef.current = setInterval(() => {
      fill += 2;
      setLiquidFill(Math.min(fill, 100));
      if (fill >= 100 && fillRef.current) clearInterval(fillRef.current);
    }, 25);

    const t1 = setTimeout(() => {
      if (gachaPulledRef.current) return;
      gachaPulledRef.current = true;
      const res = pullGacha(count);
      if (!res) { setAnimPhase('idle'); return; }

      const refund = res.filter(r => r.isDuplicate).reduce((s, r) => s + r.refund, 0);
      const highest = Math.max(...res.map(r => r.rarity));
      const gc = highest >= 6 ? '#ff3355' : highest >= 5 ? '#ffcc44' : highest >= 4 ? '#cc88ff' : highest >= 3 ? '#7a9aee' : '#ffaa44';

      setResults(res); setRefundTotal(refund); setGlowColor(gc);
      setPullCount(p => p + count);
      setAnimPhase('glow');
      playGlowSound(highest);

      if (highest >= 5) {
        triggerShake(highest >= 6 ? 3 : 1);
        triggerFlash(gc, highest >= 6 ? 400 : 250);
      }

      const t2 = setTimeout(() => {
        setRevealedCount(0); setAnimPhase('reveal');
        const pc = RARITY_CONFIG[highest]?.particle || '#ffaa44';
        if (highest >= 5) burstCenter(pc, highest >= 6 ? 80 : 40);
        if (highest >= 4) rain(pc, highest >= 6 ? 50 : 20);

        const useManual = count === 10;
        setManualReveal(useManual);

        if (useManual) {
          const t = setTimeout(() => {
            setRevealedCount(1);
            playRevealSound(res[0].rarity);
          }, 200);
          timers.current.push(t);
        } else {
          res.forEach((r, i) => {
            const t = setTimeout(() => {
              setRevealedCount(i + 1);
              playRevealSound(r.rarity);
              if (r.rarity >= 4) triggerShake(r.rarity >= 6 ? 2 : 0.5);
            }, i * 100);
            timers.current.push(t);
          });

          const t3 = setTimeout(() => {
            setAnimPhase('result');
            playResultSound(highest);
          }, res.length * 100 + 600);
          timers.current.push(t3);
        }
      }, 1100);
      timers.current.push(t2);
    }, 1500);
    timers.current.push(t1);
  }, [money, isIdle, pullGacha, burstCenter, rain]);

  useEffect(() => () => clearAll(), []);

  const highest = results.length > 0 ? Math.max(...results.map(r => r.rarity)) : 0;

  return {
    animPhase,
    results,
    revealedCount,
    selected,
    setSelected,
    refundTotal,
    pendingCount,
    glowColor,
    liquidFill,
    shake,
    flash,
    pullCount,
    manualReveal,
    isIdle,
    highest,
    clearAll,
    triggerShake,
    triggerFlash,
    skipToResult,
    revealNext,
    startGacha,
  };
}
