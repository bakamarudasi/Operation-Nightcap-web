import { useGameStore } from './store/gameStore.ts';
import { TitleScreen } from './components/TitleScreen.tsx';
import { SelectScreen } from './components/SelectScreen.tsx';
import { BattleScreen } from './components/BattleScreen.tsx';
import { ShopScreen } from './components/ShopScreen.tsx';
import { GalleryScreen } from './components/GalleryScreen.tsx';
import { SettingsScreen } from './components/SettingsScreen.tsx';
import { CGOverlay } from './components/CGOverlay.tsx';

function App() {
  const currentScreen = useGameStore((s) => s.currentScreen);

  return (
    <>
      {currentScreen === 'title' && <TitleScreen />}
      {currentScreen === 'select' && <SelectScreen />}
      {currentScreen === 'battle' && <BattleScreen />}
      {currentScreen === 'shop' && <ShopScreen />}
      {currentScreen === 'gallery' && <GalleryScreen />}
      {currentScreen === 'settings' && <SettingsScreen />}
      <CGOverlay />
    </>
  );
}

export default App;
