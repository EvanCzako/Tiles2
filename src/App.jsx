import useGameStore from './store';
import { useScale } from './hooks/useScale';
import { useInput } from './hooks/useInput';
import GameHeader from './components/GameHeader';
import Arena from './components/Arena';
import './App.css';

export default function App() {
  const { score, highScore, triggerPush, layout, resetHighScore } = useGameStore();
  const { CONTAINER_W, CONTAINER_H } = layout;

  const scale = useScale(CONTAINER_W, CONTAINER_H);
  useInput(triggerPush);

  return (
    <div className="app">
      <GameHeader score={score} highScore={highScore} onResetHighScore={resetHighScore} />
      <div className="arena-container">
        <div style={{ width: CONTAINER_W * scale, height: CONTAINER_H * scale, overflow: 'visible', flexShrink: 0 }}>
          <div className="arena" style={{ width: CONTAINER_W, height: CONTAINER_H, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            <Arena />
          </div>
        </div>
      </div>
      <div className="swipe-zone" />
    </div>
  );
}
