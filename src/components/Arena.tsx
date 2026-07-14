import useGameStore from '../store';
import { CELL, GAP, COMBO_COLORS } from '../constants';
import Tile from './Tile';
import FlyingTile from './FlyingTile';

export default function Arena() {
  const {
    grid,
    leftPending,
    rightPending,
    topPending,
    bottomPending,
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
    scorePopups,
  } = useGameStore();

  const blockedKey = pendingCommit?.pendingKey ?? null;
  const blockedSet = pendingCommit ? new Set(pendingCommit.blockedIndices) : new Set<number>();

  const { sideOffset, gridPx, gridTopOffset, pendingColTop, topPendingLeft, bottomPendingY } =
    layout;
  const { ROWS, COLS, PENDING_ROW_START, PENDING_COL_START, CENTER_COL, CENTER_ROW } = cfg;

  // The four 2×2 corner obstacle blocks. Framed as distinct "zones" since they have
  // their own gravity/refill rules separate from the main play area.
  const CORNER_PAD = 3;
  const cornerZones = [
    { sr: 0, sc: 0 },
    { sr: 0, sc: COLS - PENDING_COL_START },
    { sr: ROWS - PENDING_ROW_START, sc: 0 },
    { sr: ROWS - PENDING_ROW_START, sc: COLS - PENDING_COL_START },
  ].map(({ sr, sc }) => ({
    left: sc * (CELL + GAP) - CORNER_PAD,
    top: sr * (CELL + GAP) - CORNER_PAD,
    width: PENDING_COL_START * CELL + (PENDING_COL_START - 1) * GAP + CORNER_PAD * 2,
    height: PENDING_ROW_START * CELL + (PENDING_ROW_START - 1) * GAP + CORNER_PAD * 2,
  }));

  return (
    <>
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

      {/* Floating score popups */}
      {scorePopups.map((p) => (
        <div
          key={p.id}
          className="score-popup"
          style={{
            left: p.x,
            top: p.y,
            color: COMBO_COLORS[Math.min(p.tier, 5) - 1],
            fontSize: `${1 + Math.min(p.tier, 5) * 0.22}rem`,
          }}
        >
          {p.text}
        </div>
      ))}

      {/* Top pending */}
      <div
        className="pending-row"
        style={{ left: sideOffset + topPendingLeft, top: 0 }}
      >
        {topPending.map((val, i) => {
          const isBlocked = blockedKey === 'topPending' && blockedSet.has(i);
          const showVal = !(flyingSource === 'top' && !isBlocked);
          return <Tile key={i} value={showVal ? val : 0} />;
        })}
      </div>

      {/* Left pending */}
      <div
        className="pending-col"
        style={{ left: 0, top: pendingColTop }}
      >
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
        {/* Corner obstacle-zone frames (painted behind the tiles) */}
        {cornerZones.map((z, i) => (
          <div key={`corner-zone-${i}`} className="corner-zone" style={z} />
        ))}

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
