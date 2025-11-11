/**
 * Type definitions for ATP Match Analytics
 */

export type Round = "1R" | "2R" | "3R" | "4R" | "QF" | "SF" | "F" | "RR" | "Q1" | "Q2" | "Q3";

export interface Player {
  id: string;
  name: string;
  aliases?: string[];
}

export type Series = "Grand Slam" | "Masters" | "ATP500" | "ATP250";
export type Court = "Indoor" | "Outdoor";
export type Surface = "Hard" | "Clay" | "Grass" | "Carpet";

export interface Tournament {
  id: string;
  year: number;
  name: string;
  commonName?: string; // Common/shortened name for display (e.g., "Indian Wells" instead of "BNP Paribas Open")
  location: string;
  series: Series;
  court: Court;
  surface: Surface;
}

export interface Match {
  id: string;
  tournamentId: string;
  date: string; // ISO date string
  round: Round;
  bestOf: 3 | 5;
  winnerId: string;
  loserId: string;
  wRank?: number;
  lRank?: number;
  wPts?: number;
  lPts?: number;
  w: number[]; // Games won per set [W1, W2, W3, W4, W5]
  l: number[]; // Games lost per set [L1, L2, L3, L4, L5]
  wsets: number;
  lsets: number;
  comment?: string;
}

export interface Derived {
  matchId: string;
  rankDiff?: number; // wRank - lRank (positive = higher rank difference)
  ptsDiff?: number; // wPts - lPts
  totalGames?: number; // Sum of all games played
  setsPlayed: number; // wsets + lsets
  straightSets: boolean; // Winner won in straight sets
  hasTiebreak: boolean; // Any set went to 7-6 or similar tiebreak
  upset?: boolean; // Lower ranked player won (lRank < wRank if both exist)
}

/**
 * Defines the structure for a D3-compatible hierarchy node.
 * Each node represents a single match for the bracket.
 */
export interface BracketNode {
  // 'name' is a primary display string, e.g., for D3 labels
  name: string; 
  
  // Custom data we want to store on the node
  attributes: {
    round: Round;
    winnerName: string;
    loserName: string;
    score: string;
  };
  
  // The children nodes (the two matches that fed into this one)
  children: BracketNode[];
}