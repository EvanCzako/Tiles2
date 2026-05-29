import useGameStore from '../store';
import { useScale } from '../hooks/useScale';
import { useInput } from '../hooks/useInput';
import GameHeader from './GameHeader';
import Arena from './Arena';
import type { Screen } from '../types';

interface GameScreenProps {
  navigate: (screen: Screen) => void;
}

export default function GameScreen({ navigate }: GameScreenProps) {
  const { score, highScore, combo, triggerPush, layout } = useGameStore();
  const { CONTAINER_W, CONTAINER_H } = layout;

  const scale = useScale(CONTAINER_W, CONTAINER_H);
  useInput(triggerPush);

  return (
    <div className="app">
      <GameHeader score={score} highScore={highScore} combo={combo} onMenu={() => navigate('menu')} />
      <div className="arena-container">
        <div
          style={{
            width: CONTAINER_W * scale,
            height: CONTAINER_H * scale,
            overflow: 'visible',
            flexShrink: 0,
          }}
        >
          <div
            className="arena"
            style={{
              width: CONTAINER_W,
              height: CONTAINER_H,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <Arena navigate={navigate} />
          </div>
        </div>
      </div>
      <div className="swipe-zone" />
    </div>
  );
}
