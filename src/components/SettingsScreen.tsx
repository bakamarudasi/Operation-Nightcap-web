import { useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';

export function SettingsScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const resetData = useGameStore((s) => s.resetData);
  const loadDebugPreset = useGameStore((s) => s.loadDebugPreset);
  const debugMode = useGameStore((s) => s.debugMode);

  const [bgmVolume, setBgmVolume] = useState(80);
  const [seVolume, setSeVolume] = useState(60);
  const [textSpeed, setTextSpeed] = useState(30);

  const getTextSpeedLabel = (val: number) => {
    if (val <= 15) return 'はやい';
    if (val <= 40) return 'ふつう';
    return 'おそい';
  };

  const handleReset = () => {
    if (window.confirm('本当にデータをリセットしますか？\nすべてのセーブデータが消去されます。')) {
      resetData();
    }
  };

  const handleDebugPreset = () => {
    if (window.confirm('デバッグプリセットを読み込みますか？\n\n・所持金: 99,999\n・デッキ: セクハラカード全種+VIPルーム\n・勝利数: 50\n・バトル開始時: 相手 酔いLv3')) {
      loadDebugPreset();
    }
  };

  return (
    <div className="screen active">
      <div className="settings-header">
        <button className="back-btn" onClick={() => setScreen('title')}>← 戻る</button>
        <h2>⚙️ 設定</h2>
      </div>
      <div className="settings-content">
        <div className="settings-section">
          <label className="settings-label">🔊 BGM 音量</label>
          <input
            type="range"
            className="settings-slider"
            min={0}
            max={100}
            value={bgmVolume}
            onChange={(e) => setBgmVolume(Number(e.target.value))}
          />
          <span className="settings-value">{bgmVolume}%</span>
        </div>
        <div className="settings-section">
          <label className="settings-label">🔉 SE 音量</label>
          <input
            type="range"
            className="settings-slider"
            min={0}
            max={100}
            value={seVolume}
            onChange={(e) => setSeVolume(Number(e.target.value))}
          />
          <span className="settings-value">{seVolume}%</span>
        </div>
        <div className="settings-section">
          <label className="settings-label">💬 テキスト速度</label>
          <input
            type="range"
            className="settings-slider"
            min={10}
            max={80}
            step={5}
            value={textSpeed}
            onChange={(e) => setTextSpeed(Number(e.target.value))}
          />
          <span className="settings-value">{getTextSpeedLabel(textSpeed)}</span>
        </div>
        <div className="settings-divider"></div>
        <div className="settings-section">
          <button className="menu-btn" onClick={handleDebugPreset} style={{ backgroundColor: debugMode ? '#4a9' : '#555' }}>
            {debugMode ? '🐛 デバッグモード ON' : '🐛 デバッグプリセット読込'}
          </button>
          {debugMode && (
            <p style={{ color: '#aaa', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              セクハラカード全種デッキ / 相手酔いLv3スタート / 所持金99,999
            </p>
          )}
        </div>
        <div className="settings-section">
          <button className="menu-btn danger-btn" onClick={handleReset}>
            🗑️ データリセット
          </button>
        </div>
      </div>
    </div>
  );
}
