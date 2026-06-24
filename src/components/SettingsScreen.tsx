import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store';
import { GRID_CONFIGS, PALETTE_IDS, PALETTE_LABELS, getTileColor } from '../gameLogic';
import type { Screen, GridMode } from '../types';

const GRID_MODES = Object.keys(GRID_CONFIGS) as GridMode[];
const SWATCH_VALUES = [1, 2, 3, 4, 5, 6, 7];

interface SettingsScreenProps {
  navigate: (screen: Screen) => void;
}

export default function SettingsScreen({ navigate }: SettingsScreenProps) {
  const { gridMode, setGridMode, highScore, resetHighScore, colorPalette, setColorPalette } =
    useGameStore(
      useShallow((s) => ({
        gridMode: s.gridMode,
        setGridMode: s.setGridMode,
        highScore: s.highScore,
        resetHighScore: s.resetHighScore,
        colorPalette: s.colorPalette,
        setColorPalette: s.setColorPalette,
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
          <p className="settings-label">Color Theme</p>
          <p className="settings-sublabel">Color-vision accessibility</p>
          <div className="palette-list">
            {PALETTE_IDS.map((id) => (
              <button
                key={id}
                className={`palette-btn${colorPalette === id ? ' active' : ''}`}
                onClick={() => setColorPalette(id)}
              >
                <span className="palette-name">{PALETTE_LABELS[id]}</span>
                <span className="palette-swatches">
                  {SWATCH_VALUES.map((v) => (
                    <span
                      key={v}
                      className="palette-swatch"
                      style={{ background: getTileColor(v, id).bg }}
                    />
                  ))}
                </span>
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
