/**
 * Add Common Tournament Names Script
 * 
 * This script reads 'tournaments.json', adds a 'commonName' field
 * based on the hardcoded 'nameMap' below, and saves the result
 * back to 'tournaments.json'.
 * 
 * To maintain: Simply update the nameMap below with new tournament mappings.
 * Run: npm run add-common-names
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Tournament } from '../types';

// --- Configuration ---
const TOURNAMENTS_FILE = path.join(process.cwd(), 'public', 'data', 'tournaments.json');
// ---------------------

// --- COMMON NAME MAPPING ---
// This is the only section you need to update in the future.
// Just add new entries to this Map.
// Format: [Formal Name, Common Name]
const nameMap = new Map<string, string>([
  ['Brisbane International', 'Brisbane International'],
  ['Hong Kong Tennis Open', 'Hong Kong Open'],
  ['Adelaide International', 'Adelaide International'],
  ['ASB Classic', 'Auckland Open'],
  ['Australian Open', 'Australian Open'],
  ['Open Sud de France', 'Montpellier Open'],
  ['Dallas Open', 'Dallas Open'],
  ['ABN AMRO World Tennis Tournament', 'Rotterdam Open'],
  ['Argentina Open', 'Buenos Aires Open'],
  ['Delray Beach Open', 'Delray Beach Open'],
  ['Open 13', 'Marseille Open'],
  ['Qatar Exxon Mobil Open', 'Doha Open'],
  ['Rio Open', 'Rio Open'],
  ['Abierto Mexicano', 'Acapulco Open'],
  ['Dubai Tennis Championships', 'Dubai Open'],
  ['Chile Open', 'Santiago Open'],
  ['BNP Paribas Open', 'Indian Wells'],
  ['Miami Open', 'Miami Open'],
  ['Tiriac Open', 'Bucharest Open'],
  ["U.S. Men's Clay Court Championships", 'Houston Open'],
  ['Grand Prix Hassan II', 'Marrakech Open'],
  ['Monte Carlo Masters', 'Monte Carlo Masters'],
  ['Barcelona Open', 'Barcelona Open'],
  ['BMW Open', 'Munich Open'],
  ['Mutua Madrid Open', 'Madrid Open'],
  ["Internazionali BNL d'Italia", 'Italian Open'],
  ['Geneva Open', 'Geneva Open'],
  ['Hamburg Open', 'Hamburg Open'],
  ['French Open', 'French Open'],
  ['Stuttgart Open', 'Stuttgart Open'],
  ['Rosmalen Grass Court Championships', 'Rosmalen Open'],
  ['Halle Open', 'Halle Open'],
  ["Queen's Club Championships", "Queen's Club"],
  ['Eastbourne International', 'Eastbourne International'],
  ['Mallorca Championships', 'Mallorca Open'],
  ['Wimbledon', 'Wimbledon'],
  ['Nordea Open', 'Swedish Open'],
  ['Suisse Open Gstaad', 'Gstaad Open'],
  ['Los Cabos Open', 'Los Cabos Open'],
  ['Generali Open', 'Kitzbühel Open'],
  ['Croatia Open', 'Umag Open'],
  ['Citi Open', 'Washington Open'],
  ['Canadian Open', 'Canadian Open'],
  ['Western & Southern Financial Group Masters', 'Cincinnati Masters'],
  ['Winston-Salem Open at Wake Forest University', 'Winston-Salem Open'],
  ['US Open', 'US Open'],
  ['Chengdu Open', 'Chengdu Open'],
  ['Hangzhou Open', 'Hangzhou Open'],
  ['China Open', 'China Open'],
  ['Japan Open Tennis Championships', 'Japan Open'],
  ['Shanghai Masters', 'Shanghai Masters'],
  ['Almaty Open', 'Almaty Open'],
  ['European Open', 'Antwerp Open'],
  ['Nordic Open', 'Stockholm Open'],
  ['Swiss Indoors', 'Basel Open'],
  ['Vienna Open', 'Vienna Open'],
  ['BNP Paribas Masters', 'Paris Masters']
]);
// --- END OF MAPPING ---

/**
 * Main processing function
 */
async function addCommonNames() {
  try {
    console.log('Starting common names merge...');
    console.log(`Tournaments file: ${TOURNAMENTS_FILE}`);

    // 1. Read tournaments JSON
    if (!fs.existsSync(TOURNAMENTS_FILE)) {
      console.error(`❌ Error: File not found: ${TOURNAMENTS_FILE}`);
      console.error('Please run "npm run ingest" first to generate tournaments.json');
      process.exit(1);
    }

    const tournamentsData = fs.readFileSync(TOURNAMENTS_FILE, 'utf-8');
    const tournaments: Tournament[] = JSON.parse(tournamentsData);
    console.log(`✓ Loaded ${tournaments.length} tournaments from tournaments.json`);
    console.log(`✓ Using ${nameMap.size} common names from the built-in map\n`);

    // 2. Merge data
    let updatedCount = 0;
    let skippedCount = 0;
    const updatedTournaments = tournaments.map(tournament => {
      const formalName = tournament.name;

      if (nameMap.has(formalName)) {
        updatedCount++;
        // Create a new object with the commonName added
        return {
          ...tournament,
          commonName: nameMap.get(formalName)!
        };
      }

      // If no match, return the original tournament object (or remove commonName if it exists)
      skippedCount++;
      const { commonName: _, ...rest } = tournament as Tournament & { commonName?: string };
      return rest;
    });

    // 3. Write back to the same file
    fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(updatedTournaments, null, 2));

    console.log('✅ Success!');
    console.log(`✓ Added/Updated common names for ${updatedCount} tournaments`);
    console.log(`✓ ${skippedCount} tournaments without mappings (kept original names)`);
    console.log(`✓ Updated file: ${TOURNAMENTS_FILE}\n`);

    // Show some examples
    if (updatedCount > 0) {
      console.log('Examples of updated tournaments:');
      updatedTournaments
        .filter(t => 'commonName' in t && t.commonName)
        .slice(0, 5)
        .forEach(t => {
          const tournament = t as Tournament & { commonName: string };
          console.log(`  "${tournament.name}" → "${tournament.commonName}"`);
        });
    }
  } catch (error) {
    console.error('❌ Error during merge process:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the script
addCommonNames().catch(console.error);

