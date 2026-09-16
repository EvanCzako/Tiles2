import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store';
import { loadHighScores } from '../store/persistence';
import { GRID_CONFIGS } from '../game';
import type { Screen, GridMode } from '../types';

interface StatsScreenProps {
  navigate: (screen: Screen) => void;
}

const MODES = Object.keys(GRID_CONFIGS) as GridMode[];

const fmt = (n: number) => n.toLocaleString();

export default function StatsScreen({ navigate }: StatsScreenProps) {
  const { stats, resetStats } = useGameStore(
    useShallow((s) => ({ stats: s.stats, resetStats: s.resetStats }))
  );
  // Read straight from storage: bests are written per board at game over and
  // the store only ever holds the currently-selected board's.
  const bests = loadHighScores();

  const avgScore = stats.gamesPlayed > 0 ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;
  const avgTurns = stats.gamesPlayed > 0 ? Math.round(stats.totalTurns / stats.gamesPlayed) : 0;

  const rows: { label: string; value: string }[] = [
    { label: 'Games played', value: fmt(stats.gamesPlayed) },
    { label: 'Average score', value: fmt(avgScore) },
    { label: 'Average run', value: `${fmt(avgTurns)} turns` },
    { label: 'Longest run', value: `${fmt(stats.longestRun)} turns` },
    { label: 'Best combo', value: stats.bestCombo > 0 ? `×${stats.bestCombo}` : '—' },
    { label: 'Tiles annihilated', value: fmt(stats.tilesCleared) },
    { label: 'Board wipes', value: fmt(stats.boardWipes) },
    { label: 'Nukes fired', value: fmt(stats.nukesFired) },
    { label: 'Clean sweeps', value: fmt(stats.cleanSweeps) },
  ];

  return (
    <div className="settings-screen">
      <div className="screen-header">
        <button className="screen-back-btn" onClick={() => navigate('menu')}>← Back</button>
        <h2 className="screen-heading">Stats</h2>
      </div>
      <div className="settings-content">
        <div className="settings-card">
          <p className="settings-label">Best scores</p>
          <p className="settings-sublabel">Per board</p>
          <div className="stats-best-row">
            {MODES.map((mode) => (
              <div key={mode} className="stats-best">
                <span className="stats-best-mode">{mode.replace('x', ' × ')}</span>
                <span className="stats-best-score">{fmt(bests[mode] ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <p className="settings-label">Lifetime</p>
          <p className="settings-sublabel">All boards combined</p>
          <dl className="stats-list">
            {rows.map((r) => (
              <div key={r.label} className="stats-row">
                <dt className="stats-row-label">{r.label}</dt>
                <dd className="stats-row-value">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {stats.gamesPlayed > 0 && (
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-text">
                <p className="settings-label">Reset stats</p>
                <p className="settings-sublabel">Clears lifetime totals; best scores are kept</p>
              </div>
              <button className="settings-reset-btn" onClick={resetStats}>
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
