import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { CARD_DATA } from '../data/cards.ts';
import { GACHA_SINGLE_COST, GACHA_MULTI_COST, DUPLICATE_REFUND } from '../data/gacha.ts';
import type { GachaResult } from '../data/types.ts';

// ─── 効果音ユーティリティ (AudioContext 再利用) ───
let gachaCtx: AudioContext | null = null;
function getGachaCtx() {
  if (!gachaCtx || gachaCtx.state === 'closed') {
    gachaCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (gachaCtx.state === 'suspended') gachaCtx.resume();
  return gachaCtx;
}

/** 注ぎ音: ノイズ + 低音の持続音 */
function playPourSound() {
  try {
    const ctx = getGachaCtx();
    const t = ctx.currentTime;
    // ノイズ (液体感)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const ns = ctx.createBufferSource();
    ns.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.08, t + 0.2);
    ng.gain.setValueAtTime(0.08, t + 0.8);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    ns.connect(bp).connect(ng).connect(ctx.destination);
    ns.start(t); ns.stop(t + 1.2);
    // 低いうなり (とくとく感)
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 80;
    o.frequency.setValueAtTime(80, t);
    o.frequency.linearRampToValueAtTime(120, t + 0.5);
    o.frequency.linearRampToValueAtTime(80, t + 1.0);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.04, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(og).connect(ctx.destination);
    o.start(t); o.stop(t + 1.2);
  } catch { /* audio not supported */ }
}

/** グロー音: レアリティに応じた上昇音 */
function playGlowSound(rarity: number) {
  try {
    const ctx = getGachaCtx();
    const t = ctx.currentTime;
    if (rarity >= 5) {
      // 高レア: 和音で上昇するファンファーレ
      const freqs = rarity >= 6 ? [400, 600, 800, 1000] : [350, 525, 700];
      freqs.forEach((freq, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq * 0.7, t + i * 0.12);
        o.frequency.exponentialRampToValueAtTime(freq, t + i * 0.12 + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + i * 0.12);
        g.gain.linearRampToValueAtTime(rarity >= 6 ? 0.1 : 0.07, t + i * 0.12 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.8);
        o.connect(g).connect(ctx.destination);
        o.start(t + i * 0.12);
        o.stop(t + i * 0.12 + 0.8);
      });
    } else {
      // 低レア: 短い確認音
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 300 + rarity * 60;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.4);
    }
  } catch { /* audio not supported */ }
}

/** カード出現音: レアリティで音が変わる */
function playRevealSound(rarity: number) {
  try {
    const ctx = getGachaCtx();
    const t = ctx.currentTime;
    if (rarity >= 6) {
      // ★6: 衝撃音 + 高音チャイム
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const ns = ctx.createBufferSource(); ns.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.25, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      ns.connect(ng).connect(ctx.destination);
      ns.start(t);
      [1000, 1500, 2000].forEach((freq, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, t + 0.05 + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + i * 0.06 + 0.6);
        o.connect(g).connect(ctx.destination);
        o.start(t + 0.05 + i * 0.06);
        o.stop(t + 0.05 + i * 0.06 + 0.6);
      });
    } else if (rarity >= 4) {
      // ★4-5: キラッと光る音
      const o = ctx.createOscillator();
      o.type = 'sine';
      const baseFreq = rarity >= 5 ? 1200 : 800;
      o.frequency.setValueAtTime(baseFreq * 0.6, t);
      o.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(rarity >= 5 ? 0.08 : 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.3);
    } else {
      // ★1-3: 軽い「ポン」
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(500 + rarity * 80, t);
      o.frequency.exponentialRampToValueAtTime(200, t + 0.1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.12);
    }
  } catch { /* audio not supported */ }
}

/** 結果表示音: 全カード揃った時の締め音 */
function playResultSound(highestRarity: number) {
  try {
    const ctx = getGachaCtx();
    const t = ctx.currentTime;
    if (highestRarity >= 5) {
      // 高レア入り: 祝福チャイム
      const chords = highestRarity >= 6
        ? [[523, 659, 784], [659, 784, 1047]] // C5-E5-G5 → E5-G5-C6
        : [[440, 554, 659]]; // A4-C#5-E5
      chords.forEach((freqs, ci) => {
        freqs.forEach((freq, fi) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
          const g = ctx.createGain();
          const start = t + ci * 0.25 + fi * 0.03;
          g.gain.setValueAtTime(0.07, start);
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
          o.connect(g).connect(ctx.destination);
          o.start(start); o.stop(start + 0.8);
        });
      });
    } else {
      // 通常: 短い完了音
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = 600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.25);
    }
  } catch { /* audio not supported */ }
}

// ─── UI定数 ───
const RC: Record<number, { label: string; border: string; text: string; glow: string; bg: string; menuColor: string; particle: string }> = {
  1: { label:'並',   border:'#6b4e2a', text:'#c4a06a', glow:'rgba(180,130,60,0.4)',  bg:'linear-gradient(160deg,#3a2e1e,#2a2015)', menuColor:'#8a6a3a', particle:'#c4a06a' },
  2: { label:'上',   border:'#3a6a3a', text:'#7abf7a', glow:'rgba(80,160,80,0.4)',   bg:'linear-gradient(160deg,#1e2e1e,#151f15)', menuColor:'#5a9a5a', particle:'#7abf7a' },
  3: { label:'特上', border:'#3a5aaa', text:'#7a9aee', glow:'rgba(80,120,220,0.45)', bg:'linear-gradient(160deg,#1a1e30,#12152a)', menuColor:'#5a7acc', particle:'#7a9aee' },
  4: { label:'極',   border:'#8844bb', text:'#cc88ff', glow:'rgba(160,60,240,0.5)',  bg:'linear-gradient(160deg,#2a1a35,#1e1228)', menuColor:'#aa66dd', particle:'#cc88ff' },
  5: { label:'秘蔵', border:'#cc8800', text:'#ffcc44', glow:'rgba(220,160,0,0.55)',  bg:'linear-gradient(160deg,#352510,#281a08)', menuColor:'#ffaa00', particle:'#ffd700' },
  6: { label:'幻',   border:'#cc2244', text:'#ff6688', glow:'rgba(220,30,60,0.6)',   bg:'linear-gradient(160deg,#350a0a,#220606)', menuColor:'#ff3355', particle:'#ff4466' },
};

// ─── パーティクルシステム ───
function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const particles = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; decay: number; size: number; color: string;
    type: 'spark' | 'dot';
  }>>([]);
  const animId = useRef<number | null>(null);

  const emit = useCallback((x: number, y: number, color: string, count = 20, spread = 120) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.8;
      const speed = 1.5 + Math.random() * spread / 30;
      particles.current.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        life: 1, decay: 0.012 + Math.random() * 0.015,
        size: 2 + Math.random() * 4, color,
        type: Math.random() > 0.6 ? 'spark' : 'dot',
      });
    }
  }, []);

  const burstCenter = useCallback((color: string, count = 50) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    emit(canvas.width / 2, canvas.height / 2, color, count, 200);
  }, [canvasRef, emit]);

  const rain = useCallback((color: string, count = 30) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: Math.random() * canvas.width,
        y: -10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 2 + Math.random() * 3,
        life: 1, decay: 0.008 + Math.random() * 0.008,
        size: 1.5 + Math.random() * 3, color,
        type: 'spark',
      });
    }
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; };
    resize();
    window.addEventListener('resize', resize);
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter(p => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
        ctx.globalAlpha = p.life * 0.9;
        if (p.type === 'spark') {
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.6;
          ctx.beginPath(); ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); ctx.stroke();
        } else {
          ctx.fillStyle = p.color; ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      animId.current = requestAnimationFrame(loop);
    };
    animId.current = requestAnimationFrame(loop);
    return () => { if (animId.current) cancelAnimationFrame(animId.current); window.removeEventListener('resize', resize); };
  }, [canvasRef]);

  return { emit, burstCenter, rain };
}

// ─── メインコンポーネント ───
export default function GachaScreen() {
  const money = useGameStore(s => s.money);
  const inventory = useGameStore(s => s.inventory);
  const pullGacha = useGameStore(s => s.pullGacha);
  const setScreen = useGameStore(s => s.setScreen);

  // inventory string[] → count map
  const inventoryMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const id of inventory) { map[id] = (map[id] ?? 0) + 1; }
    return map;
  }, [inventory]);

  const [animPhase, setAnimPhase] = useState<'idle' | 'pour' | 'glow' | 'reveal' | 'result'>('idle');
  const [results, setResults] = useState<GachaResult[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [selected, setSelected] = useState<GachaResult | null>(null);
  const [refundTotal, setRefundTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState<1 | 10>(1);
  const [glowColor, setGlowColor] = useState('#ffaa44');
  const [liquidFill, setLiquidFill] = useState(0);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [pullCount, setPullCount] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fillRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { burstCenter, rain } = useParticles(canvasRef);

  const isIdle = animPhase === 'idle' || animPhase === 'result';

  const getCard = (id: string) => CARD_DATA[id] ?? { id, name: id, emoji: '❓', type: 'drink' as const, rarity: 1, price: 0, description: '???' };

  const clearAll = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (fillRef.current) clearInterval(fillRef.current);
  };

  const triggerShake = (intensity = 1) => {
    setShake(true);
    const t = setTimeout(() => setShake(false), 300 + intensity * 100);
    timers.current.push(t);
  };

  const triggerFlash = (color: string, duration = 200) => {
    setFlash(color);
    const t = setTimeout(() => setFlash(null), duration);
    timers.current.push(t);
  };

  const collectionStats = useMemo(() => {
    const total = Object.keys(CARD_DATA).length;
    const owned = Object.keys(inventoryMap).filter(k => CARD_DATA[k] && inventoryMap[k] > 0).length;
    return { total, owned };
  }, [inventoryMap]);

  const startGacha = useCallback((count: 1 | 10) => {
    const cost = count === 1 ? GACHA_SINGLE_COST : GACHA_MULTI_COST;
    if (money < cost || !isIdle) return;
    clearAll();
    setPendingCount(count);
    setSelected(null); setLiquidFill(0);
    setAnimPhase('pour');
    playPourSound();

    let fill = 0;
    fillRef.current = setInterval(() => {
      fill += 2;
      setLiquidFill(Math.min(fill, 100));
      if (fill >= 100 && fillRef.current) clearInterval(fillRef.current);
    }, 25);

    // 注ぎ演出後にストア経由でガチャ実行
    const t1 = setTimeout(() => {
      const res = pullGacha(count);
      if (!res) { setAnimPhase('idle'); return; }

      const refund = res.filter(r => r.isDuplicate).reduce((s, r) => s + r.refund, 0);
      const highest = Math.max(...res.map(r => r.rarity));
      const gc = highest >= 6 ? '#ff3355' : highest >= 5 ? '#ffcc44' : highest >= 4 ? '#cc88ff' : highest >= 3 ? '#7a9aee' : '#ffaa44';

      setResults(res); setRefundTotal(refund); setGlowColor(gc);
      setPullCount(p => p + count);
      setAnimPhase('glow');
      playGlowSound(highest);

      if (highest >= 5) {
        triggerShake(highest >= 6 ? 3 : 1);
        triggerFlash(gc, highest >= 6 ? 400 : 250);
      }

      const t2 = setTimeout(() => {
        setRevealedCount(0); setAnimPhase('reveal');
        const pc = RC[highest]?.particle || '#ffaa44';
        if (highest >= 5) burstCenter(pc, highest >= 6 ? 80 : 40);
        if (highest >= 4) rain(pc, highest >= 6 ? 50 : 20);

        res.forEach((r, i) => {
          const t = setTimeout(() => {
            setRevealedCount(i + 1);
            playRevealSound(r.rarity);
            if (r.rarity >= 4) triggerShake(r.rarity >= 6 ? 2 : 0.5);
          }, i * (count === 1 ? 100 : 130));
          timers.current.push(t);
        });

        const t3 = setTimeout(() => {
          setAnimPhase('result');
          playResultSound(highest);
        }, res.length * (count === 1 ? 100 : 130) + 600);
        timers.current.push(t3);
      }, 1100);
      timers.current.push(t2);
    }, 1500);
    timers.current.push(t1);
  }, [money, isIdle, pullGacha, burstCenter, rain]);

  useEffect(() => () => clearAll(), []);

  const highest = results.length > 0 ? Math.max(...results.map(r => r.rarity)) : 0;
  const menuRows = [
    { r: 6, emoji: '💋', items: '幻のカード', rate: '0.5%' },
    { r: 5, emoji: '💊', items: '秘蔵品カード', rate: '3.5%' },
    { r: 4, emoji: '🍶', items: '極レアカード', rate: '9.0%' },
    { r: 3, emoji: '🥃', items: '特上カード', rate: '17.0%' },
    { r: 2, emoji: '🍷', items: '上カード', rate: '25.0%' },
    { r: 1, emoji: '🍺', items: '並カード', rate: '45.0%' },
  ];

  // ── コレクション画面 ──
  if (showCollection) {
    const grouped: Record<number, Array<{ id: string; name: string; emoji: string; count: number }>> = {};
    for (const [id, card] of Object.entries(CARD_DATA)) {
      if (!grouped[card.rarity]) grouped[card.rarity] = [];
      grouped[card.rarity].push({ id, name: card.name, emoji: card.emoji, count: inventoryMap[id] ?? 0 });
    }
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: '#0e0805',
        fontFamily: "'Noto Serif JP','Hiragino Mincho ProN',serif",
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700;900&display=swap');
          @keyframes shimGold{0%{background-position:-200% center}100%{background-position:200% center}}
          .gold{background:linear-gradient(90deg,#aa6600,#ffdd55,#ffaa00,#ffee88,#aa6600);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimGold 3s linear infinite;}
        `}</style>
        <div style={{
          padding: '14px 16px', textAlign: 'center',
          background: 'linear-gradient(180deg,rgba(30,14,0,.97),rgba(20,9,0,.93))',
          borderBottom: '2px solid #4a2804', flexShrink: 0, position: 'relative',
        }}>
          <div className="gold" style={{ fontSize: 20, fontWeight: 900, letterSpacing: 4 }}>お品書き帳</div>
          <div style={{ fontSize: 10, color: '#6a4a22', marginTop: 2 }}>
            {collectionStats.owned} / {collectionStats.total} 品 収集済
          </div>
          <button onClick={() => setShowCollection(false)} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,.5)', border: '1px solid #3a1e08',
            borderRadius: 6, padding: '5px 12px', color: '#8a6030', fontSize: 11,
            cursor: 'pointer',
          }}>← 戻る</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>
          {[6, 5, 4, 3, 2, 1].map(r => {
            const cards = grouped[r] || [];
            if (!cards.length) return null;
            const cfg = RC[r];
            return (
              <div key={r} style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  padding: '6px 10px', background: 'rgba(0,0,0,.4)', borderRadius: 6,
                  borderLeft: `3px solid ${cfg.border}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: cfg.text }}>{cfg.label}</span>
                  <span style={{ fontSize: 10, color: cfg.menuColor }}>
                    {cards.filter(c => c.count > 0).length}/{cards.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(80px,1fr))', gap: 6 }}>
                  {cards.map(card => {
                    const owned = card.count > 0;
                    return (
                      <div key={card.id} style={{
                        background: owned ? cfg.bg : 'rgba(10,5,0,.6)',
                        border: `1px solid ${owned ? cfg.border : '#1a1008'}`,
                        borderRadius: 8, padding: '8px 4px', textAlign: 'center',
                        opacity: owned ? 1 : 0.35,
                        position: 'relative',
                      }}>
                        <div style={{ fontSize: 22, lineHeight: 1.2 }}>{owned ? card.emoji : '？'}</div>
                        <div style={{ fontSize: 8, color: owned ? cfg.text : '#333', fontWeight: 600, marginTop: 2, lineHeight: 1.2 }}>
                          {owned ? card.name : '？？？'}
                        </div>
                        {owned && card.count > 1 && (
                          <div style={{
                            position: 'absolute', top: 2, right: 2, fontSize: 7,
                            background: 'rgba(0,0,0,.6)', borderRadius: 3, padding: '1px 3px',
                            color: cfg.menuColor,
                          }}>×{card.count}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── メイン画面 ──
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      fontFamily: "'Noto Serif JP','Hiragino Mincho ProN','YuMincho',serif",
      background: '#0e0805',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transform: shake ? `translate(${(Math.random() - 0.5) * 8}px, ${(Math.random() - 0.5) * 6}px)` : 'none',
      transition: shake ? 'none' : 'transform 0.1s ease-out',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700;900&display=swap');
        @keyframes flicker{0%,100%{opacity:1}91%{opacity:1}92%{opacity:.75}93%{opacity:1}97%{opacity:.88}98%{opacity:1}}
        @keyframes sway{0%,100%{transform:rotate(-2.5deg) translateX(0)}50%{transform:rotate(2.5deg) translateX(1px)}}
        @keyframes shimGold{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes cardDrop{
          0%{transform:translateY(-40px) scale(0.85) rotate(-4deg);opacity:0}
          50%{transform:translateY(5px) scale(1.08) rotate(.5deg);opacity:1}
          100%{transform:translateY(0) scale(1) rotate(0);opacity:1}
        }
        @keyframes cardPopRare{
          0%{transform:scale(0.5) rotate(-5deg);opacity:0;filter:brightness(3)}
          40%{transform:scale(1.15) rotate(1deg);filter:brightness(1.6)}
          70%{transform:scale(0.97);filter:brightness(1.2)}
          100%{transform:scale(1) rotate(0);opacity:1;filter:brightness(1)}
        }
        @keyframes cardPopLegend{
          0%{transform:scale(0.3) rotate(-10deg);opacity:0;filter:brightness(5) saturate(2)}
          30%{transform:scale(1.25) rotate(2deg);filter:brightness(2) saturate(1.5)}
          50%{transform:scale(0.95) rotate(-1deg);filter:brightness(1.3)}
          70%{transform:scale(1.05);filter:brightness(1.1)}
          100%{transform:scale(1) rotate(0);opacity:1;filter:brightness(1)}
        }
        @keyframes glassGlow{
          0%{box-shadow:0 0 0px transparent;filter:brightness(1)}
          30%{box-shadow:0 0 50px var(--gc),0 0 100px var(--gc);filter:brightness(2.5)}
          60%{box-shadow:0 0 80px var(--gc),0 0 160px var(--gc);filter:brightness(3)}
          100%{box-shadow:0 0 24px var(--gc);filter:brightness(1.5)}
        }
        @keyframes pourDrop{
          0%{transform:translateY(-10px);opacity:0}
          35%{opacity:1}
          100%{transform:translateY(32px);opacity:0}
        }
        @keyframes menuFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulseGlow{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes resultIn{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
        @keyframes bgPulse{0%,100%{opacity:.15}50%{opacity:.4}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes bubbleUp{
          0%{transform:translateY(0) scale(1);opacity:.6}
          100%{transform:translateY(-40px) scale(.3);opacity:0}
        }
        @keyframes borderShine{
          0%{background-position:0% 0%}
          100%{background-position:200% 0%}
        }
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes smokeRise{
          0%{transform:translateY(0) scaleX(1);opacity:.08}
          50%{transform:translateY(-60px) scaleX(1.8);opacity:.04}
          100%{transform:translateY(-120px) scaleX(2.5);opacity:0}
        }
        @keyframes glassIdle{
          0%,100%{transform:rotate(-1deg) translateY(0)}
          25%{transform:rotate(0.5deg) translateY(-3px)}
          50%{transform:rotate(1deg) translateY(-1px)}
          75%{transform:rotate(-0.5deg) translateY(-4px)}
        }
        @keyframes gentlePulse{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes steamWisp{
          0%{transform:translateY(0) translateX(0) scale(1);opacity:.15}
          33%{transform:translateY(-15px) translateX(5px) scale(1.3);opacity:.1}
          66%{transform:translateY(-30px) translateX(-3px) scale(1.6);opacity:.05}
          100%{transform:translateY(-45px) translateX(2px) scale(2);opacity:0}
        }
        @keyframes neonFlicker{0%,18%,22%,25%,53%,57%,100%{opacity:1}20%{opacity:.4}24%{opacity:.6}55%{opacity:.5}}
        @keyframes bottleFloat{
          0%,100%{transform:translateY(0) rotate(-2deg)}
          50%{transform:translateY(-8px) rotate(2deg)}
        }
        @keyframes heroFadeIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes featuredSlide{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        .hero-fade{animation:heroFadeIn .6s ease both;}
        .featured-slide{animation:featuredSlide .5s ease both;}
        .bottle-float{animation:bottleFloat 4s ease-in-out infinite;}
        .gbtn{cursor:pointer;border:none;outline:none;transition:all .18s;-webkit-tap-highlight-color:transparent;}
        .gbtn:hover:not(:disabled){filter:brightness(1.2);transform:translateY(-2px);}
        .gbtn:active:not(:disabled){transform:translateY(1px) scale(.97);}
        .gbtn:disabled{opacity:.3;cursor:not-allowed;filter:grayscale(.5);}
        .gold{background:linear-gradient(90deg,#aa6600,#ffdd55,#ffaa00,#ffee88,#aa6600);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimGold 3s linear infinite;}
        .flick{animation:flicker 5s ease-in-out infinite;}
        .sway1{animation:sway 3.2s ease-in-out infinite;}
        .sway2{animation:sway 3.8s ease-in-out .7s infinite;}
        .menu-row{animation:menuFadeIn .4s ease both;}
        .card-drop{animation:cardDrop .4s cubic-bezier(.34,1.4,.64,1) forwards;}
        .card-rare{animation:cardPopRare .5s cubic-bezier(.34,1.56,.64,1) forwards;}
        .card-legend{animation:cardPopLegend .7s cubic-bezier(.22,1,.36,1) forwards;}
        .result-in{animation:resultIn .4s ease forwards;}
        .slide-up{animation:slideUp .4s ease both;}
        .card-hover{transition:transform .15s,box-shadow .15s,border-color .15s;}
        .card-hover:hover{transform:translateY(-3px) scale(1.04)!important;}
      `}</style>

      {/* パーティクルキャンバス */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none',
        width: '100%', height: '100%',
      }} />

      {/* フラッシュ */}
      {flash && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none',
          background: `radial-gradient(ellipse at center,${flash}44,${flash}11,transparent 70%)`,
          animation: 'resultIn .15s ease',
        }} />
      )}

      {/* 背景木目テクスチャ */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', background: `
        repeating-linear-gradient(173deg,transparent,transparent 60px,rgba(110,60,8,.04) 60px,rgba(110,60,8,.04) 61px),
        repeating-linear-gradient(7deg,transparent,transparent 80px,rgba(80,35,4,.03) 80px,rgba(80,35,4,.03) 81px),
        radial-gradient(ellipse at 50% -10%,rgba(255,130,20,.07) 0%,transparent 55%),
        radial-gradient(ellipse at 20% 100%,rgba(60,20,0,.45) 0%,transparent 50%),
        radial-gradient(ellipse at 80% 100%,rgba(60,20,0,.45) 0%,transparent 50%)
      `}} />

      {/* のれん紐 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 5,
        background: 'repeating-linear-gradient(90deg,#991500,#991500 2px,transparent 2px,transparent 18px)',
        opacity: .8, zIndex: 3,
      }} />

      {/* 提灯 */}
      {['6%', '87%'].map((left, i) => (
        <div key={i} className={i === 0 ? 'sway1' : 'sway2'} style={{
          position: 'absolute', top: -2, left, fontSize: 34, zIndex: 3,
          filter: 'drop-shadow(0 4px 14px rgba(255,70,0,.6))', lineHeight: 1,
        }}>🏮</div>
      ))}

      {/* ── ヘッダー ── */}
      <div style={{
        padding: '13px 60px 11px', textAlign: 'center',
        background: 'linear-gradient(180deg,rgba(30,14,0,.97),rgba(20,9,0,.93))',
        borderBottom: '2px solid #4a2804',
        boxShadow: '0 4px 24px rgba(0,0,0,.8)',
        flexShrink: 0, position: 'relative', zIndex: 2,
      }}>
        <div style={{ fontSize: 8, letterSpacing: 6, color: '#5a3a18', marginBottom: 2 }}>
          ─── ロドス島 龍門出張所 ───
        </div>
        <div className="gold" style={{ fontSize: 24, fontWeight: 900, letterSpacing: 6 }}>
          お品書きガチャ
        </div>
        <div style={{ fontSize: 8, color: '#3a2510', letterSpacing: 3, marginTop: 2 }} className="flick">
          〜 飲んで引いて　酔いしれろ 〜
        </div>
        {/* 龍門幣 */}
        <div style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(0,0,0,.65)', border: '1px solid #4a2804',
          borderRadius: 8, padding: '5px 11px',
          display: 'flex', alignItems: 'center', gap: 6,
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{ fontSize: 14 }}>🪙</span>
          <div>
            <div style={{ fontSize: 7, color: '#5a3a18', letterSpacing: 1 }}>龍門幣</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ffcc44', fontVariantNumeric: 'tabular-nums' }}>
              {money.toLocaleString()}
            </div>
          </div>
        </div>
        <button className="gbtn" onClick={() => setScreen('select')} style={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(0,0,0,.45)', border: '1px solid #2a1508',
          borderRadius: 6, padding: '5px 10px', color: '#4a3015', fontSize: 11,
        }}>← 戻る</button>
      </div>

      {/* ── スクロールエリア ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 12px 20px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>

        {/* ======== IDLE: メニュー表 ======== */}
        {animPhase === 'idle' && (
          <>
            {/* アンビエント煙 */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  position: 'absolute',
                  bottom: `${10 + i * 18}%`, left: `${10 + i * 20}%`,
                  width: 60 + i * 15, height: 60 + i * 15,
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse,rgba(255,180,80,.08),transparent 70%)',
                  animation: `smokeRise ${6 + i * 2}s ease-in-out infinite`,
                  animationDelay: `${i * 1.3}s`,
                }} />
              ))}
            </div>

            {/* ヒーロービジュアル */}
            <div className="hero-fade" style={{
              position: 'relative',
              background: 'radial-gradient(ellipse at 50% 80%,rgba(180,80,0,.12),transparent 60%),rgba(12,6,0,.5)',
              border: '1px solid rgba(90,50,15,.3)',
              borderRadius: 14,
              padding: '20px 16px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at 50% 90%,rgba(255,140,30,.08),transparent 50%)',
              }} />
              <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 14,
                marginBottom: 12, position: 'relative',
              }}>
                <div className="bottle-float" style={{ fontSize: 32, animationDelay: '0.5s', opacity: 0.7, marginBottom: 4 }}>🍶</div>
                <div style={{ position: 'relative', animation: 'glassIdle 6s ease-in-out infinite' }}>
                  <div style={{ fontSize: 56, lineHeight: 1, filter: 'drop-shadow(0 4px 20px rgba(255,140,30,.4))' }}>🍺</div>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      position: 'absolute', top: -8 - i * 4, left: `${30 + i * 12}%`,
                      width: 6, height: 12, borderRadius: 4,
                      background: 'rgba(255,220,160,.12)',
                      animation: `steamWisp ${2 + i * 0.5}s ease-in-out infinite`,
                      animationDelay: `${i * 0.7}s`,
                    }} />
                  ))}
                </div>
                <div className="bottle-float" style={{ fontSize: 32, animationDelay: '1.2s', opacity: 0.7, marginBottom: 4 }}>🍶</div>
              </div>
              <div style={{
                fontSize: 11, color: '#aa8050', letterSpacing: 6, fontWeight: 600,
                textShadow: '0 0 12px rgba(200,120,20,.3)', marginBottom: 4,
              }}>今宵も一杯、いかがですか</div>
              {/* コレクション進捗バー */}
              <div style={{ width: '100%', maxWidth: 260, marginTop: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: '#6a4a28', letterSpacing: 1 }}>収集進捗</span>
                  <span style={{ fontSize: 11, color: '#aa8855', fontWeight: 700 }}>
                    {collectionStats.owned}<span style={{ color: '#5a3a18', fontWeight: 400 }}>/{collectionStats.total}</span>
                  </span>
                </div>
                <div style={{
                  height: 6, borderRadius: 3,
                  background: 'rgba(0,0,0,.4)', border: '1px solid rgba(90,50,15,.25)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    background: 'linear-gradient(90deg,#6a3a10,#cc8800,#ffaa00)',
                    width: `${(collectionStats.owned / collectionStats.total) * 100}%`,
                    boxShadow: '0 0 8px rgba(200,130,0,.4)', transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </div>

            {/* 今宵のおすすめ */}
            <FeaturedCard getCard={getCard} />

            {/* 大メニューボード */}
            <div style={{
              background: 'rgba(18,9,2,.92)', border: '2px solid #5a3010',
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 8px 36px rgba(0,0,0,.7), inset 0 0 50px rgba(0,0,0,.5)',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.06,
                background: 'repeating-linear-gradient(180deg,transparent,transparent 12px,rgba(200,140,60,.3) 12px,rgba(200,140,60,.3) 13px)',
              }} />
              <div style={{
                background: 'linear-gradient(90deg,rgba(60,25,3,.9),rgba(120,55,5,.98),rgba(60,25,3,.9))',
                borderBottom: '1px solid #6a3a10',
                padding: '12px 16px', textAlign: 'center', position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 16, opacity: 0.5, animation: 'gentlePulse 4s ease-in-out infinite',
                }}>🏮</div>
                <div style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 16, opacity: 0.5, animation: 'gentlePulse 4s ease-in-out 1s infinite',
                }}>🏮</div>
                <div style={{
                  fontSize: 14, color: '#ffcc88', letterSpacing: 6, fontWeight: 700,
                  textShadow: '0 0 16px rgba(255,180,60,.25)',
                }}>本日のお品書き</div>
                <div style={{
                  fontSize: 8, color: '#7a5530', marginTop: 4, letterSpacing: 2,
                  display: 'flex', justifyContent: 'center', gap: 12,
                }}>
                  <span>天井なし</span><span style={{ color: '#4a3018' }}>│</span>
                  <span>同一3枚上限</span><span style={{ color: '#4a3018' }}>│</span>
                  <span>超過は龍門幣変換</span>
                </div>
              </div>
              {menuRows.map((row, idx) => {
                const cfg = RC[row.r];
                const isHighRare = row.r >= 5;
                return (
                  <div key={row.r} className="menu-row" style={{
                    animationDelay: `${idx * 0.08}s`,
                    display: 'flex', alignItems: 'center',
                    padding: isHighRare ? '13px 16px' : '11px 16px',
                    borderBottom: idx < menuRows.length - 1 ? '1px solid rgba(90,50,15,.3)' : 'none',
                    background: isHighRare
                      ? `linear-gradient(90deg,transparent,${cfg.glow.replace(')', ',0.06)')},transparent)`
                      : idx % 2 === 0 ? 'rgba(255,255,255,.015)' : 'transparent',
                    gap: 10, position: 'relative',
                  }}>
                    {isHighRare && (
                      <div style={{
                        position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
                        background: `linear-gradient(180deg,transparent,${cfg.border},transparent)`, borderRadius: 2,
                      }} />
                    )}
                    <div style={{
                      fontSize: isHighRare ? 24 : 22, width: 32, textAlign: 'center', flexShrink: 0,
                      filter: isHighRare ? `drop-shadow(0 0 6px ${cfg.glow})` : 'none',
                    }}>{row.emoji}</div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: cfg.text,
                      minWidth: 40, textAlign: 'center',
                      padding: '3px 8px', borderRadius: 5,
                      background: 'rgba(0,0,0,.5)', border: `1px solid ${cfg.border}`, flexShrink: 0,
                      boxShadow: isHighRare ? `0 0 8px ${cfg.glow}` : 'none',
                    }}>{cfg.label}</div>
                    <div style={{
                      flex: 1, borderBottom: `1px dashed rgba(${row.r >= 5 ? '200,150,0' : '80,60,20'},.25)`, margin: '0 6px',
                    }} />
                    <div style={{
                      fontSize: 11, color: isHighRare ? cfg.menuColor : '#aa8866', flexShrink: 0,
                      fontWeight: isHighRare ? 600 : 400,
                    }}>{row.items}</div>
                    <div style={{
                      fontSize: isHighRare ? 15 : 14, fontWeight: 700, color: cfg.menuColor,
                      minWidth: 48, textAlign: 'right', flexShrink: 0,
                      textShadow: isHighRare ? `0 0 10px ${cfg.glow}` : 'none',
                    }}>{row.rate}</div>
                  </div>
                );
              })}
            </div>

            {/* コレクション＆統計バー */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <button className="gbtn" onClick={() => setShowCollection(true)} style={{
                flex: 1, background: 'rgba(18,9,2,.85)',
                border: '1px solid rgba(90,50,15,.35)', borderRadius: 8, padding: '10px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: '#8a6a3a', boxShadow: 'inset 0 0 20px rgba(0,0,0,.3)',
              }}>
                <span style={{ fontSize: 16 }}>📖</span>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>お品書き帳</span>
                <span style={{
                  fontSize: 10, color: '#ffaa44', fontWeight: 700,
                  background: 'rgba(200,120,0,.12)', padding: '2px 6px', borderRadius: 4,
                }}>{collectionStats.owned}/{collectionStats.total}</span>
              </button>
              {pullCount > 0 && (
                <div style={{
                  background: 'rgba(18,9,2,.85)', border: '1px solid rgba(90,50,15,.3)',
                  borderRadius: 8, padding: '8px 14px', fontSize: 9, color: '#5a3a18',
                  textAlign: 'center', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,.3)',
                }}>
                  <span>累計</span>
                  <span style={{ color: '#aa8855', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{pullCount}<span style={{ fontSize: 9, fontWeight: 400 }}>回</span></span>
                </div>
              )}
            </div>

            {/* ガチャボタン */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="gbtn" disabled={money < GACHA_SINGLE_COST} onClick={() => startGacha(1)} style={{
                flex: 1, position: 'relative',
                background: money >= GACHA_SINGLE_COST
                  ? 'linear-gradient(170deg,#4a2810 0%,#2a1508 50%,#3a2010 100%)' : 'rgba(20,10,0,.4)',
                border: `1px solid ${money >= GACHA_SINGLE_COST ? '#7a4a18' : '#2a1508'}`,
                borderRadius: 12, padding: '18px 10px', color: '#fff',
                boxShadow: money >= GACHA_SINGLE_COST
                  ? '0 6px 24px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,160,50,.15),inset 0 -1px 0 rgba(0,0,0,.3)' : 'none',
                overflow: 'hidden',
              }}>
                {money >= GACHA_SINGLE_COST && <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                  background: 'linear-gradient(180deg,rgba(255,180,80,.06),transparent)',
                  pointerEvents: 'none', borderRadius: '12px 12px 0 0',
                }} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ fontSize: 26, filter: money >= GACHA_SINGLE_COST ? 'drop-shadow(0 2px 6px rgba(200,130,0,.4))' : 'none' }}>🍺</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: money >= GACHA_SINGLE_COST ? '#e8c090' : '#443322' }}>一杯だけ</span>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: money >= GACHA_SINGLE_COST ? '#ffaa44' : '#332211',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  🪙 <span style={{ fontVariantNumeric: 'tabular-nums' }}>{GACHA_SINGLE_COST.toLocaleString()}</span>
                  <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>龍門幣</span>
                </div>
              </button>
              <button className="gbtn" disabled={money < GACHA_MULTI_COST} onClick={() => startGacha(10)} style={{
                flex: 1, position: 'relative',
                background: money >= GACHA_MULTI_COST
                  ? 'linear-gradient(170deg,#4a2d00 0%,#281800 50%,#3a2500 100%)' : 'rgba(20,10,0,.4)',
                border: `1px solid ${money >= GACHA_MULTI_COST ? '#bb7700' : '#2a1508'}`,
                borderRadius: 12, padding: '18px 10px', color: '#fff',
                boxShadow: money >= GACHA_MULTI_COST
                  ? '0 6px 28px rgba(0,0,0,.6),0 0 20px rgba(200,120,0,.08),inset 0 1px 0 rgba(255,200,50,.15),inset 0 -1px 0 rgba(0,0,0,.3)' : 'none',
                overflow: 'hidden',
              }}>
                {money >= GACHA_MULTI_COST && <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                  background: 'linear-gradient(180deg,rgba(255,200,50,.08),transparent)',
                  pointerEvents: 'none', borderRadius: '12px 12px 0 0',
                }} />}
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg,#aa1800,#dd3300,#aa1800)',
                  borderRadius: 20, padding: '3px 12px',
                  fontSize: 8, color: '#ffddaa', letterSpacing: 1, fontWeight: 700,
                  whiteSpace: 'nowrap', boxShadow: '0 3px 10px rgba(200,40,0,.5)',
                  border: '1px solid rgba(255,100,50,.3)',
                  animation: 'neonFlicker 4s ease-in-out infinite',
                }}>✦ 1杯分お得 ✦</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ fontSize: 26, filter: money >= GACHA_MULTI_COST ? 'drop-shadow(0 2px 8px rgba(220,160,0,.5))' : 'none' }}>🍻</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: money >= GACHA_MULTI_COST ? '#ffcc66' : '#443322' }}>飲み放題</span>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: money >= GACHA_MULTI_COST ? '#ffcc44' : '#332211',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  🪙 <span style={{ fontVariantNumeric: 'tabular-nums' }}>{GACHA_MULTI_COST.toLocaleString()}</span>
                  <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>龍門幣</span>
                </div>
              </button>
            </div>

            {/* フッター情報 */}
            <div style={{
              textAlign: 'center', fontSize: 9, color: '#2e1c08', lineHeight: 2.2,
              borderTop: '1px solid rgba(40,20,4,.5)', paddingTop: 10,
              display: 'flex', justifyContent: 'center', gap: 16,
            }}>
              <span>★5以上 <span style={{ color: '#aa8800' }}>3.5%</span></span>
              <span style={{ color: '#1a0e04' }}>│</span>
              <span>★6（幻）<span style={{ color: '#cc3344' }}>0.5%</span></span>
              <span style={{ color: '#1a0e04' }}>│</span>
              <span>ダブりは龍門幣変換</span>
            </div>
          </>
        )}

        {/* ======== POUR: 注ぎアニメ ======== */}
        {animPhase === 'pour' && (
          <div style={{
            flex: 1, minHeight: 340, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 0,
          }}>
            <div style={{ position: 'relative', height: 55, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  position: 'absolute',
                  width: 4, height: 16, borderRadius: '0 0 3px 3px',
                  background: `rgba(${pendingCount === 10 ? '255,200,60' : '200,150,70'},.75)`,
                  left: `calc(50% + ${(i - 2) * 7}px)`,
                  animation: 'pourDrop .55s ease-in infinite',
                  animationDelay: `${i * .12}s`,
                }} />
              ))}
            </div>
            <div style={{ position: 'relative', width: 100, height: 120, flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                border: '2px solid rgba(255,220,150,.22)', borderTop: 'none',
                borderRadius: '5px 5px 12px 12px',
                background: 'rgba(255,255,255,.035)', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: `${liquidFill}%`,
                  background: pendingCount === 10
                    ? 'linear-gradient(180deg,rgba(255,200,60,.35),rgba(200,130,20,.75))'
                    : 'linear-gradient(180deg,rgba(200,160,80,.3),rgba(150,90,20,.65))',
                  transition: 'height .025s linear', borderRadius: '0 0 10px 10px',
                }}>
                  <div style={{
                    position: 'absolute', top: -3, left: 0, right: 0, height: 10,
                    background: 'rgba(255,255,255,.22)',
                    borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
                  }} />
                  {liquidFill > 20 && [0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{
                      position: 'absolute',
                      bottom: `${15 + i * 15}%`, left: `${20 + i * 14}%`,
                      width: 3 + (i % 2) * 2, height: 3 + (i % 2) * 2,
                      borderRadius: '50%', background: 'rgba(255,255,255,.25)',
                      animation: `bubbleUp ${1.2 + i * 0.3}s ease-in infinite`,
                      animationDelay: `${i * 0.25}s`,
                    }} />
                  ))}
                </div>
                <div style={{
                  position: 'absolute', top: 6, left: 10, width: 5, bottom: 12,
                  background: 'linear-gradient(180deg,rgba(255,255,255,.14),transparent)', borderRadius: 3,
                }} />
                <div style={{
                  position: 'absolute', top: 6, right: 14, width: 3, bottom: 20,
                  background: 'linear-gradient(180deg,rgba(255,255,255,.07),transparent)', borderRadius: 2,
                }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#8a6030', letterSpacing: 5, marginTop: 20 }} className="flick">
              {pendingCount === 1 ? '一杯お注ぎします…' : '飲み放題、いきます…'}
            </div>
          </div>
        )}

        {/* ======== GLOW: グラス光る ======== */}
        {animPhase === 'glow' && (
          <div style={{
            flex: 1, minHeight: 340, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
          }}>
            {highest >= 5 && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse at 50% 45%, ${glowColor}22, transparent 60%)`,
                animation: 'bgPulse 1s ease-in-out infinite',
              }} />
            )}
            <div style={{
              width: 100, height: 120, position: 'relative',
              '--gc': glowColor,
              animation: 'glassGlow 1s ease forwards',
              borderRadius: '5px 5px 12px 12px',
              border: '2px solid rgba(255,220,150,.3)', borderTop: 'none',
              overflow: 'hidden', background: 'rgba(255,255,255,.05)',
            } as React.CSSProperties}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%',
                background: `linear-gradient(180deg,${glowColor}55,${glowColor}cc)`,
                borderRadius: '0 0 10px 10px',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 10,
                  background: 'rgba(255,255,255,.3)',
                  borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
                }} />
              </div>
              <div style={{
                position: 'absolute', top: 6, left: 10, width: 5, bottom: 12,
                background: 'linear-gradient(180deg,rgba(255,255,255,.2),transparent)', borderRadius: 3,
              }} />
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, letterSpacing: 4,
              color: glowColor,
              textShadow: `0 0 24px ${glowColor}, 0 0 60px ${glowColor}55`,
              animation: 'pulseGlow 0.5s ease-in-out infinite',
            }}>
              {highest >= 6 ? '─ 幻の一品…！！ ─' : highest >= 5 ? '秘蔵品、登場…！' : highest >= 4 ? '極品、来た…！' : 'お待ちどうさまです'}
            </div>
          </div>
        )}

        {/* ======== REVEAL: カード出現 ======== */}
        {animPhase === 'reveal' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: results.length === 1 ? '1fr' : 'repeat(auto-fill,minmax(96px,1fr))',
            gap: 8, maxWidth: results.length === 1 ? 240 : '100%', margin: '0 auto', width: '100%',
          }}>
            {results.slice(0, revealedCount).map((res, i) => {
              const card = getCard(res.cardId);
              const cfg = RC[res.rarity];
              const isLegend = res.rarity >= 6;
              const isRare = res.rarity >= 4;
              return (
                <div key={i} className={isLegend ? 'card-legend' : isRare ? 'card-rare' : 'card-drop'} style={{
                  background: cfg.bg, border: `2px solid ${cfg.border}`,
                  borderRadius: 10, padding: '11px 7px', textAlign: 'center',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: isRare ? `0 0 26px ${cfg.glow},0 5px 16px rgba(0,0,0,.6)` : '0 3px 12px rgba(0,0,0,.5)',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: isRare
                      ? `linear-gradient(90deg,transparent,${cfg.text},${cfg.border},${cfg.text},transparent)` : `linear-gradient(90deg,transparent,${cfg.border},transparent)`,
                    backgroundSize: isRare ? '200% 100%' : undefined,
                    animation: isRare ? 'borderShine 2s linear infinite' : undefined,
                  }} />
                  <div style={{ fontSize: results.length === 1 ? 48 : 28, lineHeight: 1.1, marginBottom: 5 }}>{card.emoji}</div>
                  <div style={{ fontSize: results.length === 1 ? 13 : 9, color: cfg.text, fontWeight: 700, lineHeight: 1.3 }}>{card.name}</div>
                  <div style={{ fontSize: 8, color: cfg.menuColor, marginTop: 3 }}>{cfg.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======== RESULT: 結果 ======== */}
        {animPhase === 'result' && results.length > 0 && (
          <div className="result-in">
            {highest >= 5 && (
              <div className="slide-up" style={{
                textAlign: 'center', marginBottom: 10, padding: '9px 14px',
                background: `rgba(${highest === 6 ? '150,10,20' : '130,85,0'},.2)`,
                border: `1px solid ${RC[highest].border}`, borderRadius: 8,
                boxShadow: `0 0 20px ${RC[highest].glow}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: RC[highest].text, letterSpacing: 3 }}>
                  {highest === 6 ? '🎉 幻の一品、入荷！！ 🎉' : '✨ 秘蔵品、入荷！ ✨'}
                </span>
              </div>
            )}
            {refundTotal > 0 && (
              <div style={{ textAlign: 'center', fontSize: 11, color: '#ffcc44', marginBottom: 8 }}>
                🪙 重複変換 +{refundTotal.toLocaleString()}龍門幣 還元
              </div>
            )}
            {/* カードグリッド */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: results.length === 1 ? '1fr' : 'repeat(auto-fill,minmax(96px,1fr))',
              gap: 8, maxWidth: results.length === 1 ? 240 : '100%', margin: '0 auto',
            }}>
              {results.map((res, i) => {
                const card = getCard(res.cardId);
                const cfg = RC[res.rarity];
                const isSel = selected === res;
                const isRare = res.rarity >= 4;
                const isLegend = res.rarity >= 6;
                return (
                  <div key={i} onClick={() => setSelected(isSel ? null : res)}
                    className="card-hover"
                    style={{
                      background: cfg.bg,
                      border: `2px solid ${isSel ? cfg.text : cfg.border}`,
                      borderRadius: 10, padding: '11px 7px', textAlign: 'center',
                      cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      boxShadow: isSel
                        ? `0 0 30px ${cfg.glow},0 6px 16px rgba(0,0,0,.7)`
                        : isRare ? `0 0 20px ${cfg.glow},0 4px 14px rgba(0,0,0,.6)` : '0 3px 12px rgba(0,0,0,.5)',
                      transform: isSel ? 'scale(1.06)' : 'scale(1)',
                      animation: `cardDrop .38s cubic-bezier(.34,1.4,.64,1) ${i * .04}s both`,
                      opacity: 0,
                    }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                      background: isRare
                        ? `linear-gradient(90deg,transparent,${cfg.text},${cfg.border},${cfg.text},transparent)` : `linear-gradient(90deg,transparent,${cfg.border},transparent)`,
                      backgroundSize: isRare ? '200% 100%' : undefined,
                      animation: isRare ? 'borderShine 2s linear infinite' : undefined,
                    }} />
                    {isLegend && (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: `radial-gradient(ellipse at center, ${cfg.glow}, transparent 70%)`,
                        animation: 'pulseGlow 2s ease-in-out infinite',
                      }} />
                    )}
                    {res.isNew && !res.isDuplicate && (
                      <div style={{
                        position: 'absolute', top: 3, right: 3,
                        background: 'rgba(40,150,40,.35)', border: '1px solid rgba(60,170,60,.5)',
                        borderRadius: 4, padding: '1px 5px', fontSize: 7, color: '#88ee88', fontWeight: 700,
                      }}>NEW</div>
                    )}
                    {res.isDuplicate && (
                      <div style={{
                        position: 'absolute', top: 3, right: 3,
                        background: 'rgba(150,90,0,.35)', border: '1px solid rgba(190,130,0,.45)',
                        borderRadius: 4, padding: '1px 5px', fontSize: 7, color: '#ffcc44',
                      }}>変換</div>
                    )}
                    <div style={{ fontSize: results.length === 1 ? 48 : 28, lineHeight: 1.1, marginBottom: 5, position: 'relative' }}>{card.emoji}</div>
                    <div style={{ fontSize: results.length === 1 ? 13 : 9, color: cfg.text, fontWeight: 700, lineHeight: 1.3, position: 'relative' }}>{card.name}</div>
                    <div style={{ fontSize: 8, color: cfg.menuColor, marginTop: 3, position: 'relative' }}>{cfg.label}</div>
                  </div>
                );
              })}
            </div>
            {/* 詳細パネル */}
            {selected && (() => {
              const card = getCard(selected.cardId);
              const cfg = RC[selected.rarity];
              return (
                <div className="slide-up" style={{
                  marginTop: 12, padding: '16px 18px',
                  background: 'rgba(10,5,0,.94)',
                  border: `1px solid ${cfg.border}`, borderRadius: 10,
                  boxShadow: `0 0 28px ${cfg.glow}, inset 0 0 20px rgba(0,0,0,.4)`,
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <div style={{
                    fontSize: 38, flexShrink: 0, width: 56, height: 56,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,.3)', borderRadius: 10,
                    border: `1px solid ${cfg.border}44`,
                  }}>{card.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, color: '#ddd', fontWeight: 700 }}>{card.name}</span>
                      <span style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(0,0,0,.5)', border: `1px solid ${cfg.border}`, color: cfg.text,
                      }}>{cfg.label}</span>
                      {selected.isNew && !selected.isDuplicate && (
                        <span style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 4,
                          background: 'rgba(30,100,30,.25)', color: '#88ee88', border: '1px solid rgba(50,140,50,.4)',
                        }}>初入荷</span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12, color: '#aa8866', lineHeight: 1.9,
                      borderLeft: `2px solid ${cfg.border}44`, paddingLeft: 10,
                    }}>{card.description}</div>
                    {selected.isDuplicate && (
                      <div style={{ fontSize: 10, color: '#ffcc44', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🪙 在庫3枚上限のため <span style={{ fontWeight: 700 }}>{selected.refund.toLocaleString()}龍門幣</span>に変換
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: '#4a3015', marginTop: 6 }}>
                      所持数: {inventoryMap[selected.cardId] ?? 0} / 3
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* もう一度ボタン */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="gbtn" disabled={money < GACHA_SINGLE_COST} onClick={() => startGacha(1)} style={{
                flex: 1,
                background: money >= GACHA_SINGLE_COST ? 'linear-gradient(160deg,#3a2010,#261508)' : 'rgba(20,10,0,.4)',
                border: `1px solid ${money >= GACHA_SINGLE_COST ? '#6b3a10' : '#2a1508'}`,
                borderRadius: 10, padding: '13px 10px', color: '#fff',
                boxShadow: money >= GACHA_SINGLE_COST ? '0 4px 18px rgba(0,0,0,.6)' : 'none',
              }}>
                <span style={{ fontSize: 16 }}>🍺</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: money >= GACHA_SINGLE_COST ? '#e8c090' : '#443322', marginLeft: 6 }}>もう一杯</span>
                <div style={{ fontSize: 11, color: money >= GACHA_SINGLE_COST ? '#ffaa44' : '#332211', marginTop: 4 }}>
                  🪙 {GACHA_SINGLE_COST.toLocaleString()}
                </div>
              </button>
              <button className="gbtn" disabled={money < GACHA_MULTI_COST} onClick={() => startGacha(10)} style={{
                flex: 1,
                background: money >= GACHA_MULTI_COST ? 'linear-gradient(160deg,#3a2500,#281800)' : 'rgba(20,10,0,.4)',
                border: `1px solid ${money >= GACHA_MULTI_COST ? '#aa6600' : '#2a1508'}`,
                borderRadius: 10, padding: '13px 10px', color: '#fff',
                boxShadow: money >= GACHA_MULTI_COST ? '0 4px 22px rgba(0,0,0,.6)' : 'none',
              }}>
                <span style={{ fontSize: 16 }}>🍻</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: money >= GACHA_MULTI_COST ? '#ffcc66' : '#443322', marginLeft: 6 }}>飲み放題もう一回</span>
                <div style={{ fontSize: 11, color: money >= GACHA_MULTI_COST ? '#ffcc44' : '#332211', marginTop: 4 }}>
                  🪙 {GACHA_MULTI_COST.toLocaleString()}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── おすすめカード（分離して再レンダリング削減） ──
function FeaturedCard({ getCard }: { getCard: (id: string) => { name: string; emoji: string; rarity: number; description: string } }) {
  const featuredCards = ['kiss', 'ear_bite', 'breast_touch', 'baijiu', 'ukon'];
  const fc = featuredCards[Math.floor(Date.now() / 60000) % featuredCards.length];
  const card = getCard(fc);
  const cfg = RC[card.rarity];

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
