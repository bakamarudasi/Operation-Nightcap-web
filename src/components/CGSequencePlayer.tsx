import { useState, useEffect } from 'react';
import type { CGSequenceFrame } from '../data/types.ts';

interface Props {
  frames: CGSequenceFrame[];
  cgColor: string;
  dialogueIndex: number;
  fallbackEmoji: string;
  eventId: string;
}

export function CGSequencePlayer({ frames, cgColor, dialogueIndex, fallbackEmoji, eventId }: Props) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [transitionClass, setTransitionClass] = useState('cg-seq-enter');

  // dialogueIndex（クリック）に連動してフレームを進める
  useEffect(() => {
    const targetFrame = frames.findLastIndex(
      (f) => f.dialogueStart !== undefined && f.dialogueStart <= dialogueIndex
    );
    if (targetFrame >= 0 && targetFrame !== currentFrame) {
      const transition = frames[targetFrame]?.transition ?? 'fade';
      setTransitionClass(`cg-seq-exit-${transition}`);

      // 退場アニメ→入場アニメ
      const t = window.setTimeout(() => {
        setCurrentFrame(targetFrame);
        setTransitionClass(`cg-seq-enter-${transition}`);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [dialogueIndex, frames, currentFrame]);

  // CGが変わったらリセット
  useEffect(() => {
    setCurrentFrame(0);
    setTransitionClass('cg-seq-enter');
  }, [eventId]);

  const frame = frames[currentFrame];
  if (!frame) return null;

  const hasSrc = frame.src;

  return (
    <div className="cg-sequence-player">
      <div
        className={`cg-seq-frame ${transitionClass}`}
        style={{
          background: hasSrc
            ? `url(${frame.src}) center/cover no-repeat`
            : `linear-gradient(135deg, ${cgColor}44, ${cgColor}88)`,
        }}
      >
        {!hasSrc && (
          <div className="cg-placeholder">
            <div className="cg-placeholder-emoji" style={{ fontSize: '80px' }}>
              {fallbackEmoji}
            </div>
            <div className="cg-placeholder-text" style={{ fontSize: '16px', color: '#f5e6d3', marginTop: '16px' }}>
              {frame.label ?? eventId.replace(/_/g, ' ').toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* フレームインジケーター */}
      {frames.length > 1 && (
        <div className="cg-seq-indicators">
          {frames.map((_, i) => (
            <div
              key={i}
              className={`cg-seq-dot ${i === currentFrame ? 'active' : ''} ${i < currentFrame ? 'passed' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
