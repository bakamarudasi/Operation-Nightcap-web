import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { useLocalizedCharacterData } from '../hooks/useLocalizedCharacterData.ts';
import type { CharacterDef } from '../data/types.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { getAffinityLevel, AFFINITY_LEVELS } from '../data/affinity.ts';
import '../styles/select.css';

/* ── 定数 ── */
const CARD_W = 280;       // カルーセルカード幅(px)
const DRINK_COST = 500;   // 1回の飲み代

import { getSharedAudioContext } from '../engine/audioContext.ts';

function playErrSound() {
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
}

function playVsSound() {
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
}

function playKanpaiSound() {
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
}

/* ── フェーズ型 ── */
type Phase = 'select' | 'noren-close' | 'noren-closed' | 'noren-open' | 'vs' | 'kanpai' | 'noren-final';

/* ── コンポーネント ── */
export function SelectScreen() {
  const { t } = useTranslation();
  const setScreen = useGameStore((s) => s.setScreen);
  const initBattle = useGameStore((s) => s.initBattle);
  const money = useGameStore((s) => s.money);
  const wins = useGameStore((s) => s.wins);
  const losses = useGameStore((s) => s.losses);
  const unlockedCGs = useGameStore((s) => s.unlockedCGs);
  const winsByCharacter = useGameStore((s) => s.winsByCharacter);

  // Fix #3: useMemo でキャラ配列を安定化
  const CHARACTER_DATA = useLocalizedCharacterData();
  const characters = Object.values(CHARACTER_DATA);
  const charCount = characters.length;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isAnim, setIsAnim] = useState(false);
  const [moneyShake, setMoneyShake] = useState(false);

  // VS / Kanpai phase
  const [phase, setPhase] = useState<Phase>('select');
  const [vsChar, setVsChar] = useState<CharacterDef | null>(null);

  // kanpai sub-states
  const [kanpaiFlash, setKanpaiFlash] = useState(false);
  const [kanpaiText, setKanpaiText] = useState(false);
  const [kanpaiDialogue, setKanpaiDialogue] = useState<string | null>(null);
  const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: number; hue: number; delay: number }>>([]);

  const timersRef = useRef<number[]>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  /* ── カルーセル移動 ── */
  const goTo = useCallback((idx: number) => {
    if (isAnim || charCount === 0) return;
    const clamped = Math.max(0, Math.min(charCount - 1, idx));
    setCurrentIdx(clamped);
  }, [isAnim, charCount]);

  /* ── 飲み開始演出 ── */
  const startDrink = useCallback(() => {
    if (isAnim || charCount === 0) return;
    // Fix #4: 所持金不足時のビジュアルフィードバック
    if (money < DRINK_COST) {
      playErrSound();
      setMoneyShake(true);
      setTimeout(() => setMoneyShake(false), 500);
      return;
    }
    const char = characters[currentIdx];
    if (!char) return;

    setIsAnim(true);
    setVsChar(char);

    // Phase 1: noren close (CSS animation = 0.5s)
    setPhase('noren-close');

    // Phase 2: 閉じ切ったら一拍止める (600ms後 = CSS完了後に余裕)
    addTimer(() => {
      setPhase('noren-closed');

      // Phase 3: 300ms止めてから開く
      addTimer(() => {
        setPhase('noren-open');
        addTimer(() => playVsSound(), 100);

        // Phase 4: 開き終わったらVS画面 (2500ms後)
        addTimer(() => {
          setPhase('vs');

          // Phase 5: kanpai (600ms後)
          addTimer(() => {
            setPhase('kanpai');

            // kanpai sub-anim
            addTimer(() => {
              setKanpaiFlash(true);
              playKanpaiSound();
              addTimer(() => setKanpaiFlash(false), 200);
            }, 750);

            addTimer(() => setKanpaiText(true), 1000);

            addTimer(() => {
              const pieces = Array.from({ length: 40 }, (_, i) => ({
                id: i,
                left: Math.random() * 100,
                hue: Math.random() * 360,
                delay: Math.random() * 0.5,
              }));
              setConfettiPieces(pieces);
            }, 1100);

            addTimer(() => {
              setKanpaiDialogue(char.drunkLevels[0].lines[0]);
            }, 2000);

            addTimer(() => setKanpaiText(false), 3000);
            addTimer(() => setKanpaiDialogue(null), 5000);

            // Final: noren-final で暗転してバトルへ
            addTimer(() => {
              setPhase('noren-final');
              addTimer(() => {
                initBattle(char.id, CHARACTER_DATA);
              }, 600);
            }, 6000);

          }, 600);
        }, 2500);
      }, 300);
    }, 600);
  }, [isAnim, charCount, money, characters, currentIdx, addTimer, initBattle, CHARACTER_DATA]);

  /* ── キーボード操作 ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isAnim) return;
      if (e.key === 'ArrowLeft') goTo(currentIdx - 1);
      else if (e.key === 'ArrowRight') goTo(currentIdx + 1);
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startDrink(); }
      else if (e.key === 'Escape') setScreen('title');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAnim, currentIdx, goTo, startDrink, setScreen]);

  /* ── 現在のキャラ ── */
  const currentChar = characters[currentIdx] ?? null;
  const cgCount = currentChar
    ? currentChar.cgEvents.filter(e => unlockedCGs.includes(e.id)).length
    : 0;
  const cgTotal = currentChar?.cgEvents.length ?? 0;
  const charWins = currentChar ? (winsByCharacter[currentChar.id] ?? 0) : 0;
  const affinityLv = getAffinityLevel(charWins);
  const nextAffinity = AFFINITY_LEVELS.find(a => a.requiredWins > charWins);
  const affinityStars = affinityLv > 0 ? '❤'.repeat(affinityLv) + '🤍'.repeat(4 - affinityLv) : '🤍🤍🤍🤍';

  /* ── セレクトUI表示条件 ── */
  const showSelectContent = phase === 'select' || phase === 'noren-close' || phase === 'noren-closed' || phase === 'noren-final';

  /* ── render ── */
  return (
    <div className="screen sel-screen">

      {/* ====== SELECT UI ====== */}
      {showSelectContent && (
        <div className="sel-content">
          {/* Header */}
          <div className="sel-header">
            <button
              className="back-btn"
              disabled={isAnim}
              onClick={() => !isAnim && setScreen('title')}
            >
              {t('common.back')}
            </button>
            <h2>{t('select.chooseOpponent')}</h2>
            <div className={`sel-money ${moneyShake ? 'shake' : ''}`}>
              <span className="sel-money-icon">{t('common.currencyIcon')}</span>
              <span>{t('common.currencyAmount', { amount: money.toLocaleString() })}</span>
            </div>
          </div>

          {/* Carousel */}
          <div className="sel-carousel">
            {charCount > 1 && (
              <button
                className="sel-arrow sel-arrow-l"
                disabled={currentIdx === 0 || isAnim}
                onClick={() => goTo(currentIdx - 1)}
              >
                ◀
              </button>
            )}

            <div className="sel-carousel-viewport">
              <div
                className="sel-carousel-track"
                style={{ transform: `translateX(-${currentIdx * CARD_W}px)` }}
              >
                {characters.map((char, i) => (
                  <div
                    key={char.id}
                    className={`sel-card ${i === currentIdx ? 'active' : ''}`}
                    style={{ '--char-color': char.theme.color } as React.CSSProperties}
                    onClick={() => goTo(i)}
                  >
                    <div className="sel-card-sprite">
                      <CharacterPortrait theme={char.theme} variant="portrait" />
                    </div>
                    <div className="sel-card-name">{char.name}</div>
                    <div className="sel-card-sub">{char.subtitle}</div>
                    <div className="sel-card-nameEn">{char.nameEn}</div>
                  </div>
                ))}
              </div>
            </div>

            {charCount > 1 && (
              <button
                className="sel-arrow sel-arrow-r"
                disabled={currentIdx === charCount - 1 || isAnim}
                onClick={() => goTo(currentIdx + 1)}
              >
                ▶
              </button>
            )}
          </div>

          {/* Dots */}
          {charCount > 1 && (
            <div className="sel-dots">
              {characters.map((_, i) => (
                <div
                  key={i}
                  className={`sel-dot ${i === currentIdx ? 'active' : ''}`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          )}

          {/* Detail */}
          {currentChar && (
            <div className="sel-detail">
              <div className="sel-detail-stats">
                <div className="sel-stat">
                  <span className="sel-stat-label">{t('select.type')}</span>
                  <span className="sel-stat-value">{currentChar.drunkType}</span>
                </div>
                <div className="sel-stat">
                  <span className="sel-stat-label">{t('select.record')}</span>
                  <span className="sel-stat-value">{t('select.winsCount', { count: charWins })}</span>
                </div>
                <div className="sel-stat">
                  <span className="sel-stat-label">{t('select.cg')}</span>
                  <span className="sel-stat-value">{cgCount}/{cgTotal}</span>
                </div>
                <div className="sel-stat">
                  <span className="sel-stat-label">{t('select.affinity')}</span>
                  <span className="sel-stat-value sel-affinity">{affinityStars}{nextAffinity ? <span className="sel-affinity-next"> ({t('select.nextAffinity', { count: nextAffinity.requiredWins })})</span> : ''}</span>
                </div>
              </div>
              <div className="sel-detail-quote">
                「{currentChar.drunkLevels[0].lines[0]}」
              </div>
              <div className="sel-detail-actions">
                <button
                  className="sel-deck-btn"
                  disabled={isAnim}
                  onClick={() => setScreen('deck')}
                >
                  {t('select.editDeck')}
                </button>
                <button
                  className="sel-deck-btn"
                  disabled={isAnim}
                  onClick={() => setScreen('enhance')}
                >
                  {t('select.enhance')}
                </button>
                <button
                  className="sel-drink-btn"
                  disabled={isAnim || money < DRINK_COST}
                  onClick={startDrink}
                >
                  <span>{t('select.drinkWith')}</span>
                  <span className="sel-drink-cost">{t('select.drinkCost', { cost: DRINK_COST })}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== NOREN (curtain) ====== */}
      {/* Fix #1: pointer-events:auto でクリック透過を防止 */}
      {/* Fix #2: noren-final は閉じた状態で開始 (closed-instant) */}
      {(phase === 'noren-close' || phase === 'noren-closed' || phase === 'noren-open' || phase === 'noren-final') && (
        <div className={`sel-noren ${
          phase === 'noren-close' ? 'closing' :
          phase === 'noren-closed' ? 'closed-instant' :
          phase === 'noren-final' ? 'closed-instant' :
          'opening'
        }`}>
          <div className="sel-noren-half sel-noren-left">
            <span className="sel-noren-kanji">{t('title.noren.sake')}</span>
          </div>
          <div className="sel-noren-half sel-noren-right">
            <span className="sel-noren-kanji">{t('title.noren.dokoro')}</span>
          </div>
        </div>
      )}

      {/* ====== VS SCREEN ====== */}
      {(phase === 'vs' || phase === 'noren-open') && vsChar && (
        <div className="sel-vs">
          <div className="sel-vs-bg" />
          <div className="sel-vs-side sel-vs-player">
            <div className="sel-vs-icon">🧑‍⚕️</div>
            <div className="sel-vs-name">{t('common.doctor')}</div>
          </div>
          <div className="sel-vs-badge">VS</div>
          <div className="sel-vs-side sel-vs-opponent">
            <div className="sel-vs-icon">
              <CharacterPortrait theme={vsChar.theme} variant="icon" />
            </div>
            <div className="sel-vs-name">{vsChar.name}</div>
          </div>
        </div>
      )}

      {/* ====== KANPAI ====== */}
      {(phase === 'kanpai' || phase === 'noren-final') && vsChar && (
        <div className="sel-kanpai">
          {/* cups */}
          <div className="sel-kanpai-cups">
            <div className="sel-cup sel-cup-left">🍺</div>
            <div className="sel-cup sel-cup-right">🍺</div>
          </div>

          {/* flash */}
          {kanpaiFlash && <div className="sel-kanpai-flash" />}

          {/* text */}
          {kanpaiText && (
            <div className="sel-kanpai-text">{t('select.kanpai')}</div>
          )}

          {/* confetti */}
          <div className="sel-confetti">
            {confettiPieces.map((p) => (
              <div
                key={p.id}
                className="sel-confetti-piece"
                style={{
                  left: `${p.left}%`,
                  '--hue': p.hue,
                  animationDelay: `${p.delay}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* dialogue */}
          {kanpaiDialogue && (
            <div className="sel-kanpai-dialogue">
              <span className="sel-dlg-speaker">{vsChar.name}</span>
              <span className="sel-dlg-text">{kanpaiDialogue}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
