import useGameStore from '../store';
import { CELL, GAP } from '../constants';
import { isDeadCell } from '../gameLogic';
import Tile from './Tile';
import FlyingTile from './FlyingTile';
import GameOverOverlay from './GameOverOverlay';

export default function Arena() {
  const {
    grid, leftPending, rightPending, topPending, bottomPending,
    score, highScore, gameOver, reset,
    flyingTiles, flyingSource,
    flashSet, redFlashSet, redFlashSource, annihilateSet,
    collapsingCells, disabledLeft, disabledRight, disabledTop, disabledBottom,
    frozenPendingRows, cfg, layout,
  } = useGameStore();

  const { sideOffset, gridPx, gridTopOffset, pendingColTop, topPendingLeft, bottomPendingY } = layout;
  const { PENDING_ROW_START, PENDING_COL_START, CENTER_COL, CENTER_ROW, PENDING_SIZE } = cfg;
  const gridEmpty = grid.every(row => row.every(v => v === 0));
  const centerPendingRowIdx = CENTER_ROW - PENDING_ROW_START;
  const centerPendingColIdx = CENTER_COL - PENDING_COL_START;

  return (
    <>
      {gameOver && <GameOverOverlay score={score} highScore={highScore} onReset={reset} />}

      {flyingTiles.map(ft => (
        <FlyingTile
          key={ft.id}
          value={ft.value}
          fromX={ft.from.x} fromY={ft.from.y}
          toX={ft.to.x}     toY={ft.to.y}
          flyThrough={ft.flyThrough}
        />
      ))}

      {/* Top pending */}
      <div className="pending-row" style={{ left: sideOffset + topPendingLeft, top: 0 }}>
        {topPending.map((val, i) => {
          const colActive  = frozenPendingRows ? frozenPendingRows.top[i] : grid.some(row => row[PENDING_COL_START + i] !== 0) || (gridEmpty && i === centerPendingColIdx);
          const isDisabled = disabledTop.has(i);
          const isBlocked  = redFlashSource === 'topPending' && redFlashSet.has(i);
          const showVal = colActive && !(flyingSource === 'top' && !isBlocked && !isDisabled);
          return <Tile key={i} value={showVal ? val : 0} flashRed={isBlocked} disabled={isDisabled} />;
        })}
      </div>

      {/* Left pending */}
      <div className="pending-col" style={{ left: 0, top: pendingColTop }}>
        {leftPending.map((val, i) => {
          const rowActive  = frozenPendingRows ? frozenPendingRows.left[i] : grid[PENDING_ROW_START + i].some(v => v !== 0) || (gridEmpty && i === centerPendingRowIdx);
          const isDisabled = disabledLeft.has(i);
          const isBlocked  = redFlashSource === 'leftPending' && redFlashSet.has(i);
          const showVal = rowActive && !(flyingSource === 'left' && !isBlocked && !isDisabled);
          return <Tile key={i} value={showVal ? val : 0} flashRed={isBlocked} disabled={isDisabled} />;
        })}
      </div>

      {/* Grid */}
      <div className="grid" style={{ left: sideOffset, top: gridTopOffset, width: gridPx, gridTemplateColumns: `repeat(${cfg.COLS}, ${CELL}px)` }}>
        {grid.map((row, r) =>
          row.map((val, c) => (
            <div 
              key={`${r}-${c}`}
              className={`grid-cell${c === CENTER_COL || r === CENTER_ROW ? ' grid-cell--center' : ''}`}
              style={{ width: CELL, height: CELL }}
            >
              {isDeadCell(r, c)
                ? <div className="tile tile--dead" style={{ width: CELL, height: CELL }} />
                : <Tile
                    value={collapsingCells.has(`${r},${c}`) ? 0 : val}
                    flashing={flashSet.has(`${r},${c}`)}
                    flashAnnihilate={annihilateSet.has(`${r},${c}`)}
                    centerColumn={c === CENTER_COL || r === CENTER_ROW}
                  />
              }
            </div>
          ))
        )}
      </div>

      {/* Right pending */}
      <div className="pending-col" style={{ left: sideOffset + gridPx + GAP * 4, top: pendingColTop }}>
        {rightPending.map((val, i) => {
          const rowActive  = frozenPendingRows ? frozenPendingRows.right[i] : grid[PENDING_ROW_START + i].some(v => v !== 0) || (gridEmpty && i === centerPendingRowIdx);
          const isDisabled = disabledRight.has(i);
          const isBlocked  = redFlashSource === 'rightPending' && redFlashSet.has(i);
          const showVal = rowActive && !(flyingSource === 'right' && !isBlocked && !isDisabled);
          return <Tile key={i} value={showVal ? val : 0} flashRed={isBlocked} disabled={isDisabled} />;
        })}
      </div>

      {/* Bottom pending */}
      <div className="pending-row" style={{ left: sideOffset + topPendingLeft, top: bottomPendingY }}>
        {bottomPending.map((val, i) => {
          const colActive  = frozenPendingRows ? frozenPendingRows.bottom[i] : grid.some(row => row[PENDING_COL_START + i] !== 0) || (gridEmpty && i === centerPendingColIdx);
          const isDisabled = disabledBottom.has(i);
          const isBlocked  = redFlashSource === 'bottomPending' && redFlashSet.has(i);
          const showVal = colActive && !(flyingSource === 'bottom' && !isBlocked && !isDisabled);
          return <Tile key={i} value={showVal ? val : 0} flashRed={isBlocked} disabled={isDisabled} />;
        })}
      </div>
    </>
  );
}
