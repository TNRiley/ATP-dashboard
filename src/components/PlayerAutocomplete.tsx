/**
 * Custom Player Autocomplete Component
 */

import { useState, useRef, useEffect } from 'react';

interface Player {
  id: string;
  name: string;
}

interface PlayerAutocompleteProps {
  players: Player[];
  selectedPlayer: string | null;
  onSelect: (playerId: string | null) => void;
  placeholder?: string;
}

export function PlayerAutocomplete({ 
  players, 
  selectedPlayer, 
  onSelect, 
  placeholder = "Search players..." 
}: PlayerAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedPlayerName = selectedPlayer 
    ? players.find(p => p.id === selectedPlayer)?.name || ''
    : '';
  
  // Filter players based on search term
  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10); // Limit to 10 results
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelect = (playerId: string) => {
    onSelect(playerId);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(0);
  };
  
  const handleClear = () => {
    onSelect(null);
    setSearchTerm('');
    setIsOpen(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && e.key !== 'Escape') {
      setIsOpen(true);
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredPlayers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPlayers[highlightedIndex]) {
          handleSelect(filteredPlayers[highlightedIndex].id);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  };
  
  return (
    <div className="player-autocomplete">
      <div className="autocomplete-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="autocomplete-input"
          placeholder={selectedPlayerName || placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {selectedPlayer && (
          <button
            className="autocomplete-clear"
            onClick={handleClear}
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
      </div>
      {isOpen && filteredPlayers.length > 0 && (
        <div ref={dropdownRef} className="autocomplete-dropdown">
          {filteredPlayers.map((player, index) => (
            <button
              key={player.id}
              className={`autocomplete-option ${
                index === highlightedIndex ? 'highlighted' : ''
              } ${selectedPlayer === player.id ? 'selected' : ''}`}
              onClick={() => handleSelect(player.id)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {player.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

