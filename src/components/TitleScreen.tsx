import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import '../styles/title.css';

function getTimeOfDay(hour: number) {
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getTimeStatus(hour: number) {
  if (hour >= 6 && hour < 11) return '仕込み中';
  if (hour >= 11 && hour < 17) return '昼営業中';
  if (hour >= 17 && hour < 21) return '営業中';
  if (hour >= 21) return '深夜営業中';
  return '閉店中';
}

interface AudioNodes {
  masterGain: GainNode;
}

export function TitleScreen() {
  const money = useGameStore((s) => s.money);
  const setScreen = useGameStore((s) => s.setScreen);

  const [timeLabel, setTimeLabel] = useState('--:--');
  const [timeStatus, setTimeStatus] = useState('営業中');
  const [timeClass, setTimeClass] = useState('');
  const [brushAnimate, setBrushAnimate] = useState(false);
  const [currencyDisplay, setCurrencyDisplay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const rainRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<AudioNodes | null>(null);
  const isPlayingRef = useRef(false);

  // Time theme
  useEffect(() => {
    function update() {
      const now = new Date();
      const hour = now.getHours();
      const min = String(now.getMinutes()).padStart(2, '0');
      setTimeLabel(`${hour}:${min}`);
      setTimeStatus(getTimeStatus(hour));
      setTimeClass(`time-${getTimeOfDay(hour)}`);
    }
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  // Rain
  useEffect(() => {
    const container = rainRef.current;
    if (!container) return;
    for (let i = 0; i < 60; i++) {
      const drop = document.createElement('div');
      drop.className = 'ts-raindrop';
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.height = `${15 + Math.random() * 25}px`;
      drop.style.animationDuration = `${0.5 + Math.random() * 0.8}s`;
      drop.style.animationDelay = `${Math.random() * 2}s`;
      drop.style.opacity = `${0.1 + Math.random() * 0.3}`;
      container.appendChild(drop);
    }
  }, []);

  // Particles
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div');
      p.className = 'ts-particle';
      p.style.left = `${Math.random() * 100}%`;
      p.style.bottom = '-10px';
      const size = `${2 + Math.random() * 3}px`;
      p.style.width = size;
      p.style.height = size;
      p.style.animationDuration = `${8 + Math.random() * 12}s`;
      p.style.animationDelay = `${Math.random() * 10}s`;
      container.appendChild(p);
    }
  }, []);

  // Brush stroke animation trigger
  useEffect(() => {
    const id = setTimeout(() => setBrushAnimate(true), 1500);
    return () => clearTimeout(id);
  }, []);

  // Currency count-up
  useEffect(() => {
    const delay = setTimeout(() => {
      const duration = 1500;
      const start = performance.now();
      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCurrencyDisplay(Math.floor(eased * money));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, 3600);
    return () => clearTimeout(delay);
  }, [money]);

  // Lantern click
  const handleLanternClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.classList.add('clicked');
    setTimeout(() => el.classList.remove('clicked'), 600);
  }, []);

  // Ambient audio
  const createAmbientAudio = useCallback(() => {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    const bufferSize = 2 * ctx.sampleRate;

    // Brown noise (ambient chatter)
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.15;
    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseNode.start();

    // Rain sound
    const rainBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const rainData = rainBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      rainData[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const rainNode = ctx.createBufferSource();
    rainNode.buffer = rainBuffer;
    rainNode.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 3000;
    rainFilter.Q.value = 0.5;
    const rainGainNode = ctx.createGain();
    rainGainNode.gain.value = 0.04;
    rainNode.connect(rainFilter);
    rainFilter.connect(rainGainNode);
    rainGainNode.connect(masterGain);
    rainNode.start();

    // Low ambient drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 65;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.03;
    const droneLfo = ctx.createOscillator();
    droneLfo.frequency.value = 0.1;
    const droneLfoGain = ctx.createGain();
    droneLfoGain.gain.value = 5;
    droneLfo.connect(droneLfoGain);
    droneLfoGain.connect(drone.frequency);
    droneLfo.start();
    drone.connect(droneGain);
    droneGain.connect(masterGain);
    drone.start();

    // Wind chime (furin)
    function playChime() {
      if (!isPlayingRef.current) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const freqs = [1200, 1500, 1800, 2100, 2400];
      osc.frequency.value = freqs[Math.floor(Math.random() * freqs.length)];
      const chimeGain = ctx.createGain();
      chimeGain.gain.setValueAtTime(0.02, ctx.currentTime);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
      osc.connect(chimeGain);
      chimeGain.connect(masterGain);
      osc.start();
      osc.stop(ctx.currentTime + 2);
      setTimeout(playChime, 5000 + Math.random() * 15000);
    }
    setTimeout(playChime, 3000);

    masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    audioNodesRef.current = { masterGain };
  }, []);

  const toggleAudio = useCallback(() => {
    if (!isPlaying) {
      if (!audioCtxRef.current) {
        isPlayingRef.current = true;
        createAmbientAudio();
      } else {
        audioCtxRef.current.resume();
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
    } else {
      if (audioCtxRef.current && audioNodesRef.current) {
        audioNodesRef.current.masterGain.gain.linearRampToValueAtTime(
          0, audioCtxRef.current.currentTime + 0.5
        );
        setTimeout(() => audioCtxRef.current?.suspend(), 600);
      }
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, [isPlaying, createAmbientAudio]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      audioCtxRef.current?.close();
    };
  }, []);

  return (
    <div className={`screen title-screen ${timeClass}`}>
      {/* Background layers */}
      <div className="ts-bg-layer ts-bg-gradient" />
      <div className="ts-bg-layer ts-bg-noise" />
      <div className="ts-bg-layer ts-bg-vignette" />

      {/* Rain */}
      <div className="ts-rain-container" ref={rainRef} />

      {/* Particles */}
      <div className="ts-particles" ref={particlesRef} />

      {/* Smoke */}
      <div className="ts-smoke-container">
        <div className="ts-smoke" style={{ left: '10%', animationDelay: '0s' }} />
        <div className="ts-smoke" style={{ left: '40%', animationDelay: '4s' }} />
        <div className="ts-smoke" style={{ left: '70%', animationDelay: '8s' }} />
      </div>

      {/* Time Indicator */}
      <div className="ts-time-indicator">
        <div className="ts-time-dot" />
        <span className="ts-time-label">{timeLabel}</span>
        <span className="ts-time-status">{timeStatus}</span>
      </div>

      {/* Decorations */}
      <div className="ts-deco-tokkuri">🍶</div>
      <div className="ts-deco-ochoko">🍵</div>

      {/* Main Content */}
      <div className="ts-container">
        {/* Noren */}
        <div className="ts-noren-wrapper">
          <div className="ts-noren-panel"><span className="ts-noren-text">酒</span></div>
          <div className="ts-noren-panel"><span className="ts-noren-text">呑</span></div>
          <div className="ts-noren-panel"><span className="ts-noren-text">処</span></div>
        </div>

        {/* Lanterns */}
        <div className="ts-lanterns">
          {(['ロ', 'ド', 'ス'] as const).map((kanji, i) => (
            <div className="ts-lantern" key={i} onClick={handleLanternClick}>
              <div className="ts-lantern-string" />
              <div className="ts-lantern-cap" />
              <div className="ts-lantern-body">
                <span className="ts-lantern-kanji">{kanji}</span>
                <div className="ts-lantern-glow" />
              </div>
              <div className="ts-lantern-tassel" />
            </div>
          ))}
        </div>

        {/* Brush Stroke Title */}
        <div className={`ts-title-area ${brushAnimate ? 'brush-animate' : ''}`}>
          <div className="ts-title-badges">
            {(['ロ', 'ド', 'ス'] as const).map((ch, i) => (
              <div className="ts-title-badge" key={i}>{ch}</div>
            ))}
          </div>
          <div className="ts-title-svg-container">
            <svg className="ts-title-svg" viewBox="0 0 420 90">
              <defs>
                <filter id="brushTexture">
                  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={4} result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale={2} xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
              <text x="212" y="68" textAnchor="middle" className="ts-title-brush-shadow">ロドスバー</text>
              <text x="210" y="66" textAnchor="middle" className="ts-title-brush-text">ロドスバー</text>
              <text x="210" y="66" textAnchor="middle" className="ts-title-brush-fill">ロドスバー</text>
            </svg>
            <div className="ts-ink-splatter" style={{ top: 15, right: 20, width: 5, height: 5, animationDelay: '1.8s' }} />
            <div className="ts-ink-splatter" style={{ bottom: 20, left: 30, width: 4, height: 4, animationDelay: '2.2s' }} />
            <div className="ts-ink-splatter" style={{ top: 25, left: 60, width: 3, height: 3, animationDelay: '1.5s' }} />
          </div>
          <p className="ts-title-sub">～今夜は帰さない～</p>
        </div>

        <div className="ts-deco-line" />

        {/* Menu */}
        <nav className="ts-menu">
          <button className="ts-menu-btn ts-primary" onClick={() => setScreen('select')}>
            <span className="ts-btn-icon">🍶</span>
            <span className="ts-btn-label">対戦する</span>
          </button>
          <button className="ts-menu-btn" onClick={() => setScreen('shop')}>
            <span className="ts-btn-icon">🏮</span>
            <span className="ts-btn-label">ショップ</span>
          </button>
          <button className="ts-menu-btn" onClick={() => setScreen('gallery')}>
            <span className="ts-btn-icon">🎨</span>
            <span className="ts-btn-label">ギャラリー</span>
          </button>
          <button className="ts-menu-btn" onClick={() => setScreen('settings')}>
            <span className="ts-btn-icon">⚙️</span>
            <span className="ts-btn-label">設定</span>
          </button>
        </nav>

        {/* Currency */}
        <div className="ts-currency">
          <div className="ts-currency-icon">龍</div>
          <span className="ts-currency-amount">{currencyDisplay.toLocaleString()} 龍門幣</span>
        </div>
      </div>

      <div className="ts-bottom-bar" />

      {/* Audio Control */}
      <button className={`ts-audio-control ${isPlaying ? 'playing' : ''}`} onClick={toggleAudio}>
        <div className="ts-bars">
          <div className="ts-bar" />
          <div className="ts-bar" />
          <div className="ts-bar" />
          <div className="ts-bar" />
        </div>
      </button>
    </div>
  );
}
