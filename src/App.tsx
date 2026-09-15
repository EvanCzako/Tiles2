import { useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import MenuScreen from './components/MenuScreen';
import BoardsScreen from './components/BoardsScreen';
import HowToPlayScreen from './components/HowToPlayScreen';
import SettingsScreen from './components/SettingsScreen';
import GameScreen from './components/GameScreen';
import useGameStore from './store';
import './App.css';
import type { Screen } from './types';

function CurrentScreen({ screen, navigate }: { screen: Screen; navigate: (s: Screen) => void }) {
  if (screen === 'boards') return <BoardsScreen navigate={navigate} />;
  if (screen === 'howToPlay') return <HowToPlayScreen navigate={navigate} />;
  if (screen === 'settings') return <SettingsScreen navigate={navigate} />;
  if (screen === 'game') return <GameScreen navigate={navigate} />;
  return <MenuScreen navigate={navigate} />;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  // Recovering from a crash starts a fresh run (which also invalidates any
  // animation chain still pending from the broken one — see the run guard) and
  // drops the player back on the menu.
  const recover = () => {
    useGameStore.getState().reset();
    setScreen('menu');
  };

  return (
    <ErrorBoundary onReset={recover}>
      <CurrentScreen screen={screen} navigate={setScreen} />
    </ErrorBoundary>
  );
}
