/**
 * Head-to-Head Radial Bar Chart
 * Shows wins (green, right) and losses (red, left) for a selected player against opponents
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';
import { scaleLinear, scaleBand } from 'd3-scale';
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

interface HeadToHeadChartProps {
  matches: Match[];
  tournaments: Tournament[]; // accepted but not used in this component
  players: Player[];
}

interface OpponentRecord {
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
  total: number;
}

export function HeadToHeadChart({
  matches = [],
  tournaments: _tournaments = [],
  players = [],
}: HeadToHeadChartProps) {
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

  // Date range from data (assumes YYYY-MM-DD strings)
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

      // Date filters (string compare ok for ISO format)
      if (fromDate && match.date && match.date < fromDate) return;
      if (toDate && match.date && match.date > toDate) return;

      // Opponent rank filter at time of match
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

    return recordsArray.sort((a, b) => b.total - a.total);
  }, [matches, primaryPlayerId, playersMap, fromDate, toDate, minRank, maxRank, minMeetings]);

  // Only selected opponents
  const displayedRecords = useMemo(() => {
    if (selectedOpponentIds.length === 0) return [];
    return opponentRecords.filter((r) => selectedOpponentIds.includes(r.opponentId));
  }, [opponentRecords, selectedOpponentIds]);

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
            .attr('y', 300)
            .attr('text-anchor', 'middle')
            .attr('fill', '#666')
            .style('font-size', '16px')
            .text('Select a primary player to view head-to-head records');
        } else if (selectedOpponentIds.length === 0) {
          svg
            .append('text')
            .attr('x', 400)
            .attr('y', 300)
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

      const margin = { top: 60, right: 40, bottom: 40, left: 200 };
      const width = 800 - margin.left - margin.right;
      const height =
        Math.max(400, displayedRecords.length * 40 + 100) - margin.top - margin.bottom;

      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      // Max value (avoid 0/NaN)
      const rawMax = Math.max(
        0,
        ...displayedRecords.map((r) => Math.max(r.wins || 0, r.losses || 0))
      );
      const maxValue = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 1;

      // Scales
      const xScale = scaleLinear()
        .domain([-maxValue, maxValue])
        .range([0, width])
        .nice();

      // Use opponent *names* as the categorical domain to keep labels + bars in sync
      const yScale = scaleBand<string>()
        .domain(displayedRecords.map((r) => r.opponentName))
        .range([0, height])
        .padding(0.2);

      // Center line
      g.append('line')
        .attr('x1', xScale(0))
        .attr('x2', xScale(0))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#666')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '3,3');

      // Bars
      displayedRecords.forEach((record) => {
        const y = yScale(record.opponentName);
        if (y === undefined) return;

        const barHeight = yScale.bandwidth();

        // Loss (left)
        if (record.losses > 0) {
          g.append('rect')
            .attr('x', xScale(-record.losses))
            .attr('y', y)
            .attr('width', xScale(0) - xScale(-record.losses))
            .attr('height', barHeight)
            .attr('fill', '#e91e63')
            .attr('opacity', 0.8);

          g.append('text')
            .attr('x', xScale(-record.losses) + 5)
            .attr('y', y + barHeight / 2)
            .attr('dy', '0.35em')
            .attr('fill', 'white')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .text(String(record.losses))
            .attr('text-anchor', 'start');
        }

        // Win (right)
        if (record.wins > 0) {
          g.append('rect')
            .attr('x', xScale(0))
            .attr('y', y)
            .attr('width', xScale(record.wins) - xScale(0))
            .attr('height', barHeight)
            .attr('fill', '#4caf50')
            .attr('opacity', 0.8);

          g.append('text')
            .attr('x', xScale(record.wins) - 5)
            .attr('y', y + barHeight / 2)
            .attr('dy', '0.35em')
            .attr('fill', 'white')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .text(String(record.wins))
            .attr('text-anchor', 'end');
        }

        // Hover area
        g.append('rect')
          .attr('x', xScale(-maxValue))
          .attr('y', y)
          .attr('width', width)
          .attr('height', barHeight)
          .attr('fill', 'transparent')
          .on('mouseover', function (event) {
            const primaryPlayer = playersMap.get(primaryPlayerId);
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
          })
          .on('mousemove', moveTooltip)
          .on('mouseout', hideTooltip);
      });

      // Y-axis (opponent names)
      g.append('g')
        .call(axisLeft(yScale))
        .selectAll('text')
        .style('font-size', '12px');

      // X-axis
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(
          axisBottom(xScale).tickFormat((d) => {
            const n = Number(d);
            return Number.isFinite(n) ? Math.abs(n).toString() : '0';
          })
        );

      // X-axis labels
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height + 35)
        .attr('fill', 'currentColor')
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text('Matches');

      g.append('text')
        .attr('x', width / 4)
        .attr('y', height + 20)
        .attr('fill', '#e91e63')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Losses');

      g.append('text')
        .attr('x', (3 * width) / 4)
        .attr('y', height + 20)
        .attr('fill', '#4caf50')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Wins');

      // Update SVG height
      svg.attr('height', height + margin.top + margin.bottom);
    } catch (err) {
      // Make failures visible but non-fatal
      // eslint-disable-next-line no-console
      console.error('HeadToHeadChart render error:', err);
      const svg = select(svgRef.current!);
      svg.selectAll('*').remove();
      svg
        .append('text')
        .attr('x', 400)
        .attr('y', 300)
        .attr('text-anchor', 'middle')
        .attr('fill', 'crimson')
        .style('font-size', '14px')
        .text('Error rendering chart. See console for details.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedRecords, primaryPlayerId, playersMap, selectedOpponentIds]);

  const primaryPlayer = primaryPlayerId ? playersMap.get(primaryPlayerId) : null;

  return (
    <div className="chart-container">
      <h3>Head-to-Head Records</h3>

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
                  <label htmlFor="h2h-min-rank">Min Rank:</label>
                  <input
                    id="h2h-min-rank"
                    type="number"
                    min="1"
                    max="1000"
                    value={minRank}
                    onChange={(e) => setMinRank(parseInt(e.target.value) || 1)}
                    className="filter-input-number"
                  />
                </div>
                <div className="filter-control">
                  <label htmlFor="h2h-max-rank">Max Rank:</label>
                  <input
                    id="h2h-max-rank"
                    type="number"
                    min="1"
                    max="1000"
                    value={maxRank}
                    onChange={(e) => setMaxRank(parseInt(e.target.value) || 1000)}
                    className="filter-input-number"
                  />
                </div>
                <div className="filter-control">
                  <label htmlFor="h2h-min-meetings">Min Meetings:</label>
                  <input
                    id="h2h-min-meetings"
                    type="number"
                    min="1"
                    value={minMeetings}
                    onChange={(e) => setMinMeetings(parseInt(e.target.value) || 1)}
                    className="filter-input-number"
                  />
                </div>
                <div className="filter-control date-range-control">
                  <label htmlFor="h2h-from-date">From Date:</label>
                  <input
                    id="h2h-from-date"
                    type="date"
                    value={fromDate}
                    min={dataDateRange.min || undefined}
                    max={dataDateRange.max || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="filter-input-date"
                  />
                </div>
                <div className="filter-control date-range-control">
                  <label htmlFor="h2h-to-date">To Date:</label>
                  <input
                    id="h2h-to-date"
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
            <span>Wins for {primaryPlayer?.name || 'Selected Player'}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#e91e63' }} />
            <span>Losses for {primaryPlayer?.name || 'Selected Player'}</span>
          </div>
        </div>
      )}

      <svg ref={svgRef} width={800} height={500} />
    </div>
  );
}
