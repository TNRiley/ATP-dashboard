/**
 * Head-to-Head Records Page
 */

import { useState, useEffect } from 'react';
import { HeadToHeadChart } from '../components/insights/HeadToHeadChart';
import { StackedRadialBarChart } from '../components/insights/StackedRadialBarChart.tsx';
import type { Match, Tournament, Player } from '../types';

export function HeadToHeadPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load data from consolidated JSON files (includes all years)
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/players.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/tournaments.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/matches.json`).then(r => r.json())
    ])
      .then(([playersData, tournamentsData, matchesData]) => {
        setPlayers(playersData);
        setTournaments(tournamentsData);
        setMatches(matchesData);
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
    <div className="head-to-head-page">
      <HeadToHeadChart matches={matches} tournaments={tournaments} players={players} />
      <StackedRadialBarChart matches={matches} tournaments={tournaments} players={players} />
    </div>
  );
}

