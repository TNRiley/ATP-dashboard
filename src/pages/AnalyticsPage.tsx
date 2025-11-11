/**
 * Main Analytics Page
 * Filters on top, plots below
 */

import { useState, useEffect } from 'react';
import { SurfaceFilter } from '../components/filters/SurfaceFilter';
import { SeriesFilter } from '../components/filters/SeriesFilter';
import { RoundFilter } from '../components/filters/RoundFilter';
import { PlayerFilter } from '../components/filters/PlayerFilter';
import { CompetitivenessBeeswarm } from '../components/insights/CompetitivenessBeeswarm';
import { UpsetDensityByRound } from '../components/insights/UpsetDensityByRound';
import { ResultsTable } from '../components/insights/ResultsTable';
import { PlayerSurfaceProfile } from '../components/insights/PlayerSurfaceProfile';
import { useStore } from '../state/store';
import type { Match, Derived, Tournament, Player } from '../types';

export function AnalyticsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [derived, setDerived] = useState<Derived[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const { clearFilters, surface, series } = useStore();
  
  useEffect(() => {
    // Load data from consolidated JSON files (includes all years)
    Promise.all([
      fetch('/data/players.json').then(r => r.json()),
      fetch('/data/tournaments.json').then(r => r.json()),
      fetch('/data/matches.json').then(r => r.json()),
      fetch('/data/derived.json').then(r => r.json())
    ])
      .then(([playersData, tournamentsData, matchesData, derivedData]) => {
        setPlayers(playersData);
        setTournaments(tournamentsData);
        setMatches(matchesData);
        setDerived(derivedData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">Loading ATP match data...</div>
      </div>
    );
  }
  
  return (
    <div className="analytics-page">
      <div className="filters-section">
        <div className="filters-header">
          <h2>Filters</h2>
          <button onClick={clearFilters} className="clear-button">
            Clear Filters
          </button>
        </div>
        <div className="filters-grid">
          <SurfaceFilter />
          <SeriesFilter />
          <RoundFilter />
          <PlayerFilter players={players} />
        </div>
      </div>
      
      <div className="insights-section">
        <CompetitivenessBeeswarm 
          matches={matches}
          derived={derived}
          players={players}
          tournaments={tournaments}
          surface={surface}
          series={series}
        />
        
        <UpsetDensityByRound 
          matches={matches}
          derived={derived}
        />
        
        <PlayerSurfaceProfile 
          matches={matches}
          tournaments={tournaments}
          players={players}
        />
        
        <ResultsTable 
          matches={matches}
          derived={derived}
          tournaments={tournaments}
          players={players}
        />
      </div>
    </div>
  );
}

