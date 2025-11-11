/**
 * Player filter component with typeahead search
 */

import { useState, useMemo } from 'react';
import { useStore } from '../../state/store';
import type { Player } from '../../types';

interface PlayerFilterProps {
  players: Player[];
}

export function PlayerFilter({ players }: PlayerFilterProps) {
  const { playerIds, togglePlayer } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredPlayers = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return players
      .filter(p => p.name.toLowerCase().includes(term))
      .slice(0, 10); // Limit to 10 results
  }, [players, searchTerm]);
  
  const pinnedPlayers = useMemo(() => {
    return players.filter(p => playerIds.includes(p.id));
  }, [players, playerIds]);
  
  return (
    <div className="filter-group">
      <label className="filter-label">Pin Players (max 3)</label>
      <input
        type="text"
        className="filter-input"
        placeholder="Search players..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {searchTerm && filteredPlayers.length > 0 && (
        <div className="filter-dropdown">
          {filteredPlayers.map(player => (
            <button
              key={player.id}
              className="filter-dropdown-item"
              onClick={() => {
                togglePlayer(player.id);
                setSearchTerm('');
              }}
              disabled={!playerIds.includes(player.id) && playerIds.length >= 3}
            >
              {player.name}
            </button>
          ))}
        </div>
      )}
      {pinnedPlayers.length > 0 && (
        <div className="pinned-players">
          {pinnedPlayers.map(player => (
            <span key={player.id} className="pinned-player">
              {player.name}
              <button
                className="pinned-player-remove"
                onClick={() => togglePlayer(player.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

