import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { CGSequencePlayer } from './CGSequencePlayer.tsx';

export function CGOverlay() {
  const { t } = useTranslation();
  const activeCG = useGameStore((s) => s.activeCG);
  const cgDialogueIndex = useGameStore((s) => s.cgDialogueIndex);
  const advanceCG = useGameStore((s) => s.advanceCG);
  const closeCG = useGameStore((s) => s.closeCG);

  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typeIntervalRef = useRef<number | null>(null);

  const currentLine = activeCG?.dialogue[cgDialogueIndex];

  useEffect(() => {
    if (!currentLine) return;

    setDisplayText('');
    setIsTyping(true);

    let i = 0;
    const chars = currentLine.text.split('');

    typeIntervalRef.current = window.setInterval(() => {
      if (i < chars.length) {
        setDisplayText(prev => prev + chars[i]);
        i++;
      } else {
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
          typeIntervalRef.current = null;
        }
        setIsTyping(false);
      }
    }, 30);

    return () => {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
      }
    };
  }, [currentLine]);

  if (!activeCG || !currentLine) return null;

  const handleClick = () => {
    if (isTyping) {
      // タイプライター途中なら全文表示
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
        typeIntervalRef.current = null;
      }
      setDisplayText(currentLine.text);
      setIsTyping(false);
    } else {
      // 次のセリフへ
      advanceCG();
    }
  };

  const triggerCard = CARD_DATA[activeCG.triggerCard];
  const eventEmoji = triggerCard?.emoji ?? '💫';
  const hasFrames = activeCG.frames && activeCG.frames.length > 0;

  return (
    <div className="cg-overlay" onClick={handleClick}>
      <div className="cg-image-container">
        {hasFrames ? (
          <CGSequencePlayer
            frames={activeCG.frames!}
            cgColor={activeCG.cgColor}
            dialogueIndex={cgDialogueIndex}
            fallbackEmoji={eventEmoji}
            eventId={activeCG.id}
          />
        ) : (
          <div
            className="cg-image"
            style={{
              background: `linear-gradient(135deg, ${activeCG.cgColor}44, ${activeCG.cgColor}88)`,
            }}
          >
            <div className="cg-placeholder">
              <div className="cg-placeholder-emoji" style={{ fontSize: '80px' }}>{eventEmoji}</div>
              <div className="cg-placeholder-text" style={{ fontSize: '16px', color: '#f5e6d3', marginTop: '16px' }}>
                {activeCG.id.replace(/_/g, ' ').toUpperCase()}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="cg-textbox">
        <div className="cg-speaker">{currentLine.speaker}</div>
        <div className="cg-text">{displayText}</div>
        <div className="cg-next">{t('event.clickNext')}</div>
      </div>
    </div>
  );
}
