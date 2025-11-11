# Tournament Common Names Script

## Overview

The `addCommonNames.ts` script adds user-friendly common names to tournaments (e.g., "Indian Wells" instead of "BNP Paribas Open"). These common names are then used throughout the app for better readability.

## Usage

After running the main ingest script, run:

```bash
npm run add-common-names
```

This will:
1. Read `public/data/tournaments.json`
2. Match tournament names against the built-in mapping
3. Add `commonName` fields to matching tournaments
4. Save the updated file back to `public/data/tournaments.json`

## Maintaining the Name Map

To add or update tournament name mappings:

1. Open `src/scripts/addCommonNames.ts`
2. Find the `nameMap` constant (around line 20)
3. Add new entries in the format: `['Formal Name', 'Common Name']`

Example:
```typescript
const nameMap = new Map<string, string>([
  ['BNP Paribas Open', 'Indian Wells'],
  ['New Tournament Name', 'Short Name'],
  // ... more entries
]);
```

4. Save the file and run `npm run add-common-names` again

## How It Works in the App

The app uses a utility function `getTournamentDisplayName()` that:
- Returns `commonName` if available
- Falls back to `name` if no common name exists

This ensures the app always displays the best available name without breaking if a tournament doesn't have a mapping.

## Workflow

1. Run `npm run ingest` to process CSV files
2. Run `npm run add-common-names` to add common names
3. The app will automatically use common names where available

