/**
 * Data ingestion pipeline for all ATP year CSVs
 * Processes all CSVs, normalizes data, creates IDs, and outputs
 * consolidated JSON files and tournament brackets.
 */

import * as fs from 'fs';
import * as path from 'path';
import { csvParse } from 'd3-dsv';
// Import the new BracketNode type along with the existing types
import type {
  Player,
  Tournament,
  Match,
  Derived,
  Round,
  Series,
  Court,
  Surface,
  BracketNode, // <-- NEW IMPORT
} from '../types';

// CSV row interface (assuming it's the same for all files)
interface CSVRow {
  ATP: string;
  Location: string;
  Tournament: string;
  Date: string;
  Series: string;
  Court: string;
  Surface: string;
  Round: string;
  'Best of': string;
  Winner: string;
  Loser: string;
  WRank: string;
  LRank: string;
  WPts: string;
  LPts: string;
  W1: string;
  L1: string;
  W2: string;
  L2: string;
  W3: string;
  L3: string;
  W4: string;
  L4: string;
  W5: string;
  L5: string;
  Wsets: string;
  Lsets: string;
  Comment: string;
  // Adding betting odds fields just in case, based on your CSV structure
  B365W?: string;
  B365L?: string;
  PSW?: string;
  PSL?: string;
  MaxW?: string;
  MaxL?: string;
  AvgW?: string;
  AvgL?: string;
  BFEW?: string;
  BFEL?: string;
}

// --- Utility Functions ---

function normalizeValue(value: string | undefined | null): string | null {
  if (!value || value.trim() === '' || value.trim().toUpperCase() === 'N/A') {
    return null;
  }
  return value.trim();
}

function normalizeNumber(value: string | undefined | null): number | null {
  const normalized = normalizeValue(value);
  if (normalized === null) return null;
  const num = Number(normalized);
  return isNaN(num) ? null : num;
}

function parseDate(dateStr: string): string {
  // Dates are in MM/DD/YYYY format from the sample
  const normalized = normalizeValue(dateStr);
  if (!normalized) return '';

  // Handle YYYY-MM-DD format (if it exists elsewhere)
  if (normalized.includes('-')) {
    const [y, m, d] = normalized.split('-');
    if (y.length === 4) {
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  }
  
  // Handle MM/DD/YYYY format
  const parts = normalized.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    // Ensure year is 4 digits
    const fullYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  console.warn(`Could not parse date: ${dateStr}`);
  return ''; // Return empty for invalid dates
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\./g, '') // Remove periods (e.g., from player initials)
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

function createPlayerID(name: string, existingIDs: Map<string, number>): string {
  const base = slugify(name);
  if (!existingIDs.has(base)) {
    existingIDs.set(base, 0);
    return base;
  }
  const count = existingIDs.get(base)! + 1;
  existingIDs.set(base, count);
  return `${base}-${count}`;
}

function createTournamentID(year: number, tournament: string, location: string): string {
  // Simple hash function
  const str = `${year}-${tournament}-${location}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `t${Math.abs(hash)}`;
}

function createMatchID(
  tournamentId: string,
  date: string,
  round: string,
  winnerId: string,
  loserId: string
): string {
  const str = `${tournamentId}-${date}-${round}-${winnerId}-${loserId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `m${Math.abs(hash)}`;
}

function normalizeRound(round: string): Round {
  const normalized = (round || '').toLowerCase().trim();
  if (normalized.includes('1st round') || normalized === '1r') return '1R';
  if (normalized.includes('2nd round') || normalized === '2r') return '2R';
  if (normalized.includes('3rd round') || normalized === '3r') return '3R';
  if (normalized.includes('4th round') || normalized === '4r') return '4R';
  if (normalized.includes('quarterfinal') || normalized === 'qf') return 'QF';
  if (normalized.includes('semifinal') || normalized === 'sf') return 'SF';
  if (normalized.includes('the final') || (normalized.includes('final') && !normalized.includes('semifinal'))) return 'F';
  if (normalized.includes('round robin') || normalized === 'rr') return 'RR';
  if (normalized === 'q1' || normalized.includes('qualifying 1')) return 'Q1';
  if (normalized === 'q2' || normalized.includes('qualifying 2')) return 'Q2';
  if (normalized === 'q3' || normalized.includes('qualifying 3')) return 'Q3';
  console.warn(`Unknown round type: ${round}. Defaulting to 1R.`);
  return '1R'; // Default fallback
}

function normalizeSeries(series: string): Series {
  const normalized = (series || '').toUpperCase().trim();
  if (normalized.includes('GRAND SLAM')) return 'Grand Slam';
  if (normalized.includes('MASTERS')) return 'Masters';
  if (normalized.includes('ATP500')) return 'ATP500';
  if (normalized.includes('ATP250')) return 'ATP250';
  // Fallback for empty/unknown series
  return 'ATP250'; 
}

function normalizeCourt(court: string): Court {
  const normalized = (court || '').toUpperCase().trim();
  return normalized.includes('INDOOR') ? 'Indoor' : 'Outdoor';
}

function normalizeSurface(surface: string): Surface {
  const normalized = (surface || '').toUpperCase().trim();
  if (normalized.includes('HARD')) return 'Hard';
  if (normalized.includes('CLAY')) return 'Clay';
  if (normalized.includes('GRASS')) return 'Grass';
  if (normalized.includes('CARPET')) return 'Carpet';
  // Default fallback for empty/unknown surface
  return 'Hard'; 
}

function computeDerived(match: Match): Derived {
  const rankDiff = match.wRank && match.lRank ? match.wRank - match.lRank : null;
  const ptsDiff = match.wPts && match.lPts ? match.wPts - match.lPts : null;
  
  const totalGames = match.w.reduce((sum, w, i) => {
    const l = match.l[i] || 0;
    return sum + w + l;
  }, 0);
  
  const setsPlayed = match.wsets + match.lsets;
  const straightSets = match.lsets === 0;
  
  const hasTiebreak = match.w.some((w, i) => {
    const l = match.l[i] || 0;
    // Check for 7-6, 6-7, 7-5, 5-7 or any score involving 7.
    return (w === 7 && l >= 5) || (l === 7 && w >= 5);
  });
  
  const upset = match.wRank && match.lRank ? match.lRank < match.wRank : undefined;
  
  return {
    matchId: match.id,
    rankDiff: rankDiff ?? undefined,
    ptsDiff: ptsDiff ?? undefined,
    totalGames: totalGames > 0 ? totalGames : undefined,
    setsPlayed,
    straightSets,
    hasTiebreak,
    upset
  };
}

// --- NEW BRACKET GENERATION ---

/**
 * A map to define the tournament progression.
 * Key: The current round, Value: The round that feeds into it.
 */
const roundPrecedence: Partial<Record<Round, Round>> = {
  F: 'SF',
  SF: 'QF',
  QF: '4R',
  '4R': '3R',
  '3R': '2R',
  '2R': '1R',
  '1R': 'Q3', // Example if you include qualifiers
  Q3: 'Q2',
  Q2: 'Q1',
  // RR (Round Robin) does not fit this hierarchy and is skipped.
};

/**
 * Helper to format the match score from the 'w' and 'l' arrays.
 */
function formatScore(w: number[], l: number[], comment?: string): string {
  if (comment === 'Retired') {
    return w.map((wScore, i) => `${wScore}-${l[i]}`).join(' ') + ' (RET)';
  }
  return w.map((wScore, i) => `${wScore}-${l[i]}`).join(' ');
}

/**
 * The core recursive function.
 * Starts with a match (e.g., the Final) and finds the two
 * matches that fed into it (e.g., the two Semifinals).
 */
function findChildrenForMatch(
  currentMatch: Match,
  allTournamentMatches: Match[],
  playerMap: Map<string, Player>
): BracketNode {
  const winnerName = playerMap.get(currentMatch.winnerId)?.name || 'Unknown';
  const loserName = playerMap.get(currentMatch.loserId)?.name || 'Unknown';
  
  // 1. Determine the round we're looking for (the "child" round)
  const childRound = roundPrecedence[currentMatch.round];

  // 2. Base Case: If there's no preceding round (e.g., 1R or Q1), we stop.
  if (!childRound) {
    return {
      name: `${winnerName} d. ${loserName}`,
      attributes: {
        round: currentMatch.round,
        winnerName,
        loserName,
        score: formatScore(currentMatch.w, currentMatch.l, currentMatch.comment),
      },
      children: [],
    };
  }

  // 3. Find the two matches that fed into this one.
  
  // Find the winner's previous match
  const winnerPrevMatch = allTournamentMatches.find(
    (m) => m.round === childRound && m.winnerId === currentMatch.winnerId
  );
  
  // Find the loser's previous match
  const loserPrevMatch = allTournamentMatches.find(
    (m) => m.round === childRound && m.winnerId === currentMatch.loserId
  );

  // 4. Recursion: Call this function for the matches we just found.
  
  // Create the "winner's side" child node
  const child1 = winnerPrevMatch
    ? findChildrenForMatch(winnerPrevMatch, allTournamentMatches, playerMap)
    : {
        name: winnerName, // Show the player who got a BYE
        attributes: { round: childRound, winnerName: winnerName, loserName: 'BYE', score: 'BYE' },
        children: [],
      };
      
  // Create the "loser's side" child node
  const child2 = loserPrevMatch
    ? findChildrenForMatch(loserPrevMatch, allTournamentMatches, playerMap)
    : {
        name: loserName, // Show the player who got a BYE
        attributes: { round: childRound, winnerName: loserName, loserName: 'BYE', score: 'BYE' },
        children: [],
      };

  // 5. Return the current node with its new children
  return {
    name: `${winnerName} d. ${loserName}`,
    attributes: {
      round: currentMatch.round,
      winnerName,
      loserName,
      score: formatScore(currentMatch.w, currentMatch.l, currentMatch.comment),
    },
    // The winner's match is conventionally on top
    children: [child1, child2], 
  };
}

/**
 * Orchestrator function to generate all bracket JSON files.
 * This is the function you'll call from ingest().
 */
export function generateBracketData(
  allMatches: Match[],
  allPlayers: Player[],
  allTournaments: Tournament[]
) {
  console.log('\nGenerating bracket data...');
  const bracketDir = path.join(process.cwd(), 'public', 'data', 'brackets');
  if (!fs.existsSync(bracketDir)) {
    fs.mkdirSync(bracketDir, { recursive: true });
  }

  // Create a Map of player IDs for fast lookups
  const playerMap = new Map<string, Player>(allPlayers.map((p) => [p.id, p]));
  let bracketsGenerated = 0;

  for (const tournament of allTournaments) {
    // 1. Get all matches for this specific tournament
    const tournamentMatches = allMatches.filter(
      (m) => m.tournamentId === tournament.id
    );
    if (tournamentMatches.length === 0) continue;

    // 2. Find the Final match to start the tree
    const finalMatch = tournamentMatches.find((m) => m.round === 'F');
    
    if (!finalMatch) {
      // Don't warn for Round Robin tournaments, it's expected
      if (!tournamentMatches.some(m => m.round === 'RR')) {
        console.warn(`  - No Final found for ${tournament.name}, skipping bracket.`);
      }
      continue;
    }

    // 3. Build the recursive tree
    const bracketTree = findChildrenForMatch(
      finalMatch,
      tournamentMatches,
      playerMap
    );

    // 4. Write the final JSON file
    fs.writeFileSync(
      path.join(bracketDir, `${tournament.id}.json`),
      JSON.stringify(bracketTree, null, 2)
    );
    bracketsGenerated++;
  }
  
  console.log(`Successfully generated ${bracketsGenerated} bracket files.`);
}

// --- END NEW BRACKET GENERATION ---


// --- Main Ingestion Function ---

async function ingest() {
  console.log('Starting consolidated data ingestion...');
  
  // --- 1. Define CONSOLIDATED data structures (outside the loop) ---
  const playersMap = new Map<string, Player>();
  const playerIDs = new Map<string, number>(); // Track duplicates
  const tournamentsMap = new Map<string, Tournament>();
  const allMatches: Match[] = [];
  const allDerived: Derived[] = [];

  // --- 2. Find all CSV files ---
  const rootDir = process.cwd();
  // Find files that match the pattern "2024.csv", "2025.csv", etc.
  // Updated regex to handle potential prefixes or different names, as long as it *ends* with 4 digits.
  // Let's stick to the original, safer regex:
  const csvFiles = fs.readdirSync(rootDir).filter(file => 
    file.endsWith('.csv') && /^\d{4}\.csv$/.test(file)
  );

  if (csvFiles.length === 0) {
    console.error('No year CSV files (e.g., 2024.csv) found in the root directory.');
    // Check for common issues
    if (fs.existsSync('atp_matches_2024.csv')) {
         console.error('Hint: Found "atp_matches_2024.csv". The script expects "2024.csv". Please rename your files.');
    }
    return;
  }

  console.log(`Found CSV files to process: ${csvFiles.join(', ')}`);

  // --- 3. Loop through each file ---
  for (const csvFile of csvFiles) {
    console.log(`\n--- Processing ${csvFile} ---`);
    const csvPath = path.join(rootDir, csvFile);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Use d3-dsv to parse
    const rows = csvParse(csvContent) as unknown as CSVRow[];
    
    console.log(`Loaded ${rows.length} rows from ${csvFile}`);
    
    let rowsProcessed = 0;

    // --- 4. Process each row (using the SHARED maps) ---
    for (const row of rows) {
      if (!row.Tournament || !row.Winner || !row.Loser || !row.Date) {
        // console.warn('Skipping row with missing essential data:', row);
        continue;
      }
      
      const date = parseDate(row.Date);
      if (!date) {
        // console.warn('Skipping row with invalid date:', row.Date);
        continue; // Skip rows with invalid dates
      }

      const year = parseInt(date.substring(0, 4));
      const round = normalizeRound(row.Round);
      const bestOf = normalizeNumber(row['Best of']) === 5 ? 5 : 3;
      
      const winnerName = normalizeValue(row.Winner);
      const loserName = normalizeValue(row.Loser);
      if (!winnerName || !loserName) continue; // Should be caught by first check, but good safety

      // Create/get player IDs (uses shared playersMap)
      if (!playersMap.has(winnerName)) {
        const winnerId = createPlayerID(winnerName, playerIDs);
        playersMap.set(winnerName, { id: winnerId, name: winnerName });
      }
      if (!playersMap.has(loserName)) {
        const loserId = createPlayerID(loserName, playerIDs);
        playersMap.set(loserName, { id: loserId, name: loserName });
      }
      
      const winner = playersMap.get(winnerName)!;
      const loser = playersMap.get(loserName)!;
      
      // Create/get tournament ID (uses shared tournamentsMap)
      const tournamentName = normalizeValue(row.Tournament) || 'Unknown Tournament';
      const location = normalizeValue(row.Location) || 'Unknown Location';
      const tournamentKey = `${year}-${tournamentName}-${location}`;
      
      if (!tournamentsMap.has(tournamentKey)) {
        const tournamentId = createTournamentID(year, tournamentName, location);
        tournamentsMap.set(tournamentKey, {
          id: tournamentId,
          year,
          name: tournamentName,
          location,
          series: normalizeSeries(row.Series),
          court: normalizeCourt(row.Court),
          surface: normalizeSurface(row.Surface)
        });
      }
      
      const tournament = tournamentsMap.get(tournamentKey)!;
      
      // Create match ID
      const matchId = createMatchID(
        tournament.id,
        date,
        round,
        winner.id,
        loser.id
      );
      
      const w: number[] = [];
      const l: number[] = [];
      for (let i = 1; i <= 5; i++) {
        const wScore = normalizeNumber(row[`W${i}` as keyof CSVRow]);
        const lScore = normalizeNumber(row[`L${i}` as keyof CSVRow]);
        // Only push if both scores are present
        if (wScore !== null && lScore !== null) {
          w.push(wScore);
          l.push(lScore);
        } else if (wScore !== null || lScore !== null) {
          // Handle partial scores (e.g., retirement)
          w.push(wScore ?? 0);
          l.push(lScore ?? 0);
        } else {
          // Stop if we hit empty sets
          break;
        }
      }
      
      // Handle cases where sets are 0-0 but comment is 'Retired'
      const wsets = normalizeNumber(row.Wsets);
      const lsets = normalizeNumber(row.Lsets);
      const comment = normalizeValue(row.Comment);

      // Skip match if no sets were played and it wasn't a walkover/retirement
      if (w.length === 0 && (wsets === 0 && lsets === 0) && comment !== 'Retired' && comment !== 'Walkover') {
        // console.log('Skipping match with no score data:', row);
        continue;
      }
      
      const match: Match = {
        id: matchId,
        tournamentId: tournament.id,
        date,
        round,
        bestOf,
        winnerId: winner.id,
        loserId: loser.id,
        wRank: normalizeNumber(row.WRank) ?? undefined,
        lRank: normalizeNumber(row.LRank) ?? undefined,
        wPts: normalizeNumber(row.WPts) ?? undefined,
        lPts: normalizeNumber(row.LPts) ?? undefined,
        w,
        l,
        wsets: wsets ?? 0,
        lsets: lsets ?? 0,
        comment: comment ?? undefined
      };
      
      // Add to SHARED allMatches array
      allMatches.push(match);
      
      // Compute derived and add to SHARED allDerived array
      const derivedMatch = computeDerived(match);
      allDerived.push(derivedMatch);
      rowsProcessed++;
    }
    console.log(`Successfully processed ${rowsProcessed} rows from ${csvFile}`);
  } // --- End of file loop ---
  
  // --- 5. Convert consolidated maps to arrays (AFTER loop) ---
  const players = Array.from(playersMap.values());
  const tournaments = Array.from(tournamentsMap.values());
  
  console.log('\n--- Totals ---');
  console.log(`Processed ${players.length} unique players`);
  console.log(`Processed ${tournaments.length} unique tournaments`);
  console.log(`Processed ${allMatches.length} total matches`);
  
  // --- 6. Create output directory ---
  const outputDir = path.join(process.cwd(), 'public', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // --- 7. Write SINGLE, CONSOLIDATED JSON files ---
  fs.writeFileSync(
    path.join(outputDir, 'players.json'),
    JSON.stringify(players, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outputDir, 'tournaments.json'),
    JSON.stringify(tournaments, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outputDir, 'matches.json'),
    JSON.stringify(allMatches, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outputDir, 'derived.json'),
    JSON.stringify(allDerived, null, 2)
  );
  
  // --- 8. NEW STEP: Generate Bracket Data ---
  generateBracketData(allMatches, players, tournaments);
  // -------------------------------------------
  
  console.log('\nConsolidated data ingestion complete!');
  console.log(`Output files written to ${outputDir} and ${path.join(outputDir, 'brackets')}`);
}

// Run ingestion
ingest().catch(console.error);