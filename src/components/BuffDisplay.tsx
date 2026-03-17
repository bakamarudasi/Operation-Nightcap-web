import { useTranslation } from 'react-i18next';
import type { Buff } from '../data/types.ts';
import { BUFF_META } from '../engine/utils.ts';

interface BuffDisplayProps {
  buffs: Buff[];
  keyPrefix: string;
  className?: string;
}

export function BuffDisplay({ buffs, keyPrefix, className }: BuffDisplayProps) {
  const { t } = useTranslation();
  if (buffs.length === 0) return null;
  return (
    <div className={`buff-icons ${className ?? ''}`}>
      {buffs.map((buff, i) => {
        const info = BUFF_META[buff.id];
        return (
          <div
            key={`${keyPrefix}-${buff.id}-${i}`}
            className={`buff-chip ${info.positive ? 'buff-positive' : 'buff-negative'}`}
            title={`${t(info.labelKey)}${buff.duration > 0 ? ` (${buff.duration}T)` : ''}`}
          >
            <span className="buff-chip-icon">{info.icon}</span>
            {buff.duration > 0 && <span className="buff-chip-dur">{buff.duration}</span>}
          </div>
        );
      })}
    </div>
  );
}
