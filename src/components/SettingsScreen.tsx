import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store';
import { GRID_CONFIGS } from '../gameLogic';
import type { Screen, GridMode } from '../types';

const GRID_MODES = Object.keys(GRID_CONFIGS) as GridMode[];

interface SettingsScreenProps {
  navigate: (screen: Screen) => void;
}

export default function SettingsScreen({ navigate }: SettingsScreenProps) {
  const { gridMode, setGridMode, highScore, resetHighScore } = useGameStore(
    useShallow((s) => ({
      gridMode: s.gridMode,
      setGridMode: s.setGridMode,
      highScore: s.highScore,
      resetHighScore: s.resetHighScore,
    }))
  );

  return (
    <div className="settings-screen">
      <div className="screen-header">
        <button className="screen-back-btn" onClick={() => navigate('menu')}>← Back</button>
        <h2 className="screen-heading">Settings</h2>
      </div>
      <div className="settings-content">
        <div className="settings-section">
          <p className="settings-label">Grid Size</p>
          <div className="settings-mode-row">
            {GRID_MODES.map((mode) => (
              <button
                key={mode}
                className={`mode-btn${gridMode === mode ? ' active' : ''}`}
                onClick={() => setGridMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-section">
          <p className="settings-label">High Score</p>
          <p className="settings-high-score">{highScore}</p>
          <button className="settings-reset-btn" onClick={resetHighScore}>
            Reset High Score
          </button>
        </div>
      </div>
    </div>
  );
}
