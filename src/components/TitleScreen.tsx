import { useGameStore } from '../store/gameStore.ts';

export function TitleScreen() {
  const money = useGameStore((s) => s.money);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="screen active">
      <div className="title-bg">
        <div className="title-overlay"></div>
        <div className="lantern-row">
          <div className="lantern">酒</div>
          <div className="lantern">呑</div>
          <div className="lantern">処</div>
        </div>
        <div className="title-content">
          <div className="noren">
            <div className="noren-panel">ロ</div>
            <div className="noren-panel">ド</div>
            <div className="noren-panel">ス</div>
          </div>
          <h1 className="title-logo">ロドスバー</h1>
          <p className="title-sub">～今夜は帰さない～</p>
          <div className="title-menu">
            <button className="menu-btn" onClick={() => setScreen('select')}>
              <span className="menu-icon">🍶</span> 対戦する
            </button>
            <button className="menu-btn" onClick={() => setScreen('shop')}>
              <span className="menu-icon">🏮</span> ショップ
            </button>
            <button className="menu-btn" onClick={() => setScreen('gallery')}>
              <span className="menu-icon">🖼️</span> ギャラリー
            </button>
            <button className="menu-btn" onClick={() => setScreen('settings')}>
              <span className="menu-icon">⚙️</span> 設定
            </button>
          </div>
          <div className="title-money">💰 {money} 龍門幣</div>
        </div>
      </div>
    </div>
  );
}
