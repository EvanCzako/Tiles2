import useGameStore from '../store';
import { useScale } from '../hooks/useScale';
import { useInput } from '../hooks/useInput';
import GameHeader from './GameHeader';
import Arena from './Arena';
import type { Screen } from '../types';

const COMBO_COLORS = ['#8888aa', '#ffcc00', '#ff8822', '#ff4422', '#dd1144'];

interface GameScreenProps {
  navigate: (screen: Screen) => void;
}

export default function GameScreen({ navigate }: GameScreenProps) {
  const { score, highScore, combo, triggerPush, layout } = useGameStore();
  const { CONTAINER_W, CONTAINER_H } = layout;

  const scale = useScale(CONTAINER_W, CONTAINER_H);
  useInput(triggerPush);

  const comboColor = COMBO_COLORS[Math.min(combo - 1, 4)];

  return (
    <div className="app">
      <GameHeader score={score} highScore={highScore} onMenu={() => navigate('menu')} />
      <div className="combo-strip">
        {combo >= 2 && (
          <div key={combo} className="combo-strip-badge" style={{ color: comboColor }}>
            ×{combo}
          </div>
        )}
      </div>
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
