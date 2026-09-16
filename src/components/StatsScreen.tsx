import { useState } from 'react';
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
const label = (m: GridMode) => m.replace('x', ' × ');

export default function StatsScreen({ navigate }: StatsScreenProps) {
  const { stats, resetStats, gridMode } = useGameStore(
    useShallow((s) => ({ stats: s.stats, resetStats: s.resetStats, gridMode: s.gridMode }))
  );
  // Open on the board being played; every figure below is scoped to the
  // selection, since expected performance differs per board.
  const [selected, setSelected] = useState<GridMode>(gridMode);
  const bests = loadHighScores();
  const s = stats[selected];

  const avgScore = s.gamesPlayed > 0 ? Math.round(s.totalScore / s.gamesPlayed) : 0;
  const avgTurns = s.gamesPlayed > 0 ? Math.round(s.totalTurns / s.gamesPlayed) : 0;

  const rows: { label: string; value: string }[] = [
    { label: 'Best score', value: fmt(bests[selected] ?? 0) },
    { label: 'Games played', value: fmt(s.gamesPlayed) },
    { label: 'Average score', value: fmt(avgScore) },
    { label: 'Average run', value: `${fmt(avgTurns)} turns` },
    { label: 'Longest run', value: `${fmt(s.longestRun)} turns` },
    { label: 'Best combo', value: s.bestCombo > 0 ? `×${s.bestCombo}` : '—' },
    { label: 'Tiles annihilated', value: fmt(s.tilesCleared) },
    { label: 'Board wipes', value: fmt(s.boardWipes) },
    { label: 'Nukes fired', value: fmt(s.nukesFired) },
    { label: 'Clean sweeps', value: fmt(s.cleanSweeps) },
  ];

  const totalGames = MODES.reduce((a, m) => a + stats[m].gamesPlayed, 0);

  return (
    <div className="settings-screen">
      <div className="screen-header">
        <button className="screen-back-btn" onClick={() => navigate('menu')}>← Back</button>
        <h2 className="screen-heading">Stats</h2>
      </div>
      <div className="settings-content">
        <div className="stats-tabs" role="tablist" aria-label="Board">
          {MODES.map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={selected === m}
              className={`stats-tab${selected === m ? ' active' : ''}`}
              onClick={() => setSelected(m)}
            >
              {label(m)}
            </button>
          ))}
        </div>

        <div className="settings-card">
          <p className="settings-label">{label(selected)}</p>
          <p className="settings-sublabel">
            {s.gamesPlayed === 0
              ? 'No games finished on this board yet'
              : `${fmt(s.gamesPlayed)} game${s.gamesPlayed === 1 ? '' : 's'} on record`}
          </p>
          <dl className="stats-list">
            {rows.map((r) => (
              <div key={r.label} className="stats-row">
                <dt className="stats-row-label">{r.label}</dt>
                <dd className="stats-row-value">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {totalGames > 0 && (
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-text">
                <p className="settings-label">Reset stats</p>
                <p className="settings-sublabel">Clears totals for all boards; best scores are kept</p>
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
