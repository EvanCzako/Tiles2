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

// Every pushed pending tile lands on the board — a push that can't place a tile
// reports it in PushResult.blockedIndices instead, so row/col are always known.
export interface Landing {
  pendingIdx: number;
  row: number;
  col: number;
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
export type GridMode = '7x7' | '9x9' | '11x11';
export type Screen = 'menu' | 'game' | 'boards' | 'howToPlay' | 'settings' | 'stats';
export type PendingKey = 'leftPending' | 'rightPending' | 'topPending' | 'bottomPending';
export type PendingSide = 'left' | 'right' | 'top' | 'bottom';
export type FlyingSource = PendingSide | null;

// The pure, resumable part of a run — everything needed to reconstruct a game
// in progress. Animation sets, flying tiles and layout are transient and are
// rebuilt on resume, so they are deliberately absent.
export interface SavedRun {
  gridMode: GridMode;
  grid: Grid;
  leftPending: number[];
  rightPending: number[];
  topPending: number[];
  bottomPending: number[];
  score: number;
  turnCount: number;
  nukeCharge: number;
  nukeArmed: boolean;
  lastVerticalSide: VerticalSide;
  lastHorizontalSide: HorizontalSide;
}

// Cross-run totals for ONE board. Expected performance differs per board (a 7x7
// run is longer but scores less than an 11x11 one), so pooling them produced
// averages that described no board in particular — see StatsByBoard.
export interface LifetimeStats {
  gamesPlayed: number;
  totalScore: number;
  totalTurns: number;
  longestRun: number;   // most pushes survived in a single run
  bestCombo: number;    // highest cascade multiplier ever reached
  tilesCleared: number;
  boardWipes: number;   // 3+ groups that swept a value board-wide
  nukesFired: number;
  cleanSweeps: number;
}

// Lifetime stats kept per board. Every counter is scoped to the board it was
// earned on; the Stats screen shows one board at a time.
export type StatsByBoard = Record<GridMode, LifetimeStats>;

export interface GameState {
  // Identifies the current game run. Bumped by every initState() (reset / board
  // switch); async animation chains capture it and stop committing once it
  // changes, so a cascade from an abandoned game can't write into the new one.
  runId: number;
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
  turnCount: number;         // pushes taken this game — drives the difficulty ramp
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
  hapticsOn: boolean;
  // Suppresses decorative motion (shake, pulses, popup drift). See src/motion.ts
  // for what is and isn't covered.
  reducedMotion: boolean;
  stats: StatsByBoard;
  // A resumable run was found in storage at load time and has not been consumed
  // or superseded yet — drives the menu's Continue button.
  hasSavedRun: boolean;
}

export interface GameActions {
  reset: () => void;
  resetHighScore: () => void;
  setGridMode: (mode: GridMode) => void;
  setColorPalette: (id: PaletteId) => void;
  triggerPush: (direction: Direction) => void;
  fireNuke: () => void;
  setSoundOn: (on: boolean) => void;
  setHapticsOn: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
  // Restores the persisted run; returns false (leaving state untouched) when
  // there is nothing valid to resume.
  resumeRun: () => boolean;
  // Writes the current run to storage. Called at end of turn and when the tab
  // is hidden; a no-op once the run is over.
  persistRun: () => void;
  resetStats: () => void;
  // Called when the game screen is entered/left. Leaving mid-cascade collapses
  // the remaining animation to zero delay with sound and haptics suppressed, so
  // nothing plays out behind the menu (see setInstantSettle in store/animations).
  setGameVisible: (visible: boolean) => void;
}

export type GameStore = GameState & GameActions;
