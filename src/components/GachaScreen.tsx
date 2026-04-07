import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { GACHA_SINGLE_COST, GACHA_MULTI_COST } from '../data/gacha.ts';
import { buildCardCountMap } from '../data/constants.ts';

import { useParticles } from './gacha/useParticles.ts';
import { useGachaAnimation } from './gacha/useGachaAnimation.ts';
import { RARITY_CONFIG, MENU_ROWS, GACHA_CSS } from './gacha/gachaConstants.ts';
import { GachaCollection } from './gacha/GachaCollection.tsx';
import { FeaturedCard } from './gacha/FeaturedCard.tsx';
import '../styles/gacha.css';

export function GachaScreen() {
  const { t } = useTranslation();
  const money = useGameStore(s => s.money);
  const inventory = useGameStore(s => s.inventory);
  const pullGacha = useGameStore(s => s.pullGacha);
  const setScreen = useGameStore(s => s.setScreen);

  const inventoryMap = useMemo(() => buildCardCountMap(inventory), [inventory]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useParticles(canvasRef);

  const {
    animPhase, results, revealedCount, selected, setSelected,
    refundTotal, pendingCount, glowColor, liquidFill,
    shake, flash, pullCount, manualReveal,
    isIdle, highest,
    skipToResult, revealNext, startGacha,
  } = useGachaAnimation(pullGacha, money, particles);

  const [selectedTab, setSelectedTab] = useState<'rates' | 'collection'>('rates');

  const getCard = (id: string) => CARD_DATA[id] ?? { id, name: id, emoji: '❓', type: 'drink' as const, rarity: 1, price: 0, description: '???' };

  const collectionStats = useMemo(() => {
    const total = Object.keys(CARD_DATA).length;
    const owned = Object.keys(inventoryMap).filter(k => CARD_DATA[k] && inventoryMap[k] > 0).length;
    return { total, owned };
  }, [inventoryMap]);

  const canSingle = money >= GACHA_SINGLE_COST;
  const canMulti = money >= GACHA_MULTI_COST;

  return (
    <div className="gacha-screen" style={{
      transform: shake ? `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 6}px)` : 'none',
      transition: shake ? 'none' : undefined,
    }}>
      <style>{GACHA_CSS}</style>

      <canvas ref={canvasRef} className="gacha-canvas" />

      {flash && (
        <div className="gacha-flash" style={{
          background: `radial-gradient(ellipse at center,${flash}44,${flash}11,transparent 70%)`,
        }} />
      )}

      <div className="gacha-bg-texture" />
      <div className="gacha-noren" />

      {['6%', '87%'].map((left, i) => (
        <div key={i} className={`gacha-lantern ${i === 0 ? 'sway1' : 'sway2'}`} style={{ left }}>🏮</div>
      ))}

      {/* ── ヘッダー ── */}
      <header className="gacha-header">
        <button className="gbtn gacha-back-btn" onClick={() => setScreen('title')}>{t('common.back')}</button>
        <h1 className="gacha-title">{t('gacha.titlePlain')}</h1>
        <div className="gacha-money-badge">
          <span style={{ fontSize: 18 }}>🪙</span>
          <span className="gacha-money-val">{money.toLocaleString()}</span>
        </div>
      </header>

      {/* ── メイン2カラムレイアウト ── */}
      <div className="gacha-main">

        {/* ▌LEFT COLUMN — ガチャ演出 + ボタン */}
        <div className="gacha-col-left">

        {/* ======== IDLE: ヒーロー + ボタン ======== */}
        {animPhase === 'idle' && (
          <>
            <div className="gacha-smoke-container">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="gacha-smoke-puff" style={{
                  bottom: `${10 + i * 18}%`, left: `${10 + i * 20}%`,
                  width: 60 + i * 15, height: 60 + i * 15,
                  animation: `smokeRise ${6 + i * 2}s ease-in-out infinite`,
                  animationDelay: `${i * 1.3}s`,
                }} />
              ))}
            </div>

            <div className="hero-fade gacha-hero">
              <div className="gacha-hero-lantern gacha-hero-lantern-left">🏮</div>
              <div className="gacha-hero-lantern gacha-hero-lantern-right">🏮</div>

              <div className="gacha-hero-icons">
                <div className="bottle-float" style={{ fontSize: 40, opacity: 0.5, animationDelay: '0.5s' }}>🍶</div>
                <div style={{ position: 'relative', animation: 'glassIdle 6s ease-in-out infinite' }}>
                  <div className="gacha-hero-glass">🍺</div>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="gacha-hero-steam" style={{
                      top: -8 - i * 4, left: `${30 + i * 12}%`,
                      animation: `steamWisp ${2 + i * 0.5}s ease-in-out infinite`,
                      animationDelay: `${i * 0.7}s`,
                    }} />
                  ))}
                </div>
                <div className="bottle-float" style={{ fontSize: 40, opacity: 0.5, animationDelay: '1.2s' }}>🫗</div>
              </div>
              <div className="gacha-hero-text">{t('gacha.heroText')}</div>

              <div className="gacha-progress-row">
                <span className="gacha-progress-label">{t('gacha.collectProgress')}</span>
                <div className="gacha-progress-track">
                  <div className="gacha-progress-fill" style={{ width: `${(collectionStats.owned / collectionStats.total) * 100}%` }} />
                </div>
                <span className="gacha-progress-count">
                  {collectionStats.owned}<span className="gacha-progress-total">/{collectionStats.total}</span>
                </span>
              </div>
            </div>

            <FeaturedCard getCard={getCard} />

            {/* ── ガチャボタン ── */}
            <div className="gacha-btn-grid">
              <button className="gbtn gacha-pull-btn" disabled={!canSingle} onClick={() => startGacha(1)} style={{
                background: canSingle ? 'linear-gradient(180deg, #3d2814 0%, #2a1a0c 100%)' : 'rgba(20,10,0,.4)',
                border: `2px solid ${canSingle ? 'rgba(255,180,80,0.3)' : '#2a1508'}`,
                boxShadow: canSingle ? '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,180,80,0.1)' : 'none',
              }}>
                <span style={{ fontSize: 32 }}>🍺</span>
                <span className="gacha-pull-btn-name" style={{ color: canSingle ? '#e8d5b5' : '#443322' }}>{t('gacha.singlePull')}</span>
                <span className="gacha-pull-btn-cost" style={{ color: canSingle ? '#fbbf24' : '#332211' }}>
                  🪙 {GACHA_SINGLE_COST.toLocaleString()}
                </span>
              </button>

              <button className="gbtn gacha-pull-btn" disabled={!canMulti} onClick={() => startGacha(10)} style={{
                background: canMulti ? 'linear-gradient(180deg, #5c1a1a 0%, #3a0e0e 100%)' : 'rgba(20,10,0,.4)',
                border: `2px solid ${canMulti ? 'rgba(255,80,80,0.35)' : '#2a1508'}`,
                boxShadow: canMulti ? '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,80,80,0.1)' : 'none',
              }}>
                {canMulti && <div className="gacha-discount-badge">{t('gacha.multiDiscount')}</div>}
                <span style={{ fontSize: 32 }}>🍻</span>
                <span className="gacha-pull-btn-name" style={{ color: canMulti ? '#e8d5b5' : '#443322' }}>{t('gacha.multiPull')}</span>
                <span className="gacha-pull-btn-cost" style={{ color: canMulti ? '#fbbf24' : '#332211' }}>
                  🪙 {GACHA_MULTI_COST.toLocaleString()}
                </span>
              </button>
            </div>

            <div className="gacha-sub-info">
              <span>{t('gacha.rateSecret')} <span style={{ color: '#e8a020' }}>3.5%</span></span>
              <span className="gacha-sub-sep">|</span>
              <span>{t('gacha.rateMyth')} <span style={{ color: '#ff3366' }}>0.5%</span></span>
              <span className="gacha-sub-sep">|</span>
              <span>{t('gacha.dupConvert')}</span>
            </div>

            {!canSingle && (
              <div className="gacha-short-money">
                <div className="gacha-short-money-text">
                  🪙 {t('gacha.shortMoney', { amount: (GACHA_SINGLE_COST - money).toLocaleString() })}
                </div>
                <button className="gbtn gacha-shop-btn" onClick={() => setScreen('shop')}>
                  {t('gacha.goShop')}
                </button>
              </div>
            )}
          </>
        )}

        {/* ======== POUR: 注ぎアニメ ======== */}
        {animPhase === 'pour' && (
          <div className="gacha-pour-phase">
            <div className="gacha-pour-drops">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="gacha-pour-drop" style={{
                  background: `rgba(${pendingCount === 10 ? '255,200,60' : '200,150,70'},.75)`,
                  left: `calc(50% + ${(i - 2) * 7}px)`,
                  animationDelay: `${i * .12}s`,
                }} />
              ))}
            </div>
            <div className="gacha-glass-container">
              <div className="gacha-glass-body">
                <div className="gacha-liquid" style={{
                  height: `${liquidFill}%`,
                  background: pendingCount === 10
                    ? 'linear-gradient(180deg,rgba(255,200,60,.35),rgba(200,130,20,.75))'
                    : 'linear-gradient(180deg,rgba(200,160,80,.3),rgba(150,90,20,.65))',
                }}>
                  <div className="gacha-liquid-foam" />
                  {liquidFill > 20 && [0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="gacha-bubble" style={{
                      bottom: `${15 + i * 15}%`, left: `${20 + i * 14}%`,
                      width: 3 + (i % 2) * 2, height: 3 + (i % 2) * 2,
                      animation: `bubbleUp ${1.2 + i * 0.3}s ease-in infinite`,
                      animationDelay: `${i * 0.25}s`,
                    }} />
                  ))}
                </div>
                <div className="gacha-glass-highlight-left" />
                <div className="gacha-glass-highlight-right" />
              </div>
            </div>
            <div className="gacha-pour-text flick">
              {pendingCount === 1 ? t('gacha.pouring') : t('gacha.pouringMulti')}
            </div>
            <button className="gbtn gacha-skip-btn" onClick={skipToResult}>{t('gacha.skip')}</button>
          </div>
        )}

        {/* ======== GLOW: グラス光る ======== */}
        {animPhase === 'glow' && (
          <div className="gacha-glow-phase">
            {highest >= 5 && (
              <div className="gacha-glow-bg" style={{
                background: `radial-gradient(ellipse at 50% 45%, ${glowColor}22, transparent 60%)`,
              }} />
            )}
            <div className="gacha-glow-glass" style={{ '--gc': glowColor } as React.CSSProperties}>
              <div className="gacha-glow-liquid" style={{ background: `linear-gradient(180deg,${glowColor}55,${glowColor}cc)` }}>
                <div className="gacha-glow-foam" />
              </div>
              <div className="gacha-glow-highlight" />
            </div>
            <div className="gacha-glow-text" style={{
              color: glowColor,
              textShadow: `0 0 24px ${glowColor}, 0 0 60px ${glowColor}55`,
            }}>
              {highest >= 6 ? t('gacha.glowMyth') : highest >= 5 ? t('gacha.glowSecret') : highest >= 4 ? t('gacha.glowRare') : t('gacha.glowNormal')}
            </div>
            <button className="gbtn gacha-skip-btn" onClick={skipToResult}>{t('gacha.skip')}</button>
          </div>
        )}

        {/* ======== REVEAL: カード出現 ======== */}
        {animPhase === 'reveal' && (
          <div>
            {manualReveal && revealedCount < results.length && (
              <div className="gacha-reveal-hint">
                <span className="gacha-reveal-hint-text">
                  {t('gacha.tapReveal', { current: revealedCount, total: results.length })}
                </span>
                <button className="gbtn gacha-skip-btn-sm" onClick={skipToResult}>{t('gacha.revealAll')}</button>
              </div>
            )}
            <div
              onClick={manualReveal ? revealNext : undefined}
              className={`gacha-card-grid ${results.length === 1 ? 'gacha-card-grid-single' : 'gacha-card-grid-multi'}`}
              style={{ cursor: manualReveal && revealedCount < results.length ? 'pointer' : 'default' }}
            >
              {results.map((res, i) => {
                const revealed = i < revealedCount;
                const card = getCard(res.cardId);
                const cfg = RARITY_CONFIG[res.rarity];
                const isLegend = res.rarity >= 6;
                const isRare = res.rarity >= 4;
                return (
                  <div key={i}
                    className={`gacha-card ${revealed ? (isLegend ? 'card-legend' : isRare ? 'card-rare' : 'card-drop') : 'gacha-card-unrevealed'}`}
                    style={revealed ? {
                      background: cfg.bg,
                      border: `2px solid ${cfg.border}`,
                      boxShadow: isRare ? `0 0 26px ${cfg.glow},0 5px 16px rgba(0,0,0,.6)` : '0 3px 12px rgba(0,0,0,.5)',
                    } : undefined}
                  >
                    {revealed ? (
                      <>
                        <div className="gacha-card-shine" style={{
                          background: isRare
                            ? `linear-gradient(90deg,transparent,${cfg.text},${cfg.border},${cfg.text},transparent)` : `linear-gradient(90deg,transparent,${cfg.border},transparent)`,
                          backgroundSize: isRare ? '200% 100%' : undefined,
                          animation: isRare ? 'borderShine 2s linear infinite' : undefined,
                        }} />
                        <div style={{ fontSize: results.length === 1 ? 48 : 28, lineHeight: 1.1, marginBottom: 5 }}>{card.emoji}</div>
                        <div style={{ fontSize: results.length === 1 ? 13 : 9, color: cfg.text, fontWeight: 700, lineHeight: 1.3 }}>{t(`cards.${res.cardId}.name`, card.name)}</div>
                        <div className="gacha-card-label" style={{ color: cfg.menuColor }}>{cfg.label}</div>
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
              <div className="slide-up gacha-high-rare-banner" style={{
                background: `rgba(${highest === 6 ? '150,10,20' : '130,85,0'},.2)`,
                border: `1px solid ${RARITY_CONFIG[highest].border}`,
                boxShadow: `0 0 20px ${RARITY_CONFIG[highest].glow}`,
              }}>
                <span className="gacha-high-rare-text" style={{ color: RARITY_CONFIG[highest].text }}>
                  {highest === 6 ? t('gacha.resultMyth') : t('gacha.resultSecret')}
                </span>
              </div>
            )}
            {refundTotal > 0 && (
              <div className="gacha-refund-text">
                {t('gacha.dupRefund', { amount: refundTotal.toLocaleString() })}
              </div>
            )}
            <div className={`gacha-card-grid ${results.length === 1 ? 'gacha-card-grid-single' : 'gacha-card-grid-multi'}`}>
              {results.map((res, i) => {
                const card = getCard(res.cardId);
                const cfg = RARITY_CONFIG[res.rarity];
                const isSel = selected === res;
                const isRare = res.rarity >= 4;
                const isLegend = res.rarity >= 6;
                return (
                  <div key={i} onClick={() => setSelected(isSel ? null : res)}
                    className="gacha-card card-hover"
                    style={{
                      background: cfg.bg,
                      border: `2px solid ${isSel ? cfg.text : cfg.border}`,
                      cursor: 'pointer',
                      boxShadow: isSel
                        ? `0 0 30px ${cfg.glow},0 6px 16px rgba(0,0,0,.7)`
                        : isRare ? `0 0 20px ${cfg.glow},0 4px 14px rgba(0,0,0,.6)` : '0 3px 12px rgba(0,0,0,.5)',
                      transform: isSel ? 'scale(1.06)' : 'scale(1)',
                      animation: `cardDrop .38s cubic-bezier(.34,1.4,.64,1) ${i * .04}s both`,
                      opacity: 0,
                    }}>
                    <div className="gacha-card-shine" style={{
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
                      <div className="gacha-card-badge gacha-card-badge-new">NEW</div>
                    )}
                    {res.isDuplicate && (
                      <div className="gacha-card-badge gacha-card-badge-dup">{t('gacha.convert')}</div>
                    )}
                    <div style={{ fontSize: results.length === 1 ? 48 : 28, lineHeight: 1.1, marginBottom: 5, position: 'relative' }}>{card.emoji}</div>
                    <div style={{ fontSize: results.length === 1 ? 13 : 9, color: cfg.text, fontWeight: 700, lineHeight: 1.3, position: 'relative' }}>{t(`cards.${res.cardId}.name`, card.name)}</div>
                    <div className="gacha-card-label" style={{ color: cfg.menuColor }}>{cfg.label}</div>
                  </div>
                );
              })}
            </div>
            {/* 詳細パネル */}
            {selected && (() => {
              const card = getCard(selected.cardId);
              const cfg = RARITY_CONFIG[selected.rarity];
              return (
                <div className="slide-up gacha-detail-panel" style={{
                  border: `1px solid ${cfg.border}`,
                  boxShadow: `0 0 28px ${cfg.glow}, inset 0 0 20px rgba(0,0,0,.4)`,
                }}>
                  <div className="gacha-detail-icon" style={{ border: `1px solid ${cfg.border}44` }}>{card.emoji}</div>
                  <div className="gacha-detail-body">
                    <div className="gacha-detail-name-row">
                      <span className="gacha-detail-name">{t(`cards.${selected.cardId}.name`, card.name)}</span>
                      <span className="gacha-detail-rarity" style={{ border: `1px solid ${cfg.border}`, color: cfg.text }}>{cfg.label}</span>
                      {selected.isNew && !selected.isDuplicate && (
                        <span className="gacha-detail-new-badge">{t('gacha.firstDrop')}</span>
                      )}
                    </div>
                    <div className="gacha-detail-desc" style={{ borderLeft: `2px solid ${cfg.border}44` }}>
                      {t(`cards.${selected.cardId}.desc`, card.description)}
                    </div>
                    {selected.isDuplicate && (
                      <div className="gacha-detail-dup">
                        {t('gacha.dupExplain', { amount: selected.refund.toLocaleString() })}
                      </div>
                    )}
                    <div className="gacha-detail-own">
                      {t('gacha.ownCount', { count: inventoryMap[selected.cardId] ?? 0 })}
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* もう一度ボタン */}
            <div className="gacha-retry-grid">
              <button className="gbtn gacha-retry-btn" disabled={!canSingle} onClick={() => startGacha(1)} style={{
                background: canSingle ? 'linear-gradient(160deg,#3a2010,#261508)' : 'rgba(20,10,0,.4)',
                border: `1px solid ${canSingle ? '#6b3a10' : '#2a1508'}`,
                boxShadow: canSingle ? '0 4px 18px rgba(0,0,0,.6)' : 'none',
              }}>
                <span style={{ fontSize: 16 }}>🍺</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: canSingle ? '#e8c090' : '#443322', marginLeft: 6 }}>{t('gacha.onceMore')}</span>
                <div style={{ fontSize: 11, color: canSingle ? '#ffaa44' : '#332211', marginTop: 4 }}>
                  🪙 {GACHA_SINGLE_COST.toLocaleString()}
                </div>
              </button>
              <button className="gbtn gacha-retry-btn" disabled={!canMulti} onClick={() => startGacha(10)} style={{
                background: canMulti ? 'linear-gradient(160deg,#3a2500,#281800)' : 'rgba(20,10,0,.4)',
                border: `1px solid ${canMulti ? '#aa6600' : '#2a1508'}`,
                boxShadow: canMulti ? '0 4px 22px rgba(0,0,0,.6)' : 'none',
              }}>
                <span style={{ fontSize: 16 }}>🍻</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: canMulti ? '#ffcc66' : '#443322', marginLeft: 6 }}>{t('gacha.multiMore')}</span>
                <div style={{ fontSize: 11, color: canMulti ? '#ffcc44' : '#332211', marginTop: 4 }}>
                  🪙 {GACHA_MULTI_COST.toLocaleString()}
                </div>
              </button>
            </div>
          </div>
        )}

        </div>{/* END LEFT COLUMN */}

        {/* ▌RIGHT COLUMN — お品書き + コレクション */}
          <div className="gacha-col-right">
            {!isIdle && (
              <div className="gacha-right-overlay">
                <div className="gacha-right-overlay-icon">
                  {animPhase === 'pour' ? '🍺' : animPhase === 'glow' ? '✨' : '🃏'}
                </div>
                <div className="gacha-right-overlay-text">
                  {animPhase === 'pour' ? t('gacha.overlayPrep') : animPhase === 'glow' ? t('gacha.overlayGlow') : t('gacha.overlayReveal')}
                </div>
                <div className="gacha-right-overlay-bar">
                  <div className="gacha-right-overlay-fill" />
                </div>
              </div>
            )}
            <div className="gacha-tab-bar">
              <button className={`gbtn gacha-tab ${selectedTab === 'rates' ? 'active' : ''}`}
                onClick={() => setSelectedTab('rates')}>{t('gacha.rateTab')}</button>
              <button className={`gbtn gacha-tab ${selectedTab === 'collection' ? 'active' : ''}`}
                onClick={() => setSelectedTab('collection')}>{t('gacha.collectionTab', { owned: collectionStats.owned, total: collectionStats.total })}</button>
            </div>

            {selectedTab === 'rates' ? (
              <div className="gacha-rate-panel">
                <div className="gacha-rate-header">
                  <span>{t('gacha.rateLabel')}</span>
                </div>
                {MENU_ROWS.map((row, idx) => {
                  const cfg = RARITY_CONFIG[row.r];
                  const isHighRare = row.r >= 5;
                  return (
                    <div key={row.r} className="gacha-rate-row" style={{
                      background: `linear-gradient(90deg, ${cfg.glow} 0%, transparent 60%)`,
                      animationDelay: `${idx * 0.08}s`,
                    }}>
                      <div className="gacha-rate-left">
                        <span style={{ fontSize: 20 }}>{row.emoji}</span>
                        <span className="gacha-rate-badge" style={{
                          background: `linear-gradient(135deg, ${cfg.border}, ${cfg.border}aa)`,
                          boxShadow: isHighRare ? `0 0 8px ${cfg.glow}` : 'none',
                        }}>{cfg.label}</span>
                      </div>
                      <div className="gacha-rate-bar">
                        <div className="gacha-rate-bar-fill" style={{
                          width: `${parseFloat(row.rate) * 2}%`,
                          background: `linear-gradient(90deg, ${cfg.border}, ${cfg.border}66)`,
                        }} />
                      </div>
                      <div className="gacha-rate-right">
                        <span className="gacha-rate-items">{row.items}</span>
                        <span className="gacha-rate-pct" style={{ color: cfg.menuColor }}>{row.rate}</span>
                      </div>
                    </div>
                  );
                })}

                <div className="gacha-rate-notes">
                  <p>
                    {t('gacha.rateNotes').split('\n').map((line, i) => (
                      <span key={i}>{line}{i < 2 && <br />}</span>
                    ))}
                  </p>
                </div>
              </div>
            ) : (
              <GachaCollection inventoryMap={inventoryMap} />
            )}

            {pullCount > 0 && (
              <div className="gacha-pull-counter">
                {t('gacha.totalPulls')} <span className="gacha-pull-counter-num">{pullCount}</span> {t('gacha.totalPullsCount')}
              </div>
            )}
          </div>

      </div>{/* END MAIN GRID */}
    </div>
  );
}
