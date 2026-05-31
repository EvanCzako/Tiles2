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
  merged?: boolean;
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

export interface CollapseResult {
  grid: Grid;
  midGrid: Grid;
  gravityMoves: Move[];
  horizontalMoves: Move[];
}

export interface AnnihilateResult {
  grid: Grid;
  annihilatedCells: [number, number][];
  score: number;
  // board-wide wipe breakdown (non-empty only when a 4+ connected group fired)
  boardWipeGroupCells: [number, number][];   // the triggering 4+ connected group
  boardWipeSpreadCells: [number, number][];  // all other matching tiles swept board-wide
  regularCells: [number, number][];          // 2–3 group cells (no board-wipe)
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

export interface FrozenPendingRows {
  left: boolean[];
  right: boolean[];
  top: boolean[];
  bottom: boolean[];
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

export type Direction = 'left' | 'right' | 'up' | 'down';
export type VerticalSide = 'top' | 'bottom';
export type HorizontalSide = 'left' | 'right';
export type GridMode = '9x9';
export type Screen = 'menu' | 'game' | 'howToPlay' | 'settings';
export type FlyingSource = 'left' | 'right' | 'top' | 'bottom' | null;
export type PendingKey = 'leftPending' | 'rightPending' | 'topPending' | 'bottomPending';

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
  nukeFlashSet: Set<string>;
  nukeActive: boolean;
  collapsingCells: Set<string>;
  pendingCommit: PendingCommit | null;
  frozenPendingRows: FrozenPendingRows | null;
  lastVerticalSide: VerticalSide;
  lastHorizontalSide: HorizontalSide;
}

export interface GameActions {
  reset: () => void;
  resetHighScore: () => void;
  setGridMode: (mode: GridMode) => void;
  triggerPush: (direction: Direction) => void;
}

export type GameStore = GameState & GameActions;
