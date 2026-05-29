import { useState } from 'react';
import MenuScreen from './components/MenuScreen';
import HowToPlayScreen from './components/HowToPlayScreen';
import SettingsScreen from './components/SettingsScreen';
import GameScreen from './components/GameScreen';
import './App.css';
import type { Screen } from './types';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  if (screen === 'howToPlay') return <HowToPlayScreen navigate={setScreen} />;
  if (screen === 'settings') return <SettingsScreen navigate={setScreen} />;
  if (screen === 'game') return <GameScreen navigate={setScreen} />;
  return <MenuScreen navigate={setScreen} />;
}
