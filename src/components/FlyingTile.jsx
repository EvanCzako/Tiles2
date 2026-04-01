import { useState, useEffect } from 'react';
import { CELL, ANIM_MS } from '../constants';
import { getTileColor } from '../gameLogic';

export default function FlyingTile({ value, fromX, fromY, toX, toY, flyThrough = false }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setActive(true))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const { bg, text } = getTileColor(value);
  const dx = fromX - toX;
  const dy = fromY - toY;

  return (
    <div style={{
      position: 'absolute',
      left: toX, top: toY,
      width: CELL, height: CELL,
      background: bg, color: text,
      fontSize: CELL * 0.35, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 6,
      transform: active ? 'translate(0,0)' : `translate(${dx}px,${dy}px)`,
      opacity: active && flyThrough ? 0 : 1,
      transition: active
        ? `transform ${ANIM_MS}ms ease-in${flyThrough ? `, opacity ${ANIM_MS * 0.5}ms ease-in ${ANIM_MS * 0.5}ms` : ', opacity 0s'}`
        : 'none',
      pointerEvents: 'none',
      zIndex: 20,
    }}>
      {value}
    </div>
  );
}
