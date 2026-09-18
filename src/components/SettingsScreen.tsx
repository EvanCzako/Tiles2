import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store';
import { PALETTE_IDS, PALETTE_LABELS, getTileColor } from '../game';
import { hapticsSupported } from '../haptics';
import type { Screen } from '../types';

const SWATCH_VALUES = [1, 2, 3, 4, 5, 6, 7];

// Kept in step with the mobile app's Settings → About, which needs these for
// App Review (5.1.1 privacy policy reachable in-app, 1.5 developer contact).
const PRIVACY_URL = 'https://evanczako.github.io/untiled-privacy/';
const SUPPORT_URL = 'https://evanczako.github.io/untiled-privacy/support.html';

interface SettingsScreenProps {
  navigate: (screen: Screen) => void;
}

export default function SettingsScreen({ navigate }: SettingsScreenProps) {
  const {
    gridMode,
    highScore,
    resetHighScore,
    colorPalette,
    setColorPalette,
    soundOn,
    setSoundOn,
    hapticsOn,
    setHapticsOn,
    reducedMotion,
    setReducedMotion,
  } = useGameStore(
    useShallow((s) => ({
      gridMode: s.gridMode,
      highScore: s.highScore,
      resetHighScore: s.resetHighScore,
      colorPalette: s.colorPalette,
      setColorPalette: s.setColorPalette,
      soundOn: s.soundOn,
      setSoundOn: s.setSoundOn,
      hapticsOn: s.hapticsOn,
      setHapticsOn: s.setHapticsOn,
      reducedMotion: s.reducedMotion,
      setReducedMotion: s.setReducedMotion,
    }))
  );

  return (
    <div className="settings-screen">
      <div className="screen-header">
        <button className="screen-back-btn" onClick={() => navigate('menu')}>← Back</button>
        <h2 className="screen-heading">Settings</h2>
      </div>
      <div className="settings-content">
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-text">
              <p className="settings-label">Sound</p>
              <p className="settings-sublabel">Match blips, booms &amp; chimes</p>
            </div>
            <button
              className={`toggle${soundOn ? ' toggle--on' : ''}`}
              onClick={() => setSoundOn(!soundOn)}
              aria-pressed={soundOn}
              aria-label="Toggle sound"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {/* Hidden where the browser has no Vibration API (notably iOS Safari)
              rather than shown as a switch that silently does nothing. */}
          {hapticsSupported() && (
            <div className="settings-row">
              <div className="settings-row-text">
                <p className="settings-label">Haptics</p>
                <p className="settings-sublabel">Vibration on pushes &amp; matches</p>
              </div>
              <button
                className={`toggle${hapticsOn ? ' toggle--on' : ''}`}
                onClick={() => setHapticsOn(!hapticsOn)}
                aria-pressed={hapticsOn}
                aria-label="Toggle haptics"
              >
                <span className="toggle-knob" />
              </button>
            </div>
          )}

          <div className="settings-row">
            <div className="settings-row-text">
              <p className="settings-label">Reduce Motion</p>
              <p className="settings-sublabel">
                Turns off screen shake &amp; pulsing. Follows your system setting until changed here.
              </p>
            </div>
            <button
              className={`toggle${reducedMotion ? ' toggle--on' : ''}`}
              onClick={() => setReducedMotion(!reducedMotion)}
              aria-pressed={reducedMotion}
              aria-label="Toggle reduced motion"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>

        <div className="settings-card">
          <p className="settings-label">Tile Colors</p>
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


        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-text">
              <p className="settings-label">High Score</p>
              <p className="settings-sublabel">{gridMode.replace('x', ' × ')} board</p>
              <p className="settings-high-score">{highScore.toLocaleString()}</p>
            </div>
            <button className="settings-reset-btn" onClick={resetHighScore}>
              Reset
            </button>
          </div>
        </div>

        <div className="settings-card">
          <p className="settings-label">About</p>
          <a
            className="settings-link"
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy<span className="settings-link-chevron">›</span>
          </a>
          <a
            className="settings-link"
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Support<span className="settings-link-chevron">›</span>
          </a>
        </div>
      </div>
    </div>
  );
}
