/**
 * Upset Density by Round
 * Stacked bars showing upset share across rounds
 */

import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';
import { scaleBand, scaleLinear, scaleOrdinal } from 'd3-scale';
import { formatRound, formatPercent } from '../../utils/d3/formatters';
import { showTooltip, hideTooltip, moveTooltip } from '../../utils/d3/tooltip';
import type { Match, Derived, Round } from '../../types';

interface Props {
  matches: Match[];
  derived: Derived[];
}

export function UpsetDensityByRound({ matches, derived }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current) return;
    
    const derivedMap = new Map(derived.map(d => [d.matchId, d]));
    
    // Group by round
    const roundStats = new Map<Round, { total: number; upsets: number }>();
    
    matches.forEach(match => {
      const d = derivedMap.get(match.id);
      if (d && d.upset !== undefined) {
        if (!roundStats.has(match.round)) {
          roundStats.set(match.round, { total: 0, upsets: 0 });
        }
        const stats = roundStats.get(match.round)!;
        stats.total++;
        if (d.upset) stats.upsets++;
      }
    });
    
    const allRounds: Round[] = ['1R', '2R', '3R', '4R', 'QF', 'SF', 'F'];
    const roundsToShow = allRounds.filter(r => roundStats.has(r));
    
    if (roundsToShow.length === 0) return;
    
    const svg = select(svgRef.current);
    svg.selectAll('*').remove();
    
    const margin = { top: 20, right: 20, bottom: 60, left: 80 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const xScale = scaleBand()
      .domain(roundsToShow)
      .range([0, width])
      .padding(0.2);
    
    const yScale = scaleLinear()
      .domain([0, 1])
      .range([height, 0]);
    
    const colorScale = scaleOrdinal<string, string>()
      .domain(['upset', 'expected'])
      .range(['#E91E63', '#2196F3']);
    
    // Draw bars
    roundsToShow.forEach(round => {
      const stats = roundStats.get(round)!;
      const upsetRatio = stats.upsets / stats.total;
      const expectedRatio = 1 - upsetRatio;
      
      const x = xScale(round) || 0;
      const barWidth = xScale.bandwidth() || 0;
      
      // Expected win bar (bottom)
      g.append('rect')
        .attr('x', x)
        .attr('y', yScale(upsetRatio))
        .attr('width', barWidth)
        .attr('height', height - yScale(upsetRatio))
        .attr('fill', colorScale('expected'))
        .attr('opacity', 0.7);
      
      // Upset bar (top)
      g.append('rect')
        .attr('x', x)
        .attr('y', 0)
        .attr('width', barWidth)
        .attr('height', height - yScale(upsetRatio))
        .attr('fill', colorScale('upset'))
        .attr('opacity', 0.7)
        .on('mouseover', function(event) {
          showTooltip(
            {
              title: formatRound(round),
              content: [
                `Upsets: ${stats.upsets} (${formatPercent(upsetRatio)})`,
                `Expected: ${stats.total - stats.upsets} (${formatPercent(expectedRatio)})`,
                `Total: ${stats.total}`
              ]
            },
            event
          );
        })
        .on('mousemove', moveTooltip)
        .on('mouseout', hideTooltip);
      
      // Label
      g.append('text')
        .attr('x', x + barWidth / 2)
        .attr('y', yScale(upsetRatio) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', 'white')
        .text(formatPercent(upsetRatio));
    });
    
    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(axisBottom(xScale).tickFormat(formatRound))
      .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');
    
    g.append('g')
      .call(axisLeft(yScale).tickFormat(formatPercent));
    
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -height / 2)
      .attr('fill', 'currentColor')
      .style('text-anchor', 'middle')
      .text('Proportion of Matches');
    
    // Legend
    const legend = g.append('g')
      .attr('transform', `translate(${width - 150}, 20)`);
    
    ['upset', 'expected'].forEach((type, i) => {
      const legendRow = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
      legendRow.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', colorScale(type))
        .attr('opacity', 0.7);
      legendRow.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .attr('font-size', '12px')
        .text(type === 'upset' ? 'Upset' : 'Expected');
    });
    
  }, [matches, derived]);
  
  return (
    <div className="chart-container">
      <h3>Upset Density by Round</h3>
      <svg ref={svgRef} width={800} height={400}></svg>
    </div>
  );
}

