/**
 * Tournament Name Utilities
 * Helper functions for displaying tournament names
 */

import type { Tournament } from '../types';

/**
 * Get the display name for a tournament
 * Returns commonName if available, otherwise falls back to name
 */
export function getTournamentDisplayName(tournament: Tournament | undefined | null): string {
  if (!tournament) return 'Unknown';
  return tournament.commonName || tournament.name;
}

