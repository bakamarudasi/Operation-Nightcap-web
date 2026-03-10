import type { CardDef } from '../../data/types.ts';
import { CARD_TYPE_LABELS } from './cardTypeLabels.ts';

interface CardPreviewProps {
  card: CardDef;
  pos: { x: number; y: number };
}

/** バフIDの日本語表示 */
const BUFF_LABELS: Record<string, string> = {
  stun: 'スタン',
  atk_down: '攻撃力ダウン',
  dot: '継続ダメージ',
  no_food: 'つまみ封印',
  corrupted_hand: '手札汚染',
  tipsy: 'ほろ酔い',
  blush: '赤面',
  alone: '孤立',
  karaoke: 'カラオケ',
  dimlight: '薄暗い照明',
  excuse: '言い訳',
  drink_dmg_half: '被ドリンク半減',
  next_drink_boost: '次ドリンク強化',
  next_food_boost: '次フード強化',
  negate_next: '効果無効化',
  stealth: '隠密',
  self_atk_up: '攻撃力アップ',
  all_dmg_up: '全ダメージ増加',
};

export function CardPreview({ card, pos }: CardPreviewProps) {
  return (
    <div
      className="card-preview-popup"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="card-preview-header">
        <span className="card-preview-emoji">{card.emoji}</span>
        <span className="card-preview-name">{card.name}</span>
        <span className="card-preview-rarity">{'★'.repeat(card.rarity)}</span>
      </div>
      <div className="card-preview-type">{CARD_TYPE_LABELS[card.type]}</div>
      <div className="card-preview-stats">
        {card.damage !== undefined && <span>攻撃: {card.damage === -1 ? '1~3' : card.damage}</span>}
        {card.heal !== undefined && <span>回復: {card.heal === 99 ? 'MAX' : card.heal}</span>}
        {card.requiredDrunkLevel !== undefined && <span>必要酔度: Lv{card.requiredDrunkLevel}</span>}
        {card.drunkDamage !== undefined && <span>酔い+{card.drunkDamage}</span>}
        {card.selfDamage !== undefined && <span>自傷: {card.selfDamage}</span>}
        {card.enemyDamage !== undefined && <span>敵ダメージ: {card.enemyDamage}</span>}
        {card.sanityDamage !== undefined && <span>理性ダメージ: {card.sanityDamage}</span>}
        {card.duration !== undefined && <span>持続: {card.duration}T</span>}
      </div>

      {/* バフ/デバフ情報 */}
      {card.applyBuffs && card.applyBuffs.length > 0 && (
        <div className="card-preview-buffs">
          <span className="buff-label">付与:</span>
          {card.applyBuffs.map((b, i) => (
            <span key={i} className="buff-tag debuff">{BUFF_LABELS[b.id] ?? b.id}{b.duration > 0 ? ` ${b.duration}T` : ''}</span>
          ))}
        </div>
      )}
      {card.applySelfBuffs && card.applySelfBuffs.length > 0 && (
        <div className="card-preview-buffs">
          <span className="buff-label">自己:</span>
          {card.applySelfBuffs.map((b, i) => (
            <span key={i} className="buff-tag self-buff">{BUFF_LABELS[b.id] ?? b.id}{b.duration > 0 ? ` ${b.duration}T` : ''}</span>
          ))}
        </div>
      )}
      {card.applyBothBuffs && card.applyBothBuffs.length > 0 && (
        <div className="card-preview-buffs">
          <span className="buff-label">環境:</span>
          {card.applyBothBuffs.map((b, i) => (
            <span key={i} className="buff-tag env-buff">{BUFF_LABELS[b.id] ?? b.id}{b.duration > 0 ? ` ${b.duration}T` : ''}</span>
          ))}
        </div>
      )}
      {card.corruptHand !== undefined && (
        <div className="card-preview-buffs">
          <span className="buff-tag debuff">手札汚染 ×{card.corruptHand}</span>
        </div>
      )}

      <div className="card-preview-desc">{card.description}</div>
    </div>
  );
}
