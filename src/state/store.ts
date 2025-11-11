/**
 * Global state management using Zustand
 * Handles filters and URL synchronization
 */

import { create } from 'zustand';
import type { Surface, Series, Round } from '../types';

export interface FilterState {
  // Filter values
  surface: Surface | null;
  series: Series | null;
  tournamentId: string | null;
  rounds: Round[];
  dateRange: [string, string] | null; // [startDate, endDate] in ISO format
  playerIds: string[]; // Pinned players (max 3)
  
  // Actions
  setSurface: (surface: Surface | null) => void;
  setSeries: (series: Series | null) => void;
  setTournamentId: (tournamentId: string | null) => void;
  setRounds: (rounds: Round[]) => void;
  toggleRound: (round: Round) => void;
  setDateRange: (range: [string, string] | null) => void;
  setPlayerIds: (playerIds: string[]) => void;
  togglePlayer: (playerId: string) => void;
  clearFilters: () => void;
  
  // URL sync helpers
  syncToURL: () => void;
  loadFromURL: () => void;
}

const initialState = {
  surface: null,
  series: null,
  tournamentId: null,
  rounds: [],
  dateRange: null,
  playerIds: []
};

export const useStore = create<FilterState>((set, get) => ({
  ...initialState,
  
  setSurface: (surface) => set({ surface }),
  
  setSeries: (series) => set({ series }),
  
  setTournamentId: (tournamentId) => set({ tournamentId }),
  
  setRounds: (rounds) => set({ rounds }),
  
  toggleRound: (round) => {
    const { rounds } = get();
    const newRounds = rounds.includes(round)
      ? rounds.filter(r => r !== round)
      : [...rounds, round];
    set({ rounds: newRounds });
  },
  
  setDateRange: (dateRange) => set({ dateRange }),
  
  setPlayerIds: (playerIds) => {
    // Limit to 3 pinned players
    const limited = playerIds.slice(0, 3);
    set({ playerIds: limited });
  },
  
  togglePlayer: (playerId) => {
    const { playerIds } = get();
    const newPlayerIds = playerIds.includes(playerId)
      ? playerIds.filter(id => id !== playerId)
      : [...playerIds, playerId].slice(0, 3); // Max 3
    set({ playerIds: newPlayerIds });
  },
  
  clearFilters: () => set(initialState),
  
  syncToURL: () => {
    const state = get();
    const params = new URLSearchParams();
    
    if (state.surface) params.set('surface', state.surface);
    if (state.series) params.set('series', state.series);
    if (state.tournamentId) params.set('tournament', state.tournamentId);
    if (state.rounds.length > 0) params.set('rounds', state.rounds.join(','));
    if (state.dateRange) {
      params.set('startDate', state.dateRange[0]);
      params.set('endDate', state.dateRange[1]);
    }
    if (state.playerIds.length > 0) params.set('players', state.playerIds.join(','));
    
    const newURL = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newURL);
  },
  
  loadFromURL: () => {
    const params = new URLSearchParams(window.location.search);
    const surface = params.get('surface') as Surface | null;
    const series = params.get('series') as Series | null;
    const tournamentId = params.get('tournament');
    const roundsStr = params.get('rounds');
    const startDate = params.get('startDate');
    const endDate = params.get('endDate');
    const playersStr = params.get('players');
    
    set({
      surface: surface && ['Hard', 'Clay', 'Grass', 'Carpet'].includes(surface) ? surface : null,
      series: series && ['Grand Slam', 'Masters', 'ATP500', 'ATP250'].includes(series) ? series : null,
      tournamentId: tournamentId || null,
      rounds: roundsStr ? roundsStr.split(',') as Round[] : [],
      dateRange: startDate && endDate ? [startDate, endDate] : null,
      playerIds: playersStr ? playersStr.split(',') : []
    });
  }
}));

// Initialize from URL on load and set up sync
if (typeof window !== 'undefined') {
  // Load initial state from URL
  useStore.getState().loadFromURL();
  
  // Sync to URL whenever state changes (but not on initial load)
  let isInitialLoad = true;
  useStore.subscribe(() => {
    if (!isInitialLoad) {
      useStore.getState().syncToURL();
    }
    isInitialLoad = false;
  });
}

