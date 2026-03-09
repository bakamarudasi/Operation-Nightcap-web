import { useGameStore } from '../store/gameStore.ts';
import { useTypewriterEffect } from '../hooks/useTypewriterEffect.ts';

export function AfterEventOverlay() {
  const activeAfterEvent = useGameStore((s) => s.activeAfterEvent);
  const afterEventDialogueIndex = useGameStore((s) => s.afterEventDialogueIndex);
  const advanceAfterEvent = useGameStore((s) => s.advanceAfterEvent);

  const currentLine = activeAfterEvent?.dialogue[afterEventDialogueIndex];
  const { displayText, isTyping, skipToEnd } = useTypewriterEffect(currentLine?.text ?? '', 40);

  if (!activeAfterEvent || !currentLine) return null;

  const handleClick = () => {
    if (isTyping) {
      skipToEnd();
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
            ? '▶ クリックで次へ'
            : '▶ クリックで閉じる'}
        </div>
      </div>
    </div>
  );
}
