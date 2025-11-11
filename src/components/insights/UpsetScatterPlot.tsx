/**
 * Upset Scatter Plot
 * D3 scatter plot showing WRank vs LRank with diagonal line
 * Points below the line (x=y) are upsets (red), above are expected wins (green)
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import { zoom, zoomIdentity } from 'd3-zoom';
import { showTooltip, hideTooltip, moveTooltip } from '../../utils/d3/tooltip';
import { PlayerAutocomplete } from '../PlayerAutocomplete';
import { getTournamentDisplayName } from '../../utils/tournamentNames';
import type { Match, Tournament, Player, Surface, Series } from '../../types';

interface UpsetScatterPlotProps {
  matches: Match[];
  tournaments: Tournament[];
  players: Player[];
}

interface MatchDataPoint {
  wRank: number;
  lRank: number;
  winner: string;
  loser: string;
  winnerId: string;
  loserId: string;
  tournament: string;
  date: string;
  isUpset: boolean;
  isSelectedPlayerMatch: boolean;
  surface: Surface;
  series: Series;
  selectedPlayerWon: boolean; // true if selected player won this match
}

type ViewMode = 'active' | 'highlight';

export function UpsetScatterPlot({ matches, tournaments, players }: UpsetScatterPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const [selectedSurface, setSelectedSurface] = useState<Surface | 'All'>('All');
  const [selectedSeries, setSelectedSeries] = useState<Series | 'All'>('All');
  const [minRank, setMinRank] = useState<number>(1);
  const [maxRank, setMaxRank] = useState<number>(1000);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');

  // Date boundaries from data
  const dataDateRange = useMemo(() => {
    if (matches.length === 0) return { min: '', max: '' };
    const dates = matches.map(m => m.date).filter(Boolean).sort();
    return { min: dates[0] || '', max: dates[dates.length - 1] || '' };
  }, [matches]);

  // Lookups
  const tournamentsMap = useMemo(() => new Map(tournaments.map(t => [t.id, t])), [tournaments]);
  const playersMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  // Filter & shape data
  const processedData = useMemo(() => {
    const data: MatchDataPoint[] = [];

    matches.forEach(match => {
      const tournament = tournamentsMap.get(match.tournamentId);

      if (selectedSurface !== 'All') {
        if (!tournament || tournament.surface !== selectedSurface) return;
      }
      if (selectedSeries !== 'All') {
        if (!tournament || tournament.series !== selectedSeries) return;
      }
      if (fromDate && match.date < fromDate) return;
      if (toDate && match.date > toDate) return;

      const wRank = match.wRank ?? 1000;
      const lRank = match.lRank ?? 1000;

      if (wRank < minRank || wRank > maxRank || lRank < minRank || lRank > maxRank) return;
      if (wRank === 1000 && lRank === 1000) return;

      const tournamentName = getTournamentDisplayName(tournament);
      const winner = playersMap.get(match.winnerId);
      const loser = playersMap.get(match.loserId);
      const winnerName = winner?.name || 'Unknown';
      const loserName = loser?.name || 'Unknown';

      const isUpset = wRank > lRank;
      const isSelectedPlayerMatch =
        selectedPlayerId !== null &&
        (match.winnerId === selectedPlayerId || match.loserId === selectedPlayerId);
      const selectedPlayerWon = selectedPlayerId !== null && match.winnerId === selectedPlayerId;

      data.push({
        wRank,
        lRank,
        winner: winnerName,
        loser: loserName,
        winnerId: match.winnerId,
        loserId: match.loserId,
        tournament: tournamentName,
        date: match.date,
        isUpset,
        isSelectedPlayerMatch,
        surface: tournament?.surface || 'Hard',
        series: tournament?.series || 'ATP250',
        selectedPlayerWon
      });
    });

    if (selectedPlayerId !== null && viewMode === 'active') {
      return data.filter(d => d.isSelectedPlayerMatch);
    }
    return data;
  }, [
    matches,
    tournamentsMap,
    playersMap,
    selectedSurface,
    selectedSeries,
    minRank,
    maxRank,
    fromDate,
    toDate,
    selectedPlayerId,
    viewMode
  ]);

  // Helper functions for visual encoding
  const getRadius = (d: MatchDataPoint): number => {
    if (selectedPlayerId === null) {
      // Global View: radius = abs(wRank - lRank) (magnitude of upset)
      return Math.max(2, Math.min(12, Math.abs(d.wRank - d.lRank) * 0.3));
    } else {
      // Player-Centric View: radius based on Tournament Series
      const seriesRadius: Record<Series, number> = {
        'Grand Slam': 8,
        'Masters': 6,
        'ATP500': 4,
        'ATP250': 2
      };
      return seriesRadius[d.series] || 4;
    }
  };

  const getColor = (d: MatchDataPoint): string => {
    if (selectedPlayerId === null) {
      // Global View: red (Upset) vs. green (Expected)
      return d.isUpset ? '#e91e63' : '#4caf50';
    } else {
      // Player-Centric View: green (Player Won) vs. red (Player Lost)
      return d.selectedPlayerWon ? '#4caf50' : '#e91e63';
    }
  };

  const getShapeType = (d: MatchDataPoint): 'circle' | 'square' | 'triangle' => {
    if (selectedPlayerId === null) {
      // Global View: All Circles
      return 'circle';
    } else {
      // Player-Centric View: Circle (Hard) vs. Square (Clay) vs. Triangle (Grass)
      switch (d.surface) {
        case 'Hard':
          return 'circle';
        case 'Clay':
          return 'square';
        case 'Grass':
          return 'triangle';
        default:
          return 'circle';
      }
    }
  };


  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    // Empty state
    if (processedData.length === 0) {
      svg
        .append('text')
        .attr('x', 400)
        .attr('y', 300)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .style('font-size', '16px')
        .text('No data matches the current filters');
      return;
    }

    // Layout
    const margin = { top: 40, right: 40, bottom: 60, left: 80 };
    const fullWidth = 800;
    const fullHeight = 600;
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    const rootG = svg
      .attr('width', fullWidth)
      .attr('height', fullHeight)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Clip path to keep points within axes box
    const defs = svg.append('defs');
    defs
      .append('clipPath')
      .attr('id', 'plot-clip')
      .append('rect')
      .attr('width', width)
      .attr('height', height);

    // Domains (with small padding)
    const allRanks = processedData.flatMap(d => [d.wRank, d.lRank]);
    const minRankValue = Math.min(...allRanks);
    const maxRankValue = Math.max(...allRanks);
    const padding = Math.max(0, (maxRankValue - minRankValue) * 0.05);

    const domainMin = Math.max(1, minRankValue - padding);
    const domainMax = maxRankValue + padding;

    // Base scales (canonical domains)
    const xScale = scaleLinear().domain([domainMin, domainMax]).range([0, width]).nice();
    const yScale = scaleLinear().domain([domainMin, domainMax]).range([height, 0]).nice();

    // Axis groups (kept for redraw)
    const xAxisG = rootG.append('g').attr('transform', `translate(0,${height})`);
    const yAxisG = rootG.append('g');
    xAxisG.call(axisBottom(xScale));
    yAxisG.call(axisLeft(yScale));

    // Axis labels (separate so redraw doesn't wipe them)
    rootG
      .append('text')
      .attr('x', width / 2)
      .attr('y', height + 50)
      .attr('fill', 'currentColor')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .text('Winner Rank');

    rootG
      .append('text')
      .attr('transform', `translate(${-50},${height / 2}) rotate(-90)`)
      .attr('fill', 'currentColor')
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .text('Loser Rank');

    // Diagonal x=y line (recomputable)
    const lineData: [number, number][] = [
      [domainMin, domainMin],
      [domainMax, domainMax]
    ];

    const diagonalLineGen = (xs: typeof xScale, ys: typeof yScale) =>
      line<[number, number]>()
        .x(d => xs(d[0]))
        .y(d => ys(d[1]))(lineData)!;

    const diagPath = rootG
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', '#666')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('d', diagonalLineGen(xScale, yScale))
      .attr('clip-path', 'url(#plot-clip)');

    const diagLabel = rootG.append('text').attr('fill', '#666').attr('font-size', '12px').text('x = y');

    const placeDiagLabel = (xs: typeof xScale, ys: typeof yScale) => {
      const mid = (domainMin + domainMax) / 2;
      diagLabel.attr('x', xs(mid) + 10).attr('y', ys(mid) - 10);
    };
    placeDiagLabel(xScale, yScale);

    // Points layer (clipped)
    const pointsG = rootG.append('g').attr('clip-path', 'url(#plot-clip)');

    // Separate data by shape type for efficient rendering
    const circlesData = processedData.filter(d => getShapeType(d) === 'circle');
    const squaresData = processedData.filter(d => getShapeType(d) === 'square');
    const trianglesData = processedData.filter(d => getShapeType(d) === 'triangle');

    // Render circles
    const circles = pointsG
      .selectAll('circle.point')
      .data(circlesData)
      .enter()
      .append('circle')
      .attr('class', 'point')
      .attr('cx', d => xScale(d.wRank))
      .attr('cy', d => yScale(d.lRank))
      .attr('r', d => getRadius(d))
      .attr('fill', d => getColor(d))
      .attr('opacity', d =>
        viewMode === 'highlight' && selectedPlayerId !== null ? (d.isSelectedPlayerMatch ? 1 : 0.1) : 0.6
      )
      .attr('stroke', d => {
        const baseColor = getColor(d);
        return baseColor === '#e91e63' ? '#c2185b' : '#388e3c';
      })
      .attr('stroke-width', 1)
      .on('mouseover', function (event, d) {
        const selectedPlayerName = selectedPlayerId ? playersMap.get(selectedPlayerId)?.name : null;
        const tooltipTitle = selectedPlayerId
          ? `${selectedPlayerName} ${d.selectedPlayerWon ? 'def.' : 'lost to'} ${d.selectedPlayerWon ? d.loser : d.winner}`
          : `${d.winner} (Rank ${d.wRank}) def. ${d.loser} (Rank ${d.lRank})`;
        const tooltipContent = [
          `Tournament: ${d.tournament}`,
          `Date: ${d.date}`,
          `Surface: ${d.surface}`,
          selectedPlayerId
            ? d.selectedPlayerWon
              ? 'Win'
              : 'Loss'
            : d.isUpset
            ? 'Upset!'
            : 'Expected win'
        ];
        showTooltip({ title: tooltipTitle, content: tooltipContent }, event);
        const baseRadius = getRadius(d);
        select(this).attr('r', baseRadius * 1.5).attr('opacity', 1);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', function (_, d) {
        hideTooltip();
        const baseOpacity =
          viewMode === 'highlight' && selectedPlayerId !== null ? (d.isSelectedPlayerMatch ? 1 : 0.1) : 0.6;
        select(this).attr('r', getRadius(d)).attr('opacity', baseOpacity);
      });

    // Render squares
    const squares = pointsG
      .selectAll('rect.point')
      .data(squaresData)
      .enter()
      .append('rect')
      .attr('class', 'point')
      .attr('x', d => xScale(d.wRank) - getRadius(d))
      .attr('y', d => yScale(d.lRank) - getRadius(d))
      .attr('width', d => getRadius(d) * 2)
      .attr('height', d => getRadius(d) * 2)
      .attr('fill', d => getColor(d))
      .attr('opacity', d =>
        viewMode === 'highlight' && selectedPlayerId !== null ? (d.isSelectedPlayerMatch ? 1 : 0.1) : 0.6
      )
      .attr('stroke', d => {
        const baseColor = getColor(d);
        return baseColor === '#e91e63' ? '#c2185b' : '#388e3c';
      })
      .attr('stroke-width', 1)
      .on('mouseover', function (event, d) {
        const selectedPlayerName = selectedPlayerId ? playersMap.get(selectedPlayerId)?.name : null;
        const tooltipTitle = selectedPlayerId
          ? `${selectedPlayerName} ${d.selectedPlayerWon ? 'def.' : 'lost to'} ${d.selectedPlayerWon ? d.loser : d.winner}`
          : `${d.winner} (Rank ${d.wRank}) def. ${d.loser} (Rank ${d.lRank})`;
        const tooltipContent = [
          `Tournament: ${d.tournament}`,
          `Date: ${d.date}`,
          `Surface: ${d.surface}`,
          selectedPlayerId
            ? d.selectedPlayerWon
              ? 'Win'
              : 'Loss'
            : d.isUpset
            ? 'Upset!'
            : 'Expected win'
        ];
        showTooltip({ title: tooltipTitle, content: tooltipContent }, event);
        const baseSize = getRadius(d);
        select(this)
          .attr('x', xScale(d.wRank) - baseSize * 1.5)
          .attr('y', yScale(d.lRank) - baseSize * 1.5)
          .attr('width', baseSize * 3)
          .attr('height', baseSize * 3)
          .attr('opacity', 1);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', function (_, d) {
        hideTooltip();
        const baseOpacity =
          viewMode === 'highlight' && selectedPlayerId !== null ? (d.isSelectedPlayerMatch ? 1 : 0.1) : 0.6;
        const baseSize = getRadius(d);
        select(this)
          .attr('x', xScale(d.wRank) - baseSize)
          .attr('y', yScale(d.lRank) - baseSize)
          .attr('width', baseSize * 2)
          .attr('height', baseSize * 2)
          .attr('opacity', baseOpacity);
      });

    // Render triangles
    const triangles = pointsG
      .selectAll('path.triangle-point')
      .data(trianglesData)
      .enter()
      .append('path')
      .attr('class', 'triangle-point point')
      .attr('d', d => {
        const size = getRadius(d);
        const h = (size * Math.sqrt(3)) / 2;
        return `M ${xScale(d.wRank)},${yScale(d.lRank) + h} L ${xScale(d.wRank) - size / 2},${yScale(d.lRank) - h / 2} L ${xScale(d.wRank) + size / 2},${yScale(d.lRank) - h / 2} Z`;
      })
      .attr('fill', d => getColor(d))
      .attr('opacity', d =>
        viewMode === 'highlight' && selectedPlayerId !== null ? (d.isSelectedPlayerMatch ? 1 : 0.1) : 0.6
      )
      .attr('stroke', d => {
        const baseColor = getColor(d);
        return baseColor === '#e91e63' ? '#c2185b' : '#388e3c';
      })
      .attr('stroke-width', 1)
      .on('mouseover', function (event, d) {
        const selectedPlayerName = selectedPlayerId ? playersMap.get(selectedPlayerId)?.name : null;
        const tooltipTitle = selectedPlayerId
          ? `${selectedPlayerName} ${d.selectedPlayerWon ? 'def.' : 'lost to'} ${d.selectedPlayerWon ? d.loser : d.winner}`
          : `${d.winner} (Rank ${d.wRank}) def. ${d.loser} (Rank ${d.lRank})`;
        const tooltipContent = [
          `Tournament: ${d.tournament}`,
          `Date: ${d.date}`,
          `Surface: ${d.surface}`,
          selectedPlayerId
            ? d.selectedPlayerWon
              ? 'Win'
              : 'Loss'
            : d.isUpset
            ? 'Upset!'
            : 'Expected win'
        ];
        showTooltip({ title: tooltipTitle, content: tooltipContent }, event);
        const baseSize = getRadius(d);
        const h = (baseSize * Math.sqrt(3)) / 2;
        select(this)
          .attr('d', `M ${xScale(d.wRank)},${yScale(d.lRank) + h * 1.5} L ${xScale(d.wRank) - (baseSize * 1.5) / 2},${yScale(d.lRank) - (h * 1.5) / 2} L ${xScale(d.wRank) + (baseSize * 1.5) / 2},${yScale(d.lRank) - (h * 1.5) / 2} Z`)
          .attr('opacity', 1);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', function (_, d) {
        hideTooltip();
        const baseOpacity =
          viewMode === 'highlight' && selectedPlayerId !== null ? (d.isSelectedPlayerMatch ? 1 : 0.1) : 0.6;
        const baseSize = getRadius(d);
        const h = (baseSize * Math.sqrt(3)) / 2;
        select(this)
          .attr('d', `M ${xScale(d.wRank)},${yScale(d.lRank) + h} L ${xScale(d.wRank) - baseSize / 2},${yScale(d.lRank) - h / 2} L ${xScale(d.wRank) + baseSize / 2},${yScale(d.lRank) - h / 2} Z`)
          .attr('opacity', baseOpacity);
      });

    // Update points on zoom
    const updatePointsOnZoom = (zx: typeof xScale, zy: typeof yScale) => {
      circles.attr('cx', d => zx(d.wRank)).attr('cy', d => zy(d.lRank));
      squares
        .attr('x', d => zx(d.wRank) - getRadius(d))
        .attr('y', d => zy(d.lRank) - getRadius(d));
      triangles.attr('d', d => {
        const size = getRadius(d);
        const h = (size * Math.sqrt(3)) / 2;
        return `M ${zx(d.wRank)},${zy(d.lRank) + h} L ${zx(d.wRank) - size / 2},${zy(d.lRank) - h / 2} L ${zx(d.wRank) + size / 2},${zy(d.lRank) - h / 2} Z`;
      });
    };

    // Legend (not clipped) - changes based on view mode
    const legend = rootG.append('g').attr('transform', `translate(${width - 180}, 20)`);
    let legendY = 0;

    if (selectedPlayerId === null) {
      // Global View Legend
      [
        { label: 'Upset', color: '#e91e63', shape: 'circle' },
        { label: 'Expected', color: '#4caf50', shape: 'circle' }
      ].forEach((item) => {
        const row = legend.append('g').attr('transform', `translate(0, ${legendY})`);
        row.append('circle')
          .attr('r', 4)
          .attr('fill', item.color)
          .attr('opacity', 0.6)
          .attr('stroke', item.color === '#e91e63' ? '#c2185b' : '#388e3c')
          .attr('stroke-width', 1);
        row.append('text').attr('x', 15).attr('y', 4).attr('font-size', '12px').text(item.label);
        legendY += 20;
      });
      legend
        .append('text')
        .attr('x', 0)
        .attr('y', legendY)
        .attr('font-size', '10px')
        .attr('fill', '#666')
        .text('Size = Rank Diff');
    } else {
      // Player-Centric View Legend
      const selectedPlayerName = playersMap.get(selectedPlayerId)?.name || 'Selected Player';
      
      // Win/Loss colors
      [
        { label: `${selectedPlayerName} Won`, color: '#4caf50' },
        { label: `${selectedPlayerName} Lost`, color: '#e91e63' }
      ].forEach((item) => {
        const row = legend.append('g').attr('transform', `translate(0, ${legendY})`);
        row.append('circle')
          .attr('r', 4)
          .attr('fill', item.color)
          .attr('opacity', 0.6)
          .attr('stroke', item.color === '#e91e63' ? '#c2185b' : '#388e3c')
          .attr('stroke-width', 1);
        row.append('text').attr('x', 15).attr('y', 4).attr('font-size', '12px').text(item.label);
        legendY += 20;
      });

      // Surface shapes
      legendY += 5;
      [
        { label: 'Hard', shape: 'circle' },
        { label: 'Clay', shape: 'square' },
        { label: 'Grass', shape: 'triangle' }
      ].forEach((item) => {
        const row = legend.append('g').attr('transform', `translate(0, ${legendY})`);
        if (item.shape === 'circle') {
          row.append('circle').attr('r', 4).attr('fill', '#666').attr('opacity', 0.6);
        } else if (item.shape === 'square') {
          row.append('rect')
            .attr('x', -4)
            .attr('y', -4)
            .attr('width', 8)
            .attr('height', 8)
            .attr('fill', '#666')
            .attr('opacity', 0.6);
        } else if (item.shape === 'triangle') {
          const h = (4 * Math.sqrt(3)) / 2;
          row.append('path')
            .attr('d', `M 0,${h} L -4,${-h / 2} L 4,${-h / 2} Z`)
            .attr('fill', '#666')
            .attr('opacity', 0.6);
        }
        row.append('text').attr('x', 15).attr('y', 4).attr('font-size', '12px').text(item.label);
        legendY += 20;
      });

      // Series sizes
      legendY += 5;
      legend
        .append('text')
        .attr('x', 0)
        .attr('y', legendY)
        .attr('font-size', '10px')
        .attr('fill', '#666')
        .text('Size = Series Level');
      legendY += 15;
      [
        { label: 'Grand Slam', size: 8 },
        { label: 'Masters', size: 6 },
        { label: 'ATP 500', size: 4 },
        { label: 'ATP 250', size: 2 }
      ].forEach((item) => {
        const row = legend.append('g').attr('transform', `translate(0, ${legendY})`);
        row.append('circle')
          .attr('r', item.size)
          .attr('fill', 'none')
          .attr('stroke', '#666')
          .attr('stroke-width', 1)
          .attr('opacity', 0.6);
        row.append('text').attr('x', item.size + 5).attr('y', 4).attr('font-size', '11px').text(item.label);
        legendY += 18;
      });
    }

    // --- Zoom behavior ---
    // IMPORTANT: attach to the INNER group (rootG), not the SVG.
    // Use plot coordinates for extent/translateExtent so panning is bounded to the plot box.
    const zoomBehavior = zoom<SVGGElement, unknown>()
      .scaleExtent([1, 12])
      .translateExtent([
        [0, 0],
        [width, height]
      ])
      .extent([
        [0, 0],
        [width, height]
      ])
      .on('zoom', (event) => {
        const t = event.transform;
        const zx = t.rescaleX(xScale);
        const zy = t.rescaleY(yScale);

        // Reposition all points (remain clipped to box)
        updatePointsOnZoom(zx, zy);

        // Redraw axes (ticks + domain line move as the scale changes)
        xAxisG.call(axisBottom(zx));
        yAxisG.call(axisLeft(zy));

        // Redraw diagonal line & label to match view scales
        diagPath.attr('d', diagonalLineGen(zx, zy));
        placeDiagLabel(zx, zy);
      });

    // Attach zoom to the plotting group
    rootG.call(zoomBehavior as any);

    // Double-click to reset zoom (centered on plot area)
    rootG.on('dblclick.zoom', null); // remove default dblclick zoom-in
    rootG.on('dblclick', () => {
      rootG.transition().duration(250).call(zoomBehavior.transform as any, zoomIdentity);
    });

    // Cleanup
    return () => {
      rootG.on('.zoom', null).on('dblclick', null);
      svg.selectAll('*').remove();
    };
  }, [processedData, viewMode, selectedPlayerId]);

  return (
    <div className="chart-container">
      <h3>Upset Scatter Plot</h3>

      <div className="upset-filters">
        <div className="filter-control">
          <label htmlFor="surface-filter">Surface:</label>
          <select
            id="surface-filter"
            value={selectedSurface}
            onChange={(e) => setSelectedSurface(e.target.value as Surface | 'All')}
            className="filter-select"
          >
            <option value="All">All</option>
            <option value="Hard">Hard</option>
            <option value="Clay">Clay</option>
            <option value="Grass">Grass</option>
            <option value="Carpet">Carpet</option>
          </select>
        </div>

        <div className="filter-control">
          <label htmlFor="series-filter">Tournament Level:</label>
          <select
            id="series-filter"
            value={selectedSeries}
            onChange={(e) => setSelectedSeries(e.target.value as Series | 'All')}
            className="filter-select"
          >
            <option value="All">All</option>
            <option value="Grand Slam">Grand Slam</option>
            <option value="Masters">Masters 1000</option>
            <option value="ATP500">ATP 500</option>
            <option value="ATP250">ATP 250</option>
          </select>
        </div>

        <div className="filter-control">
          <label htmlFor="min-rank">Min Rank:</label>
          <input
            id="min-rank"
            type="number"
            min="1"
            max="1000"
            value={minRank}
            onChange={(e) => setMinRank(parseInt(e.target.value) || 1)}
            className="filter-input-number"
          />
        </div>

        <div className="filter-control">
          <label htmlFor="max-rank">Max Rank:</label>
          <input
            id="max-rank"
            type="number"
            min="1"
            max="1000"
            value={maxRank}
            onChange={(e) => setMaxRank(parseInt(e.target.value) || 1000)}
            className="filter-input-number"
          />
        </div>

        <div className="filter-control date-range-control">
          <label htmlFor="from-date">From Date:</label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            min={dataDateRange.min}
            max={dataDateRange.max || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            className="filter-input-date"
          />
        </div>

        <div className="filter-control date-range-control">
          <label htmlFor="to-date">To Date:</label>
          <input
            id="to-date"
            type="date"
            value={toDate}
            min={fromDate || dataDateRange.min}
            max={dataDateRange.max || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className="filter-input-date"
          />
        </div>

        {(fromDate || toDate) && (
          <div className="filter-control">
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="clear-date-button"
              title="Clear date range"
            >
              Clear Dates
            </button>
          </div>
        )}

        <div className="filter-control player-filter-control">
          <label>Player:</label>
          <PlayerAutocomplete
            players={players}
            selectedPlayer={selectedPlayerId}
            onSelect={setSelectedPlayerId}
            placeholder="Search players..."
          />
        </div>

        {selectedPlayerId && (
          <div className="filter-control mode-toggle-control">
            <label>View Mode:</label>
            <div className="mode-toggle">
              <button
                className={`mode-button ${viewMode === 'active' ? 'active' : ''}`}
                onClick={() => setViewMode('active')}
              >
                Active
              </button>
              <button
                className={`mode-button ${viewMode === 'highlight' ? 'active' : ''}`}
                onClick={() => setViewMode('highlight')}
              >
                Highlight
              </button>
            </div>
          </div>
        )}

        <div className="filter-info">
          Showing {processedData.length} matches
          {selectedPlayerId && viewMode === 'active' && (
            <span className="player-match-count">
              {' '}({processedData.filter(d => d.isSelectedPlayerMatch).length} player matches)
            </span>
          )}
        </div>
      </div>

      <svg ref={svgRef} width={800} height={600}></svg>
    </div>
  );
}