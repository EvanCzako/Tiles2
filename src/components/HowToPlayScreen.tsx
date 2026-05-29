import type { Screen } from '../types';

interface Section {
  title: string;
  body: string;
}

const sections: Section[] = [
  {
    title: 'Swipe to Push',
    body: 'Swipe left, right, up, or down to push a row of tiles onto the grid. Tiles fly in from the side you swipe toward.',
  },
  {
    title: 'Annihilation',
    body: 'When two identical tiles touch after a push, they annihilate — both disappear and you earn points equal to their combined value.',
  },
  {
    title: 'Combos',
    body: 'Chain annihilations to build a combo multiplier. Each consecutive chain increases your multiplier up to 5×, boosting your score.',
  },
  {
    title: 'Nuke',
    body: 'Reach a 5× combo and the entire center row and column explodes — clearing all tiles in the cross and earning massive bonus points.',
  },
  {
    title: 'Game Over',
    body: "The game ends when there's no valid move left — when no tile from any direction can land anywhere on the grid.",
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
          <div key={s.title} className="htp-section">
            <p className="htp-section-title">{s.title}</p>
            <p className="htp-section-body">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
