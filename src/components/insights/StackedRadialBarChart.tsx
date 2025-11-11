/**
 * Stacked Radial Bar Chart
 * Shows total matches (bar length) stacked by wins (green) and losses (red)
 * for a primary player against multiple opponents
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { select } from 'd3-selection';
import { arc } from 'd3-shape';
import { scaleLinear, scaleBand } from 'd3-scale';
import { max } from 'd3-array';
import { showTooltip, hideTooltip, moveTooltip } from '../../utils/d3/tooltip';
import { PlayerAutocomplete } from '../PlayerAutocomplete';
import type { Match, Tournament, Player } from '../../types';

// Simple opponent autocomplete that clears after selection
function OpponentAutocomplete({
  players,
  onAdd,
  placeholder = 'Search opponents...',
}: {
  players: Player[];
  onAdd: (id: string) => void;
  placeholder?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredPlayers = (players ?? [])
    .filter((player) => player.name.toLowerCase().includes(searchTerm.toLowerCase()))
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
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
      </div>
      {isOpen && filteredPlayers.length > 0 && (
        <div ref={dropdownRef} className="autocomplete-dropdown">
          {filteredPlayers.map((player) => (
            <button
              key={player.id}
              className="autocomplete-option"
              onClick={() => handleSelect(player.id)}
            >
              {player.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface StackedRadialBarChartProps {
  matches: Match[];
  tournaments: Tournament[];
  players: Player[];
}

interface OpponentRecord {
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
  total: number;
}

export function StackedRadialBarChart({
  matches = [],
  tournaments: _tournaments = [],
  players = [],
}: StackedRadialBarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [primaryPlayerId, setPrimaryPlayerId] = useState<string | null>(null);
  const [selectedOpponentIds, setSelectedOpponentIds] = useState<string[]>([]);
  const [minRank, setMinRank] = useState<number>(1);
  const [maxRank, setMaxRank] = useState<number>(1000);
  const [minMeetings, setMinMeetings] = useState<number>(1);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Lookup
  const playersMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Date range from data
  const dataDateRange = useMemo(() => {
    if (!matches || matches.length === 0) return { min: '', max: '' };
    const dates = matches.map((m) => m.date).filter(Boolean).sort();
    return { min: dates[0] || '', max: dates[dates.length - 1] || '' };
  }, [matches]);

  // Compute H2H
  const opponentRecords = useMemo<OpponentRecord[]>(() => {
    if (!primaryPlayerId) return [];

    const records = new Map<string, { wins: number; losses: number }>();

    (matches ?? []).forEach((match) => {
      const isWinner = match.winnerId === primaryPlayerId;
      const isLoser = match.loserId === primaryPlayerId;
      if (!isWinner && !isLoser) return;

      const opponentId = isWinner ? match.loserId : match.winnerId;

      // Date filters
      if (fromDate && match.date && match.date < fromDate) return;
      if (toDate && match.date && match.date > toDate) return;

      // Opponent rank filter
      const opponentRank = isWinner ? match.lRank : match.wRank;
      if (typeof opponentRank === 'number') {
        if (opponentRank < minRank || opponentRank > maxRank) return;
      }

      if (!records.has(opponentId)) records.set(opponentId, { wins: 0, losses: 0 });
      const record = records.get(opponentId)!;
      if (isWinner) record.wins++;
      else record.losses++;
    });

    const recordsArray: OpponentRecord[] = Array.from(records.entries())
      .map(([opponentId, record]) => {
        const opponent = playersMap.get(opponentId);
        return {
          opponentId,
          opponentName: opponent?.name || 'Unknown',
          wins: record.wins,
          losses: record.losses,
          total: record.wins + record.losses,
        };
      })
      .filter((r) => r.total >= minMeetings);

    // Sort by total matches (descending)
    return recordsArray.sort((a, b) => b.total - a.total);
  }, [matches, primaryPlayerId, playersMap, fromDate, toDate, minRank, maxRank, minMeetings]);

  // Only selected opponents, sorted by total
  const displayedRecords = useMemo(() => {
    if (!primaryPlayerId) return [];
    if (selectedOpponentIds.length === 0) return [];
    const filtered = opponentRecords.filter((r) =>
      selectedOpponentIds.includes(r.opponentId)
    );
    return filtered.sort((a, b) => b.total - a.total);
  }, [primaryPlayerId, opponentRecords, selectedOpponentIds]);

  // Bulk add by current filters
  const handleFindOpponents = () => {
    const matchingOpponents = opponentRecords
      .filter((r) => !selectedOpponentIds.includes(r.opponentId))
      .map((r) => r.opponentId);
    setSelectedOpponentIds((prev) => [...prev, ...matchingOpponents]);
  };

  // Render chart
  useEffect(() => {
    if (!svgRef.current || !primaryPlayerId || displayedRecords.length === 0) {
      if (svgRef.current) {
        const svg = select(svgRef.current);
        svg.selectAll('*').remove();
        if (!primaryPlayerId) {
          svg
            .append('text')
            .attr('x', 400)
            .attr('y', 400)
            .attr('text-anchor', 'middle')
            .attr('fill', '#666')
            .style('font-size', '16px')
            .text('Select a primary player to view radial head-to-head records');
        } else if (selectedOpponentIds.length === 0) {
          svg
            .append('text')
            .attr('x', 400)
            .attr('y', 400)
            .attr('text-anchor', 'middle')
            .attr('fill', '#666')
            .style('font-size', '16px')
            .text('Select opponents to compare');
        }
      }
      return;
    }

    try {
      const svg = select(svgRef.current);
      svg.selectAll('*').remove();

      const width = 800;
      const height = 800;
      const centerX = width / 2;
      const centerY = height / 2;

      const innerRadius = 80; // "Zero line"
      const outerRadius = Math.min(width, height) / 2 - 100; // Max line

      const maxValue = Math.max(
        15, // At least 15 for gridlines
        max(displayedRecords, (r) => r.total) || 0
      );

      const radiusScale = scaleLinear()
        .domain([0, maxValue])
        .range([innerRadius, outerRadius]);

      // Angle scale for opponents
      const angleScale = scaleBand<string>()
        .domain(displayedRecords.map((r) => r.opponentId))
        .range([0, 2 * Math.PI]) // 0 = 12 o'clock in d3.arc space
        .padding(0.02);

      const bandWidth = angleScale.bandwidth();

      const g = svg.append('g').attr('transform', `translate(${centerX},${centerY})`);

      // Draw concentric gridlines
      const gridlineValues = [5, 10, 15, 20, 30, 40, 50];
      gridlineValues.forEach((value) => {
        if (value <= maxValue) {
          const radius = radiusScale(value);
          g.append('circle')
            .attr('r', radius)
            .attr('fill', 'none')
            .attr('stroke', 'rgba(0, 0, 0, 0.1)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2');

          g.append('text')
            .attr('x', 0)
            .attr('y', -radius - 5)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(0, 0, 0, 0.5)')
            .style('font-size', '10px')
            .text(value.toString());
        }
      });

      // Draw center circle
      g.append('circle')
        .attr('r', innerRadius)
        .attr('fill', 'rgba(0, 0, 0, 0.05)')
        .attr('stroke', 'rgba(0, 0, 0, 0.2)')
        .attr('stroke-width', 1);

      const primaryPlayer = playersMap.get(primaryPlayerId);

      // Draw arcs for each opponent
      displayedRecords.forEach((record, idx) => {
        const startAngle = angleScale(record.opponentId);
        if (startAngle == null) return;

        const endAngle = startAngle + bandWidth;
        const midAngle = (startAngle + endAngle) / 2;

        const lossEndRadius = radiusScale(record.losses);
        const totalRadius = radiusScale(record.total);

        // LOSS arc (inner)
        if (record.losses > 0) {
          const lossArcGenerator = arc()
            .innerRadius(innerRadius)
            .outerRadius(lossEndRadius);

          const lossPath = g
            .append('path')
            .attr('d', lossArcGenerator({ startAngle, endAngle } as any))
            .attr('fill', '#e91e63')
            .attr('opacity', 0.8)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);

          lossPath
            .on('mouseover', (event) => {
              showTooltip(
                {
                  title: `${primaryPlayer?.name || 'Unknown'} vs ${record.opponentName}`,
                  content: [
                    `${record.wins} Wins, ${record.losses} Losses`,
                    `${record.total} Total Matches`,
                  ],
                },
                event
              );
              select(event.currentTarget).attr('opacity', 1);
            })
            .on('mousemove', moveTooltip)
            .on('mouseout', (event) => {
              hideTooltip();
              select(event.currentTarget).attr('opacity', 0.8);
            });
        }

        // WIN arc (outer)
        if (record.wins > 0) {
          const winArcGenerator = arc()
            .innerRadius(lossEndRadius)
            .outerRadius(totalRadius);

          const winPath = g
            .append('path')
            .attr('d', winArcGenerator({ startAngle, endAngle } as any))
            .attr('fill', '#4caf50')
            .attr('opacity', 0.8)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);

          winPath
            .on('mouseover', (event) => {
              showTooltip(
                {
                  title: `${primaryPlayer?.name || 'Unknown'} vs ${record.opponentName}`,
                  content: [
                    `${record.wins} Wins, ${record.losses} Losses`,
                    `${record.total} Total Matches`,
                  ],
                },
                event
              );
              select(event.currentTarget).attr('opacity', 1);
            })
            .on('mousemove', moveTooltip)
            .on('mouseout', (event) => {
              hideTooltip();
              select(event.currentTarget).attr('opacity', 0.8);
            });
        }

        // ---- CORRECTED LABEL LOGIC ----
        // Label on outer edge - aligned with the spoke
        const labelRadius = outerRadius + 20;
        const labelX = Math.sin(midAngle) * labelRadius;
        const labelY = -Math.cos(midAngle) * labelRadius;

        // Get rotation in degrees (0-360, where 0 is 12 o'clock)
        const textRotation = (midAngle * 180) / Math.PI;

        // Check if the label is on the "bottom half" of the chart (3 o'clock to 9 o'clock)
        const flip = textRotation > 90 && textRotation < 270;

        // If we flip, add 180 degrees to the rotation and anchor the text at its end
        const finalRotation = flip ? textRotation + 180 : textRotation;
        const textAnchor = flip ? 'end' : 'start';

        g.append('text')
          .attr('text-anchor', textAnchor)
          .attr('alignment-baseline', 'middle')
          .attr('fill', 'currentColor')
          .style('font-size', '11px')
          .style('font-weight', '500')
          .attr('transform', `translate(${labelX}, ${labelY}) rotate(${finalRotation})`)
          .text(`${idx + 1}. ${record.opponentName}`);
        // ---- END OF FIX ----

        // Spoke line – same midAngle, same sin / -cos mapping
        const barEndRadius = totalRadius;

        const x1 = Math.sin(midAngle) * innerRadius;
        const y1 = -Math.cos(midAngle) * innerRadius;
        const x2 = Math.sin(midAngle) * barEndRadius;
        const y2 = -Math.cos(midAngle) * barEndRadius;

        g.append('line')
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('stroke', 'rgba(0, 0, 0, 0.1)')
          .attr('stroke-width', 0.5)
          .attr('stroke-dasharray', '1,3');
      });

      svg.attr('width', width).attr('height', height);
    } catch (err) {
      console.error('StackedRadialBarChart render error:', err);
      const svg = select(svgRef.current!);
      svg.selectAll('*').remove();
      svg
        .append('text')
        .attr('x', 400)
        .attr('y', 400)
        .attr('text-anchor', 'middle')
        .attr('fill', 'crimson')
        .style('font-size', '14px')
        .text('Error rendering chart. See console for details.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedRecords, primaryPlayerId, playersMap, selectedOpponentIds]);

  return (
    <div className="chart-container">
      <h3>Stacked Radial Bar Chart - Head-to-Head Records</h3>

      <div className="h2h-filters">
        <div className="filter-section">
          <h4>Primary Player</h4>
          <div className="filter-control">
            <PlayerAutocomplete
              players={players}
              selectedPlayer={primaryPlayerId}
              onSelect={setPrimaryPlayerId}
              placeholder="Select primary player..."
            />
          </div>
        </div>

        {primaryPlayerId && (
          <>
            <div className="filter-section">
              <h4>Selected Opponents</h4>
              <div className="selected-opponents">
                {selectedOpponentIds.map((opponentId) => {
                  const opponent = playersMap.get(opponentId);
                  const record = opponentRecords.find((r) => r.opponentId === opponentId);
                  return (
                    <div key={opponentId} className="opponent-tag">
                      <span>
                        {opponent?.name || 'Unknown'}
                        {record && ` (${record.wins}-${record.losses})`}
                      </span>
                      <button
                        onClick={() =>
                          setSelectedOpponentIds((prev) => prev.filter((id) => id !== opponentId))
                        }
                        className="remove-opponent"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="filter-control">
                <OpponentAutocomplete
                  players={players.filter(
                    (p) => p.id !== primaryPlayerId && !selectedOpponentIds.includes(p.id)
                  )}
                  onAdd={(id) => {
                    if (id && !selectedOpponentIds.includes(id)) {
                      setSelectedOpponentIds((prev) => [...prev, id]);
                    }
                  }}
                  placeholder="Add opponent..."
                />
              </div>
            </div>

            <div className="filter-section bulk-add-section">
              <h4>Bulk Add Opponents</h4>
              <div className="bulk-add-controls">
                <div className="filter-control">
                  <label htmlFor="radial-min-rank">Min Rank:</label>
                  <input
                    id="radial-min-rank"
                    type="number"
                    min="1"
                    max="1000"
                    value={minRank}
                    onChange={(e) => setMinRank(parseInt(e.target.value) || 1)}
                    className="filter-input-number"
                  />
                </div>
                <div className="filter-control">
                  <label htmlFor="radial-max-rank">Max Rank:</label>
                  <input
                    id="radial-max-rank"
                    type="number"
                    min="1"
                    max="1000"
                    value={maxRank}
                    onChange={(e) => setMaxRank(parseInt(e.target.value) || 1000)}
                    className="filter-input-number"
                  />
                </div>
                <div className="filter-control">
                  <label htmlFor="radial-min-meetings">Min Meetings:</label>
                  <input
                    id="radial-min-meetings"
                    type="number"
                    min="1"
                    value={minMeetings}
                    onChange={(e) => setMinMeetings(parseInt(e.target.value) || 1)}
                    className="filter-input-number"
                  />
                </div>
                <div className="filter-control date-range-control">
                  <label htmlFor="radial-from-date">From Date:</label>
                  <input
                    id="radial-from-date"
                    type="date"
                    value={fromDate}
                    min={dataDateRange.min || undefined}
                    max={dataDateRange.max || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="filter-input-date"
                  />
                </div>
                <div className="filter-control date-range-control">
                  <label htmlFor="radial-to-date">To Date:</label>
                  <input
                    id="radial-to-date"
                    type="date"
                    value={toDate}
                    min={fromDate || dataDateRange.min || undefined}
                    max={dataDateRange.max || undefined}
                    onChange={(e) => setToDate(e.target.value)}
                    className="filter-input-date"
                  />
                </div>
                <div className="filter-control">
                  <button onClick={handleFindOpponents} className="find-opponents-button">
                    Find & Add Opponents
                  </button>
                </div>
              </div>
              {opponentRecords.length > 0 && (
                <div className="bulk-add-info">
                  Found {opponentRecords.length} opponent
                  {opponentRecords.length !== 1 ? 's' : ''} matching criteria
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {primaryPlayerId && displayedRecords.length > 0 && (
        <div className="h2h-legend">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#4caf50' }} />
            <span>Wins (Outer segment)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#e91e63' }} />
            <span>Losses (Inner segment)</span>
          </div>
        </div>
      )}

      <svg ref={svgRef} width={800} height={800} />
    </div>
  );
}