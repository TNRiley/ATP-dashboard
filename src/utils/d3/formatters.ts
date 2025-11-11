/**
 * D3 formatting utilities
 */

import { format } from 'd3-format';
import { timeFormat, timeParse } from 'd3-time-format';

export const formatNumber = format(',');
export const formatDecimal = format('.2f');
export const formatPercent = format('.1%');
export const formatInteger = format('d');

export const formatDate = timeFormat('%Y-%m-%d');
export const parseDate = timeParse('%Y-%m-%d');
export const formatDateShort = timeFormat('%b %d');
export const formatDateLong = timeFormat('%B %d, %Y');

export function formatRound(round: string): string {
  const roundMap: Record<string, string> = {
    '1R': '1st Round',
    '2R': '2nd Round',
    '3R': '3rd Round',
    '4R': '4th Round',
    'QF': 'Quarterfinals',
    'SF': 'Semifinals',
    'F': 'Final',
    'RR': 'Round Robin',
    'Q1': 'Qualifying 1',
    'Q2': 'Qualifying 2',
    'Q3': 'Qualifying 3'
  };
  return roundMap[round] || round;
}

export function formatPlayerName(name: string, maxLength: number = 20): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

