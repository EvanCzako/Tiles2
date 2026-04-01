import { CELL } from '../constants';
import { getTileColor } from '../gameLogic';

export default function Tile({ value, size = CELL, flashing = false, flashRed = false, flashAnnihilate = false, disabled = false, centerColumn = false }) {
  const { bg, text } = disabled
    ? { bg: '#4a1c1c', text: '#c06060' }
    : getTileColor(value);
  return (
    <div
      className={`tile${value > 0 && !disabled ? ' tile--filled' : ''}${flashing ? ' tile--flash' : ''}${flashRed ? ' tile--flash-red' : ''}${flashAnnihilate ? ' tile--flash-annihilate' : ''}${disabled ? ' tile--disabled' : ''}`}
      style={{ width: size, height: size, background: value > 0 || disabled ? bg : (centerColumn ? 'transparent' : bg), color: text, fontSize: size * 0.35 }}
    >
      {value > 0 && !disabled ? value : ''}
    </div>
  );
}
