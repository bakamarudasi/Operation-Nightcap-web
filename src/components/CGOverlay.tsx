import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { CGSequencePlayer } from './CGSequencePlayer.tsx';
import { useTypewriterEffect } from '../hooks/useTypewriterEffect.ts';

export function CGOverlay() {
  const { t } = useTranslation();
  const activeCG = useGameStore((s) => s.activeCG);
  const cgDialogueIndex = useGameStore((s) => s.cgDialogueIndex);
  const advanceCG = useGameStore((s) => s.advanceCG);
  const closeCG = useGameStore((s) => s.closeCG);

  const currentLine = activeCG?.dialogue[cgDialogueIndex];
  const { displayText, isTyping, skipToEnd } = useTypewriterEffect(currentLine?.text, 30);

  if (!activeCG || !currentLine) return null;

  const handleClick = () => {
    if (isTyping) {
      skipToEnd();
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
