import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA, getEnhancedCard } from '../data/cards.ts';
import { getAffinityLevel, getAffinityBonus } from '../data/affinity.ts';
import { useLocalizedCharacterData } from '../hooks/useLocalizedCharacterData.ts';
import { gaugePercent } from '../data/constants.ts';
import { randomPick, getDrunkLevel, BUFF_META, getKanryoku, canPlayCard, isFoodDisabled } from '../engine/utils.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { BuffDisplay } from './BuffDisplay.tsx';
import { AfterEventOverlay } from './AfterEventOverlay.tsx';

// バフ表示は BUFF_META (utils.ts) から参照

// 酔い段階
const DRUNK_STAGES = [
  { max: 0, textKey: 'battle.drunkStages.sober',   cls: 'drunk-sober' },
  { max: 1, textKey: 'battle.drunkStages.tipsy', cls: 'drunk-tipsy' },
  { max: 3, textKey: 'battle.drunkStages.drunk',     cls: 'drunk-good' },
  { max: 6, textKey: 'battle.drunkStages.wasted', cls: 'drunk-done' },
  { max: 9, textKey: 'battle.drunkStages.hammered',     cls: 'drunk-wasted' },
  { max: 10, textKey: 'battle.drunkStages.passed',    cls: 'drunk-gone' },
];

function getDrunkStage(value: number) {
  for (const s of DRUNK_STAGES) {
    if (value <= s.max) return s;
  }
  return DRUNK_STAGES[DRUNK_STAGES.length - 1];
}

// 理性段階
const SANITY_STAGES = [
  { min: 8, textKey: 'battle.sanityStages.calm',       cls: 'sanity-calm' },
  { min: 5, textKey: 'battle.sanityStages.shaken',       cls: 'sanity-shaken' },
  { min: 2, textKey: 'battle.sanityStages.breaking', cls: 'sanity-breaking' },
  { min: 0, textKey: 'battle.sanityStages.gone',    cls: 'sanity-gone' },
];

function getSanityStage(value: number) {
  for (const s of SANITY_STAGES) {
    if (value >= s.min) return s;
  }
  return SANITY_STAGES[SANITY_STAGES.length - 1];
}

import { getSharedAudioContext } from '../engine/audioContext.ts';

function playSound(type: 'slam' | 'flip') {
  try {
    const x = getSharedAudioContext();
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

export function BattleScreen() {
  const { t } = useTranslation();
  const battle = useGameStore((s) => s.battle);
  const currentOpponent = useGameStore((s) => s.currentOpponent);
  const money = useGameStore((s) => s.money);
  const wins = useGameStore((s) => s.wins);
  const losses = useGameStore((s) => s.losses);
  const drawHands = useGameStore((s) => s.drawHands);
  const selectCard = useGameStore((s) => s.selectCard);
  const playRound = useGameStore((s) => s.playRound);
  const checkGameEnd = useGameStore((s) => s.checkGameEnd);
  const endBattle = useGameStore((s) => s.endBattle);
  const setScreen = useGameStore((s) => s.setScreen);
  const showCG = useGameStore((s) => s.showCG);
  const checkAfterEvent = useGameStore((s) => s.checkAfterEvent);
  const showAfterEvent = useGameStore((s) => s.showAfterEvent);
  const updateCurrentOpponent = useGameStore((s) => s.updateCurrentOpponent);
  const activeAfterEvent = useGameStore((s) => s.activeAfterEvent);
  const winsByCharacter = useGameStore((s) => s.winsByCharacter);

  const [dialogue, setDialogue] = useState({ speaker: '', text: '' });
  const [displayText, setDisplayText] = useState('');
  const [tableCards, setTableCards] = useState<{
    player: { id: string; emoji: string; name: string; val: string } | null;
    opponent: { id: string; emoji: string; name: string; val: string } | null;
  }>({ player: null, opponent: null });
  const [playerFlipped, setPlayerFlipped] = useState(false);
  const [oppFlipped, setOppFlipped] = useState(false);
  const [gameResult, setGameResult] = useState<'player_win' | 'opponent_win' | 'draw' | null>(null);
  const [resultReward, setResultReward] = useState(0);
  const [pendingAfterEvent, setPendingAfterEvent] = useState<ReturnType<typeof checkAfterEvent>>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [fieldShaking, setFieldShaking] = useState(false);
  const [slamPlayer, setSlamPlayer] = useState(false);
  const [slamOpp, setSlamOpp] = useState(false);

  const [roundPopup, setRoundPopup] = useState<{ text: string; cls: string } | null>(null);
  const [matchupBadge, setMatchupBadge] = useState<string | null>(null);
  const [misplayFlash, setMisplayFlash] = useState(false);
  const [revealedCards, setRevealedCards] = useState<string[] | null>(null);
  const [playingCardIdx, setPlayingCardIdx] = useState<number | null>(null);
  const [lastRound, setLastRound] = useState<{ pl: string; op: string; res: string; resColor: string }>({
    pl: '-', op: '-', res: '-', resColor: 'var(--gold)'
  });

  const fieldRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);
  const cardPlayLock = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // アンマウントガード付き setTimeout
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  // アンマウント時に全タイマーをクリア
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  // 言語切替時に currentOpponent + activeCG/afterEvent を再ローカライズ
  const characterData = useLocalizedCharacterData();
  const activeCG = useGameStore((s) => s.activeCG);
  useEffect(() => {
    if (!currentOpponent) return;
    const fresh = characterData[currentOpponent.id];
    if (!fresh || fresh.name === currentOpponent.name) return;
    updateCurrentOpponent(fresh);
    // 表示中のCG/AfterEventも再ローカライズ
    if (activeCG) {
      const freshCG = fresh.cgEvents.find((e) => e.id === activeCG.id);
      if (freshCG) showCG(freshCG);
    }
    if (activeAfterEvent) {
      const freshAE = fresh.afterEvents.find((e) => e.id === activeAfterEvent.id);
      if (freshAE) showAfterEvent(freshAE);
    }
  }, [characterData, currentOpponent, updateCurrentOpponent, activeCG, activeAfterEvent, showCG, showAfterEvent]);

  // 最初の手札を配る
  useEffect(() => {
    if (battle.playerHand.length === 0 && !battle.isProcessing && !gameResult &&
        (battle.playerDeckRemaining.length > 0 || battle.playerDiscardPile.length > 0)) {
      drawHands();
      if (currentOpponent) {
        const line = randomPick(currentOpponent.drunkLevels[0].lines) ?? '';
        setDialogue({ speaker: currentOpponent.name, text: line });
      }
    }
  }, [battle.playerHand.length, battle.playerDeckRemaining.length, battle.playerDiscardPile.length, battle.isProcessing, gameResult, drawHands, currentOpponent]);

  // タイピングエフェクト
  useEffect(() => {
    if (!dialogue.text) { setDisplayText(''); return; }
    let i = 0;
    setDisplayText('');
    const timer = setInterval(() => {
      if (i < dialogue.text.length) {
        setDisplayText(dialogue.text.substring(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [dialogue.text]);

  // 酔い演出更新
  useEffect(() => {
    if (blurRef.current) {
      const blur = Math.min(battle.playerDrunk / 10 * 4, 4);
      blurRef.current.style.backdropFilter = `blur(${blur}px)`;
    }
    if (tiltRef.current) {
      const tilt = (Math.random() - 0.5) * Math.min(battle.playerDrunk / 10 * 3, 3);
      tiltRef.current.style.transform = `rotate(${tilt}deg)`;
    }
  }, [battle.playerDrunk]);

  const opponentDrunkLevel = getDrunkLevel(battle.opponentDrunk);

  const oppDrunkStage = getDrunkStage(battle.opponentDrunk);
  const plDrunkStage = getDrunkStage(battle.playerDrunk);
  const oppSanityStage = getSanityStage(battle.opponentSanity);
  const plSanityStage = getSanityStage(battle.playerSanity);

  const drunkClassName = (level: number) => level > 0 ? `drunk-${level}` : '';

  const particleStyles = useMemo(() =>
    Array.from({ length: 12 }).map(() => ({
      left: `${Math.random() * 100}%`,
      bottom: '-10px',
      animationDuration: `${10 + Math.random() * 15}s`,
      animationDelay: `${Math.random() * 10}s`,
    })),
  []);

  const oppFlush = useMemo(() => {
    const f = Math.min(battle.opponentDrunk / 10 * 0.3, 0.3);
    return `radial-gradient(circle at 50% 45%, rgba(200, 40, 40, ${f}), transparent 70%)`;
  }, [battle.opponentDrunk]);

  const handCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleCardClick = (cardId: string, idx: number) => {
    if (battle.isProcessing || gameResult || playingCardIdx !== null || cardPlayLock.current) return;
    cardPlayLock.current = true;

    // cardToField アニメーション用に --tx/--ty を計算
    const cardEl = handCardRefs.current[idx];
    const fieldEl = fieldRef.current;
    if (cardEl && fieldEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const fieldRect = fieldEl.getBoundingClientRect();
      const tx = (fieldRect.left + fieldRect.width / 2) - (cardRect.left + cardRect.width / 2);
      const ty = (fieldRect.top + fieldRect.height / 2) - (cardRect.top + cardRect.height / 2);
      cardEl.style.setProperty('--tx', `${tx}px`);
      cardEl.style.setProperty('--ty', `${ty}px`);
    }

    selectCard(cardId);
    setPlayingCardIdx(idx);
  };

  const handlePlayCard = useCallback(() => {
    if (!battle.selectedCard || battle.isProcessing || gameResult) return;

    const selectedId = battle.selectedCard;
    const pCard = CARD_DATA[selectedId];
    const result = playRound();
    if (!result) {
      // playRound失敗時はロックを解除して復帰
      cardPlayLock.current = false;
      setPlayingCardIdx(null);
      return;
    }

    // cardPlayLock の安全タイムアウト（15秒で強制解除）
    const lockSafetyTimer = safeTimeout(() => {
      if (cardPlayLock.current) {
        cardPlayLock.current = false;
        setPlayingCardIdx(null);
      }
    }, 15000);

    // プレイヤーカードをフィールドに表示
    const resolvedCard = CARD_DATA[result.playerCardId] ?? pCard;
    if (resolvedCard) {
      const val = resolvedCard.type === 'food' ? (resolvedCard.heal === 99 ? '+MAX' : `+${resolvedCard.heal ?? 0}`) :
                  resolvedCard.type === 'drink' ? `${resolvedCard.damage === -1 ? '1~3' : resolvedCard.damage}` :
                  '';
      setTableCards(prev => ({
        ...prev,
        player: { id: result.playerCardId, emoji: resolvedCard.emoji, name: t(`cards.${resolvedCard.id}.name`, resolvedCard.name), val }
      }));
      setPlayerFlipped(true);
      setSlamPlayer(true);
      playSound('slam');
      setFieldShaking(true);
      safeTimeout(() => { setSlamPlayer(false); setFieldShaking(false); }, 400);
    }

    // 相手カードを少し遅れて表示
    safeTimeout(() => {
      // 相手カードをplayRoundの結果から直接取得
      const oppCard = CARD_DATA[result.opponentCardId];
      let oppCardInfo: { emoji: string; name: string; val: string } | null = null;
      if (oppCard) {
        const v = oppCard.type === 'food' ? (oppCard.heal === 99 ? '+MAX' : `+${oppCard.heal ?? 0}`) :
                  oppCard.type === 'drink' ? `${oppCard.damage === -1 ? '?' : oppCard.damage}` :
                  oppCard.type === 'chug' ? t('battle.special') :
                  oppCard.type === 'harassment' ? t('battle.special') : '';
        oppCardInfo = { emoji: oppCard.emoji, name: t(`cards.${oppCard.id}.name`, oppCard.name), val: v };
      }

      if (oppCardInfo) {
        setTableCards(prev => ({ ...prev, opponent: { id: '', ...oppCardInfo! } }));
      }

      setSlamOpp(true);
      playSound('slam');
      safeTimeout(() => setSlamOpp(false), 400);

      // 相手カードフリップ
      safeTimeout(() => {
        setOppFlipped(true);
        playSound('flip');

        // 結果表示
        safeTimeout(() => {
          // セリフ
          if (result.messages.length > 0) {
            setDialogue({ speaker: currentOpponent?.name ?? '', text: result.messages.join(' / ') });
          }

          // リアクション（実際のダメージ値で判定）
          const oppNetDamage = result.opponentDamage - result.opponentHeal;
          const plNetDamage = result.playerDamage - result.playerHeal;
          if (oppNetDamage > 0 && oppNetDamage >= plNetDamage) {
            setReaction('😵');
          } else if (plNetDamage > 0) {
            setReaction('😏');
          } else {
            setReaction(null);
          }
          safeTimeout(() => setReaction(null), 2000);

          if (result.playerMisplay) {
            setMisplayFlash(true);
            safeTimeout(() => setMisplayFlash(false), 900);
          }
          if (result.playerMatchup === 'advantage') setMatchupBadge(t('battle.advantageBadge'));
          else if (result.playerMatchup === 'disadvantage') setMatchupBadge(t('battle.disadvantageBadge'));
          else setMatchupBadge(null);

          // ラウンド結果ポップアップ
          if (oppNetDamage > plNetDamage) {
            setRoundPopup({ text: t('battle.roundWin'), cls: 'result-win' });
          } else if (plNetDamage > oppNetDamage) {
            setRoundPopup({ text: t('battle.roundLose'), cls: 'result-lose' });
          } else {
            setRoundPopup({ text: t('battle.roundDraw'), cls: 'result-draw' });
          }
          safeTimeout(() => setRoundPopup(null), 1800);

          // distract: 相手の手札を公開
          if (result.revealedHand && result.revealedHand.length > 0) {
            setRevealedCards(result.revealedHand);
            safeTimeout(() => setRevealedCards(null), 4000);
          }

          // CG（プレイヤーのセクハラ成功時）
          if (result.cgEvent) {
            safeTimeout(() => { showCG(result.cgEvent!); }, 1000);
          }

          // CG（相手の逆セクハラ成功時）
          // プレイヤー側CGがある場合はその後に表示、なければ同タイミング
          if (result.opponentCgEvent) {
            const delay = result.cgEvent ? 5000 : 1000;
            safeTimeout(() => { showCG(result.opponentCgEvent!); }, delay);
          }

          const hasCG = !!(result.cgEvent || result.opponentCgEvent);
          const cgDelay = result.cgEvent && result.opponentCgEvent ? 9000 : hasCG ? 5000 : 2000;

          // 即勝利
          if (result.instantWin) {
            safeTimeout(() => {
              clearTimeout(lockSafetyTimer);
              cardPlayLock.current = false;
              const reward = endBattle('player_win');
              setResultReward(reward);
              setGameResult('player_win');
              const afterEvt = checkAfterEvent();
              if (afterEvt) setPendingAfterEvent(afterEvt);
            }, cgDelay);
            return;
          }

          // 勝敗チェック（CG表示中は待つ）
          const endCheckDelay = hasCG ? cgDelay : 1500;
          safeTimeout(() => {
            const end = checkGameEnd();
            if (end) {
              clearTimeout(lockSafetyTimer);
              cardPlayLock.current = false;
              const reward = endBattle(end);
              setResultReward(reward);
              setGameResult(end);
              if (end === 'player_win') {
                const afterEvt = checkAfterEvent();
                if (afterEvt) setPendingAfterEvent(afterEvt);
              }
            } else {
              // 直前のラウンド記録
              const pc = pCard;
              if (pc && oppCardInfo) {
                const netOpp = result.opponentDamage - result.opponentHeal;
                const netPl = result.playerDamage - result.playerHeal;
                const roundRes = netOpp > netPl ? t('battle.lastRoundWin') : netPl > netOpp ? t('battle.lastRoundLose') : t('battle.lastRoundDraw');
                const roundColor = netOpp > netPl ? '#8bc98b' : netPl > netOpp ? '#c98b8b' : 'var(--gold)';
                setLastRound({
                  pl: `${pc.emoji} ${t(`cards.${pc.id}.name`, pc.name)}`,
                  op: `${oppCardInfo.emoji} ${oppCardInfo.name}`,
                  res: roundRes,
                  resColor: roundColor
                });
              }

              // リセットして次のラウンド
              setTableCards({ player: null, opponent: null });
              setPlayerFlipped(false);
              setOppFlipped(false);
              setPlayingCardIdx(null);
              setMatchupBadge(null);
              clearTimeout(lockSafetyTimer);
              cardPlayLock.current = false;
              drawHands();

              // 相手のセリフ更新
              const s = useGameStore.getState();
              if (s.currentOpponent) {
                const lvl = getDrunkLevel(s.battle.opponentDrunk);
                const levelData = s.currentOpponent.drunkLevels.find(l => l.level === lvl);
                if (levelData) {
                  setDialogue({ speaker: s.currentOpponent.name, text: randomPick(levelData.lines) ?? '' });
                }
              }
            }
          }, endCheckDelay);
        }, 400);
      }, 400);
    }, 800);
  }, [battle.selectedCard, battle.isProcessing, gameResult, currentOpponent, drawHands, endBattle, checkGameEnd, showCG, playRound, checkAfterEvent, safeTimeout]);

  // カード選択後に自動で出す
  useEffect(() => {
    if (battle.selectedCard && !battle.isProcessing && !gameResult) {
      const timer = setTimeout(handlePlayCard, 500);
      return () => clearTimeout(timer);
    }
  }, [battle.selectedCard, battle.isProcessing, gameResult, handlePlayCard]);

  if (!currentOpponent) return null;

  const charGlow = currentOpponent.theme.colorGlow;

  return (
    <div className="screen active" style={{ position: 'relative' }}>
      {/* 背景レイヤー */}
      <div className="battle-bg-layer battle-bg-gradient" />
      <div className="battle-bg-layer battle-bg-noise" />
      <div className="battle-bg-layer battle-bg-table" />

      {/* 酔いブラー */}
      <div className="battle-drunk-blur" ref={blurRef} />

      {/* パーティクル */}
      <div className="battle-particles">
        {particleStyles.map((style, i) => (
          <div
            key={i}
            className="battle-particle"
            style={style}
          />
        ))}
      </div>

      {/* 酔い傾きラッパー */}
      <div className="battle-tilt-wrapper" ref={tiltRef}>
        {/* ヘッダー */}
        <div className="battle-header">
          <div className="battle-bar-name">{t('battle.barName')}</div>
          <div className="battle-header-center">
            <div className="round-display">R.{Math.min(battle.round + 1, battle.maxRounds)}/{battle.maxRounds}</div>
          </div>
          <div className="battle-money">
            <div className="battle-money-icon">龍</div>
            <span>{money.toLocaleString()}</span>
          </div>
        </div>

        {/* メインレイアウト */}
        <div className="battle-main">
          {/* 左: キャラクター立ち絵 */}
          <div className="battle-left" style={{ '--char-glow': charGlow } as React.CSSProperties}>
            <div className={`char-portrait ${drunkClassName(opponentDrunkLevel)}`}>
              <div className="char-portrait-flush" style={{ background: oppFlush }} />
              <div className="char-portrait-icon">
                <CharacterPortrait
                  theme={currentOpponent.theme}
                  variant="portrait"
                  drunkLevel={opponentDrunkLevel}
                  costumeStates={currentOpponent.costumeStates}
                />
              </div>
              <div className={`char-reaction ${reaction ? 'show' : ''}`}>{reaction}</div>
            </div>
            <div className="char-info">
              <div className="char-name">{currentOpponent.name}</div>
              <div className="char-subtitle">{currentOpponent.subtitle}</div>
              <div className={`char-drunk-label ${oppDrunkStage.cls}`}>
                {t(oppDrunkStage.textKey)}
              </div>
            </div>
          </div>

          {/* 中央: ゲームエリア */}
          <div className="battle-center">
            {/* 相手バー */}
            <div className="opponent-bar">
              <div className="opp-portrait-mini">
                <CharacterPortrait theme={currentOpponent.theme} variant="icon" />
              </div>
              <div className="opp-info">
                <div className="opp-name-row">
                  <div className="opp-name">{currentOpponent.name}</div>
                  <div className="opp-title">{currentOpponent.subtitle}</div>
                </div>
                <div className="gauge-row">
                  <div className="gauge-label-sm">{t('battle.drunkLabel')}</div>
                  <div className="gauge-track">
                    <div
                      className="gauge-fill opp-fill"
                      style={{ width: `${gaugePercent(battle.opponentDrunk, 10)}%` }}
                    />
                  </div>
                  <div className="gauge-lvl">
                    <span className="lvl-t">{t(oppDrunkStage.textKey)}</span>
                    <span className="lvl-n">({battle.opponentDrunk}/10)</span>
                  </div>
                </div>
                <div className="gauge-row">
                  <div className="gauge-label-sm">{t('battle.sanityLabel')}</div>
                  <div className="gauge-track">
                    <div
                      className="gauge-fill sanity-fill"
                      style={{ width: `${gaugePercent(battle.opponentSanity, currentOpponent.sanityMax ?? 10)}%` }}
                    />
                  </div>
                  <div className={`gauge-lvl ${oppSanityStage.cls}`}>
                    <span className="lvl-t">{t(oppSanityStage.textKey)}</span>
                    <span className="lvl-n">({battle.opponentSanity}/{currentOpponent.sanityMax ?? 10})</span>
                  </div>
                </div>
                <BuffDisplay buffs={battle.opponentBuffs} keyPrefix="ob" />
              </div>
            </div>

            {/* フィールド */}
            <div className="battle-field">
              <div className={`field-table ${fieldShaking ? 'field-shaking' : ''}`} ref={fieldRef}>
                <div className="card-slots">
                  {/* 相手カード */}
                  <div className={`card-slot ${slamOpp ? 'card-slam' : ''}`}>
                    <div className={`card-3d ${oppFlipped ? 'flipped' : ''}`}>
                      <div className="card-3d-face card-3d-back">
                        <div className="card-back-pattern wave" />
                        <div className="card-back-frame" />
                        <div className="card-back-q">？</div>
                      </div>
                      <div className="card-3d-face card-3d-front">
                        <div className="card-front-content">
                          <div className="card-front-icon">{tableCards.opponent?.emoji ?? ''}</div>
                          <div className="card-front-name">{tableCards.opponent?.name ?? ''}</div>
                          <div className="card-front-val">{tableCards.opponent?.val ?? ''}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="vs-badge">VS</div>

                  {/* プレイヤーカード（自分のカードなので即表面表示） */}
                  <div className={`card-slot ${slamPlayer ? 'card-slam' : ''}`}>
                    <div className={`card-3d ${playerFlipped ? 'instant-flip' : ''}`}>
                      <div className="card-3d-face card-3d-back">
                        <div className="card-back-pattern check" />
                        <div className="card-back-frame" />
                        <div className="card-back-q">？</div>
                      </div>
                      <div className="card-3d-face card-3d-front">
                        <div className="card-front-content">
                          <div className="card-front-icon">{tableCards.player?.emoji ?? ''}</div>
                          <div className="card-front-name">{tableCards.player?.name ?? ''}</div>
                          <div className="card-front-val">{tableCards.player?.val ?? ''}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ラウンド結果ポップアップ */}
                {roundPopup && (
                  <div className={`card-result-popup show ${roundPopup.cls}`}>
                    {roundPopup.text}
                  </div>
                )}
              </div>
            </div>

            {/* セリフ */}
            <div className="dialogue-area">
              <div className="dialogue-bar">
                <div className="dlg-name">{dialogue.speaker ? `${dialogue.speaker}：` : ''}</div>
                <div className="dlg-text">{displayText}</div>
              </div>
            </div>

            {/* プレイヤーゲージ */}
            <div className="player-gauge-row gauge-row">
              <div className="gauge-label-sm">{t('battle.playerDrunk')}</div>
              <div className="gauge-track">
                <div
                  className="gauge-fill player-fill"
                  style={{ width: `${gaugePercent(battle.playerDrunk, 10)}%` }}
                />
              </div>
              <div className="gauge-lvl">
                <span className="lvl-t">{t(plDrunkStage.textKey)}</span>
                <span className="lvl-n">({battle.playerDrunk}/10)</span>
              </div>
            </div>
            <div className="player-gauge-row gauge-row">
              <div className="gauge-label-sm">{t('battle.playerSanity')}</div>
              <div className="gauge-track">
                <div
                  className="gauge-fill sanity-fill"
                  style={{ width: `${gaugePercent(battle.playerSanity, 10)}%` }}
                />
              </div>
              <div className="kanryoku-display">{t('battle.kanryoku', { value: getKanryoku(getDrunkLevel(battle.playerDrunk)) })}</div>
              <div className={`gauge-lvl ${plSanityStage.cls}`}>
                <span className="lvl-t">{t(plSanityStage.textKey)}</span>
                <span className="lvl-n">({battle.playerSanity}/10)</span>
              </div>
            </div>
            <BuffDisplay buffs={battle.playerBuffs} keyPrefix="pb" className="player-buff-icons" />
          </div>

        </div>

        {/* 手札エリア */}
        <div className="hand-area" data-card-count={battle.playerHand.length}>
          {battle.playerHand.map((cardId, i) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            const isPlaying = playingCardIdx === i;
            const playerDrunkLevel = getDrunkLevel(battle.playerDrunk);
            const costLocked = !canPlayCard(card, battle.playerDrunk);
            const foodLocked = isFoodDisabled(playerDrunkLevel) && card.type === 'food';
            const isDisabled = ((battle.isProcessing || playingCardIdx !== null) && !isPlaying) || costLocked || foodLocked;
            const isSelected = battle.selectedCard === cardId && !isPlaying;
            const isCorrupted = battle.corruptedSlots[i] === true;
            const isHidden = battle.playerHiddenSlots.includes(i);
            const isBlurred = i === battle.playerBlurredSlot && !isHidden;
            const cardLevel = battle.playerCardLevels?.[cardId] ?? 1;
            const levelClass = cardLevel >= 3 ? 'card-lv3' : cardLevel >= 2 ? 'card-lv2' : '';
            const valText = isHidden ? '???' : card.type === 'food' ? (card.heal === 99 ? t('battle.maxHeal') : t('battle.heal', { value: card.heal })) :
                            card.type === 'drink' ? (card.damage === -1 ? '1~3' : `${card.damage}`) :
                            card.type === 'chug' ? t('battle.special') :
                            card.type === 'harassment' ? t('battle.special') : '';

            return (
              <div
                key={`${cardId}-${i}`}
                ref={el => { handCardRefs.current[i] = el; }}
                className={`hand-card type-${card.type} ${levelClass} ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''} ${isDisabled ? 'disabled' : ''} ${isCorrupted ? 'corrupted' : ''} ${isBlurred ? 'card-blurred' : ''} ${isHidden ? 'card-hidden' : ''} ${costLocked ? 'card-cost-locked' : ''} ${foodLocked ? 'card-food-locked' : ''}`}
                onClick={() => handleCardClick(cardId, i)}
              >
                {cardLevel >= 2 && !isHidden && (
                  <div className="card-level-badge">{'★'.repeat(cardLevel)}</div>
                )}
                <div className="hand-tooltip">
                  <div className="tooltip-name">{isHidden ? '???' : t(`cards.${card.id}.name`, card.name)}</div>
                  <div className="tooltip-desc">{costLocked ? t('battle.costLocked') : foodLocked ? t('battle.foodLocked') : (isHidden ? t('battle.hiddenCard') : t(`cards.${card.id}.desc`, card.description))}</div>
                </div>
                <div className="hand-cost">{card.cost}</div>
                <div className="hand-icon">{isHidden ? '❓' : card.emoji}</div>
                <div className="hand-name">{isHidden ? '???' : t(`cards.${card.id}.name`, card.name)}</div>
                <div className="hand-val">{valText}</div>
              </div>
            );
          })}
        </div>

        {matchupBadge && <div className="matchup-badge">{matchupBadge}</div>}
        {misplayFlash && <div className="matchup-badge misplay-shake">{t('battle.rampage')}</div>}

        {/* 下部ステータスバー */}
        <div className="battle-status-bar">
          <div className="status-bar-item">
            <span className="status-bar-label">{t('battle.recordLabel')}</span>
            <span className="status-bar-val">
              <span className="win-c">{t('battle.winsShort', { count: wins })}</span>
              <span className="status-bar-sep">/</span>
              <span className="lose-c">{t('battle.lossesShort', { count: losses })}</span>
            </span>
          </div>
          <div className="status-bar-divider" />
          <div className="status-bar-item">
            <span className="status-bar-label">{t('battle.deck')}</span>
            <span className="status-bar-val">{battle.playerDeckRemaining.length}</span>
          </div>
          <div className="status-bar-divider" />
          <div className="status-bar-item">
            <span className="status-bar-label">{t('battle.opponentDeck')}</span>
            <span className="status-bar-val">{battle.opponentDeckRemaining.length}</span>
          </div>
          <div className="status-bar-divider" />
          <div className="status-bar-item status-bar-lastround">
            <span className="status-bar-label">{t('battle.prevRound')}</span>
            <span className="status-bar-val" style={{ color: lastRound.resColor }}>{lastRound.res}</span>
            <span className="status-bar-detail">{lastRound.pl} vs {lastRound.op}</span>
          </div>
        </div>
      </div>

      {/* distract: 相手の手札公開 */}
      {revealedCards && (
        <div className="revealed-hand-overlay">
          <div className="revealed-hand-title">{t('battle.revealedHand')}</div>
          <div className="revealed-hand-cards">
            {revealedCards.map((cardId, i) => {
              const card = CARD_DATA[cardId];
              if (!card) return null;
              return (
                <div key={`reveal-${i}`} className={`revealed-card type-${card.type}`}>
                  <div className="revealed-card-emoji">{card.emoji}</div>
                  <div className="revealed-card-name">{t(`cards.${card.id}.name`, card.name)}</div>
                  <div className="revealed-card-type">
                    {card.type === 'drink' ? t('battle.cardTypeAttack', { value: card.damage === -1 ? '1~3' : card.damage }) :
                     card.type === 'food' ? t('battle.cardTypeHeal', { value: card.heal }) :
                     card.type === 'chug' ? t('battle.cardTypeChug') :
                     card.type === 'harassment' ? t('battle.cardTypeHarassment') :
                     card.type === 'strategy' ? t('battle.cardTypeStrategy') :
                     card.type === 'environment' ? t('battle.cardTypeEnvironment') : t('battle.cardTypeStatus')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 勝敗リザルト */}
      {gameResult && !activeAfterEvent && (
        <div className="battle-result">
          <div className="result-content">
            <h2>
              {gameResult === 'player_win'
                ? (battle.opponentSanity <= 0 ? t('battle.resultSanityWin') : t('battle.resultWin'))
                : gameResult === 'opponent_win'
                ? (battle.playerSanity <= 0 ? t('battle.resultSanityLose') : t('battle.resultLose'))
                : t('battle.resultDraw')}
            </h2>
            <p>
              {gameResult === 'player_win'
                ? currentOpponent.battleLines.loseLine
                : gameResult === 'opponent_win'
                ? currentOpponent.battleLines.winLine
                : t('battle.goodMatch')}
            </p>
            <div className="result-reward">{t('battle.reward', { amount: resultReward })}</div>
            {gameResult === 'player_win' && currentOpponent && (() => {
              const charWins = winsByCharacter[currentOpponent.id] ?? 0;
              const affLv = getAffinityLevel(charWins);
              const bonus = getAffinityBonus(charWins);
              return affLv > 0 ? (
                <div className="result-affinity">
                  {'❤'.repeat(affLv)} {t('battle.affinityLevel', { level: affLv })}
                  {bonus > 0 && <span className="affinity-bonus"> ({t('battle.affinityBonus', { bonus })})</span>}
                </div>
              ) : null;
            })()}
            {gameResult === 'player_win' && pendingAfterEvent && (
              <button
                className="menu-btn after-event-btn"
                onClick={() => showAfterEvent(pendingAfterEvent)}
                style={{
                  background: `linear-gradient(135deg, ${pendingAfterEvent.cgColor}cc, ${pendingAfterEvent.cgColor}88)`,
                  border: `1px solid ${pendingAfterEvent.cgColor}`,
                }}
              >
                {pendingAfterEvent.emoji} {pendingAfterEvent.title}
              </button>
            )}
            <button className="menu-btn" onClick={() => setScreen('title')}>
              {t('battle.returnToBar')}
            </button>
          </div>
        </div>
      )}

      {/* 勝利後イベントオーバーレイ */}
      <AfterEventOverlay />
    </div>
  );
}
