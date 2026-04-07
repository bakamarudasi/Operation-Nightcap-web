import { forwardRef } from 'react';

interface Props {
  particleStyles: React.CSSProperties[];
}

/** 背景・酔いブラー・パーティクル。blurRefは外から渡す */
export const BattleBackground = forwardRef<HTMLDivElement, Props>(
  function BattleBackground({ particleStyles }, blurRef) {
    return (
      <>
        <div className="battle-bg-layer battle-bg-gradient" />
        <div className="battle-bg-layer battle-bg-noise" />
        <div className="battle-bg-layer battle-bg-table" />
        <div className="battle-drunk-blur" ref={blurRef} />
        <div className="battle-particles">
          {particleStyles.map((style, i) => (
            <div key={i} className="battle-particle" style={style} />
          ))}
        </div>
      </>
    );
  }
);
