import { forwardRef } from 'react';

interface TableCard {
  id: string;
  emoji: string;
  name: string;
  val: string;
}

interface Props {
  tableCards: { player: TableCard | null; opponent: TableCard | null };
  playerFlipped: boolean;
  oppFlipped: boolean;
  slamPlayer: boolean;
  slamOpp: boolean;
  fieldShaking: boolean;
  roundPopup: { text: string; cls: string } | null;
}

/** バトル中央のフィールド（カード対戦領域） */
export const BattleField = forwardRef<HTMLDivElement, Props>(
  function BattleField(
    { tableCards, playerFlipped, oppFlipped, slamPlayer, slamOpp, fieldShaking, roundPopup },
    fieldRef
  ) {
    return (
      <div className="battle-field">
        <div className={`field-table ${fieldShaking ? 'field-shaking' : ''}`} ref={fieldRef}>
          <div className="card-slots">
            {/* 相手カード */}
            <div className={`card-slot ${slamOpp ? 'card-slam' : ''}`}>
              <div className={`card-3d ${oppFlipped ? 'flipped' : ''}`}>
                <div className="card-3d-face card-3d-back">
                  <div className="card-back-pattern wave" />
                  <div className="card-back-frame" />
                  <div className="card-back-q">？</div>
                </div>
                <div className="card-3d-face card-3d-front">
                  <div className="card-front-content">
                    <div className="card-front-icon">{tableCards.opponent?.emoji ?? ''}</div>
                    <div className="card-front-name">{tableCards.opponent?.name ?? ''}</div>
                    <div className="card-front-val">{tableCards.opponent?.val ?? ''}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="vs-badge">VS</div>

            {/* プレイヤーカード（自分のカードなので即表面表示） */}
            <div className={`card-slot ${slamPlayer ? 'card-slam' : ''}`}>
              <div className={`card-3d ${playerFlipped ? 'instant-flip' : ''}`}>
                <div className="card-3d-face card-3d-back">
                  <div className="card-back-pattern check" />
                  <div className="card-back-frame" />
                  <div className="card-back-q">？</div>
                </div>
                <div className="card-3d-face card-3d-front">
                  <div className="card-front-content">
                    <div className="card-front-icon">{tableCards.player?.emoji ?? ''}</div>
                    <div className="card-front-name">{tableCards.player?.name ?? ''}</div>
                    <div className="card-front-val">{tableCards.player?.val ?? ''}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {roundPopup && (
            <div className={`card-result-popup show ${roundPopup.cls}`}>{roundPopup.text}</div>
          )}
        </div>
      </div>
    );
  }
);
