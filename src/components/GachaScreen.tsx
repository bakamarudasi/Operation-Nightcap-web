import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { GACHA_SINGLE_COST, GACHA_MULTI_COST } from '../data/gacha.ts';
import { buildCardCountMap } from '../data/constants.ts';
import type { GachaResult } from '../data/types.ts';

import { playPourSound, playGlowSound, playRevealSound, playResultSound } from '../engine/gachaAudio.ts';
import { useParticles } from './gacha/useParticles.ts';
import { RARITY_CONFIG, MENU_ROWS, GACHA_CSS } from './gacha/gachaConstants.ts';
import { GachaCollection } from './gacha/GachaCollection.tsx';
import { FeaturedCard } from './gacha/FeaturedCard.tsx';

export function GachaScreen() {
  const { t } = useTranslation();
  const money = useGameStore(s => s.money);
  const inventory = useGameStore(s => s.inventory);
  const pullGacha = useGameStore(s => s.pullGacha);
  const setScreen = useGameStore(s => s.setScreen);

  const inventoryMap = useMemo(() => buildCardCountMap(inventory), [inventory]);

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
  const [selectedTab, setSelectedTab] = useState<'rates' | 'collection'>('rates');
  const [pullCount, setPullCount] = useState(0);
  const [manualReveal, setManualReveal] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fillRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gachaPulledRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { burstCenter, rain } = useParticles(canvasRef);

  const isIdle = animPhase === 'idle' || animPhase === 'result';

  const getCard = (id: string) => CARD_DATA[id] ?? { id, name: id, emoji: '❓', type: 'drink' as const, rarity: 1, price: 0, description: '???' };

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

  const collectionStats = useMemo(() => {
    const total = Object.keys(CARD_DATA).length;
    const owned = Object.keys(inventoryMap).filter(k => CARD_DATA[k] && inventoryMap[k] > 0).length;
    return { total, owned };
  }, [inventoryMap]);

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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      fontFamily: "'Zen Maru Gothic','Noto Serif JP','Hiragino Sans',sans-serif",
      background: '#1a0e08', color: '#e8d5b5',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transform: shake ? `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 6}px)` : 'none',
      transition: shake ? 'none' : 'transform 0.1s ease-out',
    }}>
      <style>{GACHA_CSS}</style>

      {/* パーティクルキャンバス */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none',
        width: '100%', height: '100%',
      }} />

      {/* フラッシュ */}
      {flash && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none',
          background: `radial-gradient(ellipse at center,${flash}44,${flash}11,transparent 70%)`,
          animation: 'resultIn .15s ease',
        }} />
      )}

      {/* 背景木目テクスチャ */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', background: `
        repeating-linear-gradient(173deg,transparent,transparent 60px,rgba(110,60,8,.04) 60px,rgba(110,60,8,.04) 61px),
        repeating-linear-gradient(7deg,transparent,transparent 80px,rgba(80,35,4,.03) 80px,rgba(80,35,4,.03) 81px),
        radial-gradient(ellipse at 50% -10%,rgba(255,130,20,.07) 0%,transparent 55%),
        radial-gradient(ellipse at 20% 100%,rgba(60,20,0,.45) 0%,transparent 50%),
        radial-gradient(ellipse at 80% 100%,rgba(60,20,0,.45) 0%,transparent 50%)
      `}} />

      {/* のれん紐 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 5,
        background: 'repeating-linear-gradient(90deg,#991500,#991500 2px,transparent 2px,transparent 18px)',
        opacity: .8, zIndex: 3,
      }} />

      {/* 提灯 */}
      {['6%', '87%'].map((left, i) => (
        <div key={i} className={i === 0 ? 'sway1' : 'sway2'} style={{
          position: 'absolute', top: -2, left, fontSize: 34, zIndex: 3,
          filter: 'drop-shadow(0 4px 14px rgba(255,70,0,.6))', lineHeight: 1,
        }}>🏮</div>
      ))}

      {/* ── ヘッダー ── */}
      <header style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'linear-gradient(180deg,rgba(30,14,0,.97),rgba(20,9,0,.93))',
        borderBottom: '1px solid rgba(255,180,80,0.15)',
        boxShadow: '0 4px 24px rgba(0,0,0,.8)',
        flexShrink: 0,
      }}>
        <button className="gbtn" onClick={() => setScreen('title')} style={{
          background: 'none', border: '1px solid rgba(255,180,80,0.25)',
          color: '#c9a96e', padding: '6px 16px', borderRadius: 6,
          fontFamily: 'inherit', fontSize: 13,
        }}>{t('common.back')}</button>
        <h1 style={{
          fontSize: 26, fontWeight: 900, color: '#fbbf24',
          textShadow: '0 0 20px rgba(251,191,36,0.4)',
          letterSpacing: 4, margin: 0,
          fontFamily: "'Shippori Mincho','Noto Serif JP',serif",
        }}>
          {t('gacha.titlePlain')}
        </h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,180,80,0.1)', border: '1px solid rgba(255,180,80,0.3)',
          borderRadius: 20, padding: '6px 16px',
        }}>
          <span style={{ fontSize: 18 }}>🪙</span>
          <span style={{
            fontSize: 20, fontWeight: 700, color: '#fbbf24',
            fontFamily: "'Courier New', monospace",
          }}>{money.toLocaleString()}</span>
        </div>
      </header>

      {/* ── メイン2カラムレイアウト ── */}
      <div style={{
        flex: 1, overflow: 'auto', position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24, maxWidth: 1280, margin: '0 auto', width: '100%',
        padding: '20px 24px',
        alignContent: 'start',
      }}>

        {/* ▌LEFT COLUMN — ガチャ演出 + ボタン */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>

        {/* ======== IDLE: ヒーロー + ボタン ======== */}
        {animPhase === 'idle' && (
          <>
            {/* アンビエント煙 */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  position: 'absolute',
                  bottom: `${10 + i * 18}%`, left: `${10 + i * 20}%`,
                  width: 60 + i * 15, height: 60 + i * 15,
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse,rgba(255,180,80,.08),transparent 70%)',
                  animation: `smokeRise ${6 + i * 2}s ease-in-out infinite`,
                  animationDelay: `${i * 1.3}s`,
                }} />
              ))}
            </div>

            {/* ヒーロービジュアル */}
            <div className="hero-fade" style={{
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(60,30,10,0.6) 0%, rgba(30,15,5,0.8) 100%)',
              border: '1px solid rgba(255,180,80,0.2)',
              borderRadius: 16,
              padding: '32px 24px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 8, left: 16, fontSize: 28,
                animation: 'floatLantern 3s ease-in-out infinite',
              }}>🏮</div>
              <div style={{
                position: 'absolute', top: 8, right: 16, fontSize: 28,
                animation: 'floatLantern 3s ease-in-out infinite 1.5s',
              }}>🏮</div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
                marginBottom: 12, position: 'relative',
              }}>
                <div className="bottle-float" style={{ fontSize: 40, opacity: 0.5, animationDelay: '0.5s' }}>🍶</div>
                <div style={{ position: 'relative', animation: 'glassIdle 6s ease-in-out infinite' }}>
                  <div style={{
                    fontSize: 72, lineHeight: 1,
                    filter: 'drop-shadow(0 4px 20px rgba(255,140,30,.4))',
                    animation: 'pulseGlow 3s ease-in-out infinite',
                    borderRadius: '50%',
                  }}>🍺</div>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      position: 'absolute', top: -8 - i * 4, left: `${30 + i * 12}%`,
                      width: 6, height: 12, borderRadius: 4,
                      background: 'rgba(255,220,160,.12)',
                      animation: `steamWisp ${2 + i * 0.5}s ease-in-out infinite`,
                      animationDelay: `${i * 0.7}s`,
                    }} />
                  ))}
                </div>
                <div className="bottle-float" style={{ fontSize: 40, opacity: 0.5, animationDelay: '1.2s' }}>🫗</div>
              </div>
              <div style={{
                fontSize: 14, color: '#c9a96e', letterSpacing: 3, marginBottom: 16,
                fontFamily: "'Shippori Mincho','Noto Serif JP',serif",
              }}>{t('gacha.heroText')}</div>

              {/* 収集進捗バー */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>{t('gacha.collectProgress')}</span>
                <div style={{ width: 120, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(collectionStats.owned / collectionStats.total) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #fbbf24, #ff8c00)',
                    borderRadius: 3, transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24', fontFamily: "'Courier New', monospace" }}>
                  {collectionStats.owned}<span style={{ color: '#888', fontSize: 12 }}>/{collectionStats.total}</span>
                </span>
              </div>
            </div>

            {/* 今宵のおすすめ */}
            <FeaturedCard getCard={getCard} />

            {/* ── ガチャボタン ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
              <button className="gbtn" disabled={money < GACHA_SINGLE_COST} onClick={() => startGacha(1)} style={{
                position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '20px 16px', borderRadius: 14,
                background: money >= GACHA_SINGLE_COST
                  ? 'linear-gradient(180deg, #3d2814 0%, #2a1a0c 100%)' : 'rgba(20,10,0,.4)',
                border: `2px solid ${money >= GACHA_SINGLE_COST ? 'rgba(255,180,80,0.3)' : '#2a1508'}`,
                color: '#fff',
                boxShadow: money >= GACHA_SINGLE_COST
                  ? '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,180,80,0.1)' : 'none',
                overflow: 'hidden',
              }}>
                <span style={{ fontSize: 32 }}>🍺</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: money >= GACHA_SINGLE_COST ? '#e8d5b5' : '#443322', letterSpacing: 2 }}>{t('gacha.singlePull')}</span>
                <span style={{ fontSize: 13, color: money >= GACHA_SINGLE_COST ? '#fbbf24' : '#332211', fontWeight: 700 }}>
                  🪙 {GACHA_SINGLE_COST.toLocaleString()}
                </span>
              </button>

              <button className="gbtn" disabled={money < GACHA_MULTI_COST} onClick={() => startGacha(10)} style={{
                position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '20px 16px', borderRadius: 14,
                background: money >= GACHA_MULTI_COST
                  ? 'linear-gradient(180deg, #5c1a1a 0%, #3a0e0e 100%)' : 'rgba(20,10,0,.4)',
                border: `2px solid ${money >= GACHA_MULTI_COST ? 'rgba(255,80,80,0.35)' : '#2a1508'}`,
                color: '#fff',
                boxShadow: money >= GACHA_MULTI_COST
                  ? '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,80,80,0.1)' : 'none',
                overflow: 'hidden',
              }}>
                {money >= GACHA_MULTI_COST && <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg,#aa1800,#dd3300,#aa1800)',
                  borderRadius: 20, padding: '3px 12px',
                  fontSize: 8, color: '#ffddaa', letterSpacing: 1, fontWeight: 700,
                  whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(200,40,0,.5)',
                  border: '1px solid rgba(255,100,50,.3)',
                  animation: 'neonFlicker 4s ease-in-out infinite',
                }}>{t('gacha.multiDiscount')}</div>}
                <span style={{ fontSize: 32 }}>🍻</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: money >= GACHA_MULTI_COST ? '#e8d5b5' : '#443322', letterSpacing: 2 }}>{t('gacha.multiPull')}</span>
                <span style={{ fontSize: 13, color: money >= GACHA_MULTI_COST ? '#fbbf24' : '#332211', fontWeight: 700 }}>
                  🪙 {GACHA_MULTI_COST.toLocaleString()}
                </span>
              </button>
            </div>

            {/* サブ情報 */}
            <div style={{ textAlign: 'center', fontSize: 12, color: '#888', padding: '4px 0' }}>
              <span>{t('gacha.rateSecret')} <span style={{ color: '#e8a020' }}>3.5%</span></span>
              <span style={{ margin: '0 12px', color: '#555' }}>|</span>
              <span>{t('gacha.rateMyth')} <span style={{ color: '#ff3366' }}>0.5%</span></span>
              <span style={{ margin: '0 12px', color: '#555' }}>|</span>
              <span>{t('gacha.dupConvert')}</span>
            </div>

            {/* コイン不足時のUX */}
            {money < GACHA_SINGLE_COST && (
              <div style={{
                background: 'rgba(80,30,10,.4)', border: '1px solid rgba(255,120,50,.2)',
                borderRadius: 10, padding: '12px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, color: '#cc8866', marginBottom: 8 }}>
                  🪙 {t('gacha.shortMoney', { amount: (GACHA_SINGLE_COST - money).toLocaleString() })}
                </div>
                <button className="gbtn" onClick={() => setScreen('shop')} style={{
                  background: 'linear-gradient(160deg,#2a3a10,#1a2508)',
                  border: '1px solid rgba(120,180,50,.35)',
                  borderRadius: 8, padding: '8px 20px', color: '#aad060',
                  fontSize: 12, fontWeight: 700, letterSpacing: 1,
                }}>
                  {t('gacha.goShop')}
                </button>
              </div>
            )}
          </>
        )}

        {/* ======== POUR: 注ぎアニメ ======== */}
        {animPhase === 'pour' && (
          <div style={{
            flex: 1, minHeight: 340, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 0,
          }}>
            <div style={{ position: 'relative', height: 55, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  position: 'absolute',
                  width: 4, height: 16, borderRadius: '0 0 3px 3px',
                  background: `rgba(${pendingCount === 10 ? '255,200,60' : '200,150,70'},.75)`,
                  left: `calc(50% + ${(i - 2) * 7}px)`,
                  animation: 'pourDrop .55s ease-in infinite',
                  animationDelay: `${i * .12}s`,
                }} />
              ))}
            </div>
            <div style={{ position: 'relative', width: 100, height: 120, flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                border: '2px solid rgba(255,220,150,.22)', borderTop: 'none',
                borderRadius: '5px 5px 12px 12px',
                background: 'rgba(255,255,255,.035)', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: `${liquidFill}%`,
                  background: pendingCount === 10
                    ? 'linear-gradient(180deg,rgba(255,200,60,.35),rgba(200,130,20,.75))'
                    : 'linear-gradient(180deg,rgba(200,160,80,.3),rgba(150,90,20,.65))',
                  transition: 'height .025s linear', borderRadius: '0 0 10px 10px',
                }}>
                  <div style={{
                    position: 'absolute', top: -3, left: 0, right: 0, height: 10,
                    background: 'rgba(255,255,255,.22)',
                    borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
                  }} />
                  {liquidFill > 20 && [0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      position: 'absolute',
                      bottom: `${15 + i * 15}%`, left: `${20 + i * 14}%`,
                      width: 3 + (i % 2) * 2, height: 3 + (i % 2) * 2,
                      borderRadius: '50%', background: 'rgba(255,255,255,.25)',
                      animation: `bubbleUp ${1.2 + i * 0.3}s ease-in infinite`,
                      animationDelay: `${i * 0.25}s`,
                    }} />
                  ))}
                </div>
                <div style={{
                  position: 'absolute', top: 6, left: 10, width: 5, bottom: 12,
                  background: 'linear-gradient(180deg,rgba(255,255,255,.14),transparent)', borderRadius: 3,
                }} />
                <div style={{
                  position: 'absolute', top: 6, right: 14, width: 3, bottom: 20,
                  background: 'linear-gradient(180deg,rgba(255,255,255,.07),transparent)', borderRadius: 2,
                }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#8a6030', letterSpacing: 5, marginTop: 20 }} className="flick">
              {pendingCount === 1 ? t('gacha.pouring') : t('gacha.pouringMulti')}
            </div>
            <button className="gbtn" onClick={skipToResult} style={{
              marginTop: 16, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 6, padding: '6px 20px', color: '#666', fontSize: 11,
            }}>{t('gacha.skip')}</button>
          </div>
        )}

        {/* ======== GLOW: グラス光る ======== */}
        {animPhase === 'glow' && (
          <div style={{
            flex: 1, minHeight: 340, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
          }}>
            {highest >= 5 && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse at 50% 45%, ${glowColor}22, transparent 60%)`,
                animation: 'bgPulse 1s ease-in-out infinite',
              }} />
            )}
            <div style={{
              width: 100, height: 120, position: 'relative',
              '--gc': glowColor,
              animation: 'glassGlow 1s ease forwards',
              borderRadius: '5px 5px 12px 12px',
              border: '2px solid rgba(255,220,150,.3)', borderTop: 'none',
              overflow: 'hidden', background: 'rgba(255,255,255,.05)',
            } as React.CSSProperties}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%',
                background: `linear-gradient(180deg,${glowColor}55,${glowColor}cc)`,
                borderRadius: '0 0 10px 10px',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 10,
                  background: 'rgba(255,255,255,.3)',
                  borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
                }} />
              </div>
              <div style={{
                position: 'absolute', top: 6, left: 10, width: 5, bottom: 12,
                background: 'linear-gradient(180deg,rgba(255,255,255,.2),transparent)', borderRadius: 3,
              }} />
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, letterSpacing: 4,
              color: glowColor,
              textShadow: `0 0 24px ${glowColor}, 0 0 60px ${glowColor}55`,
              animation: 'pulseGlow 0.5s ease-in-out infinite',
            }}>
              {highest >= 6 ? t('gacha.glowMyth') : highest >= 5 ? t('gacha.glowSecret') : highest >= 4 ? t('gacha.glowRare') : t('gacha.glowNormal')}
            </div>
            <button className="gbtn" onClick={skipToResult} style={{
              marginTop: 16, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 6, padding: '6px 20px', color: '#666', fontSize: 11,
            }}>{t('gacha.skip')}</button>
          </div>
        )}

        {/* ======== REVEAL: カード出現 ======== */}
        {animPhase === 'reveal' && (
          <div>
            {manualReveal && revealedCount < results.length && (
              <div style={{ textAlign: 'center', marginBottom: 12, display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#aa8050', letterSpacing: 2 }}>
                  {t('gacha.tapReveal', { current: revealedCount, total: results.length })}
                </span>
                <button className="gbtn" onClick={skipToResult} style={{
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: 6, padding: '4px 14px', color: '#666', fontSize: 10,
                }}>{t('gacha.revealAll')}</button>
              </div>
            )}
            <div
              onClick={manualReveal ? revealNext : undefined}
              style={{
                display: 'grid',
                gridTemplateColumns: results.length === 1 ? '1fr' : 'repeat(auto-fill,minmax(96px,1fr))',
                gap: 8, maxWidth: results.length === 1 ? 240 : '100%', margin: '0 auto', width: '100%',
                cursor: manualReveal && revealedCount < results.length ? 'pointer' : 'default',
              }}
            >
              {results.map((res, i) => {
                const revealed = i < revealedCount;
                const card = getCard(res.cardId);
                const cfg = RARITY_CONFIG[res.rarity];
                const isLegend = res.rarity >= 6;
                const isRare = res.rarity >= 4;
                return (
                  <div key={i}
                    className={revealed ? (isLegend ? 'card-legend' : isRare ? 'card-rare' : 'card-drop') : ''}
                    style={{
                      background: revealed ? cfg.bg : 'rgba(255,255,255,.03)',
                      border: `2px solid ${revealed ? cfg.border : 'rgba(255,255,255,.08)'}`,
                      borderRadius: 10, padding: '11px 7px', textAlign: 'center',
                      position: 'relative', overflow: 'hidden',
                      boxShadow: revealed && isRare ? `0 0 26px ${cfg.glow},0 5px 16px rgba(0,0,0,.6)` : '0 3px 12px rgba(0,0,0,.5)',
                      opacity: revealed ? 1 : 0.4,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {revealed ? (
                      <>
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                          background: isRare
                            ? `linear-gradient(90deg,transparent,${cfg.text},${cfg.border},${cfg.text},transparent)` : `linear-gradient(90deg,transparent,${cfg.border},transparent)`,
                          backgroundSize: isRare ? '200% 100%' : undefined,
                          animation: isRare ? 'borderShine 2s linear infinite' : undefined,
                        }} />
                        <div style={{ fontSize: results.length === 1 ? 48 : 28, lineHeight: 1.1, marginBottom: 5 }}>{card.emoji}</div>
                        <div style={{ fontSize: results.length === 1 ? 13 : 9, color: cfg.text, fontWeight: 700, lineHeight: 1.3 }}>{card.name}</div>
                        <div style={{ fontSize: 8, color: cfg.menuColor, marginTop: 3 }}>{cfg.label}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 24, opacity: 0.3, padding: '4px 0' }}>？</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======== RESULT: 結果 ======== */}
        {animPhase === 'result' && results.length > 0 && (
          <div className="result-in">
            {highest >= 5 && (
              <div className="slide-up" style={{
                textAlign: 'center', marginBottom: 10, padding: '9px 14px',
                background: `rgba(${highest === 6 ? '150,10,20' : '130,85,0'},.2)`,
                border: `1px solid ${RARITY_CONFIG[highest].border}`, borderRadius: 8,
                boxShadow: `0 0 20px ${RARITY_CONFIG[highest].glow}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: RARITY_CONFIG[highest].text, letterSpacing: 3 }}>
                  {highest === 6 ? t('gacha.resultMyth') : t('gacha.resultSecret')}
                </span>
              </div>
            )}
            {refundTotal > 0 && (
              <div style={{ textAlign: 'center', fontSize: 11, color: '#ffcc44', marginBottom: 8 }}>
                {t('gacha.dupRefund', { amount: refundTotal.toLocaleString() })}
              </div>
            )}
            {/* カードグリッド */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: results.length === 1 ? '1fr' : 'repeat(auto-fill,minmax(96px,1fr))',
              gap: 8, maxWidth: results.length === 1 ? 240 : '100%', margin: '0 auto',
            }}>
              {results.map((res, i) => {
                const card = getCard(res.cardId);
                const cfg = RARITY_CONFIG[res.rarity];
                const isSel = selected === res;
                const isRare = res.rarity >= 4;
                const isLegend = res.rarity >= 6;
                return (
                  <div key={i} onClick={() => setSelected(isSel ? null : res)}
                    className="card-hover"
                    style={{
                      background: cfg.bg,
                      border: `2px solid ${isSel ? cfg.text : cfg.border}`,
                      borderRadius: 10, padding: '11px 7px', textAlign: 'center',
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      boxShadow: isSel
                        ? `0 0 30px ${cfg.glow},0 6px 16px rgba(0,0,0,.7)`
                        : isRare ? `0 0 20px ${cfg.glow},0 4px 14px rgba(0,0,0,.6)` : '0 3px 12px rgba(0,0,0,.5)',
                      transform: isSel ? 'scale(1.06)' : 'scale(1)',
                      animation: `cardDrop .38s cubic-bezier(.34,1.4,.64,1) ${i * .04}s both`,
                      opacity: 0,
                    }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                      background: isRare
                        ? `linear-gradient(90deg,transparent,${cfg.text},${cfg.border},${cfg.text},transparent)` : `linear-gradient(90deg,transparent,${cfg.border},transparent)`,
                      backgroundSize: isRare ? '200% 100%' : undefined,
                      animation: isRare ? 'borderShine 2s linear infinite' : undefined,
                    }} />
                    {isLegend && (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: `radial-gradient(ellipse at center, ${cfg.glow}, transparent 70%)`,
                        animation: 'pulseGlow 2s ease-in-out infinite',
                      }} />
                    )}
                    {res.isNew && !res.isDuplicate && (
                      <div style={{
                        position: 'absolute', top: 3, right: 3,
                        background: 'rgba(40,150,40,.35)', border: '1px solid rgba(60,170,60,.5)',
                        borderRadius: 4, padding: '1px 5px', fontSize: 7, color: '#88ee88', fontWeight: 700,
                      }}>NEW</div>
                    )}
                    {res.isDuplicate && (
                      <div style={{
                        position: 'absolute', top: 3, right: 3,
                        background: 'rgba(150,90,0,.35)', border: '1px solid rgba(190,130,0,.45)',
                        borderRadius: 4, padding: '1px 5px', fontSize: 7, color: '#ffcc44',
                      }}>{t('gacha.convert')}</div>
                    )}
                    <div style={{ fontSize: results.length === 1 ? 48 : 28, lineHeight: 1.1, marginBottom: 5, position: 'relative' }}>{card.emoji}</div>
                    <div style={{ fontSize: results.length === 1 ? 13 : 9, color: cfg.text, fontWeight: 700, lineHeight: 1.3, position: 'relative' }}>{card.name}</div>
                    <div style={{ fontSize: 8, color: cfg.menuColor, marginTop: 3, position: 'relative' }}>{cfg.label}</div>
                  </div>
                );
              })}
            </div>
            {/* 詳細パネル */}
            {selected && (() => {
              const card = getCard(selected.cardId);
              const cfg = RARITY_CONFIG[selected.rarity];
              return (
                <div className="slide-up" style={{
                  marginTop: 12, padding: '16px 18px',
                  background: 'rgba(10,5,0,.94)',
                  border: `1px solid ${cfg.border}`, borderRadius: 10,
                  boxShadow: `0 0 28px ${cfg.glow}, inset 0 0 20px rgba(0,0,0,.4)`,
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <div style={{
                    fontSize: 38, flexShrink: 0, width: 56, height: 56,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,.3)', borderRadius: 10,
                    border: `1px solid ${cfg.border}44`,
                  }}>{card.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, color: '#ddd', fontWeight: 700 }}>{card.name}</span>
                      <span style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(0,0,0,.5)', border: `1px solid ${cfg.border}`, color: cfg.text,
                      }}>{cfg.label}</span>
                      {selected.isNew && !selected.isDuplicate && (
                        <span style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 4,
                          background: 'rgba(30,100,30,.25)', color: '#88ee88', border: '1px solid rgba(50,140,50,.4)',
                        }}>{t('gacha.firstDrop')}</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12, color: '#aa8866', lineHeight: 1.9,
                      borderLeft: `2px solid ${cfg.border}44`, paddingLeft: 10,
                    }}>{card.description}</div>
                    {selected.isDuplicate && (
                      <div style={{ fontSize: 10, color: '#ffcc44', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {t('gacha.dupExplain', { amount: selected.refund.toLocaleString() })}
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: '#4a3015', marginTop: 6 }}>
                      {t('gacha.ownCount', { count: inventoryMap[selected.cardId] ?? 0 })}
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* もう一度ボタン */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="gbtn" disabled={money < GACHA_SINGLE_COST} onClick={() => startGacha(1)} style={{
                flex: 1,
                background: money >= GACHA_SINGLE_COST ? 'linear-gradient(160deg,#3a2010,#261508)' : 'rgba(20,10,0,.4)',
                border: `1px solid ${money >= GACHA_SINGLE_COST ? '#6b3a10' : '#2a1508'}`,
                borderRadius: 10, padding: '13px 10px', color: '#fff',
                boxShadow: money >= GACHA_SINGLE_COST ? '0 4px 18px rgba(0,0,0,.6)' : 'none',
              }}>
                <span style={{ fontSize: 16 }}>🍺</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: money >= GACHA_SINGLE_COST ? '#e8c090' : '#443322', marginLeft: 6 }}>{t('gacha.onceMore')}</span>
                <div style={{ fontSize: 11, color: money >= GACHA_SINGLE_COST ? '#ffaa44' : '#332211', marginTop: 4 }}>
                  🪙 {GACHA_SINGLE_COST.toLocaleString()}
                </div>
              </button>
              <button className="gbtn" disabled={money < GACHA_MULTI_COST} onClick={() => startGacha(10)} style={{
                flex: 1,
                background: money >= GACHA_MULTI_COST ? 'linear-gradient(160deg,#3a2500,#281800)' : 'rgba(20,10,0,.4)',
                border: `1px solid ${money >= GACHA_MULTI_COST ? '#aa6600' : '#2a1508'}`,
                borderRadius: 10, padding: '13px 10px', color: '#fff',
                boxShadow: money >= GACHA_MULTI_COST ? '0 4px 22px rgba(0,0,0,.6)' : 'none',
              }}>
                <span style={{ fontSize: 16 }}>🍻</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: money >= GACHA_MULTI_COST ? '#ffcc66' : '#443322', marginLeft: 6 }}>{t('gacha.multiMore')}</span>
                <div style={{ fontSize: 11, color: money >= GACHA_MULTI_COST ? '#ffcc44' : '#332211', marginTop: 4 }}>
                  🪙 {GACHA_MULTI_COST.toLocaleString()}
                </div>
              </button>
            </div>
          </div>
        )}

        </div>{/* END LEFT COLUMN */}

        {/* ▌RIGHT COLUMN — お品書き + コレクション */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
            {/* 演出中のオーバーレイ */}
            {!isIdle && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 20,
                background: 'rgba(10,5,2,.85)',
                borderRadius: 12,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 16,
                backdropFilter: 'blur(4px)',
              }}>
                <div style={{ fontSize: 40, animation: 'gentlePulse 2s ease-in-out infinite' }}>
                  {animPhase === 'pour' ? '🍺' : animPhase === 'glow' ? '✨' : '🃏'}
                </div>
                <div style={{ fontSize: 14, color: '#aa8050', letterSpacing: 4, fontWeight: 700 }}>
                  {animPhase === 'pour' ? t('gacha.overlayPrep') : animPhase === 'glow' ? t('gacha.overlayGlow') : t('gacha.overlayReveal')}
                </div>
                <div style={{
                  width: 60, height: 3, borderRadius: 2, overflow: 'hidden',
                  background: 'rgba(255,255,255,.1)',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'linear-gradient(90deg, #fbbf24, #ff8c00)',
                    animation: 'shimmer 1.5s linear infinite',
                    backgroundSize: '200% 100%',
                  }} />
                </div>
              </div>
            )}
            {/* タブ切り替え */}
            <div style={{ display: 'flex', borderBottom: '2px solid rgba(255,180,80,0.15)' }}>
              <button className="gbtn" onClick={() => setSelectedTab('rates')} style={{
                flex: 1, background: 'none', border: 'none',
                color: selectedTab === 'rates' ? '#fbbf24' : '#777',
                padding: '12px 16px', fontSize: 14, fontWeight: 700,
                fontFamily: "'Shippori Mincho','Noto Serif JP',serif",
                letterSpacing: 2,
                borderBottom: `2px solid ${selectedTab === 'rates' ? '#fbbf24' : 'transparent'}`,
                marginBottom: -2, transition: 'all 0.2s',
              }}>{t('gacha.rateTab')}</button>
              <button className="gbtn" onClick={() => setSelectedTab('collection')} style={{
                flex: 1, background: 'none', border: 'none',
                color: selectedTab === 'collection' ? '#fbbf24' : '#777',
                padding: '12px 16px', fontSize: 14, fontWeight: 700,
                fontFamily: "'Shippori Mincho','Noto Serif JP',serif",
                letterSpacing: 2,
                borderBottom: `2px solid ${selectedTab === 'collection' ? '#fbbf24' : 'transparent'}`,
                marginBottom: -2, transition: 'all 0.2s',
              }}>{t('gacha.collectionTab', { owned: collectionStats.owned, total: collectionStats.total })}</button>
            </div>

            {/* レート表示タブ */}
            {selectedTab === 'rates' ? (
              <div style={{
                background: 'linear-gradient(180deg, rgba(50,25,10,0.6) 0%, rgba(25,12,5,0.8) 100%)',
                border: '1px solid rgba(255,180,80,0.15)', borderTop: 'none',
                borderRadius: '0 0 12px 12px', padding: 16,
              }}>
                <div style={{ textAlign: 'right', marginBottom: 8 }}>
                  <span style={{ color: '#aaa', fontSize: 12 }}>{t('gacha.rateLabel')}</span>
                </div>
                {MENU_ROWS.map((row, idx) => {
                  const cfg = RARITY_CONFIG[row.r];
                  const isHighRare = row.r >= 5;
                  return (
                    <div key={row.r} style={{
                      display: 'flex', alignItems: 'center',
                      padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                      background: `linear-gradient(90deg, ${cfg.glow} 0%, transparent 60%)`,
                      animation: 'fadeSlideIn 0.4s ease both',
                      animationDelay: `${idx * 0.08}s`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                        <span style={{ fontSize: 20 }}>{row.emoji}</span>
                        <span style={{
                          padding: '3px 10px', borderRadius: 5, fontSize: 12, fontWeight: 700, color: '#fff',
                          letterSpacing: 1,
                          background: `linear-gradient(135deg, ${cfg.border}, ${cfg.border}aa)`,
                          boxShadow: isHighRare ? `0 0 8px ${cfg.glow}` : 'none',
                        }}>{cfg.label}</span>
                      </div>
                      {/* 割合バー */}
                      <div style={{
                        flex: 1, height: 4, background: 'rgba(255,255,255,0.05)',
                        borderRadius: 2, margin: '0 16px', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          width: `${parseFloat(row.rate) * 2}%`,
                          background: `linear-gradient(90deg, ${cfg.border}, ${cfg.border}66)`,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 110, gap: 2 }}>
                        <span style={{ color: '#999', fontSize: 12 }}>{row.items}</span>
                        <span style={{
                          color: cfg.menuColor, fontWeight: 700, fontSize: 18,
                          fontFamily: "'Courier New', monospace",
                        }}>{row.rate}</span>
                      </div>
                    </div>
                  );
                })}

                {/* 注意事項 */}
                <div style={{ marginTop: 16, padding: 12, borderTop: '1px solid rgba(255,180,80,0.1)' }}>
                  <p style={{ color: '#777', fontSize: 11, lineHeight: 1.6, margin: 0 }}>
                    {t('gacha.rateNotes').split('\n').map((line, i) => (
                      <span key={i}>{line}{i < 2 && <br />}</span>
                    ))}
                  </p>
                </div>
              </div>
            ) : (
              <GachaCollection inventoryMap={inventoryMap} />
            )}

            {/* 累計カウント */}
            {pullCount > 0 && (
              <div style={{
                marginTop: 12, textAlign: 'center',
                background: 'rgba(18,9,2,.85)', border: '1px solid rgba(90,50,15,.3)',
                borderRadius: 8, padding: '8px 14px', fontSize: 11, color: '#5a3a18',
              }}>
                {t('gacha.totalPulls')} <span style={{ color: '#aa8855', fontWeight: 700, fontSize: 16 }}>{pullCount}</span> {t('gacha.totalPullsCount')}
              </div>
            )}
          </div>

      </div>{/* END MAIN GRID */}
    </div>
  );
}
