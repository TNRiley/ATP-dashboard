/**
 * Round filter component (multi-select)
 */

import { useStore } from '../../state/store';
import type { Round } from '../../types';
import { formatRound } from '../../utils/d3/formatters';

const rounds: Round[] = ['1R', '2R', '3R', '4R', 'QF', 'SF', 'F', 'RR', 'Q1', 'Q2', 'Q3'];

export function RoundFilter() {
  const { rounds: selectedRounds, toggleRound } = useStore();
  
  return (
    <div className="filter-group">
      <label className="filter-label">Round</label>
      <div className="filter-checkboxes">
        {rounds.map(round => (
          <label key={round} className="filter-checkbox">
            <input
              type="checkbox"
              checked={selectedRounds.includes(round)}
              onChange={() => toggleRound(round)}
            />
            <span>{formatRound(round)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

