import { CELL } from '../constants';
import { getTileColor, baseValue, isBomb } from '../gameLogic';
import useGameStore from '../store';

interface TileProps {
  value: number;
  size?: number;
  flashing?: boolean;
  flashAnnihilate?: boolean;
  flashBoardWipe?: boolean;
  flashBomb?: boolean;
  flashNuke?: boolean;
  centerColumn?: boolean;
}

export default function Tile({
  value,
  size = CELL,
  flashing = false,
  flashAnnihilate = false,
  flashBoardWipe = false,
  flashBomb = false,
  flashNuke = false,
  centerColumn = false,
}: TileProps) {
  const palette = useGameStore((s) => s.colorPalette);
  const { bg, text } = getTileColor(value, palette);
  const base = baseValue(value);
  const bomb = isBomb(value);
  const flashClass = flashNuke
    ? ' tile--flash-nuke'
    : flashBomb
      ? ' tile--flash-bomb'
      : flashBoardWipe
        ? ' tile--flash-boardwipe'
        : flashAnnihilate
          ? ' tile--flash-annihilate'
          : '';
  return (
    <div
      className={`tile${value > 0 ? ' tile--filled' : ''}${bomb ? ' tile--bomb' : ''}${flashing ? ' tile--flash' : ''}${flashClass}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        background: value > 0 ? bg : centerColumn && !flashAnnihilate && !flashBoardWipe && !flashBomb && !flashNuke ? 'transparent' : bg,
        color: text,
        fontSize: size * 0.35,
      }}
    >
      {bomb ? (
        <span className="tile-bomb-glyph" style={{ fontSize: size * 0.5 }}>💣</span>
      ) : base > 0 ? (
        base
      ) : (
        ''
      )}
    </div>
  );
}
