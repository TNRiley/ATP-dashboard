# ATP 2025 Match Analytics Dashboard

A production-ready React + TypeScript + D3 application for analyzing ATP 2025 singles match data.

## Features

- **Competitiveness Beeswarm**: Visualize rank differences by round
- **Upset Density by Round**: Stacked bars showing upset percentages
- **Results Table**: Interactive, sortable table with derived metrics
- **Player Surface Profile**: Win rates by surface for pinned players
- **Advanced Filtering**: Filter by surface, series, round, date range, and players
- **URL State Sync**: Share filtered views via URL
- **Keyboard Shortcuts**: Quick navigation and filter management

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Process the CSV data:
```bash
npm run ingest
```

This will read `2025.csv` and generate JSON files in `public/data/`:
- `players-2025.json`
- `tournaments-2025.json`
- `matches-2025.json`
- `derived-2025.json`

3. Start the development server:
```bash
npm run dev
```

The app will open at `http://localhost:3000`

## Project Structure

```
├── src/
│   ├── types.ts              # TypeScript type definitions
│   ├── data/
│   │   └── ingest.ts        # CSV processing pipeline
│   ├── state/
│   │   └── store.ts         # Zustand state management
│   ├── components/
│   │   ├── filters/         # Filter components
│   │   └── insights/        # D3 visualization components
│   ├── utils/
│   │   └── d3/              # D3 utilities (scales, layouts, formatters, tooltips)
│   ├── styles/
│   │   └── index.css        # Main stylesheet
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── public/
│   └── data/                # Generated JSON data files
└── 2025.csv                 # Source CSV data
```

## Data Pipeline

The ingestion script (`src/data/ingest.ts`):
1. Loads and parses the CSV file
2. Normalizes values (blanks/N/A → null)
3. Creates unique IDs:
   - **PlayerID**: slugified name with numeric suffix for duplicates
   - **TournamentID**: hash of Year + Tournament + Location
   - **MatchID**: hash of TournamentID + Date + Round + WinnerID + LoserID
4. Computes derived metrics (rankDiff, totalGames, setsPlayed, etc.)
5. Outputs normalized JSON files

## Keyboard Shortcuts

- `Ctrl+F` (or `Cmd+F` on Mac): Focus filters
- `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac): Clear all filters

## Development

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Data Schema

See `src/types.ts` for complete type definitions:

- **Match**: Core match data with tournament, players, scores
- **Derived**: Computed metrics (rankDiff, totalGames, upset flags, etc.)
- **Tournament**: Tournament metadata
- **Player**: Player information with unique IDs

## Future Enhancements

- Elo-like rolling strength ratings
- Odds layer (implied probabilities)
- Retirement/walkover-aware filters
- Additional visualizations (H2H Matrix, Round Flow Sankey, etc.)

