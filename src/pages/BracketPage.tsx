/**
 * Tournament Bracket Page
 */

import { useState, useEffect, useMemo } from 'react';
import { TournamentBracket } from '../components/insights/TournamentBracket';
import { getTournamentDisplayName } from '../utils/tournamentNames';
import type { Tournament, BracketNode, Series } from '../types';

export function BracketPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [bracketData, setBracketData] = useState<BracketNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [bracketLoading, setBracketLoading] = useState(false);

  // Load tournaments
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/tournaments.json`)
      .then(r => r.json())
      .then(data => {
        setTournaments(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading tournaments:', err);
        setLoading(false);
      });
  }, []);

  // Get available years
  const availableYears = useMemo(() => {
    const years = new Set(tournaments.map(t => t.year));
    return Array.from(years).sort((a, b) => b - a); // Descending order
  }, [tournaments]);

  // Get tournaments for selected year, sorted by level then name
  const tournamentsForYear = useMemo(() => {
    if (!selectedYear) return [];
    
    const filtered = tournaments.filter(t => t.year === selectedYear);
    
    // Sort by series level (Grand Slam > Masters > ATP500 > ATP250), then by name
    const seriesOrder: Record<Series, number> = {
      'Grand Slam': 1,
      'Masters': 2,
      'ATP500': 3,
      'ATP250': 4
    };

    return filtered.sort((a, b) => {
      const seriesDiff = seriesOrder[a.series] - seriesOrder[b.series];
      if (seriesDiff !== 0) return seriesDiff;
      return getTournamentDisplayName(a).localeCompare(getTournamentDisplayName(b));
    });
  }, [tournaments, selectedYear]);

  // Load bracket data when tournament is selected
  useEffect(() => {
    if (!selectedTournamentId) {
      setBracketData(null);
      return;
    }

    setBracketLoading(true);
    fetch(`${import.meta.env.BASE_URL}data/brackets/${selectedTournamentId}.json`)
      .then(r => {
        if (!r.ok) {
          throw new Error('Bracket not found');
        }
        return r.json();
      })
      .then(data => {
        setBracketData(data);
        setBracketLoading(false);
      })
      .catch(err => {
        console.error('Error loading bracket:', err);
        setBracketData(null);
        setBracketLoading(false);
      });
  }, [selectedTournamentId]);

  // Reset tournament selection when year changes
  useEffect(() => {
    setSelectedTournamentId('');
    setBracketData(null);
  }, [selectedYear]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">Loading tournaments...</div>
      </div>
    );
  }

  const selectedTournament = tournaments.find(t => t.id === selectedTournamentId);

  return (
    <div className="bracket-page">
      <div className="bracket-filters">
        <div className="filter-control">
          <label htmlFor="year-select">Year:</label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value ? parseInt(e.target.value) : '')}
            className="filter-select"
          >
            <option value="">Select Year</option>
            {availableYears.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-control">
          <label htmlFor="tournament-select">Tournament:</label>
          <select
            id="tournament-select"
            value={selectedTournamentId}
            onChange={e => setSelectedTournamentId(e.target.value)}
            className="filter-select"
            disabled={!selectedYear}
          >
            <option value="">Select Tournament</option>
            {tournamentsForYear.map(tournament => (
              <option key={tournament.id} value={tournament.id}>
                {getTournamentDisplayName(tournament)} ({tournament.series})
              </option>
            ))}
          </select>
        </div>

        {selectedTournament && (
          <div className="tournament-info">
            <h3>{getTournamentDisplayName(selectedTournament)}</h3>
            <p>
              {selectedTournament.year} • {selectedTournament.series} • {selectedTournament.surface} • {selectedTournament.location}
            </p>
          </div>
        )}
      </div>

      <div className="bracket-container" style={{ 
        height: 'calc(100vh - 280px)', 
        minHeight: '600px',
        width: '100%' // Ensure full width
      }}>
        {bracketLoading ? (
          <div className="app-loading">
            <div className="loading-spinner">Loading bracket...</div>
          </div>
        ) : (
          <TournamentBracket bracketData={bracketData} />
        )}
      </div>
    </div>
  );
}

