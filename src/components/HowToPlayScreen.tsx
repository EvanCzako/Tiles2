import Tile from './Tile';
import { BOMB_FLAG, STONE_FLAG } from '../game';
import type { Screen } from '../types';

interface Example {
  tiles: number[];
  caption: string;
}

interface Section {
  icon: string;
  title: string;
  body: string;
  examples?: Example[];
}

const sections: Section[] = [
  {
    icon: '👆',
    title: 'Push',
    body: 'Swipe to push a strip of tiles into the board from that side. Plan ahead!',
  },
  {
    icon: '💥',
    title: 'Annihilate',
    body: 'Match similar tiles (same number/color) to annihilate them and score. A pair just clears two, but connect three or more of the same type and you’ll wipe the board of that value!',
    examples: [
      { tiles: [2, 2], caption: 'pair — clears itself' },
      { tiles: [5, 5, 5], caption: '3+ — wipes every 5 on the board' },
    ],
  },
  {
    icon: '⚡',
    title: 'Cascade Combos',
    body: 'After a clear, tiles collapse toward the center of the board. If the collapse creates new matches, the cascade continues and your multiplier climbs (up to 8x per turn).',
  },
  {
    icon: '☢',
    title: 'Nuke',
    body: 'Every match adds to the nuke meter. Bigger combos charge it faster. When the button lights up and reads “NUKE”, tap it to clear a hole in the center of the board. However, a charged meter drains on every swipe - use it or lose it!',
  },
  {
    icon: '✨',
    title: 'Clean Sweep',
    body: 'Empty the entire board in one turn and you bank a bonus - the more tiles you cleared, the bigger it pays!',
  },
  {
    icon: '💣',
    title: 'Bombs & Stones',
    body: 'Clearing a bomb blasts every neighbor around it. Stones never budge - clear them with a bomb or a tile of matching color.',
    examples: [{ tiles: [BOMB_FLAG + 3, STONE_FLAG + 4], caption: 'bomb · stone' }],
  },
  {
    icon: '🧱',
    title: 'Corners',
    body: 'The four corner sections are self-contained, but you can still create combos with them!',
  },
  {
    icon: '🏁',
    title: 'Game Over',
    body: 'The game ends when no further tiles can be swiped into the board. Keep the center breathing!',
  },
];

interface HowToPlayScreenProps {
  navigate: (screen: Screen) => void;
}

export default function HowToPlayScreen({ navigate }: HowToPlayScreenProps) {
  return (
    <div className="htp-screen">
      <div className="screen-header">
        <button className="screen-back-btn" onClick={() => navigate('menu')}>← Back</button>
        <h2 className="screen-heading">How to Play</h2>
      </div>
      <div className="htp-content">
        {sections.map((s) => (
          <div key={s.title} className="htp-card">
            <span className="htp-card-icon">{s.icon}</span>
            <div className="htp-card-text">
              <p className="htp-card-title">{s.title}</p>
              <p className="htp-card-body">{s.body}</p>
              {s.examples && (
                <div className="htp-examples">
                  {s.examples.map((ex) => (
                    <div key={ex.caption} className="htp-example">
                      <div className="htp-example-tiles">
                        {ex.tiles.map((v, i) => (
                          <Tile key={i} value={v} size={26} />
                        ))}
                      </div>
                      <span className="htp-example-caption">{ex.caption}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
