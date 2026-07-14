import { CELL } from '../constants';
import { getTileColor, baseValue, isBomb, isLocked, isStone } from '../game';
import useGameStore from '../store';

interface TileProps {
  value: number;
  size?: number;
  flashAnnihilate?: boolean;
  flashBoardWipe?: boolean;
  flashBomb?: boolean;
  flashNuke?: boolean;
  centerColumn?: boolean;
}

export default function Tile({
  value,
  size = CELL,
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
  const locked = isLocked(value);
  const stone = isStone(value);
  const anyFlash = flashAnnihilate || flashBoardWipe || flashBomb || flashNuke;
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
      className={`tile${locked ? ' tile--locked' : ''}${stone ? ' tile--stone' : ''}${flashClass}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        // Empty cells on the center cross stay transparent so the cross tint
        // shows through — unless a flash animation needs the cell visible.
        background: value === 0 && centerColumn && !anyFlash ? 'transparent' : bg,
        color: text,
        fontSize: size * 0.35,
      }}
    >
      {bomb ? (
        <span className="tile-special-glyph" style={{ fontSize: size * 0.5 }}>💣</span>
      ) : locked ? (
        <span className="tile-special-glyph" style={{ fontSize: size * 0.5 }}>🔒</span>
      ) : stone ? (
        <span className="tile-special-glyph" style={{ fontSize: size * 0.5 }}>🪨</span>
      ) : base > 0 ? (
        base
      ) : (
        ''
      )}
    </div>
  );
}
