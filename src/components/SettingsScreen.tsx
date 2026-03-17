import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const setScreen = useGameStore((s) => s.setScreen);
  const resetData = useGameStore((s) => s.resetData);
  const loadDebugPreset = useGameStore((s) => s.loadDebugPreset);
  const debugMode = useGameStore((s) => s.debugMode);

  const [bgmVolume, setBgmVolume] = useState(80);
  const [seVolume, setSeVolume] = useState(60);
  const [textSpeed, setTextSpeed] = useState(30);

  const getTextSpeedLabel = (val: number) => {
    if (val <= 15) return t('settings.speedFast');
    if (val <= 40) return t('settings.speedNormal');
    return t('settings.speedSlow');
  };

  const handleReset = () => {
    if (window.confirm(t('settings.resetConfirm'))) {
      resetData();
    }
  };

  const handleDebugPreset = () => {
    if (window.confirm(t('settings.debugConfirm'))) {
      loadDebugPreset();
    }
  };

  return (
    <div className="screen active">
      <div className="settings-header">
        <button className="back-btn" onClick={() => setScreen('title')}>{t('common.back')}</button>
        <h2>{t('settings.title')}</h2>
      </div>
      <div className="settings-content">
        <div className="settings-section">
          <label className="settings-label">{t('settings.bgmVolume')}</label>
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
          <label className="settings-label">{t('settings.seVolume')}</label>
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
          <label className="settings-label">{t('settings.textSpeed')}</label>
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
        <div className="settings-section">
          <label className="settings-label">{t('settings.language')}</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="menu-btn"
              style={{ backgroundColor: i18n.language === 'ja' ? '#886644' : '#555', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => i18n.changeLanguage('ja')}
            >
              日本語
            </button>
            <button
              className="menu-btn"
              style={{ backgroundColor: i18n.language === 'en' ? '#886644' : '#555', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => i18n.changeLanguage('en')}
            >
              English
            </button>
            <button
              className="menu-btn"
              style={{ backgroundColor: i18n.language === 'zh-CN' ? '#886644' : '#555', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => i18n.changeLanguage('zh-CN')}
            >
              简体中文
            </button>
          </div>
        </div>
        <div className="settings-divider"></div>
        <div className="settings-section">
          <button className="menu-btn" onClick={handleDebugPreset} style={{ backgroundColor: debugMode ? '#4a9' : '#555' }}>
            {debugMode ? t('settings.debugOn') : t('settings.debugLoad')}
          </button>
          {debugMode && (
            <p style={{ color: '#aaa', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              {t('settings.debugDesc')}
            </p>
          )}
        </div>
        <div className="settings-section">
          <button className="menu-btn danger-btn" onClick={handleReset}>
            {t('settings.resetData')}
          </button>
        </div>
      </div>
    </div>
  );
}
