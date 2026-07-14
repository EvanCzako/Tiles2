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
    body: 'Swipe — or use the arrow keys — to push a strip of five tiles into the board from that side. All four incoming strips are always visible, so plan ahead.',
  },
  {
    icon: '💥',
    title: 'Annihilate',
    body: 'Matching tiles that touch annihilate and score. A pair clears just those two — but connect three or more and every tile of that value anywhere on the board is wiped.',
    examples: [
      { tiles: [2, 2], caption: 'pair — clears itself' },
      { tiles: [5, 5, 5], caption: '3+ — wipes every 5 on the board' },
    ],
  },
  {
    icon: '⚡',
    title: 'Cascade Combos',
    body: 'After a clear, tiles collapse toward the center. If the collapse creates new matches, the cascade continues and your multiplier climbs — up to ×5 per wave.',
  },
  {
    icon: '☢',
    title: 'Nuke',
    body: "Every match adds to the nuke meter — bigger combos charge it faster. When the button reads NUKE, tap it (or press Space) to blast a plus-shaped hole in the center of the board at ×5 points. But don't sit on it: an armed nuke leaks charge every swipe, and if the meter drains empty the nuke is gone.",
  },
  {
    icon: '↻',
    title: 'Swap',
    body: "Don't like an incoming strip? Tap SWAP, then tap any of the four strips to reroll its tiles. Recharges after 10 turns.",
  },
  {
    icon: '✨',
    title: 'Clean Sweep',
    body: 'Empty the entire board in one turn and you bank a bonus — the more tiles you cleared, the bigger it pays — plus half a nuke meter.',
  },
  {
    icon: '💣',
    title: 'Bombs & Stones',
    body: 'Clearing a bomb blasts everything around it — and bombs caught in a blast chain. Stones never budge and hide their value; clear them with a bomb, or by wiping their value board-wide.',
    examples: [{ tiles: [BOMB_FLAG + 3, STONE_FLAG + 4], caption: 'bomb · stone' }],
  },
  {
    icon: '🧱',
    title: 'Corner Pockets',
    body: "The four 2×2 corners hold obstacle tiles with their own gravity. Pushes can't reach them — but board-wide wipes and bomb blasts can.",
  },
  {
    icon: '🏁',
    title: 'Game Over',
    body: 'The run ends when no push can land a single tile. Keep the center breathing.',
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
