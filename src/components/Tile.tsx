import { CELL } from '../constants';
import { getTileColor } from '../gameLogic';

interface TileProps {
  value: number;
  size?: number;
  flashing?: boolean;
  flashAnnihilate?: boolean;
  flashBoardWipe?: boolean;
  flashNuke?: boolean;
  centerColumn?: boolean;
}

export default function Tile({
  value,
  size = CELL,
  flashing = false,
  flashAnnihilate = false,
  flashBoardWipe = false,
  flashNuke = false,
  centerColumn = false,
}: TileProps) {
  const { bg, text } = getTileColor(value);
  const flashClass = flashNuke
    ? ' tile--flash-nuke'
    : flashBoardWipe
      ? ' tile--flash-boardwipe'
      : flashAnnihilate
        ? ' tile--flash-annihilate'
        : '';
  return (
    <div
      className={`tile${value > 0 ? ' tile--filled' : ''}${flashing ? ' tile--flash' : ''}${flashClass}`}
      style={{
        width: size,
        height: size,
        background: value > 0 ? bg : centerColumn && !flashAnnihilate && !flashBoardWipe && !flashNuke ? 'transparent' : bg,
        color: text,
        fontSize: size * 0.35,
      }}
    >
      {value > 0 ? value : ''}
    </div>
  );
}
