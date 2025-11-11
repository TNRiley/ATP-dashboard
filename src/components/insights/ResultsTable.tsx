/**
 * Results Table
 * Interactive virtualized table with derived columns
 */

import { useMemo, useState } from 'react';
import type React from 'react';
import { useStore } from '../../state/store';
import type { Match, Derived, Tournament, Player } from '../../types';
import { formatDate, formatRound, formatInteger } from '../../utils/d3/formatters';
import { getTournamentDisplayName } from '../../utils/tournamentNames';

interface Props {
  matches: Match[];
  derived: Derived[];
  tournaments: Tournament[];
  players: Player[];
}

type SortColumn = 
  | 'date' 
  | 'tournament' 
  | 'round' 
  | 'winner' 
  | 'loser'
  | keyof Derived;

type SortCriteria = {
  column: SortColumn;
  direction: 'asc' | 'desc';
};

export function ResultsTable({ matches, derived, tournaments, players }: Props) {
  const { surface, series, rounds, playerIds, dateRange } = useStore();
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  
  // Create lookup maps
  const tournamentsMap = useMemo(() => 
    new Map(tournaments.map(t => [t.id, t])), 
    [tournaments]
  );
  const playersMap = useMemo(() => 
    new Map(players.map(p => [p.id, p])), 
    [players]
  );
  const derivedMap = useMemo(() => 
    new Map(derived.map(d => [d.matchId, d])), 
    [derived]
  );
  
  // Filter matches
  const filteredMatches = useMemo(() => {
    let result = matches;
    
    if (surface) {
      result = result.filter(m => {
        const tournament = tournamentsMap.get(m.tournamentId);
        return tournament?.surface === surface;
      });
    }
    
    if (series) {
      result = result.filter(m => {
        const tournament = tournamentsMap.get(m.tournamentId);
        return tournament?.series === series;
      });
    }
    
    if (rounds.length > 0) {
      result = result.filter(m => rounds.includes(m.round));
    }
    
    if (playerIds.length > 0) {
      result = result.filter(m => 
        playerIds.includes(m.winnerId) || playerIds.includes(m.loserId)
      );
    }
    
    if (dateRange) {
      result = result.filter(m => 
        m.date >= dateRange[0] && m.date <= dateRange[1]
      );
    }
    
    return result;
  }, [matches, surface, series, rounds, playerIds, dateRange, tournamentsMap]);
  
  // Sort matches
  const sortedMatches = useMemo(() => {
    if (sortCriteria.length === 0) return filteredMatches;
    
    return [...filteredMatches].sort((a, b) => {
      for (const { column, direction } of sortCriteria) {
        const dA = derivedMap.get(a.id);
        const dB = derivedMap.get(b.id);
        const tournamentA = tournamentsMap.get(a.tournamentId);
        const tournamentB = tournamentsMap.get(b.tournamentId);
        const winnerA = playersMap.get(a.winnerId);
        const winnerB = playersMap.get(b.winnerId);
        const loserA = playersMap.get(a.loserId);
        const loserB = playersMap.get(b.loserId);
        
        let aVal: any;
        let bVal: any;
        
        // Get the value based on column type
        if (column === 'date') {
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
        } else if (column === 'tournament') {
          aVal = getTournamentDisplayName(tournamentA);
          bVal = getTournamentDisplayName(tournamentB);
        } else if (column === 'round') {
          aVal = a.round;
          bVal = b.round;
        } else if (column === 'winner') {
          aVal = winnerA?.name || '';
          bVal = winnerB?.name || '';
        } else if (column === 'loser') {
          aVal = loserA?.name || '';
          bVal = loserB?.name || '';
        } else {
          // Derived column
          aVal = dA?.[column as keyof Derived];
          bVal = dB?.[column as keyof Derived];
        }
        
        // Handle null/undefined values
        if (aVal === undefined || aVal === null) {
          aVal = direction === 'asc' ? Infinity : -Infinity;
        }
        if (bVal === undefined || bVal === null) {
          bVal = direction === 'asc' ? Infinity : -Infinity;
        }
        
        // Handle boolean values
        if (typeof aVal === 'boolean') {
          aVal = aVal ? 1 : 0;
          bVal = bVal ? 1 : 0;
        }
        
        // Compare values
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else {
          comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
        
        // Apply direction
        if (comparison !== 0) {
          return direction === 'asc' ? comparison : -comparison;
        }
      }
      
      return 0;
    });
  }, [filteredMatches, sortCriteria, derivedMap, tournamentsMap, playersMap]);
  
  // Paginate
  const paginatedMatches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedMatches.slice(start, start + pageSize);
  }, [sortedMatches, page]);
  
  const totalPages = Math.ceil(sortedMatches.length / pageSize);
  
  const handleSort = (column: SortColumn, event?: React.MouseEvent) => {
    const isCtrlClick = event?.ctrlKey || event?.metaKey;
    
    setSortCriteria(prev => {
      const existingIndex = prev.findIndex(c => c.column === column);
      
      if (existingIndex >= 0) {
        // Column already in sort list
        const existing = prev[existingIndex];
        if (existing.direction === 'asc') {
          // Change to descending
          const updated = [...prev];
          updated[existingIndex] = { ...existing, direction: 'desc' };
          return updated;
        } else {
          // Remove from sort (was descending)
          return prev.filter((_, i) => i !== existingIndex);
        }
      } else {
        // Column not in sort list
        if (isCtrlClick) {
          // Add as additional sort column
          return [...prev, { column, direction: 'asc' }];
        } else {
          // Replace all sorts with this column
          return [{ column, direction: 'asc' }];
        }
      }
    });
    
    setPage(1);
  };
  
  const renderSortIcon = (column: SortColumn) => {
    const criteria = sortCriteria.find(c => c.column === column);
    if (!criteria) return '↕';
    
    const index = sortCriteria.findIndex(c => c.column === column);
    const priority = index >= 0 ? index + 1 : null;
    
    return (
      <span>
        {criteria.direction === 'asc' ? '↑' : '↓'}
        {sortCriteria.length > 1 && <sup>{priority}</sup>}
      </span>
    );
  };
  
  return (
    <div className="table-container">
      <h3>Match Results ({filteredMatches.length} matches)</h3>
      <div className="table-wrapper">
        <table className="results-table">
          <thead>
            <tr>
              <th 
                className="sortable"
                onClick={(e) => handleSort('date', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Date {renderSortIcon('date')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('tournament', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Tournament {renderSortIcon('tournament')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('round', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Round {renderSortIcon('round')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('winner', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Winner {renderSortIcon('winner')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('loser', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Loser {renderSortIcon('loser')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('rankDiff', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Rank Diff {renderSortIcon('rankDiff')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('totalGames', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Total Games {renderSortIcon('totalGames')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('setsPlayed', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Sets {renderSortIcon('setsPlayed')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('straightSets', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Straight Sets {renderSortIcon('straightSets')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('hasTiebreak', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Tiebreak {renderSortIcon('hasTiebreak')}
              </th>
              <th 
                className="sortable"
                onClick={(e) => handleSort('upset', e)}
                title="Click to sort, Ctrl+Click to add secondary sort"
              >
                Upset {renderSortIcon('upset')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedMatches.map(match => {
              const d = derivedMap.get(match.id);
              const tournament = tournamentsMap.get(match.tournamentId);
              const winner = playersMap.get(match.winnerId);
              const loser = playersMap.get(match.loserId);
              
              // Create a date object to check for validity
              const dateObj = new Date(match.date);
              
              return (
                <tr 
                  key={match.id}
                  className={
                    playerIds.includes(match.winnerId) || playerIds.includes(match.loserId)
                      ? 'highlighted'
                      : ''
                  }
                >
                  {/* This cell is now fixed.
                    It checks if the date is invalid using isNaN(dateObj.getTime())
                    and shows 'N/A' if it is, otherwise it formats the valid date.
                  */}
                  <td>
                    {isNaN(dateObj.getTime()) 
                      ? 'N/A' 
                      : formatDate(dateObj)
                    }
                  </td>
                  
                  <td>{getTournamentDisplayName(tournament)}</td>
                  <td>{formatRound(match.round)}</td>
                  <td>{winner?.name || 'Unknown'}</td>
                  <td>{loser?.name || 'Unknown'}</td>
                  <td>{d?.rankDiff !== undefined ? formatInteger(d.rankDiff) : '-'}</td>
                  <td>{d?.totalGames ?? '-'}</td>
                  <td>{d?.setsPlayed ?? '-'}</td>
                  <td>{d?.straightSets ? '✓' : '✗'}</td>
                  <td>{d?.hasTiebreak ? '✓' : '✗'}</td>
                  <td>{d?.upset ? '✓' : '✗'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <button 
          disabled={page === 1}
          onClick={() => setPage(p => p - 1)}
        >
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button 
          disabled={page >= totalPages}
          onClick={() => setPage(p => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

