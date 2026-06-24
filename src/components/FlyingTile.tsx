import { useState, useEffect } from 'react';
import { CELL, ANIM_MS } from '../constants';
import { getTileColor, baseValue, isBomb } from '../gameLogic';
import useGameStore from '../store';

interface FlyingTileProps {
  value: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  flyThrough?: boolean;
}

export default function FlyingTile({ value, fromX, fromY, toX, toY, flyThrough = false }: FlyingTileProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setActive(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const palette = useGameStore((s) => s.colorPalette);
  const { bg, text } = getTileColor(value, palette);
  const base = baseValue(value);
  const bomb = isBomb(value);
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
        opacity: active && flyThrough ? 0 : 1,
        transition: active
          ? `transform ${ANIM_MS}ms ease-in${flyThrough ? `, opacity ${ANIM_MS * 0.5}ms ease-in ${ANIM_MS * 0.5}ms` : ', opacity 0s'}`
          : 'none',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {bomb ? <span style={{ fontSize: CELL * 0.5 }}>💣</span> : base}
    </div>
  );
}
