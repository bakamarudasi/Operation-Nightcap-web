export const RARITY_CONFIG: Record<number, { label: string; border: string; text: string; glow: string; bg: string; menuColor: string; particle: string }> = {
  1: { label:'並',   border:'#6b4e2a', text:'#c4a06a', glow:'rgba(180,130,60,0.4)',  bg:'linear-gradient(160deg,#3a2e1e,#2a2015)', menuColor:'#8a6a3a', particle:'#c4a06a' },
  2: { label:'上',   border:'#3a6a3a', text:'#7abf7a', glow:'rgba(80,160,80,0.4)',   bg:'linear-gradient(160deg,#1e2e1e,#151f15)', menuColor:'#5a9a5a', particle:'#7abf7a' },
  3: { label:'特上', border:'#3a5aaa', text:'#7a9aee', glow:'rgba(80,120,220,0.45)', bg:'linear-gradient(160deg,#1a1e30,#12152a)', menuColor:'#5a7acc', particle:'#7a9aee' },
  4: { label:'極',   border:'#8844bb', text:'#cc88ff', glow:'rgba(160,60,240,0.5)',  bg:'linear-gradient(160deg,#2a1a35,#1e1228)', menuColor:'#aa66dd', particle:'#cc88ff' },
  5: { label:'秘蔵', border:'#cc8800', text:'#ffcc44', glow:'rgba(220,160,0,0.55)',  bg:'linear-gradient(160deg,#352510,#281a08)', menuColor:'#ffaa00', particle:'#ffd700' },
  6: { label:'幻',   border:'#cc2244', text:'#ff6688', glow:'rgba(220,30,60,0.6)',   bg:'linear-gradient(160deg,#350a0a,#220606)', menuColor:'#ff3355', particle:'#ff4466' },
};

export const MENU_ROWS = [
  { r: 6, emoji: '💋', items: '幻のカード', rate: '0.5%' },
  { r: 5, emoji: '💊', items: '秘蔵品カード', rate: '3.5%' },
  { r: 4, emoji: '🍶', items: '極レアカード', rate: '9.0%' },
  { r: 3, emoji: '🥃', items: '特上カード', rate: '17.0%' },
  { r: 2, emoji: '🍷', items: '上カード', rate: '25.0%' },
  { r: 1, emoji: '🍺', items: '並カード', rate: '45.0%' },
];

export const GACHA_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700;900&family=Zen+Maru+Gothic:wght@400;700;900&family=Shippori+Mincho:wght@400;700&display=swap');
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
@keyframes floatLantern{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-6px) rotate(3deg)}}
@keyframes fadeSlideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
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
`;
