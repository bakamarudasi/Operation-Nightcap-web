import { useState, useEffect } from 'react';
import type { CharacterTheme, CostumeState } from '../data/types.ts';

interface PortraitProps {
  theme: CharacterTheme;
  /** 'portrait' = 大きい立ち絵, 'icon' = ミニアイコン */
  variant: 'portrait' | 'icon';
  className?: string;
  style?: React.CSSProperties;
  /** 酔いレベル (0-4) → 衣装崩れ演出 */
  drunkLevel?: number;
  /** キャラのコスチューム状態データ */
  costumeStates?: CostumeState[];
}

/**
 * キャラクター画像コンポーネント（画像未設定時はemojiにフォールバック）
 * drunkLevelを渡すと衣装崩れのオーバーレイが表示される
 */
export function CharacterPortrait({ theme, variant, className = '', style, drunkLevel = 0, costumeStates }: PortraitProps) {
  // 酔いレベル別立ち絵があればそちらを優先、なければ通常portraitImgにフォールバック
  const imgSrc = variant === 'portrait'
    ? (theme.portraitDrunkImgs?.[drunkLevel] ?? theme.portraitImg)
    : theme.iconImg;
  const [imgError, setImgError] = useState(false);

  // 画像ソースが変わったらエラー状態をリセット
  useEffect(() => {
    setImgError(false);
  }, [imgSrc]);

  const showImage = imgSrc && !imgError;
  const costume = costumeStates?.find(c => c.level === drunkLevel);
  const dishevel = costume?.dishevelAmount ?? 0;

  // 衣装崩れのCSS変数
  const costumeVars: React.CSSProperties = variant === 'portrait' ? {
    '--costume-dishevel': dishevel,
    '--costume-skin-opacity': Math.min(dishevel * 0.6, 0.5),
    '--costume-shift-x': `${dishevel * 8}px`,
    '--costume-shift-y': `${dishevel * 4}px`,
    '--costume-rotate': `${dishevel * 5}deg`,
  } as React.CSSProperties : {};

  const wrapperClass = variant === 'portrait' && drunkLevel > 0
    ? `char-portrait-wrapper costume-level-${drunkLevel}`
    : 'char-portrait-wrapper';

  const content = showImage ? (
    <img
      src={imgSrc}
      alt=""
      className={`char-img ${className}`}
      style={{ ...style, ...costumeVars }}
      onError={() => { setImgError(true); }}
      draggable={false}
    />
  ) : (
    <span className={`char-emoji ${className}`} style={{ ...style, ...costumeVars }}>
      {theme.icon}
    </span>
  );

  // ポートレートの場合、衣装崩れオーバーレイを追加
  if (variant === 'portrait' && drunkLevel > 0 && costumeStates) {
    return (
      <div className={wrapperClass}>
        {content}
        {/* 衣装崩れ演出オーバーレイ */}
        <div className="costume-overlay">
          {/* 肌の露出エフェクト（グラデーション） */}
          <div
            className="costume-skin-glow"
            style={{
              opacity: dishevel * 0.4,
              background: `radial-gradient(ellipse at 50% 40%, rgba(255, 200, 170, ${dishevel * 0.3}), transparent 70%)`,
            }}
          />
          {/* 衣装ずれインジケータ */}
          {drunkLevel >= 2 && (
            <div className="costume-slip-indicator" style={{ opacity: Math.min((drunkLevel - 1) * 0.3, 0.8) }}>
              <span className="costume-slip-mark" style={{
                top: '15%', right: '20%',
                transform: `rotate(${15 + dishevel * 20}deg)`,
              }}>〰️</span>
            </div>
          )}
          {drunkLevel >= 3 && (
            <div className="costume-slip-indicator" style={{ opacity: 0.6 }}>
              <span className="costume-slip-mark" style={{
                top: '35%', left: '15%',
                transform: `rotate(-${10 + dishevel * 15}deg)`,
              }}>〰️</span>
            </div>
          )}
        </div>
        {/* 衣装状態ラベル */}
        {costume && (
          <div className="costume-label">
            <span className="costume-label-emoji">{costume.emoji}</span>
            <span className="costume-label-text">{costume.label}</span>
          </div>
        )}
      </div>
    );
  }

  return content;
}
