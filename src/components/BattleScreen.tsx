import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { Card, CardBack } from './Card.tsx';
import { randomPick } from '../engine/utils.ts';

export function BattleScreen() {
  const battle = useGameStore((s) => s.battle);
  const currentOpponent = useGameStore((s) => s.currentOpponent);
  const money = useGameStore((s) => s.money);
  const drawHands = useGameStore((s) => s.drawHands);
  const selectCard = useGameStore((s) => s.selectCard);
  const playRound = useGameStore((s) => s.playRound);
  const checkGameEnd = useGameStore((s) => s.checkGameEnd);
  const endBattle = useGameStore((s) => s.endBattle);
  const setScreen = useGameStore((s) => s.setScreen);
  const showCG = useGameStore((s) => s.showCG);
  const getDrunkLevel = useGameStore((s) => s.getDrunkLevel);

  const [dialogue, setDialogue] = useState({ speaker: '', text: '' });
  const [tableCards, setTableCards] = useState<{ player: string | null; opponent: string | null }>({ player: null, opponent: null });
  const [gameResult, setGameResult] = useState<'player_win' | 'opponent_win' | 'draw' | null>(null);
  const [resultReward, setResultReward] = useState(0);

  // 最初の手札を配る
  useEffect(() => {
    if (battle.playerHand.length === 0 && !battle.isProcessing && !gameResult) {
      drawHands();
      if (currentOpponent) {
        const line = randomPick(currentOpponent.drunkLevels[0].lines);
        setDialogue({ speaker: currentOpponent.name, text: line });
      }
    }
  }, []);

  const opponentDrunkLevel = getDrunkLevel(battle.opponentDrunk);
  const playerDrunkLevel = getDrunkLevel(battle.playerDrunk);

  const drunkClassName = (level: number) => level > 0 ? `drunk-${level}` : '';

  const getDrunkLevelInfo = (drunkValue: number) => {
    const level = getDrunkLevel(drunkValue);
    if (!currentOpponent) return { name: '', level };
    const data = currentOpponent.drunkLevels.find(l => l.level === level);
    return data || { name: '???', level };
  };

  const handleCardClick = (cardId: string) => {
    if (battle.isProcessing || gameResult) return;
    selectCard(cardId);
  };

  const handlePlayCard = useCallback(() => {
    if (!battle.selectedCard || battle.isProcessing || gameResult) return;

    const selectedId = battle.selectedCard;
    const result = playRound();
    if (!result) return;

    // テーブルにカード表示
    setTableCards({ player: selectedId, opponent: result.messages.length > 0 ? 'shown' : null });

    // セリフ
    if (result.messages.length > 0) {
      setDialogue({ speaker: '', text: result.messages.join(' / ') });
    }

    // CG
    if (result.cgEvent) {
      setTimeout(() => {
        showCG(result.cgEvent!);
      }, 1500);
    }

    // 即勝利
    if (result.instantWin) {
      setTimeout(() => {
        const reward = 500;
        endBattle('player_win');
        setResultReward(reward);
        setGameResult('player_win');
      }, result.cgEvent ? 5000 : 2000);
      return;
    }

    // 勝敗チェック
    setTimeout(() => {
      const end = checkGameEnd();
      if (end) {
        const b = useGameStore.getState().battle;
        const reward = end === 'player_win' ? (b.playerDrunk === 0 ? 800 : 500) :
                       end === 'opponent_win' ? 100 : 200;
        endBattle(end);
        setResultReward(reward);
        setGameResult(end);
      } else {
        // 次のラウンド
        setTableCards({ player: null, opponent: null });
        drawHands();

        // 相手のセリフ更新
        const state = useGameStore.getState();
        if (state.currentOpponent) {
          const lvl = getDrunkLevel(state.battle.opponentDrunk);
          const levelData = state.currentOpponent.drunkLevels.find(l => l.level === lvl);
          if (levelData) {
            setDialogue({ speaker: state.currentOpponent.name, text: randomPick(levelData.lines) });
          }
        }
      }
    }, 2000);
  }, [battle.selectedCard, battle.isProcessing, gameResult]);

  // カード選択後に自動で出す
  useEffect(() => {
    if (battle.selectedCard && !battle.isProcessing && !gameResult) {
      const timer = setTimeout(handlePlayCard, 500);
      return () => clearTimeout(timer);
    }
  }, [battle.selectedCard, battle.isProcessing, gameResult, handlePlayCard]);

  if (!currentOpponent) return null;

  return (
    <div className="screen active">
      {/* ヘッダー */}
      <div className="battle-header">
        <span className="battle-bar-name">ロドスバー</span>
        <span className="round-display">R.{battle.round}/{battle.maxRounds}</span>
        <span className="battle-money">💰 {money}</span>
      </div>

      {/* メインエリア */}
      <div className="battle-main">
        {/* 左: 相手キャラ */}
        <div className="battle-left">
          <div className="opponent-area">
            <div className={`character-sprite ${drunkClassName(opponentDrunkLevel)}`}>
              {currentOpponent.theme.icon}
            </div>
            <div className="opponent-name">{currentOpponent.name}</div>
          </div>
        </div>

        {/* 中央 */}
        <div className="battle-center">
          {/* 相手の酔いゲージ */}
          <div className="gauge-area">
            <div className="gauge-label">相手の酔い</div>
            <div className="drunk-gauge">
              <div
                className="drunk-gauge-fill"
                style={{ width: `${(battle.opponentDrunk / 10) * 100}%` }}
              ></div>
            </div>
            <div className="gauge-text">
              Lv.{opponentDrunkLevel} {getDrunkLevelInfo(battle.opponentDrunk).name} ({battle.opponentDrunk}/10)
            </div>
          </div>

          {/* テーブルエリア */}
          <div className="table-area">
            <div className="card-slot opponent-slot">
              {tableCards.opponent ? (
                <CardBack />
              ) : (
                <CardBack />
              )}
            </div>
            <div className="vs-text">VS</div>
            <div className="card-slot player-slot">
              {tableCards.player ? (
                <Card cardId={tableCards.player} size="table" />
              ) : (
                <CardBack />
              )}
            </div>
          </div>

          {/* セリフ */}
          <div className="dialogue-area">
            {dialogue.speaker && (
              <span className="dialogue-speaker">{dialogue.speaker}:</span>
            )}
            <span className="dialogue-text">{dialogue.text}</span>
          </div>

          {/* プレイヤーの酔いゲージ */}
          <div className="gauge-area player-gauge-area">
            <div className="gauge-label">ドクターの酔い</div>
            <div className="drunk-gauge">
              <div
                className="drunk-gauge-fill"
                style={{ width: `${(battle.playerDrunk / 10) * 100}%` }}
              ></div>
            </div>
            <div className="gauge-text">
              Lv.{playerDrunkLevel} ({battle.playerDrunk}/10)
            </div>
          </div>
        </div>

        {/* 右: デッキ情報 */}
        <div className="battle-right">
          <div className="deck-count">残りデッキ: {battle.playerDeckRemaining.length}枚</div>
        </div>
      </div>

      {/* 手札エリア */}
      <div className="hand-area">
        {battle.playerHand.map((cardId, i) => (
          <Card
            key={`${cardId}-${i}`}
            cardId={cardId}
            selected={battle.selectedCard === cardId}
            onClick={() => handleCardClick(cardId)}
          />
        ))}
      </div>

      {/* 勝敗リザルト */}
      {gameResult && (
        <div className="battle-result">
          <div className="result-content">
            <h2>
              {gameResult === 'player_win' ? '🏆 勝利！' :
               gameResult === 'opponent_win' ? '💀 敗北…' : '🤝 引き分け'}
            </h2>
            <p>
              {gameResult === 'player_win'
                ? currentOpponent.battleLines.loseLine
                : gameResult === 'opponent_win'
                ? currentOpponent.battleLines.winLine
                : 'いい勝負だった…'}
            </p>
            <div id="result-reward">+{resultReward} 龍門幣</div>
            <button className="menu-btn" onClick={() => setScreen('title')}>
              店に戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
