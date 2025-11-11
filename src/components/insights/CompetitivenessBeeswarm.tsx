/**
 * Competitiveness Beeswarm Chart
 * Shows RankDiff by Round (beeswarm plot)
 */

import { useEffect, useRef } from 'react';
import { select, Selection } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';
import { createLinearScale, createBandScale, roundColors } from '../../utils/d3/scales';
import { beeswarmLayout } from '../../utils/d3/layout';
import { formatRound, formatInteger } from '../../utils/d3/formatters';
import { showTooltip, hideTooltip, moveTooltip } from '../../utils/d3/tooltip';
import { useStore } from '../../state/store';
import type { Match, Derived, Round, Surface, Series } from '../../types';

interface Props {
  matches: Match[];
  derived: Derived[];
  players: Array<{ id: string; name: string }>;
  tournaments: Array<{ id: string; surface: Surface; series: Series }>;
  surface: Surface | null;
  series: Series | null;
}

export function CompetitivenessBeeswarm({ matches, derived, players, tournaments, surface, series }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { rounds } = useStore();
  
  useEffect(() => {
    if (!svgRef.current) return;
    
    // Create tournament lookup map
    const tournamentsMap = new Map(tournaments.map(t => [t.id, t]));
    
    // Filter matches
    let filteredMatches = matches;
    if (surface) {
      filteredMatches = filteredMatches.filter(m => {
        const tournament = tournamentsMap.get(m.tournamentId);
        return tournament?.surface === surface;
      });
    }
    if (series) {
      filteredMatches = filteredMatches.filter(m => {
        const tournament = tournamentsMap.get(m.tournamentId);
        return tournament?.series === series;
      });
    }
    if (rounds.length > 0) {
      filteredMatches = filteredMatches.filter(m => rounds.includes(m.round));
    }
    
    // Create derived map
    const derivedMap = new Map(derived.map(d => [d.matchId, d]));
    
    // Group by round
    const roundGroups = new Map<Round, Array<{ match: Match; derived: Derived }>>();
    
    filteredMatches.forEach(match => {
      const d = derivedMap.get(match.id);
      if (d && d.rankDiff !== undefined) {
        if (!roundGroups.has(match.round)) {
          roundGroups.set(match.round, []);
        }
        roundGroups.get(match.round)!.push({ match, derived: d });
      }
    });
    
    const allRounds: Round[] = ['1R', '2R', '3R', '4R', 'QF', 'SF', 'F'];
    const roundsToShow = allRounds.filter(r => roundGroups.has(r));
    
    if (roundsToShow.length === 0) return;
    
    const svg = select(svgRef.current);
    svg.selectAll('*').remove();
    
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const xScale = createBandScale(roundsToShow, [0, width]);
    const yScale = createLinearScale(
      [
        Math.min(...Array.from(roundGroups.values()).flat().map(d => d.derived.rankDiff || 0)),
        Math.max(...Array.from(roundGroups.values()).flat().map(d => d.derived.rankDiff || 0))
      ],
      [height, 0]
    );
    
    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(axisBottom(xScale).tickFormat(formatRound))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');
    
    g.append('g')
      .call(axisLeft(yScale).tickFormat(formatInteger))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .attr('fill', 'currentColor')
      .style('text-anchor', 'middle')
      .text('Rank Difference (Winner - Loser)');
    
    // Beeswarm plot
    roundsToShow.forEach(round => {
      const data = roundGroups.get(round)!;
      const xPos = (xScale(round) || 0) + (xScale.bandwidth() || 0) / 2;
      
      // Create beeswarm layout
      const beeswarmData = beeswarmLayout(
        data.map(d => ({ value: d.derived.rankDiff || 0, match: d.match, derived: d.derived })),
        (val) => yScale(val),
        4
      );
      
      g.selectAll(`circle.round-${round}`)
        .data(beeswarmData)
        .enter()
        .append('circle')
        .attr('class', `round-${round}`)
        .attr('cx', xPos)
        .attr('cy', d => d.y)
        .attr('r', 4)
        .attr('fill', roundColors(round))
        .attr('opacity', 0.6)
        .on('mouseover', function(event, d) {
          const winner = players.find(p => p.id === d.match.winnerId);
          const loser = players.find(p => p.id === d.match.loserId);
          showTooltip(
            {
              title: `${winner?.name || 'Unknown'} vs ${loser?.name || 'Unknown'}`,
              content: [
                `Round: ${formatRound(round)}`,
                `Rank Diff: ${formatInteger(d.derived.rankDiff || 0)}`,
                `Date: ${d.match.date}`
              ]
            },
            event
          );
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', hideTooltip);
    });
    
  }, [matches, derived, players, tournaments, surface, series, rounds]);
  
  return (
    <div className="chart-container">
      <h3>Competitiveness by Round</h3>
      <svg ref={svgRef} width={800} height={400}></svg>
    </div>
  );
}

