import useGameStore from '../store';
import { useScale } from '../hooks/useScale';
import { useInput } from '../hooks/useInput';
import { COMBO_COLORS } from '../constants';
import { NUKE_CHARGE_MAX } from '../game';
import GameHeader from './GameHeader';
import Arena from './Arena';
import GameOverOverlay from './GameOverOverlay';
import type { Screen } from '../types';

interface GameScreenProps {
  navigate: (screen: Screen) => void;
}

export default function GameScreen({ navigate }: GameScreenProps) {
  const {
    score,
    highScore,
    combo,
    triggerPush,
    layout,
    animating,
    gameOver,
    nukeCharge,
    nukeArmed,
    fireNuke,
    reset,
    shake,
    announcement,
  } = useGameStore();
  const { CONTAINER_W, CONTAINER_H } = layout;

  const scale = useScale(CONTAINER_W, CONTAINER_H);
  useInput(triggerPush, fireNuke);

  const comboColor = COMBO_COLORS[Math.min(combo - 1, 4)];
  // While armed the meter drains per push (use-it-or-lose-it) — the shrinking
  // fill bar under the NUKE label is the countdown.
  const nukeReady = nukeArmed;

  return (
    <div className="app">
      <GameHeader score={score} highScore={highScore} onMenu={() => navigate('menu')} />
      <div className="combo-strip">
        <button
          className={`ability-btn nuke-btn${nukeReady ? ' ability-btn--ready' : ''}`}
          onClick={fireNuke}
          disabled={!nukeReady || animating || gameOver}
        >
          <span
            className="nuke-btn-fill"
            style={{ width: `${(nukeCharge / NUKE_CHARGE_MAX) * 100}%` }}
          />
          <span className="ability-btn-label">
            {nukeReady ? '☢ NUKE' : `☢ ${nukeCharge}/${NUKE_CHARGE_MAX}`}
          </span>
        </button>
        <div className="combo-slot">
          {combo >= 2 && (
            <div key={combo} className="combo-strip-badge" style={{ color: comboColor }}>
              ×{combo}
            </div>
          )}
        </div>
        {/* Balances the NUKE button so the combo badge stays centered */}
        <div className="combo-strip-spacer" />
      </div>
      <div className={`arena-container${shake ? ` shake-${shake.tier}` : ''}`}>
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
            <Arena />
          </div>
        </div>
        {announcement && (
          <div
            key={announcement.id}
            className="announcement"
            style={{
              textShadow: `0 0 18px ${announcement.color ?? 'rgba(255, 90, 40, 0.85)'}, 0 2px 10px rgba(0, 0, 0, 0.7)`,
            }}
          >
            {announcement.text}
          </div>
        )}
      </div>
      <div className="swipe-zone" />
      {gameOver && (
        <GameOverOverlay
          score={score}
          highScore={highScore}
          onReset={reset}
          onMenu={() => navigate('menu')}
        />
      )}
    </div>
  );
}
