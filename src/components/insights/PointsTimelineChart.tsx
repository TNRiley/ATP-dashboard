/**
 * Points Timeline Chart
 * Multi-line time series chart showing ranking points over time for selected players
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';
import { scaleTime, scaleLinear } from 'd3-scale';
import { line, curveMonotoneX } from 'd3-shape';
import { schemeCategory10 } from 'd3-scale-chromatic';
import { timeParse, timeFormat } from 'd3-time-format';
import { showTooltip, hideTooltip, moveTooltip } from '../../utils/d3/tooltip';
import { getTournamentDisplayName } from '../../utils/tournamentNames';
import type { Match, Tournament, Player, Series } from '../../types';

interface PointsTimelineChartProps {
  matches: Match[];
  tournaments: Tournament[];
  players: Player[];
}

interface TimeSeriesPoint {
  date: Date;
  points: number;
  tournament: string;
}

// Simple opponent autocomplete for multi-select
function PlayerMultiSelect({
  players,
  selectedPlayerIds,
  onAdd,
  placeholder = 'Add player...'
}: {
  players: Player[];
  selectedPlayerIds: string[];
  onAdd: (id: string) => void;
  placeholder?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredPlayers = players
    .filter(p => !selectedPlayerIds.includes(p.id))
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 10);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (playerId: string) => {
    onAdd(playerId);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="player-autocomplete">
      <div className="autocomplete-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="autocomplete-input"
          placeholder={placeholder}
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
      </div>
      {isOpen && filteredPlayers.length > 0 && (
        <div ref={dropdownRef} className="autocomplete-dropdown">
          {filteredPlayers.map(player => (
            <button key={player.id} className="autocomplete-option" onClick={() => handleSelect(player.id)}>
              {player.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PointsTimelineChart({ matches, tournaments, players }: PointsTimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [showTournamentLevels, setShowTournamentLevels] = useState<Record<Series, boolean>>({
    'Grand Slam': false,
    'Masters': false,
    'ATP500': false,
    'ATP250': false
  });
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [bulkRankMin, setBulkRankMin] = useState<number>(1);
  const [bulkRankMax, setBulkRankMax] = useState<number>(25);
  const [bulkAddMode, setBulkAddMode] = useState<'current' | 'historical'>('current');
  const [bulkAddMessage, setBulkAddMessage] = useState<string>('');

  const playersMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const tournamentsMap = useMemo(() => new Map(tournaments.map(t => [t.id, t])), [tournaments]);

  const parseDate = timeParse('%Y-%m-%d');
  const formatDate = timeFormat('%Y-%m-%d');

  // Get date range from data
  const dataDateRange = useMemo(() => {
    if (matches.length === 0) return { min: '', max: '' };
    const dates = matches.map(m => m.date).filter(Boolean).sort();
    return { min: dates[0] || '', max: dates[dates.length - 1] || '' };
  }, [matches]);

  // Transform match data into time series for selected players
  const playerTimeSeries = useMemo(() => {
    if (selectedPlayerIds.length === 0) return [];

    const seriesMap = new Map<string, TimeSeriesPoint[]>();

    selectedPlayerIds.forEach(playerId => {
      seriesMap.set(playerId, []);
    });

    // Process matches chronologically
    const sortedMatches = [...matches].sort((a, b) => a.date.localeCompare(b.date));

    sortedMatches.forEach(match => {
      const matchDate = parseDate(match.date);
      if (!matchDate) return;

      // Filter by date range
      if (fromDate && match.date < fromDate) return;
      if (toDate && match.date > toDate) return;

      const tournament = tournamentsMap.get(match.tournamentId);

      // Check if winner is selected
      if (selectedPlayerIds.includes(match.winnerId) && match.wPts !== undefined) {
        const series = seriesMap.get(match.winnerId)!;
        series.push({
          date: matchDate,
          points: match.wPts,
          tournament: getTournamentDisplayName(tournament)
        });
      }

      // Check if loser is selected
      if (selectedPlayerIds.includes(match.loserId) && match.lPts !== undefined) {
        const series = seriesMap.get(match.loserId)!;
        series.push({
          date: matchDate,
          points: match.lPts,
          tournament: getTournamentDisplayName(tournament)
        });
      }
    });

    // Convert to array and assign colors
    const colorScale = schemeCategory10;
    return selectedPlayerIds.map((playerId, index) => {
      const player = playersMap.get(playerId);
      const data = seriesMap.get(playerId) || [];
      // Sort by date
      data.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        playerId,
        playerName: player?.name || 'Unknown',
        data,
        color: colorScale[index % colorScale.length]
      };
    });
  }, [matches, selectedPlayerIds, playersMap, tournamentsMap, fromDate, toDate, parseDate]);

  // Get tournament marker dates based on selected levels
  const tournamentMarkerDates = useMemo(() => {
    const selectedSeries = Object.entries(showTournamentLevels)
      .filter(([_, selected]) => selected)
      .map(([series]) => series as Series);
  
    if (selectedSeries.length === 0) return [];
  
    const markers: Array<{ date: Date; name: string; series: Series; isFinal: boolean }> = [];
  
    matches.forEach(match => {
      const tournament = tournamentsMap.get(match.tournamentId);
      if (!tournament) return;
      if (!selectedSeries.includes(tournament.series)) return;
  
      if (match.round === 'F') {
        const finalDate = parseDate(match.date);
        if (finalDate) {
          markers.push({
            date: finalDate,
            name: getTournamentDisplayName(tournament),
            series: tournament.series,
            isFinal: true
          });
        }
      }
    });
  
    markers.sort((a, b) => a.date.getTime() - b.date.getTime());
    return markers;
  }, [matches, tournamentsMap, showTournamentLevels, parseDate]);
  


  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev => prev.filter(id => id !== playerId));
  };

// Bulk add players by rank (REPLACES current selection)
const handleBulkAddByRank = () => {
  if (matches.length === 0) {
    setBulkAddMessage('No match data available');
    return;
  }

  let matchingPlayers: string[] = [];

  if (bulkAddMode === 'current') {
    // Current ranking mode: Use most recent ranking for each player
    const playerRanks = new Map<string, number>(); // playerId -> rank

    // Sort matches by date (most recent first)
    const sortedMatches = [...matches]
      .filter(m => m.date)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (sortedMatches.length === 0) {
        setBulkAddMessage('No valid match dates found');
        return;
    }

    // 1. Define a "current" window (e.g., 60 days)
    const latestDate = sortedMatches[0].date;
    const latestDateObj = new Date(latestDate);
    // Get date 60 days ago
    const cutoffDate = new Date(latestDateObj.getTime() - (120 * 24 * 60 * 60 * 1000)); 
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    // 2. Filter matches to *only* this "current" window
    const currentMatches = sortedMatches.filter(m => m.date >= cutoffDateString);

    if (currentMatches.length === 0) {
      setBulkAddMessage('No matches found in the last 60 days to determine current ranks.');
      setTimeout(() => setBulkAddMessage(''), 3000);
      return;
    }

    // 3. Build the rank map ONLY from these recent matches
    // This map will only contain *active* players
    currentMatches.forEach(match => {
      if (match.wRank !== undefined && match.winnerId && !playerRanks.has(match.winnerId)) {
        playerRanks.set(match.winnerId, match.wRank);
      }
      if (match.lRank !== undefined && match.loserId && !playerRanks.has(match.loserId)) {
        playerRanks.set(match.loserId, match.lRank);
      }
    });


    // 4. Filter this *active player* map by rank range
    matchingPlayers = Array.from(playerRanks.entries())
      .filter(([_, rank]) => rank >= bulkRankMin && rank <= bulkRankMax)
      .map(([playerId]) => playerId);

  } else {
    // Historical range mode: Include players who held a rank within the range during the date period
    const playersInRange = new Set<string>();

    // Filter matches by date range if specified
    let filteredMatches = matches;
    if (fromDate || toDate) {
      filteredMatches = matches.filter(match => {
        if (fromDate && match.date < fromDate) return false;
        if (toDate && match.date > toDate) return false;
        return true;
      });
    }

    if (filteredMatches.length === 0) {
      setBulkAddMessage('No matches found in the selected date range');
      setTimeout(() => setBulkAddMessage(''), 3000);
      return;
    }

    // Check each match to see if any player's rank falls within the range
    filteredMatches.forEach(match => {
      if (match.wRank !== undefined && match.winnerId) {
        if (match.wRank >= bulkRankMin && match.wRank <= bulkRankMax) {
          playersInRange.add(match.winnerId);
        }
      }
      if (match.lRank !== undefined && match.loserId) {
        if (match.lRank >= bulkRankMin && match.lRank <= bulkRankMax) {
          playersInRange.add(match.loserId);
        }
      }
    });

    matchingPlayers = Array.from(playersInRange);
  }

  if (matchingPlayers.length === 0) {
    const modeText = bulkAddMode === 'current' ? 'currently' : 'historically';
    const dateText = bulkAddMode === 'historical' && (fromDate || toDate) 
      ? ` in the selected date range` 
      : '';
    setBulkAddMessage(`No players found ranked ${bulkRankMin}-${bulkRankMax} ${modeText}${dateText}`);
    setTimeout(() => setBulkAddMessage(''), 3000);
    return;
  }

  // REPLACE selected players with new list
  setSelectedPlayerIds(matchingPlayers);
  const modeText = bulkAddMode === 'current' ? 'currently' : 'historically';
  const dateText = bulkAddMode === 'historical' && (fromDate || toDate) 
    ? ` in the selected date range` 
    : '';
  setBulkAddMessage(`Showing ${matchingPlayers.length} player${matchingPlayers.length !== 1 ? 's' : ''} ranked ${bulkRankMin}-${bulkRankMax} ${modeText}${dateText}`);
  setTimeout(() => setBulkAddMessage(''), 5000);
};

// Render chart
useEffect(() => {
  if (!svgRef.current) return;

  const svg = select(svgRef.current);
  svg.selectAll('*').remove();

  if (playerTimeSeries.length === 0) {
    svg.append('text')
      .attr('x', 400)
      .attr('y', 300)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .style('font-size', '16px')
      .text('Select players to view ranking points over time');
    return;
  }

  const margin = { top: 120, right: 0, bottom: 60, left: 40 };
  const svgWidth = svg.node()?.clientWidth || 0;
  const svgHeight = svg.node()?.clientHeight || 0;
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Determine domains
  const allDates = playerTimeSeries.flatMap(series => series.data.map(d => d.date));
  const allPoints = playerTimeSeries.flatMap(series => series.data.map(d => d.points));

  if (allDates.length === 0 || allPoints.length === 0) {
    svg.append('text')
      .attr('x', 500)
      .attr('y', 300)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .style('font-size', '16px')
      .text('No data available for selected players in date range');
    return;
  }

  const dateMin = new Date(Math.min(...allDates.map(d => d.getTime())));
  const dateMax = new Date(Math.max(...allDates.map(d => d.getTime())));
  
  // Find the *true* min/max. Do not add a manual buffer.
  const pointsMin = Math.max(0, Math.min(...allPoints));
  const pointsMax = Math.max(...allPoints);

  // Scales
  const xScale = scaleTime().domain([dateMin, dateMax]).range([0, width]).nice();
  // Let .nice() create the buffer. This guarantees all data is inside the domain.
  const yScale = scaleLinear().domain([pointsMin, pointsMax]).range([height, 0]).nice();


  // Color scheme for tournament levels
  const seriesColors: Record<Series, string> = {
    'Grand Slam': '#e74c3c',
    'Masters': '#3498db',
    'ATP500': '#2ecc71',
    'ATP250': '#f39c12'
  };

  // --- START: DYNAMIC MARKER LOGIC ---

  // Define the Y-position for the *first* level and the *step* for new levels.
  const labelYBase = -5; // Y-position of the highest label
  const labelYStep = -20; // Vertical distance between staggered levels

  // Keep track of the last label's X-position *for each level*.
  // This array will grow as needed.
  const lastLabelXAtLevel: number[] = []; 

  // Minimum horizontal space (in pixels) between labels on the same level.
  const minLabelSpacing = 35; 

  // Draw tournament markers
  tournamentMarkerDates.forEach(marker => {
    const x = xScale(marker.date);
    const color = seriesColors[marker.series];
    
    // Draw the vertical line
    g.append('line')
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', labelYBase + 5) // Start just below the highest label
      .attr('y2', height)
      .attr('stroke', color)
      .attr('stroke-width', marker.isFinal ? 2 : 1)
      .attr('stroke-dasharray', marker.isFinal ? '5,3' : '3,3')
      .attr('opacity', marker.isFinal ? 0.7 : 0.5);
    
    let yPos = labelYBase;
    let level = 0;

    // Keep searching for an open level, starting from level 0
    while (true) {
      // Have we checked this level before? If not, initialize it.
      if (level >= lastLabelXAtLevel.length) {
        lastLabelXAtLevel.push(-Infinity);
      }

      // Is this level "open" at this X position?
      if (x - lastLabelXAtLevel[level] > minLabelSpacing) {
        // Yes! We found our slot.
        yPos = labelYBase + (level * labelYStep); // Calculate Y
        lastLabelXAtLevel[level] = x;           // "Book" this slot
        break; // Stop searching
      }
      
      // No, this level is blocked. Try the next level down.
      level++;
    }
    
    // Dynamically set text-anchor
    let textAnchor = 'middle';
    const edgeBuffer = 60; // How much space to give edge labels
    
    if (x < edgeBuffer) {
      textAnchor = 'start';
    } else if (x > width - edgeBuffer) {
      textAnchor = 'end';
    }
    
    // Draw the text label at the found yPos
    g.append('text')
      .attr('x', x)
      .attr('y', yPos)
      .attr('text-anchor', textAnchor) // Use the dynamic textAnchor
      .attr('fill', color)
      .attr('font-size', marker.isFinal ? '11px' : '10px')
      .attr('font-weight', marker.isFinal ? '600' : '400')
      .attr('transform', `rotate(-25 ${x} ${yPos})`)
      .text(marker.name)
      .style('cursor', 'default');
  });

  // --- END: DYNAMIC MARKER LOGIC ---

  // Line generator
  const lineGenerator = line<TimeSeriesPoint>()
    .x(d => xScale(d.date))
    .y(d => yScale(d.points))
    .curve(curveMonotoneX);

  // Draw lines and points
  playerTimeSeries.forEach(series => {
    if (series.data.length === 0) return;

    // Draw line
    g.append('path')
      .datum(series.data)
      .attr('fill', 'none')
      .attr('stroke', series.color)
      .attr('stroke-width', 2.5)
      .attr('d', lineGenerator);

    // Draw points
    g.selectAll(`.point-${series.playerId}`)
      .data(series.data)
      .enter()
      .append('circle')
      .attr('class', `point-${series.playerId}`)
      .attr('cx', d => xScale(d.date))
      .attr('cy', d => yScale(d.points))
      .attr('r', 3)
      .attr('fill', series.color)
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .on('mouseover', function (event, d) {
        showTooltip(
          {
            title: series.playerName,
            content: [`Date: ${formatDate(d.date)}`, `Points: ${d.points}`, `Tournament: ${d.tournament}`]
          },
          event
        );
        select(this).attr('r', 5);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', function () {
        hideTooltip();
        select(this).attr('r', 3);
      });

    // Line hover area (invisible wider path for easier hovering)
    g.append('path')
      .datum(series.data)
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 10)
      .attr('d', lineGenerator)
      .style('cursor', 'pointer')
      .on('mouseover', function (event) {
        // Simple approximation - show middle point tooltip
        if (series.data.length > 0) {
          const closestPoint = series.data[Math.floor(series.data.length / 2)];
          showTooltip(
            {
              title: series.playerName,
              content: [
                `Date: ${formatDate(closestPoint.date)}`,
                `Points: ${closestPoint.points}`,
                `Tournament: ${closestPoint.tournament}`
              ]
            },
            event
          );
        }
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', hideTooltip);
  });

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(axisBottom(xScale).tickFormat(timeFormat('%Y-%m-%d') as any))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  g.append('g').call(axisLeft(yScale));

  // Axis labels
  g.append('text')
    .attr('x', width / 2)
    .attr('y', height + 50)
    .attr('fill', 'currentColor')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .text('Date');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -50)
    .attr('x', -height / 2)
    .attr('fill', 'currentColor')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .text('Ranking Points');

}, [playerTimeSeries, tournamentMarkerDates, formatDate]);

  return (
    <div className="chart-container">
      <h3>Ranking Points Timeline</h3>

      <div className="timeline-filters">
      <div className="filter-section">
        <h4>Selected Players</h4>

        {/* 1. "ADD PLAYER" SEARCH BOX MOVED HERE */}
        <div className="filter-control">
          <PlayerMultiSelect
            onAdd={id => setSelectedPlayerIds(prev => [...prev, id])}
            placeholder="Add player..."
            players={players} 
            selectedPlayerIds={selectedPlayerIds}
          />
        </div>

        {/* 2. LIST OF PLAYERS IS NOW SECOND */}
        <div className="selected-players-list">
          {selectedPlayerIds.map(playerId => {
            const player = playersMap.get(playerId);
            const series = playerTimeSeries.find(s => s.playerId === playerId);
            return (
              <div key={playerId} className="player-tag">
                <div className="player-tag-color" style={{ backgroundColor: series?.color || '#999' }}></div>
                <span>{player?.name || 'Unknown'}</span>
                <button onClick={() => handleRemovePlayer(playerId)} className="remove-player" title="Remove">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

        <div className="filter-section">
          <h4>Bulk Add by Rank</h4>
          
          {/* Mode Selection */}
          <div className="filter-control" style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
              Selection Mode:
            </label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="bulk-add-mode"
                  value="current"
                  checked={bulkAddMode === 'current'}
                  onChange={() => setBulkAddMode('current')}
                />
                <span style={{ fontSize: '13px' }}>Current Ranking</span>
              </label>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="bulk-add-mode"
                  value="historical"
                  checked={bulkAddMode === 'historical'}
                  onChange={() => setBulkAddMode('historical')}
                />
                <span style={{ fontSize: '13px' }}>Historical Range</span>
              </label>
            </div>
            <p style={{ fontSize: '11px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
              {bulkAddMode === 'current' 
                ? 'Uses each player\'s most recent ranking in the dataset'
                : 'Includes players who held a rank in this range at any point' + (fromDate || toDate ? ' during the selected date range' : ' in the dataset')}
            </p>
          </div>

          <div className="bulk-rank-controls">
            <div className="filter-control">
              <label htmlFor="bulk-rank-min">Min Rank:</label>
              <input
                id="bulk-rank-min"
                type="number"
                min="1"
                max="1000"
                value={bulkRankMin}
                onChange={e => setBulkRankMin(parseInt(e.target.value) || 1)}
                className="filter-input-number"
              />
            </div>
            <div className="filter-control">
              <label htmlFor="bulk-rank-max">Max Rank:</label>
              <input
                id="bulk-rank-max"
                type="number"
                min="1"
                max="1000"
                value={bulkRankMax}
                onChange={e => setBulkRankMax(parseInt(e.target.value) || 1000)}
                className="filter-input-number"
              />
            </div>
            <div className="filter-control">
              <button onClick={handleBulkAddByRank} className="add-top5-button">
                Add Players
              </button>
            </div>
          </div>
          {bulkAddMessage && (
            <div className={`bulk-add-message ${bulkAddMessage.includes('No') ? 'error' : 'success'}`}>
              {bulkAddMessage}
            </div>
          )}
        </div>

        <div className="filter-section">
          <h4>Tournament Markers</h4>
          <p className="bulk-add-description" style={{ fontSize: '12px', marginBottom: '10px' }}>
            Show vertical lines for selected tournament levels. Grand Slam finals are included.
          </p>
          <div className="filter-control" style={{ display: 'grid', gridTemplateColumns: 'max-content max-content', gap: '6px', alignItems: 'center' }}>            
            {(['Grand Slam', 'Masters', 'ATP500', 'ATP250'] as Series[]).map(series => (
              <label key={series} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={showTournamentLevels[series]}
                  onChange={e => {
                    setShowTournamentLevels(prev => ({
                      ...prev,
                      [series]: e.target.checked
                    }));
                  }}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      backgroundColor: series === 'Grand Slam' ? '#e74c3c' : series === 'Masters' ? '#3498db' : series === 'ATP500' ? '#2ecc71' : '#f39c12',
                      borderRadius: '2px'
                    }}
                  ></span>
                  {series}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h4>Date Range</h4>
          <div className="date-range-controls">
            <div className="filter-control date-range-control">
              <label htmlFor="timeline-from-date">From:</label>
              <input
                id="timeline-from-date"
                type="date"
                value={fromDate}
                min={dataDateRange.min}
                max={dataDateRange.max || undefined}
                onChange={e => setFromDate(e.target.value)}
                className="filter-input-date"
              />
            </div>
            <div className="filter-control date-range-control">
              <label htmlFor="timeline-to-date">To:</label>
              <input
                id="timeline-to-date"
                type="date"
                value={toDate}
                min={fromDate || dataDateRange.min}
                max={dataDateRange.max || undefined}
                onChange={e => setToDate(e.target.value)}
                className="filter-input-date"
              />
            </div>
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate(''); }} className="clear-date-button">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <svg ref={svgRef} style={{ width: '100%', height: '600px' }}></svg>
      </div>
  );
}

