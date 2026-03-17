import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CHARACTER_DATA } from '../data/characters.ts';
import { randomPick } from '../engine/utils.ts';
import { CharacterPortrait } from './CharacterPortrait.tsx';
import { AfterEventOverlay } from './AfterEventOverlay.tsx';

export function GalleryScreen() {
  const { t } = useTranslation();
  const setScreen = useGameStore((s) => s.setScreen);
  const unlockedCGs = useGameStore((s) => s.unlockedCGs);
  const showCG = useGameStore((s) => s.showCG);
  const showAfterEvent = useGameStore((s) => s.showAfterEvent);
  const unlockedAfterEvents = useGameStore((s) => s.unlockedAfterEvents);
  const wins = useGameStore((s) => s.wins);
  const losses = useGameStore((s) => s.losses);

  const [activeTab, setActiveTab] = useState<'cg' | 'portrait'>('cg');
  const [selectedChar, setSelectedChar] = useState<string>(Object.keys(CHARACTER_DATA)[0] ?? 'blaze');
  const [drunkLevel, setDrunkLevel] = useState(0);
  const [currentLine, setCurrentLine] = useState('');

  const characters = Object.values(CHARACTER_DATA);
  const char = CHARACTER_DATA[selectedChar];

  // CG一覧
  const allCGs = characters.flatMap(c => c.cgEvents.map(e => ({ ...e, charId: c.id, charName: c.name })));
  const unlockedCount = allCGs.filter(cg => unlockedCGs.includes(cg.id)).length;

  // 立ち絵: 酔いLvのセリフ
  const handleCharSelect = (charId: string) => {
    setSelectedChar(charId);
    setDrunkLevel(0);
    const c = CHARACTER_DATA[charId];
    if (c) {
      setCurrentLine(c.drunkLevels[0].lines[0]);
    }
  };

  const handleDrunkLevel = (level: number) => {
    setDrunkLevel(level);
    if (char) {
      const lvData = char.drunkLevels.find(l => l.level === level);
      if (lvData) {
        setCurrentLine(randomPick(lvData.lines) ?? '');
      }
    }
  };

  const handleNextLine = () => {
    if (char) {
      const lvData = char.drunkLevels.find(l => l.level === drunkLevel);
      if (lvData) {
        setCurrentLine(randomPick(lvData.lines) ?? '');
      }
    }
  };

  // blush opacity
  const blushOpacity = drunkLevel >= 3 ? 0.8 : drunkLevel >= 2 ? 0.5 : drunkLevel >= 1 ? 0.25 : 0;

  return (
    <div className="screen active">
      <div className="gallery-header">
        <button className="back-btn" onClick={() => setScreen('title')}>{t('common.back')}</button>
        <h2>{t('gallery.title')}</h2>
      </div>

      {/* タブ切替 */}
      <div className="gallery-tabs">
        <button
          className={`gallery-tab ${activeTab === 'cg' ? 'active' : ''}`}
          onClick={() => setActiveTab('cg')}
        >
          {t('gallery.cgTab')}
        </button>
        <button
          className={`gallery-tab ${activeTab === 'portrait' ? 'active' : ''}`}
          onClick={() => setActiveTab('portrait')}
        >
          {t('gallery.portraitTab')}
        </button>
      </div>

      {/* CGタブ */}
      {activeTab === 'cg' && (
        <div className="gallery-tab-content active">
          <span className="gallery-progress">
            {t('gallery.unlockRate', { unlocked: unlockedCount, total: allCGs.length, percent: allCGs.length > 0 ? Math.round(unlockedCount / allCGs.length * 100) : 0 })}
          </span>
          <div className="gallery-content">
            {allCGs.map((cg) => {
              const isUnlocked = unlockedCGs.includes(cg.id);
              return (
                <div
                  key={cg.id}
                  className={`gallery-item ${isUnlocked ? '' : 'locked'}`}
                  onClick={() => {
                    if (isUnlocked) {
                      showCG(cg);
                    }
                  }}
                >
                  {isUnlocked ? (
                    <>
                      <span className="gallery-thumb">
                        {cg.dialogue[0]?.speaker === t('common.doctor') ? '💫' : cg.charName}
                      </span>
                      <span className="gallery-label">{cg.id.replace(/_/g, ' ')}</span>
                    </>
                  ) : (
                    <span className="gallery-thumb">{t('gallery.unknown')}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 勝利後イベント */}
          <div className="gallery-after-section">
            <div className="gallery-after-title">
              {t('gallery.afterEvents', { unlocked: characters.flatMap(c => c.afterEvents).filter(ae => unlockedAfterEvents.includes(ae.id)).length, total: characters.flatMap(c => c.afterEvents).length })}
            </div>
            <div className="gallery-after-grid">
              {characters.flatMap(c => c.afterEvents).map((ae) => {
                const isUnlocked = unlockedAfterEvents.includes(ae.id);
                return (
                  <div
                    key={ae.id}
                    className={`gallery-after-item ${isUnlocked ? '' : 'locked'}`}
                    style={{
                      background: isUnlocked
                        ? `linear-gradient(135deg, ${ae.cgColor}44, ${ae.cgColor}88)`
                        : 'rgba(30, 18, 10, 0.6)',
                    }}
                    onClick={() => {
                      if (isUnlocked) {
                        showAfterEvent(ae);
                      }
                    }}
                  >
                    {isUnlocked ? (
                      <>
                        <span className="gallery-after-emoji">{ae.emoji}</span>
                        <span className="gallery-after-label">{ae.title}</span>
                      </>
                    ) : (
                      <div className="gallery-after-lock">{t('gallery.locked')}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 立ち絵タブ */}
      {activeTab === 'portrait' && (
        <div className="gallery-tab-content active">
          <div className="portrait-view-layout">
            {/* 左: キャラ選択リスト */}
            <div className="portrait-char-list">
              {characters.map((c) => (
                <button
                  key={c.id}
                  className={`portrait-char-btn ${selectedChar === c.id ? 'active' : ''}`}
                  onClick={() => handleCharSelect(c.id)}
                >
                  <span className="portrait-char-btn-icon"><CharacterPortrait theme={c.theme} variant="icon" /></span> {c.name}
                </button>
              ))}
            </div>

            {/* 右: 立ち絵表示エリア */}
            {char && (
              <div className="portrait-view-main">
                <div className="portrait-sprite-area">
                  <div className="portrait-sprite">
                    <CharacterPortrait
                      theme={char.theme}
                      variant="portrait"
                      drunkLevel={drunkLevel}
                      costumeStates={char.costumeStates}
                    />
                  </div>
                  <div className="portrait-blush" style={{ opacity: blushOpacity }}></div>
                </div>
                {/* 衣装状態表示 */}
                {char.costumeStates[drunkLevel] && (
                  <div className="portrait-costume-info">
                    <span>{char.costumeStates[drunkLevel].emoji} {char.costumeStates[drunkLevel].label}</span>
                    <span className="portrait-costume-desc">{char.costumeStates[drunkLevel].description}</span>
                  </div>
                )}
                <div className="portrait-info">
                  <h3 className="portrait-char-name">{char.name}</h3>
                  <p className="portrait-char-subtitle">{char.subtitle}</p>
                </div>
                <div className="portrait-drunk-selector">
                  {char.drunkLevels.map((lv) => (
                    <button
                      key={lv.level}
                      className={`drunk-level-btn ${drunkLevel === lv.level ? 'active' : ''}`}
                      onClick={() => handleDrunkLevel(lv.level)}
                    >
                      Lv.{lv.level} {lv.name}
                    </button>
                  ))}
                </div>
                <div className="portrait-dialogue">
                  <p className="portrait-line">{currentLine || char.drunkLevels[0].lines[0]}</p>
                  <button className="portrait-next-line-btn" onClick={handleNextLine}>
                    {t('gallery.changeLine')}
                  </button>
                </div>
                <div className="portrait-stats">
                  <span>{t('gallery.stats', { wins, losses })}</span>
                  <span>{t('gallery.cgProgress', { unlocked: char.cgEvents.filter(e => unlockedCGs.includes(e.id)).length, total: char.cgEvents.length })}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 勝利後イベントオーバーレイ */}
      <AfterEventOverlay />
    </div>
  );
}
