import { RARITY_CONFIG } from './gachaConstants.ts';

interface Props {
  getCard: (id: string) => { name: string; emoji: string; rarity: number; description: string };
}

export function FeaturedCard({ getCard }: Props) {
  const featuredCards = ['kiss', 'ear_bite', 'breast_touch', 'baijiu', 'ukon'];
  const fc = featuredCards[Math.floor(Date.now() / 60000) % featuredCards.length];
  const card = getCard(fc);
  const cfg = RARITY_CONFIG[card.rarity];

  return (
    <div className="featured-slide" style={{
      background: 'rgba(12,6,0,.7)',
      border: '1px solid rgba(100,55,15,.35)',
      borderRadius: 10, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(90deg,transparent,rgba(200,120,20,.04),transparent)',
      }} />
      <div style={{
        fontSize: 8, color: '#7a5020', letterSpacing: 2,
        position: 'absolute', top: 3, left: 10, fontWeight: 600,
      }}>▸ 今宵のおすすめ</div>
      <div style={{
        fontSize: 30, flexShrink: 0, marginTop: 6, position: 'relative',
        animation: 'gentlePulse 3s ease-in-out infinite',
      }}>
        {card.emoji}
        <div style={{
          position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
          width: 20, height: 3, borderRadius: 2, background: cfg.glow, filter: 'blur(2px)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: cfg.text }}>{card.name}</span>
          <span style={{
            fontSize: 8, padding: '1px 5px', borderRadius: 3,
            background: 'rgba(0,0,0,.5)', border: `1px solid ${cfg.border}`,
            color: cfg.menuColor, fontWeight: 700,
          }}>{cfg.label}</span>
        </div>
        <div style={{
          fontSize: 10, color: '#7a5a35', lineHeight: 1.6,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{card.description}</div>
      </div>
    </div>
  );
}
