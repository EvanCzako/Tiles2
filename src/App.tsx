import { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import MenuScreen from './components/MenuScreen';
import BoardsScreen from './components/BoardsScreen';
import HowToPlayScreen from './components/HowToPlayScreen';
import SettingsScreen from './components/SettingsScreen';
import StatsScreen from './components/StatsScreen';
import GameScreen from './components/GameScreen';
import useGameStore from './store';
import { useLifecycle } from './hooks/useLifecycle';
import { onSystemMotionChange } from './motion';
import { hasReducedMotionOverride } from './store/persistence';
import './App.css';
import type { Screen } from './types';

function CurrentScreen({ screen, navigate }: { screen: Screen; navigate: (s: Screen) => void }) {
  if (screen === 'boards') return <BoardsScreen navigate={navigate} />;
  if (screen === 'howToPlay') return <HowToPlayScreen navigate={navigate} />;
  if (screen === 'settings') return <SettingsScreen navigate={navigate} />;
  if (screen === 'stats') return <StatsScreen navigate={navigate} />;
  if (screen === 'game') return <GameScreen navigate={navigate} />;
  return <MenuScreen navigate={navigate} />;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const reducedMotion = useGameStore((s) => s.reducedMotion);

  useLifecycle();

  // CSS keys decorative animations off this attribute rather than the media
  // query directly, so the in-app override in Settings works in both directions
  // (a player can ask for the motion back on a system that suppresses it).
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);

  // Track the OS setting live, but never overrule an explicit in-app choice.
  // Writes state directly instead of going through setReducedMotion: that action
  // records an override, which would pin the value to whatever the system
  // happened to be when it last changed.
  useEffect(
    () => onSystemMotionChange((reduced) => {
      if (!hasReducedMotionOverride()) useGameStore.setState({ reducedMotion: reduced });
    }),
    []
  );

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
