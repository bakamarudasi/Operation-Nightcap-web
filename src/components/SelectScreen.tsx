import { useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CHARACTER_DATA } from '../data/characters.ts';

export function SelectScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const initBattle = useGameStore((s) => s.initBattle);
  const wins = useGameStore((s) => s.wins);
  const losses = useGameStore((s) => s.losses);
  const unlockedCGs = useGameStore((s) => s.unlockedCGs);
  const [hoveredChar, setHoveredChar] = useState<string | null>(null);

  const characters = Object.values(CHARACTER_DATA);
  const hovered = hoveredChar ? CHARACTER_DATA[hoveredChar] : null;

  return (
    <div className="screen active">
      <div className="select-header">
        <button className="back-btn" onClick={() => setScreen('title')}>← 戻る</button>
        <h2>対戦相手を選べ</h2>
      </div>
      <div className="select-body">
        <div className="character-list">
          {characters.map((char) => (
            <div
              key={char.id}
              className="character-card"
              onMouseEnter={() => setHoveredChar(char.id)}
              onClick={() => initBattle(char.id)}
            >
              <div className="char-sprite">{char.theme.icon}</div>
              <div className="char-name">{char.name}</div>
              <div className="char-subtitle-small">{char.subtitle}</div>
            </div>
          ))}
        </div>

        <div className={`character-detail ${hovered ? 'visible' : ''}`}>
          {hovered && (
            <div className="detail-inner">
              <div className="detail-portrait">
                <div className="detail-sprite">{hovered.theme.icon}</div>
              </div>
              <div className="detail-info">
                <h3 className="detail-name">{hovered.name}</h3>
                <p className="detail-subtitle">{hovered.subtitle}</p>
                <div className="detail-divider"></div>
                <div className="detail-stats">
                  <div className="detail-stat-row">
                    <span className="detail-stat-label">タイプ</span>
                    <span className="detail-stat-value">{hovered.drunkType}</span>
                  </div>
                  <div className="detail-stat-row">
                    <span className="detail-stat-label">戦績</span>
                    <span className="detail-stat-value">{wins}勝 {losses}敗</span>
                  </div>
                  <div className="detail-stat-row">
                    <span className="detail-stat-label">CG解放</span>
                    <span className="detail-stat-value">
                      {hovered.cgEvents.filter(e => unlockedCGs.includes(e.id)).length}/{hovered.cgEvents.length}
                    </span>
                  </div>
                </div>
                <div className="detail-divider"></div>
                <p className="detail-quote">
                  「{hovered.drunkLevels[0].lines[0]}」
                </p>
              </div>
              <button
                className="menu-btn detail-battle-btn"
                onClick={() => initBattle(hovered.id)}
              >
                この相手と飲む
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
