import { useState, useEffect } from 'react';
import { CELL, ANIM_MS } from '../constants';
import { getTileColor, baseValue, isBomb, isLocked, isStone } from '../game';
import useGameStore from '../store';

interface FlyingTileProps {
  value: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export default function FlyingTile({ value, fromX, fromY, toX, toY }: FlyingTileProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setActive(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const palette = useGameStore((s) => s.colorPalette);
  const { bg, text } = getTileColor(value, palette);
  const base = baseValue(value);
  const bomb = isBomb(value);
  const locked = isLocked(value);
  const stone = isStone(value);
  const dx = fromX - toX;
  const dy = fromY - toY;

  return (
    <div
      style={{
        position: 'absolute',
        left: toX,
        top: toY,
        width: CELL,
        height: CELL,
        background: bg,
        color: text,
        fontSize: CELL * 0.35,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        transform: active ? 'translate(0,0)' : `translate(${dx}px,${dy}px)`,
        transition: active ? `transform ${ANIM_MS}ms ease-in` : 'none',
        pointerEvents: 'none',
        zIndex: 20,
        outline: stone ? '2px solid rgba(255,255,255,0.3)' : undefined,
      }}
      className={locked ? 'tile--locked' : stone ? 'tile--stone' : undefined}
    >
      {bomb ? (
        <span className="tile-special-glyph" style={{ fontSize: CELL * 0.5 }}>💣</span>
      ) : locked ? (
        <span className="tile-special-glyph" style={{ fontSize: CELL * 0.5 }}>🔒</span>
      ) : stone ? (
        <span className="tile-special-glyph" style={{ fontSize: CELL * 0.5 }}>🪨</span>
      ) : base}
    </div>
  );
}
