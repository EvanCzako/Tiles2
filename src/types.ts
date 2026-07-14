export type Grid = number[][];

export interface GridCfg {
  ROWS: number;
  COLS: number;
  PENDING_SIZE: number;
  PENDING_ROW_START: number;
  PENDING_COL_START: number;
  CENTER_ROW: number;
  CENTER_COL: number;
}

export interface Layout {
  sideOffset: number;
  gridPx: number;
  gridTopOffset: number;
  pendingColTop: number;
  topPendingLeft: number;
  bottomPendingY: number;
  CONTAINER_H: number;
  CONTAINER_W: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Landing {
  pendingIdx: number;
  row?: number;
  col?: number;
  flyThrough?: boolean;
}

export interface PushResult {
  grid: Grid;
  pending: number[];
  landings: Landing[];
  blockedIndices: number[];
}

export interface Move {
  value: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

// One animation stage of the collapse: a batch of single-axis moves plus the grid
// snapshot to commit once they finish. Stages are played in order so a tile that
// turns a corner (slides then drops) animates as two straight segments, never a diagonal.
export interface CollapseStage {
  moves: Move[];
  grid: Grid;
}

export interface CollapseResult {
  grid: Grid;
  midGrid: Grid;
  gravityMoves: Move[];
  horizontalMoves: Move[];
  // Ordered post-gravity passes (first horizontal pass, then any extra vertical/horizontal
  // passes needed to fully settle around obstacles). Each stage is a single axis.
  stages: CollapseStage[];
}

export interface AnnihilateResult {
  grid: Grid;
  annihilatedCells: [number, number][];
  score: number;
  // board-wide wipe breakdown (non-empty only when a 3+ connected group fired)
  boardWipeValues: number[];                 // base values swept board-wide, ascending
  boardWipeGroupCells: [number, number][];   // the triggering 3+ connected group
  boardWipeSpreadCells: [number, number][];  // all other matching tiles swept board-wide
  regularCells: [number, number][];          // 2-tile group cells (no board-wipe)
  bombBlastCells: [number, number][];        // cells cleared by bomb explosions (3×3 blast, chained)
  unlockedCells: [number, number][];         // locked tiles that had their lock removed (not cleared)
}

export interface NukeCrossResult {
  cells: [number, number][];
  score: number;
}

export interface TileColor {
  bg: string;
  text: string;
}

export interface FlyingTileDescriptor {
  id: string | number;
  value: number;
  from: Position;
  to: Position;
  flyThrough: boolean;
}

// Floating "+N" score indicator, positioned in arena pixel coordinates.
export interface ScorePopup {
  id: number;
  x: number;
  y: number;
  text: string;
  tier: number; // combo multiplier at spawn time — drives size/color
}

export interface ShakeState {
  tier: 'small' | 'big';
  id: number;
}

export interface Announcement {
  text: string;
  id: number;
  color?: string; // banner glow tint (e.g. wiped tile's color); default is nuke red-orange
}

export interface PendingCommitPayload {
  grid: Grid;
  leftPending?: number[];
  rightPending?: number[];
  topPending?: number[];
  bottomPending?: number[];
}

export interface PendingCommit {
  payload: PendingCommitPayload;
  blockedIndices: number[];
  pendingKey: PendingKey;
}

export type PaletteId = 'default' | 'deuteranopia' | 'protanopia' | 'tritanopia' | 'monochrome';
export type Direction = 'left' | 'right' | 'up' | 'down';
export type VerticalSide = 'top' | 'bottom';
export type HorizontalSide = 'left' | 'right';
export type GridMode = '9x9';
export type Screen = 'menu' | 'game' | 'howToPlay' | 'settings';
export type PendingKey = 'leftPending' | 'rightPending' | 'topPending' | 'bottomPending';
export type PendingSide = 'left' | 'right' | 'top' | 'bottom';
export type FlyingSource = PendingSide | null;

export interface GameState {
  gridMode: GridMode;
  cfg: GridCfg;
  layout: Layout;
  grid: Grid;
  leftPending: number[];
  rightPending: number[];
  topPending: number[];
  bottomPending: number[];
  score: number;
  highScore: number;
  combo: number;
  gameOver: boolean;
  animating: boolean;
  flyingTiles: FlyingTileDescriptor[];
  flyingSource: FlyingSource;
  annihilateSet: Set<string>;
  boardWipeFlashSet: Set<string>;
  bombFlashSet: Set<string>;
  nukeFlashSet: Set<string>;
  collapsingCells: Set<string>;
  pendingCommit: PendingCommit | null;
  lastVerticalSide: VerticalSide;
  lastHorizontalSide: HorizontalSide;
  colorPalette: PaletteId;
  nukeCharge: number;        // 0..NUKE_CHARGE_MAX — accrues while unarmed, drains while armed
  nukeArmed: boolean;        // meter filled; nuke fireable, meter decays per push until fired/lost
  turnClearedTiles: number;  // tiles cleared so far this turn (drives clean-sweep bonus)
  cleanSweepAwarded: boolean; // one clean-sweep award per turn
  scorePopups: ScorePopup[];
  shake: ShakeState | null;
  announcement: Announcement | null;
  soundOn: boolean;
}

export interface GameActions {
  reset: () => void;
  resetHighScore: () => void;
  setGridMode: (mode: GridMode) => void;
  setColorPalette: (id: PaletteId) => void;
  triggerPush: (direction: Direction) => void;
  fireNuke: () => void;
  setSoundOn: (on: boolean) => void;
}

export type GameStore = GameState & GameActions;
