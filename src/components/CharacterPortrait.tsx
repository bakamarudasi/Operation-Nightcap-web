import { useState } from 'react';
import type { CharacterTheme } from '../data/types.ts';

interface PortraitProps {
  theme: CharacterTheme;
  /** 'portrait' = 大きい立ち絵, 'icon' = ミニアイコン */
  variant: 'portrait' | 'icon';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * キャラクター画像コンポーネント（画像未設定時はemojiにフォールバック）
 *
 * 使い方:
 *   <CharacterPortrait theme={char.theme} variant="portrait" className="my-class" />
 *
 * 画像パスの規約:
 *   - portrait: /characters/{id}/portrait.png (立ち絵)
 *   - icon:     /characters/{id}/icon.png     (ミニアイコン)
 */
export function CharacterPortrait({ theme, variant, className = '', style }: PortraitProps) {
  const imgSrc = variant === 'portrait' ? theme.portraitImg : theme.iconImg;
  const [imgError, setImgError] = useState(false);

  const showImage = imgSrc && !imgError;

  if (showImage) {
    return (
      <img
        src={imgSrc}
        alt=""
        className={`char-img ${className}`}
        style={style}
        onError={() => setImgError(true)}
        draggable={false}
      />
    );
  }

  // フォールバック: emoji表示
  return (
    <span className={`char-emoji ${className}`} style={style}>
      {theme.icon}
    </span>
  );
}
