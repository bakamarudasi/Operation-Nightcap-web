import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';

export function AfterEventOverlay() {
  const { t } = useTranslation();
  const activeAfterEvent = useGameStore((s) => s.activeAfterEvent);
  const afterEventDialogueIndex = useGameStore((s) => s.afterEventDialogueIndex);
  const advanceAfterEvent = useGameStore((s) => s.advanceAfterEvent);

  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typeIntervalRef = useRef<number | null>(null);

  const currentLine = activeAfterEvent?.dialogue[afterEventDialogueIndex];

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
    }, 40);

    return () => {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
      }
    };
  }, [currentLine]);

  if (!activeAfterEvent || !currentLine) return null;

  const handleClick = () => {
    if (isTyping) {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
        typeIntervalRef.current = null;
      }
      setDisplayText(currentLine.text);
      setIsTyping(false);
    } else {
      advanceAfterEvent();
    }
  };

  const isNarration = currentLine.speaker === '';

  return (
    <div className="after-event-overlay" onClick={handleClick}>
      <div className="after-event-scene">
        {/* ビジュアルエリア */}
        <div
          className="after-event-visual"
          style={{
            background: `linear-gradient(135deg, ${activeAfterEvent.cgColor}33, ${activeAfterEvent.cgColor}66)`,
          }}
        >
          <div className="after-event-emoji">{activeAfterEvent.emoji}</div>
          <div className="after-event-title-bar">
            <div className="after-event-title">{activeAfterEvent.title}</div>
          </div>
          {afterEventDialogueIndex === 0 && (
            <div className="after-event-new">NEW</div>
          )}
        </div>

        {/* テキストボックス */}
        <div className="after-event-textbox">
          {!isNarration && (
            <div className="after-event-speaker">{currentLine.speaker}</div>
          )}
          <div
            className="after-event-text"
            style={isNarration ? { fontStyle: 'italic', color: '#c9a85c' } : undefined}
          >
            {displayText}
          </div>
        </div>

        <div className="after-event-hint">
          {afterEventDialogueIndex < activeAfterEvent.dialogue.length - 1
            ? t('event.clickNext')
            : t('event.clickClose')}
        </div>
      </div>
    </div>
  );
}
