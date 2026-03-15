import { useCallback, useRef, useEffect } from 'react';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; decay: number; size: number; color: string;
  type: 'spark' | 'dot';
}

export function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const particles = useRef<Particle[]>([]);
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
