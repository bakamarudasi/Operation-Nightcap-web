import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { randomPick } from '../engine/utils.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { AfterEventOverlay } from './AfterEventOverlay.tsx';
import type { Buff } from '../data/types.ts';

// バフ/デバフ表示情報
const BUFF_DISPLAY: Record<Buff['id'], { icon: string; label: string; positive: boolean }> = {
  stun:             { icon: '💫', label: 'スタン',       positive: false },
  atk_down:         { icon: '⬇️', label: '攻撃力低下',   positive: false },
  dot:              { icon: '🩸', label: '継続ダメージ', positive: false },
  no_food:          { icon: '🚫', label: '食べ物封印',   positive: false },
  corrupted_hand:   { icon: '💋', label: '手札汚染',     positive: false },
  tipsy:            { icon: '🍺', label: 'ほろ酔い',     positive: false },
  blush:            { icon: '😳', label: '頬染め',       positive: false },
  alone:            { icon: '🚷', label: '孤立',         positive: false },
  karaoke:          { icon: '🎤', label: 'カラオケ',     positive: true },
  dimlight:         { icon: '🕯️', label: '薄暗い照明',   positive: false },
  excuse:           { icon: '🛡️', label: '言い訳',       positive: true },
  drink_dmg_half:   { icon: '🛡️', label: 'ダメージ半減', positive: true },
  next_drink_boost: { icon: '⚔️', label: '次攻撃強化',   positive: true },
  next_food_boost:  { icon: '💚', label: '次回復強化',   positive: true },
  negate_next:      { icon: '🚫', label: '次ダメ無効',   positive: true },
  stealth:          { icon: '👻', label: 'ステルス',     positive: true },
  self_atk_up:      { icon: '💪', label: '攻撃力UP',     positive: true },
  all_dmg_up:       { icon: '🔥', label: '全ダメUP',     positive: true },
  sanity_negate:    { icon: '🧠', label: '理性ガード',   positive: true },
  thorns:           { icon: '🌵', label: '反撃',         positive: true },
  reflect_all:      { icon: '🪞', label: '全反射',       positive: true },
  afterglow:        { icon: '✨', label: '余韻',         positive: false },
  frustration:      { icon: '😤', label: '焦らし',       positive: false },
  finger_technique: { icon: '🤌', label: '指先テク',     positive: true },
};

// 酔い段階
const DRUNK_STAGES = [
  { max: 0, text: 'シラフ',   cls: 'drunk-sober' },
  { max: 1, text: 'ほろ酔い', cls: 'drunk-tipsy' },
  { max: 3, text: '酔い',     cls: 'drunk-good' },
  { max: 6, text: 'べろべろ', cls: 'drunk-done' },
  { max: 9, text: '泥酔',     cls: 'drunk-wasted' },
  { max: 10, text: '潰れ',    cls: 'drunk-gone' },
];

function getDrunkStage(value: number) {
  for (const s of DRUNK_STAGES) {
    if (value <= s.max) return s;
  }
  return DRUNK_STAGES[DRUNK_STAGES.length - 1];
}

// 理性段階
const SANITY_STAGES = [
  { min: 8, text: '冷静',       cls: 'sanity-calm' },
  { min: 5, text: '動揺',       cls: 'sanity-shaken' },
  { min: 2, text: '理性崩壊寸前', cls: 'sanity-breaking' },
  { min: 0, text: '理性ゼロ',    cls: 'sanity-gone' },
];

function getSanityStage(value: number) {
  for (const s of SANITY_STAGES) {
    if (value >= s.min) return s;
  }
  return SANITY_STAGES[SANITY_STAGES.length - 1];
}

// 効果音（AudioContextを再利用）
let _audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

function playSound(type: 'slam' | 'flip') {
  try {
    const x = getAudioContext();
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
  const getDrunkLevel = useGameStore((s) => s.getDrunkLevel);
  const checkAfterEvent = useGameStore((s) => s.checkAfterEvent);
  const showAfterEvent = useGameStore((s) => s.showAfterEvent);
  const activeAfterEvent = useGameStore((s) => s.activeAfterEvent);

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
  const [revealedCards, setRevealedCards] = useState<string[] | null>(null);
  const [playingCardIdx, setPlayingCardIdx] = useState<number | null>(null);
  const [lastRound, setLastRound] = useState<{ pl: string; op: string; res: string; resColor: string }>({
    pl: '-', op: '-', res: '-', resColor: 'var(--gold)'
  });

  const fieldRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);
  const cardPlayLock = useRef(false);

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
    if (!result) return;

    // cardPlayLock の安全タイムアウト（15秒で強制解除）
    const lockSafetyTimer = setTimeout(() => {
      if (cardPlayLock.current) {
        cardPlayLock.current = false;
        setPlayingCardIdx(null);
      }
    }, 15000);

    // プレイヤーカードをフィールドに表示
    if (pCard) {
      const val = pCard.type === 'food' ? (pCard.heal === 99 ? '+MAX' : `+${pCard.heal ?? 0}`) :
                  pCard.type === 'drink' ? `${pCard.damage === -1 ? '1~3' : pCard.damage}` :
                  '';
      setTableCards(prev => ({
        ...prev,
        player: { id: selectedId, emoji: pCard.emoji, name: pCard.name, val }
      }));
      setPlayerFlipped(true);
      setSlamPlayer(true);
      playSound('slam');
      setFieldShaking(true);
      setTimeout(() => { setSlamPlayer(false); setFieldShaking(false); }, 400);
    }

    // 相手カードを少し遅れて表示
    setTimeout(() => {
      // 相手カードをplayRoundの結果から直接取得
      const oppCard = CARD_DATA[result.opponentCardId];
      let oppCardInfo: { emoji: string; name: string; val: string } | null = null;
      if (oppCard) {
        const v = oppCard.type === 'food' ? (oppCard.heal === 99 ? '+MAX' : `+${oppCard.heal ?? 0}`) :
                  oppCard.type === 'drink' ? `${oppCard.damage === -1 ? '?' : oppCard.damage}` :
                  oppCard.type === 'chug' ? '特殊' :
                  oppCard.type === 'harassment' ? '特殊' : '';
        oppCardInfo = { emoji: oppCard.emoji, name: oppCard.name, val: v };
      }

      if (oppCardInfo) {
        setTableCards(prev => ({ ...prev, opponent: { id: '', ...oppCardInfo! } }));
      }

      setSlamOpp(true);
      playSound('slam');
      setTimeout(() => setSlamOpp(false), 400);

      // 相手カードフリップ
      setTimeout(() => {
        setOppFlipped(true);
        playSound('flip');

        // 結果表示
        setTimeout(() => {
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
          setTimeout(() => setReaction(null), 2000);

          // ラウンド結果ポップアップ
          if (oppNetDamage > plNetDamage) {
            setRoundPopup({ text: '勝ち！', cls: 'result-win' });
          } else if (plNetDamage > oppNetDamage) {
            setRoundPopup({ text: '負け…', cls: 'result-lose' });
          } else {
            setRoundPopup({ text: '引分', cls: 'result-draw' });
          }
          setTimeout(() => setRoundPopup(null), 1800);

          // distract: 相手の手札を公開
          if (result.revealedHand && result.revealedHand.length > 0) {
            setRevealedCards(result.revealedHand);
            setTimeout(() => setRevealedCards(null), 4000);
          }

          // CG（プレイヤーのセクハラ成功時）
          if (result.cgEvent) {
            setTimeout(() => { showCG(result.cgEvent!); }, 1000);
          }

          // CG（相手の逆セクハラ成功時）
          // プレイヤー側CGがある場合はその後に表示、なければ同タイミング
          if (result.opponentCgEvent) {
            const delay = result.cgEvent ? 5000 : 1000;
            setTimeout(() => { showCG(result.opponentCgEvent!); }, delay);
          }

          const hasCG = !!(result.cgEvent || result.opponentCgEvent);
          const cgDelay = result.cgEvent && result.opponentCgEvent ? 9000 : hasCG ? 5000 : 2000;

          // 即勝利
          if (result.instantWin) {
            setTimeout(() => {
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
          setTimeout(() => {
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
                const roundRes = netOpp > netPl ? '勝ち' : netPl > netOpp ? '負け' : '引分';
                const roundColor = netOpp > netPl ? '#8bc98b' : netPl > netOpp ? '#c98b8b' : 'var(--gold)';
                setLastRound({
                  pl: `${pc.emoji} ${pc.name}`,
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
  }, [battle.selectedCard, battle.isProcessing, gameResult, currentOpponent, drawHands, endBattle, checkGameEnd, showCG, getDrunkLevel, playRound, checkAfterEvent]);

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
          <div className="battle-bar-name">ロドスバー</div>
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
                {oppDrunkStage.text}
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
                  <div className="gauge-label-sm">酔い</div>
                  <div className="gauge-track">
                    <div
                      className="gauge-fill opp-fill"
                      style={{ width: `${Math.min(battle.opponentDrunk / 10, 1) * 100}%` }}
                    />
                  </div>
                  <div className="gauge-lvl">
                    <span className="lvl-t">{oppDrunkStage.text}</span>
                    <span className="lvl-n">({battle.opponentDrunk}/10)</span>
                  </div>
                </div>
                <div className="gauge-row">
                  <div className="gauge-label-sm">理性</div>
                  <div className="gauge-track">
                    <div
                      className="gauge-fill sanity-fill"
                      style={{ width: `${Math.min(battle.opponentSanity / (currentOpponent.sanityMax ?? 10), 1) * 100}%` }}
                    />
                  </div>
                  <div className={`gauge-lvl ${oppSanityStage.cls}`}>
                    <span className="lvl-t">{oppSanityStage.text}</span>
                    <span className="lvl-n">({battle.opponentSanity}/{currentOpponent.sanityMax ?? 10})</span>
                  </div>
                </div>
                {battle.opponentBuffs.length > 0 && (
                  <div className="buff-icons">
                    {battle.opponentBuffs.map((buff, i) => {
                      const info = BUFF_DISPLAY[buff.id];
                      return (
                        <div
                          key={`ob-${buff.id}-${i}`}
                          className={`buff-chip ${info.positive ? 'buff-positive' : 'buff-negative'}`}
                          title={`${info.label}${buff.duration > 0 ? ` (${buff.duration}T)` : ''}`}
                        >
                          <span className="buff-chip-icon">{info.icon}</span>
                          {buff.duration > 0 && <span className="buff-chip-dur">{buff.duration}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
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
              <div className="gauge-label-sm">ドクターの酔い</div>
              <div className="gauge-track">
                <div
                  className="gauge-fill player-fill"
                  style={{ width: `${Math.min(battle.playerDrunk / 10, 1) * 100}%` }}
                />
              </div>
              <div className="gauge-lvl">
                <span className="lvl-t">{plDrunkStage.text}</span>
                <span className="lvl-n">({battle.playerDrunk}/10)</span>
              </div>
            </div>
            <div className="player-gauge-row gauge-row">
              <div className="gauge-label-sm">ドクターの理性</div>
              <div className="gauge-track">
                <div
                  className="gauge-fill sanity-fill"
                  style={{ width: `${Math.min(battle.playerSanity / 10, 1) * 100}%` }}
                />
              </div>
              <div className={`gauge-lvl ${plSanityStage.cls}`}>
                <span className="lvl-t">{plSanityStage.text}</span>
                <span className="lvl-n">({battle.playerSanity}/10)</span>
              </div>
            </div>
            {battle.playerBuffs.length > 0 && (
              <div className="buff-icons player-buff-icons">
                {battle.playerBuffs.map((buff, i) => {
                  const info = BUFF_DISPLAY[buff.id];
                  return (
                    <div
                      key={`pb-${buff.id}-${i}`}
                      className={`buff-chip ${info.positive ? 'buff-positive' : 'buff-negative'}`}
                      title={`${info.label}${buff.duration > 0 ? ` (${buff.duration}T)` : ''}`}
                    >
                      <span className="buff-chip-icon">{info.icon}</span>
                      {buff.duration > 0 && <span className="buff-chip-dur">{buff.duration}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* 手札エリア */}
        <div className="hand-area" data-card-count={battle.playerHand.length}>
          {battle.playerHand.map((cardId, i) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            const isPlaying = playingCardIdx === i;
            const isDisabled = (battle.isProcessing || playingCardIdx !== null) && !isPlaying;
            const isSelected = battle.selectedCard === cardId && !isPlaying;
            const isCorrupted = battle.corruptedSlots[i] === true;
            const valText = card.type === 'food' ? (card.heal === 99 ? 'MAX回復' : `回復 ${card.heal}`) :
                            card.type === 'drink' ? (card.damage === -1 ? '1~3' : `${card.damage}`) :
                            card.type === 'chug' ? '特殊' :
                            card.type === 'harassment' ? '特殊' : '';

            return (
              <div
                key={`${cardId}-${i}`}
                ref={el => { handCardRefs.current[i] = el; }}
                className={`hand-card type-${card.type} ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''} ${isDisabled ? 'disabled' : ''} ${isCorrupted ? 'corrupted' : ''}`}
                onClick={() => handleCardClick(cardId, i)}
              >
                <div className="hand-tooltip">
                  <div className="tooltip-name">{card.name}</div>
                  <div className="tooltip-desc">{card.description}</div>
                </div>
                <div className="hand-icon">{card.emoji}</div>
                <div className="hand-name">{card.name}</div>
                <div className="hand-val">{valText}</div>
              </div>
            );
          })}
        </div>

        {/* 下部ステータスバー */}
        <div className="battle-status-bar">
          <div className="status-bar-item">
            <span className="status-bar-label">戦績</span>
            <span className="status-bar-val">
              <span className="win-c">{wins}勝</span>
              <span className="status-bar-sep">/</span>
              <span className="lose-c">{losses}敗</span>
            </span>
          </div>
          <div className="status-bar-divider" />
          <div className="status-bar-item">
            <span className="status-bar-label">🃏 デッキ</span>
            <span className="status-bar-val">{battle.playerDeckRemaining.length}</span>
          </div>
          <div className="status-bar-divider" />
          <div className="status-bar-item">
            <span className="status-bar-label">🎴 相手</span>
            <span className="status-bar-val">{battle.opponentDeckRemaining.length}</span>
          </div>
          <div className="status-bar-divider" />
          <div className="status-bar-item status-bar-lastround">
            <span className="status-bar-label">前R</span>
            <span className="status-bar-val" style={{ color: lastRound.resColor }}>{lastRound.res}</span>
            <span className="status-bar-detail">{lastRound.pl} vs {lastRound.op}</span>
          </div>
        </div>
      </div>

      {/* distract: 相手の手札公開 */}
      {revealedCards && (
        <div className="revealed-hand-overlay">
          <div className="revealed-hand-title">👁️ 相手の手札が見えた！</div>
          <div className="revealed-hand-cards">
            {revealedCards.map((cardId, i) => {
              const card = CARD_DATA[cardId];
              if (!card) return null;
              return (
                <div key={`reveal-${i}`} className={`revealed-card type-${card.type}`}>
                  <div className="revealed-card-emoji">{card.emoji}</div>
                  <div className="revealed-card-name">{card.name}</div>
                  <div className="revealed-card-type">
                    {card.type === 'drink' ? `攻撃 ${card.damage === -1 ? '1~3' : card.damage}` :
                     card.type === 'food' ? `回復 ${card.heal}` :
                     card.type === 'chug' ? '一気飲み' :
                     card.type === 'harassment' ? 'セクハラ' :
                     card.type === 'strategy' ? '戦略' :
                     card.type === 'environment' ? '環境' : '状態異常'}
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
                ? (battle.opponentSanity <= 0 ? '理性崩壊…勝利！' : '勝利！')
                : gameResult === 'opponent_win'
                ? (battle.playerSanity <= 0 ? '理性が持たなかった…' : '敗北…')
                : '引き分け'}
            </h2>
            <p>
              {gameResult === 'player_win'
                ? currentOpponent.battleLines.loseLine
                : gameResult === 'opponent_win'
                ? currentOpponent.battleLines.winLine
                : 'いい勝負だった…'}
            </p>
            <div className="result-reward">+{resultReward} 龍門幣</div>
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
              店に戻る
            </button>
          </div>
        </div>
      )}

      {/* 勝利後イベントオーバーレイ */}
      <AfterEventOverlay />
    </div>
  );
}
