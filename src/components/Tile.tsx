import { CELL } from '../constants';
import { getTileColor } from '../gameLogic';

interface TileProps {
  value: number;
  size?: number;
  flashing?: boolean;
  flashAnnihilate?: boolean;
  centerColumn?: boolean;
}

export default function Tile({
  value,
  size = CELL,
  flashing = false,
  flashAnnihilate = false,
  centerColumn = false,
}: TileProps) {
  const { bg, text } = getTileColor(value);
  return (
    <div
      className={`tile${value > 0 ? ' tile--filled' : ''}${flashing ? ' tile--flash' : ''}${flashAnnihilate ? ' tile--flash-annihilate' : ''}`}
      style={{
        width: size,
        height: size,
        background: value > 0 ? bg : centerColumn && !flashAnnihilate ? 'transparent' : bg,
        color: text,
        fontSize: size * 0.35,
      }}
    >
      {value > 0 ? value : ''}
    </div>
  );
}
