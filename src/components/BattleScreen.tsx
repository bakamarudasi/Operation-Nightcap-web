import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { randomPick } from '../engine/utils.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { AfterEventOverlay } from './AfterEventOverlay.tsx';
import { getDrunkStage } from '../utils/drunkLevel.ts';
import { playBattleSound } from '../utils/audioContext.ts';
import { formatFieldValue, formatOppFieldValue, formatCardValue, formatRevealedType } from '../utils/cardFormatting.ts';
import { useTypewriterEffect } from '../hooks/useTypewriterEffect.ts';

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
    if (battle.playerHand.length === 0 && !battle.isProcessing && !gameResult) {
      drawHands();
      if (currentOpponent) {
        const line = randomPick(currentOpponent.drunkLevels[0].lines);
        setDialogue({ speaker: currentOpponent.name, text: line });
      }
    }
  }, [battle.playerHand.length, battle.isProcessing, gameResult, drawHands, currentOpponent]);

  const { displayText } = useTypewriterEffect(dialogue.text);

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

    // プレイヤーカードをフィールドに表示
    if (pCard) {
      const val = formatFieldValue(pCard);
      setTableCards(prev => ({
        ...prev,
        player: { id: selectedId, emoji: pCard.emoji, name: pCard.name, val }
      }));
      setPlayerFlipped(true);
      setSlamPlayer(true);
      playBattleSound('slam');
      setFieldShaking(true);
      setTimeout(() => { setSlamPlayer(false); setFieldShaking(false); }, 400);
    }

    // 相手カードを少し遅れて表示
    setTimeout(() => {
      // 相手カードをplayRoundの結果から直接取得
      const oppCard = CARD_DATA[result.opponentCardId];
      let oppCardInfo: { emoji: string; name: string; val: string } | null = null;
      if (oppCard) {
        oppCardInfo = { emoji: oppCard.emoji, name: oppCard.name, val: formatOppFieldValue(oppCard) };
      }

      if (oppCardInfo) {
        setTableCards(prev => ({ ...prev, opponent: { id: '', ...oppCardInfo! } }));
      }

      setSlamOpp(true);
      playBattleSound('slam');
      setTimeout(() => setSlamOpp(false), 400);

      // 相手カードフリップ
      setTimeout(() => {
        setOppFlipped(true);
        playBattleSound('flip');

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
              cardPlayLock.current = false;
              drawHands();

              // 相手のセリフ更新
              const s = useGameStore.getState();
              if (s.currentOpponent) {
                const lvl = getDrunkLevel(s.battle.opponentDrunk);
                const levelData = s.currentOpponent.drunkLevels.find(l => l.level === lvl);
                if (levelData) {
                  setDialogue({ speaker: s.currentOpponent.name, text: randomPick(levelData.lines) });
                }
              }
            }
          }, endCheckDelay);
        }, 400);
      }, 400);
    }, 800);
  }, [battle.selectedCard, battle.isProcessing, gameResult, currentOpponent, drawHands, endBattle, checkGameEnd, showCG, getDrunkLevel, playRound, selectCard]);

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
                      style={{ width: `${(battle.opponentDrunk / 10) * 100}%` }}
                    />
                  </div>
                  <div className="gauge-lvl">
                    <span className="lvl-t">{oppDrunkStage.text}</span>
                    <span className="lvl-n">({battle.opponentDrunk}/10)</span>
                  </div>
                </div>
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
                  style={{ width: `${(battle.playerDrunk / 10) * 100}%` }}
                />
              </div>
              <div className="gauge-lvl">
                <span className="lvl-t">{plDrunkStage.text}</span>
                <span className="lvl-n">({battle.playerDrunk}/10)</span>
              </div>
            </div>
          </div>

          {/* 右: ステータスパネル */}
          <div className="status-panel">
            <div className="panel-section">
              <div className="panel-label">ドクター状態</div>
              <div className={`char-drunk-label ${plDrunkStage.cls}`} style={{ textAlign: 'center', padding: '8px', background: 'rgba(30,18,10,0.4)', borderRadius: '6px', border: '1px solid rgba(80,50,25,0.2)' }}>
                {plDrunkStage.text}
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-label">酔いレベル</div>
              <div className="panel-gauge-mini">
                <div className="panel-gauge-label">
                  <span className="lbl">酔い度</span>
                  <span className="val">{battle.playerDrunk} / 10</span>
                </div>
                <div className="panel-gauge-track">
                  <div
                    className="panel-gauge-fill pl-fill"
                    style={{ width: `${(battle.playerDrunk / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-label">戦績</div>
              <div className="panel-record">
                <div className="panel-record-item">
                  <span className="panel-record-num win-c">{wins}</span>
                  <span className="panel-record-label">勝ち</span>
                </div>
                <div className="panel-record-item">
                  <span className="panel-record-num lose-c">{losses}</span>
                  <span className="panel-record-label">負け</span>
                </div>
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-label">デッキ</div>
              <div className="panel-deck">
                <div className="panel-deck-icon">🃏</div>
                <div className="panel-deck-info">
                  <div className="panel-deck-label">残りカード</div>
                  <div className="panel-deck-num">{battle.playerDeckRemaining.length}</div>
                </div>
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-label">相手デッキ</div>
              <div className="panel-deck">
                <div className="panel-deck-icon">🎴</div>
                <div className="panel-deck-info">
                  <div className="panel-deck-label">残りカード</div>
                  <div className="panel-deck-num">{battle.opponentDeckRemaining.length}</div>
                </div>
              </div>
            </div>

            <div className="panel-section">
              <div className="panel-label">直前のラウンド</div>
              <div className="panel-stat">
                <div className="panel-stat-name">自分</div>
                <div className="panel-stat-val">{lastRound.pl}</div>
              </div>
              <div className="panel-stat">
                <div className="panel-stat-name">相手</div>
                <div className="panel-stat-val">{lastRound.op}</div>
              </div>
              <div className="panel-stat">
                <div className="panel-stat-name">結果</div>
                <div className="panel-stat-val" style={{ color: lastRound.resColor }}>{lastRound.res}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 手札エリア */}
        <div className="hand-area">
          {battle.playerHand.map((cardId, i) => {
            const card = CARD_DATA[cardId];
            if (!card) return null;
            const isPlaying = playingCardIdx === i;
            const isDisabled = (battle.isProcessing || playingCardIdx !== null) && !isPlaying;
            const isSelected = battle.selectedCard === cardId && !isPlaying;
            const isCorrupted = battle.corruptedSlots[i] === true;
            const valText = formatCardValue(card);

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
                    {formatRevealedType(card)}
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
              {gameResult === 'player_win' ? '勝利！' :
               gameResult === 'opponent_win' ? '敗北…' : '引き分け'}
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
