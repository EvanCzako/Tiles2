import useGameStore from '../store';
import { CELL, GAP } from '../constants';
import Tile from './Tile';
import FlyingTile from './FlyingTile';
import GameOverOverlay from './GameOverOverlay';
import type { Screen } from '../types';

interface ArenaProps {
  navigate?: (screen: Screen) => void;
}

export default function Arena({ navigate }: ArenaProps) {
  const {
    grid,
    leftPending,
    rightPending,
    topPending,
    bottomPending,
    score,
    highScore,
    gameOver,
    reset,
    flyingTiles,
    flyingSource,
    annihilateSet,
    boardWipeFlashSet,
    bombFlashSet,
    nukeFlashSet,
    collapsingCells,
    pendingCommit,
    cfg,
    layout,
  } = useGameStore();

  const blockedKey = pendingCommit?.pendingKey ?? null;
  const blockedSet = pendingCommit ? new Set(pendingCommit.blockedIndices) : new Set<number>();

  const { sideOffset, gridPx, gridTopOffset, pendingColTop, topPendingLeft, bottomPendingY } =
    layout;
  const { PENDING_ROW_START, PENDING_COL_START, CENTER_COL, CENTER_ROW } = cfg;

  return (
    <>
      {gameOver && (
        <GameOverOverlay
          score={score}
          highScore={highScore}
          onReset={reset}
          onMenu={navigate ? () => navigate('menu') : undefined}
        />
      )}

      {flyingTiles.map((ft) => (
        <FlyingTile
          key={ft.id}
          value={ft.value}
          fromX={ft.from.x}
          fromY={ft.from.y}
          toX={ft.to.x}
          toY={ft.to.y}
          flyThrough={ft.flyThrough}
        />
      ))}

      {/* Top pending */}
      <div className="pending-row" style={{ left: sideOffset + topPendingLeft, top: 0 }}>
        {topPending.map((val, i) => {
          const isBlocked = blockedKey === 'topPending' && blockedSet.has(i);
          const showVal = !(flyingSource === 'top' && !isBlocked);
          return <Tile key={i} value={showVal ? val : 0} />;
        })}
      </div>

      {/* Left pending */}
      <div className="pending-col" style={{ left: 0, top: pendingColTop }}>
        {leftPending.map((val, i) => {
          const isBlocked = blockedKey === 'leftPending' && blockedSet.has(i);
          const showVal = !(flyingSource === 'left' && !isBlocked);
          return <Tile key={i} value={showVal ? val : 0} />;
        })}
      </div>

      {/* Grid */}
      <div
        className="grid"
        style={{
          left: sideOffset,
          top: gridTopOffset,
          width: gridPx,
          gridTemplateColumns: `repeat(${cfg.COLS}, ${CELL}px)`,
        }}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const key = `${r},${c}`;
            const isCorner =
              (r < PENDING_ROW_START || r >= PENDING_ROW_START + cfg.PENDING_SIZE) &&
              (c < PENDING_COL_START || c >= PENDING_COL_START + cfg.PENDING_SIZE);
            return (
              <div
                key={`${r}-${c}`}
                className={`grid-cell${c === CENTER_COL || r === CENTER_ROW ? ' grid-cell--center' : ''}${isCorner ? ` grid-cell--corner${val === 0 ? ' grid-cell--corner--empty' : ''}` : ''}`}
                style={{ width: CELL, height: CELL }}
              >
                <Tile
                  value={collapsingCells.has(key) ? 0 : val}
                  flashAnnihilate={annihilateSet.has(key)}
                  flashBoardWipe={boardWipeFlashSet.has(key)}
                  flashBomb={bombFlashSet.has(key)}
                  flashNuke={nukeFlashSet.has(key)}
                  centerColumn={c === CENTER_COL || r === CENTER_ROW}
                />
              </div>
            );
          })
        )}
      </div>

      {/* Right pending */}
      <div
        className="pending-col"
        style={{ left: sideOffset + gridPx + GAP * 4, top: pendingColTop }}
      >
        {rightPending.map((val, i) => {
          const isBlocked = blockedKey === 'rightPending' && blockedSet.has(i);
          const showVal = !(flyingSource === 'right' && !isBlocked);
          return <Tile key={i} value={showVal ? val : 0} />;
        })}
      </div>

      {/* Bottom pending */}
      <div
        className="pending-row"
        style={{ left: sideOffset + topPendingLeft, top: bottomPendingY }}
      >
        {bottomPending.map((val, i) => {
          const isBlocked = blockedKey === 'bottomPending' && blockedSet.has(i);
          const showVal = !(flyingSource === 'bottom' && !isBlocked);
          return <Tile key={i} value={showVal ? val : 0} />;
        })}
      </div>
    </>
  );
}
