import { useTranslation } from 'react-i18next';
import type { CardDef } from '../../data/types.ts';
import { CARD_TYPE_LABELS } from './cardTypeLabels.ts';

interface CardPreviewProps {
  card: CardDef;
  pos: { x: number; y: number };
}


export function CardPreview({ card, pos }: CardPreviewProps) {
  const { t } = useTranslation();
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
      <div className="card-preview-type">{t(CARD_TYPE_LABELS[card.type])}</div>
      <div className="card-preview-stats">
        {card.damage !== undefined && <span>{t('cardPreview.attack', { value: card.damage === -1 ? '1~3' : card.damage })}</span>}
        {card.heal !== undefined && <span>{t('cardPreview.heal', { value: card.heal === 99 ? t('cardPreview.max') : card.heal })}</span>}
        {card.requiredDrunkLevel !== undefined && <span>{t('cardPreview.requiredDrunk', { level: card.requiredDrunkLevel })}</span>}
        {card.drunkDamage !== undefined && <span>{t('cardPreview.drunkDamage', { value: card.drunkDamage })}</span>}
        {card.selfDamage !== undefined && <span>{t('cardPreview.selfDamage', { value: card.selfDamage })}</span>}
        {card.enemyDamage !== undefined && <span>{t('cardPreview.enemyDamage', { value: card.enemyDamage })}</span>}
        {card.sanityDamage !== undefined && <span>{t('cardPreview.sanityDamage', { value: card.sanityDamage })}</span>}
        {card.duration !== undefined && <span>{t('cardPreview.duration', { value: card.duration })}</span>}
      </div>

      {/* バフ/デバフ情報 */}
      {card.applyBuffs && card.applyBuffs.length > 0 && (
        <div className="card-preview-buffs">
          <span className="buff-label">{t('cardPreview.buffApply')}</span>
          {card.applyBuffs.map((b, i) => (
            <span key={i} className="buff-tag debuff">{t(`previewBuff.${b.id}`, b.id)}{b.duration > 0 ? ` ${b.duration}T` : ''}</span>
          ))}
        </div>
      )}
      {card.applySelfBuffs && card.applySelfBuffs.length > 0 && (
        <div className="card-preview-buffs">
          <span className="buff-label">{t('cardPreview.buffSelf')}</span>
          {card.applySelfBuffs.map((b, i) => (
            <span key={i} className="buff-tag self-buff">{t(`previewBuff.${b.id}`, b.id)}{b.duration > 0 ? ` ${b.duration}T` : ''}</span>
          ))}
        </div>
      )}
      {card.applyBothBuffs && card.applyBothBuffs.length > 0 && (
        <div className="card-preview-buffs">
          <span className="buff-label">{t('cardPreview.buffEnv')}</span>
          {card.applyBothBuffs.map((b, i) => (
            <span key={i} className="buff-tag env-buff">{t(`previewBuff.${b.id}`, b.id)}{b.duration > 0 ? ` ${b.duration}T` : ''}</span>
          ))}
        </div>
      )}
      {card.corruptHand !== undefined && (
        <div className="card-preview-buffs">
          <span className="buff-tag debuff">{t('cardPreview.handCorrupt', { count: card.corruptHand })}</span>
        </div>
      )}

      <div className="card-preview-desc">{card.description}</div>
    </div>
  );
}
