/**
 * Player Surface Profile
 * Radar or bar cluster showing win% by surface/series for pinned players
 */

import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';
import { scaleBand, scaleLinear, scaleOrdinal } from 'd3-scale';
import { formatPercent } from '../../utils/d3/formatters';
import { showTooltip, hideTooltip, moveTooltip } from '../../utils/d3/tooltip';
import { useStore } from '../../state/store';
import type { Match, Tournament, Surface, Series } from '../../types';

interface Props {
  matches: Match[];
  tournaments: Tournament[];
  players: Array<{ id: string; name: string }>;
}

export function PlayerSurfaceProfile({ matches, tournaments, players }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { playerIds } = useStore();
  
  useEffect(() => {
    if (!svgRef.current || playerIds.length === 0) return;
    
    const tournamentsMap = new Map(tournaments.map(t => [t.id, t]));
    
    // Calculate win rates for each pinned player
    const playerStats = playerIds.map(playerId => {
      const player = players.find(p => p.id === playerId);
      if (!player) return null;
      
      const playerMatches = matches.filter(
        m => m.winnerId === playerId || m.loserId === playerId
      );
      
      // Group by surface
      const surfaceStats = new Map<Surface, { wins: number; total: number }>();
      
      playerMatches.forEach(match => {
        const tournament = tournamentsMap.get(match.tournamentId);
        if (!tournament) return;
        
        if (!surfaceStats.has(tournament.surface)) {
          surfaceStats.set(tournament.surface, { wins: 0, total: 0 });
        }
        
        const stats = surfaceStats.get(tournament.surface)!;
        stats.total++;
        if (match.winnerId === playerId) {
          stats.wins++;
        }
      });
      
      return {
        playerId,
        playerName: player.name,
        surfaceStats: Array.from(surfaceStats.entries()).map(([surface, stats]) => ({
          surface,
          winRate: stats.total > 0 ? stats.wins / stats.total : 0,
          wins: stats.wins,
          total: stats.total
        }))
      };
    }).filter(Boolean) as Array<{
      playerId: string;
      playerName: string;
      surfaceStats: Array<{ surface: Surface; winRate: number; wins: number; total: number }>;
    }>;
    
    if (playerStats.length === 0) return;
    
    const svg = select(svgRef.current);
    svg.selectAll('*').remove();
    
    const margin = { top: 40, right: 80, bottom: 60, left: 100 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const surfaces: Surface[] = ['Hard', 'Clay', 'Grass', 'Carpet'];
    const xScale = scaleBand()
      .domain(surfaces)
      .range([0, width])
      .padding(0.2);
    
    const yScale = scaleLinear()
      .domain([0, 1])
      .range([height, 0]);
    
    const playerColorScale = scaleOrdinal<string, string>()
      .domain(playerIds)
      .range(['#E91E63', '#2196F3', '#4CAF50']);
    
    // Group bars by player
    const groupWidth = xScale.bandwidth() / playerStats.length;
    
    playerStats.forEach((playerData, playerIndex) => {
      surfaces.forEach((surface, surfaceIndex) => {
        const stat = playerData.surfaceStats.find(s => s.surface === surface);
        const winRate = stat?.winRate || 0;
        
        const x = (xScale(surface) || 0) + playerIndex * groupWidth;
        const barHeight = height - yScale(winRate);
        
        g.append('rect')
          .attr('x', x)
          .attr('y', yScale(winRate))
          .attr('width', groupWidth * 0.9)
          .attr('height', barHeight)
          .attr('fill', playerColorScale(playerData.playerId))
          .attr('opacity', 0.7)
          .on('mouseover', function(event) {
            if (stat) {
              showTooltip(
                {
                  title: `${playerData.playerName} - ${surface}`,
                  content: [
                    `Win Rate: ${formatPercent(winRate)}`,
                    `Wins: ${stat.wins}`,
                    `Total: ${stat.total}`
                  ]
                },
                event
              );
            }
          })
          .on('mousemove', moveTooltip)
          .on('mouseout', hideTooltip);
        
        if (stat && stat.total > 0) {
          g.append('text')
            .attr('x', x + groupWidth / 2)
            .attr('y', yScale(winRate) - 5)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', 'currentColor')
            .text(formatPercent(winRate));
        }
      });
    });
    
    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(axisBottom(xScale));
    
    g.append('g')
      .call(axisLeft(yScale).tickFormat(formatPercent));
    
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -70)
      .attr('x', -height / 2)
      .attr('fill', 'currentColor')
      .style('text-anchor', 'middle')
      .text('Win Rate');
    
    // Legend
    const legend = g.append('g')
      .attr('transform', `translate(${width + 20}, 20)`);
    
    playerStats.forEach((playerData, i) => {
      const legendRow = legend.append('g').attr('transform', `translate(0, ${i * 25})`);
      legendRow.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', playerColorScale(playerData.playerId))
        .attr('opacity', 0.7);
      legendRow.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .attr('font-size', '12px')
        .text(playerData.playerName);
    });
    
  }, [matches, tournaments, players, playerIds]);
  
  if (playerIds.length === 0) {
    return (
      <div className="chart-container">
        <h3>Player Surface Profile</h3>
        <p>Pin up to 3 players to see their win rates by surface</p>
      </div>
    );
  }
  
  return (
    <div className="chart-container">
      <h3>Player Surface Profile</h3>
      <svg ref={svgRef} width={800} height={400}></svg>
    </div>
  );
}

