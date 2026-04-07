import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { useLocalizedCharacterData } from '../hooks/useLocalizedCharacterData.ts';
import { randomPick, getDrunkLevel } from '../engine/utils.ts';
import { buildCardDisplayInfo, buildOpponentCardDisplayInfo, computeRoundOutcome } from '../engine/battlePresenter.ts';
import { playSlamSound, playFlipSound } from '../engine/battleAudio.ts';
import { AfterEventOverlay } from './AfterEventOverlay.tsx';
import { BattleResult } from './battle/BattleResult.tsx';
import { OpponentBar } from './battle/OpponentBar.tsx';
import { PlayerHand } from './battle/PlayerHand.tsx';
import { BattleBackground } from './battle/BattleBackground.tsx';
import { OpponentPortrait } from './battle/OpponentPortrait.tsx';
import { BattleField } from './battle/BattleField.tsx';
import { PlayerGauges } from './battle/PlayerGauges.tsx';
import { BattleStatusBar, type LastRoundInfo } from './battle/BattleStatusBar.tsx';
import { RevealedHandOverlay } from './battle/RevealedHandOverlay.tsx';
import { getDrunkStage, getSanityStage } from './battle/battleStages.ts';

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
  const [lastRound, setLastRound] = useState<LastRoundInfo>({
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
      cardPlayLock.current = false;
      setPlayingCardIdx(null);
      return;
    }

    const lockSafetyTimer = safeTimeout(() => {
      if (cardPlayLock.current) {
        cardPlayLock.current = false;
        setPlayingCardIdx(null);
      }
    }, 15000);

    const playerCardInfo = buildCardDisplayInfo(result.playerCardId, t);
    if (playerCardInfo) {
      setTableCards(prev => ({ ...prev, player: playerCardInfo }));
      setPlayerFlipped(true);
      setSlamPlayer(true);
      playSlamSound();
      setFieldShaking(true);
      safeTimeout(() => { setSlamPlayer(false); setFieldShaking(false); }, 400);
    }

    safeTimeout(() => {
      const oppCardInfo = buildOpponentCardDisplayInfo(result.opponentCardId, t);

      if (oppCardInfo) {
        setTableCards(prev => ({ ...prev, opponent: oppCardInfo }));
      }

      setSlamOpp(true);
      playSlamSound();
      safeTimeout(() => setSlamOpp(false), 400);

      safeTimeout(() => {
        setOppFlipped(true);
        playFlipSound();

        safeTimeout(() => {
          if (result.messages.length > 0) {
            setDialogue({ speaker: currentOpponent?.name ?? '', text: result.messages.join(' / ') });
          }

          const outcome = computeRoundOutcome(result);
          setReaction(outcome.reaction);
          safeTimeout(() => setReaction(null), 2000);

          if (result.playerMisplay) {
            setMisplayFlash(true);
            safeTimeout(() => setMisplayFlash(false), 900);
          }
          if (result.playerMatchup === 'advantage') setMatchupBadge(t('battle.advantageBadge'));
          else if (result.playerMatchup === 'disadvantage') setMatchupBadge(t('battle.disadvantageBadge'));
          else setMatchupBadge(null);

          const popupMap = {
            win:  { text: t('battle.roundWin'), cls: 'result-win' },
            lose: { text: t('battle.roundLose'), cls: 'result-lose' },
            draw: { text: t('battle.roundDraw'), cls: 'result-draw' },
          };
          setRoundPopup(popupMap[outcome.roundResultType]);
          safeTimeout(() => setRoundPopup(null), 1800);

          if (result.revealedHand && result.revealedHand.length > 0) {
            setRevealedCards(result.revealedHand);
            safeTimeout(() => setRevealedCards(null), 4000);
          }

          if (result.cgEvent) {
            safeTimeout(() => { showCG(result.cgEvent!); }, 1000);
          }

          if (result.opponentCgEvent) {
            const delay = result.cgEvent ? 5000 : 1000;
            safeTimeout(() => { showCG(result.opponentCgEvent!); }, delay);
          }

          const hasCG = !!(result.cgEvent || result.opponentCgEvent);
          const cgDelay = result.cgEvent && result.opponentCgEvent ? 9000 : hasCG ? 5000 : 2000;

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
              const pc = pCard;
              if (pc && oppCardInfo) {
                const lastRoundMap = {
                  win:  { res: t('battle.lastRoundWin'), color: '#8bc98b' },
                  lose: { res: t('battle.lastRoundLose'), color: '#c98b8b' },
                  draw: { res: t('battle.lastRoundDraw'), color: 'var(--gold)' },
                };
                const lr = lastRoundMap[outcome.roundResultType];
                setLastRound({
                  pl: `${pc.emoji} ${t(`cards.${pc.id}.name`, pc.name)}`,
                  op: `${oppCardInfo.emoji} ${oppCardInfo.name}`,
                  res: lr.res,
                  resColor: lr.color,
                });
              }

              setTableCards({ player: null, opponent: null });
              setPlayerFlipped(false);
              setOppFlipped(false);
              setPlayingCardIdx(null);
              setMatchupBadge(null);
              clearTimeout(lockSafetyTimer);
              cardPlayLock.current = false;
              drawHands();

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
  }, [battle.selectedCard, battle.isProcessing, gameResult, currentOpponent, drawHands, endBattle, checkGameEnd, showCG, playRound, checkAfterEvent, safeTimeout, t]);

  // カード選択後に自動で出す
  useEffect(() => {
    if (battle.selectedCard && !battle.isProcessing && !gameResult) {
      const timer = setTimeout(handlePlayCard, 500);
      return () => clearTimeout(timer);
    }
  }, [battle.selectedCard, battle.isProcessing, gameResult, handlePlayCard]);

  if (!currentOpponent) return null;

  return (
    <div className="screen active" style={{ position: 'relative' }}>
      <BattleBackground ref={blurRef} particleStyles={particleStyles} />

      <div className="battle-tilt-wrapper" ref={tiltRef}>
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

        <div className="battle-main">
          <OpponentPortrait
            currentOpponent={currentOpponent}
            opponentDrunkLevel={opponentDrunkLevel}
            oppDrunkStage={oppDrunkStage}
            oppFlush={oppFlush}
            reaction={reaction}
            drunkClassName={drunkClassName}
            t={t}
          />

          <div className="battle-center">
            <OpponentBar
              currentOpponent={currentOpponent}
              battle={battle}
              oppDrunkStage={oppDrunkStage}
              oppSanityStage={oppSanityStage}
              t={t}
            />

            <BattleField
              ref={fieldRef}
              tableCards={tableCards}
              playerFlipped={playerFlipped}
              oppFlipped={oppFlipped}
              slamPlayer={slamPlayer}
              slamOpp={slamOpp}
              fieldShaking={fieldShaking}
              roundPopup={roundPopup}
            />

            <div className="dialogue-area">
              <div className="dialogue-bar">
                <div className="dlg-name">{dialogue.speaker ? `${dialogue.speaker}：` : ''}</div>
                <div className="dlg-text">{displayText}</div>
              </div>
            </div>

            <PlayerGauges
              battle={battle}
              plDrunkStage={plDrunkStage}
              plSanityStage={plSanityStage}
              t={t}
            />
          </div>
        </div>

        <PlayerHand
          battle={battle}
          playingCardIdx={playingCardIdx}
          handCardRefs={handCardRefs}
          onCardClick={handleCardClick}
          t={t}
        />

        {matchupBadge && <div className="matchup-badge">{matchupBadge}</div>}
        {misplayFlash && <div className="matchup-badge misplay-shake">{t('battle.rampage')}</div>}

        <BattleStatusBar
          battle={battle}
          wins={wins}
          losses={losses}
          lastRound={lastRound}
          t={t}
        />
      </div>

      {revealedCards && <RevealedHandOverlay revealedCards={revealedCards} t={t} />}

      {gameResult && !activeAfterEvent && (
        <BattleResult
          gameResult={gameResult}
          battle={battle}
          currentOpponent={currentOpponent}
          resultReward={resultReward}
          winsByCharacter={winsByCharacter}
          pendingAfterEvent={pendingAfterEvent}
          t={t}
          onShowAfterEvent={showAfterEvent}
          onReturnToBar={() => setScreen('title')}
        />
      )}

      <AfterEventOverlay />
    </div>
  );
}
