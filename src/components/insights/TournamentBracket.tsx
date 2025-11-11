import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { hierarchy, tree, HierarchyNode } from 'd3-hierarchy';
import { linkHorizontal } from 'd3-shape';
import type { BracketNode } from '../../types';

interface TournamentBracketProps {
  bracketData: BracketNode | null;
  compact?: boolean;               // tighter vertical spacing
  initialCollapsedDepth?: number;  // e.g., 2 collapses QF & earlier
  minRow?: number;                 // min px between rows (leaves)
  minCol?: number;                 // min px between columns (rounds) for shallow draws
  showRoundHeaders?: boolean;      // optional round headers (off by default)
}

export function TournamentBracket({
  bracketData,
  compact = true,
  initialCollapsedDepth = 4,
  minRow = 34,
  minCol = 240,
  showRoundHeaders = true,
}: TournamentBracketProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HierarchyNode<BracketNode> | null>(null);

  function collapseByDepth(n: HierarchyNode<BracketNode>, maxDepth: number) {
    if (n.depth >= maxDepth && n.children) {
      (n as any)._children = n.children;
      n.children = undefined;
    }
    (n.children || (n as any)._children || []).forEach((c: any) =>
      collapseByDepth(c, maxDepth)
    );
  }

  function toggle(n: any) {
    if (n.children) { n._children = n.children; n.children = undefined; }
    else if (n._children) { n.children = n._children; n._children = undefined; }
  }

  useEffect(() => {
    if (!svgRef.current || !bracketData) return;

    const svg = select(svgRef.current);

    // Reuse root to preserve collapse state
    const root =
      rootRef.current || hierarchy(bracketData as BracketNode, (d) => d.children as any);
    if (!rootRef.current) {
      collapseByDepth(root, initialCollapsedDepth);
      rootRef.current = root;
    }

    function draw() {
      svg.selectAll('*').remove();

      // Measure container — parent MUST set a real height
      const container = svg.node()?.parentElement;
      const containerW = container?.clientWidth || window.innerWidth - 64;
      const containerH = container?.clientHeight || window.innerHeight - 240;

      // Layout constants
      const margin = { top: 40, right: 0, bottom: 0, left: 0 };
      const nodeW = 200; // card width (slightly smaller for better fit)
      const nodeH = 65;  // card height

      // Basic counts
      const rounds = (root.height || 0) + 1;
      const leaves = Math.max(root.leaves().length, 1);

      // Usable drawing area (inside margins)
      const usableW = Math.max(containerW - margin.left - margin.right, 400);
      const usableH = Math.max(containerH - margin.top - margin.bottom, 400);

      // Deep draw heuristic: Slams/Masters usually have >=64 leaves
      const isDeep = root.leaves().length >= 64;

      // For deep draws, use more aggressive spacing
      const hPad = isDeep ? 4 : 8;
      const vPad = isDeep ? 4 : 8;

      // Calculate column gap - ensure minimum spacing for readability
      let colGap: number;
      if (root.height > 0) {
        // For deep draws, calculate to fit width but maintain minimum spacing
        const minColGap = isDeep ? 100 : minCol;
        const exactFitCol = (usableW - nodeW - 2 * hPad) / root.height;
        colGap = Math.max(minColGap, exactFitCol);
      } else {
        colGap = minCol;
      }

      // Vertical spacing: for deep draws, use tighter spacing but still readable
      const baseRowGap = isDeep ? (compact ? 40 : 48) : minRow;
      const rowGap = Math.max(
        baseRowGap * (compact ? 0.8 : 1),
        leaves > 1 ? Math.min(usableH / (leaves - 1), baseRowGap * 1.5) : usableH
      );

      // Layout with explicit spacing
            const layout = tree<BracketNode>()
              .nodeSize([rowGap, colGap])
              .separation((a, b) => {
                // Non-siblings
                if (a.parent !== b.parent) {
                  return 1.2; // Default non-sibling separation
                }    
                if (a.depth >= 5) { // R64 & R128
                  return 1.4; // 2x the base rowGap
                }
                if (a.depth === 4) { // R32
                  return 1.4; // 1.8x the base rowGap
                }
                if (a.depth === 3) { // R16
                  return 1.4; // 1.5x the base rowGap
                }
                if (a.depth === 2) { // QF
                  return 1.2; // 1.2x the base rowGap
                }
                // SF (depth 1)
                return 1; // Default 1x space
              });

      const treeData = layout(root);
      const nodes = treeData.descendants();
      const links = treeData.links();

      

      // Mirror horizontally so Final is on the right
      const depthW = root.height * colGap;
      const cx = (d: any) => d.x;                 // vertical
      const cy = (d: any) => depthW - d.y;        // mirrored horizontal

      // Compute extents (include node footprint + configurable pad)
      const minX = Math.min(...nodes.map((n) => cx(n) - nodeH / 2)) - vPad;
      const maxX = Math.max(...nodes.map((n) => cx(n) + nodeH / 2)) + vPad;
      const minY = Math.min(...nodes.map((n) => cy(n) - nodeW / 2)) - hPad;
      const maxY = Math.max(...nodes.map((n) => cy(n) + nodeW / 2)) + hPad;

      const innerW = maxY - minY;   // intrinsic content width
      const innerH = maxX - minX;   // intrinsic content height

      // --- SCALING STRATEGY ---
      // For deep draws: prioritize fitting width, allow vertical scrolling if needed
      // For shallow draws: use available space, can scale up slightly for better use of space
      const scaleToWidth = usableW / innerW;
      const scaleToHeight = usableH / innerH;
      
      let s: number;
      if (isDeep) {
        // Deep draws (Grand Slams/Masters): 
        // - Scale to fit width primarily
        // - Maintain minimum scale of 0.8 for readability
        // - Allow vertical scrolling if content is taller than viewport
        s = Math.max(0.8, Math.min(scaleToWidth, 1));
      } else {
        // Shallow draws: use available space, allow slight upscaling for better use of wide screens
        // Cap at 1.2x to prevent excessive growth
        s = Math.min(scaleToWidth, scaleToHeight, 1.2);
      }

      // --- POSITION ---
      // For deep draws, left-align and top-align (allows scrolling)
      // For shallow draws, center both horizontally and vertically
      let offsetX = margin.left;
      let offsetY = margin.top;
      
      if (!isDeep) {
        // Center shallow draws horizontally
        const leftoverW = usableW - innerW * s;
        if (leftoverW > 0) {
          offsetX = margin.left + leftoverW / 2;
        }
      }
      
      // Center vertically if there's extra space and not a deep draw
      if (!isDeep) {
        const leftoverH = usableH - innerH * s;
        if (leftoverH > 0) {
          offsetY = margin.top + leftoverH / 2;
        }
      }

      // --- SVG size: accommodate full content and use available space ---
      const scaledContentW = innerW * s;
      const scaledContentH = innerH * s;
      
      // For shallow draws, use full container width to allow growth on wider screens
      // For deep draws, allow growth for scrolling
      const svgW = isDeep 
        ? Math.max(containerW, scaledContentW + margin.left + margin.right)
        : Math.max(containerW, scaledContentW + margin.left + margin.right); // Use full width for both
      
      const svgH = Math.max(containerH, scaledContentH + margin.top + margin.bottom);

      svg
        .attr('width', svgW)
        .attr('height', svgH)
        .attr('viewBox', `0 0 ${svgW} ${svgH}`)
        .attr('preserveAspectRatio', 'none');

      // Apply transform: translate to position, scale, then normalize to content origin
      const g = svg
        .append('g')
        .attr('transform', `translate(${offsetX}, ${offsetY}) scale(${s}) translate(${-minY}, ${-minX})`);



      // Optional round headers (no shaded bands)
      if (showRoundHeaders) {
                    const roundNames = ['Final', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'];
                    for (let i = 0; i < rounds; i++) {
                  // CHECK: See if any visible node exists at this depth
                  const isRoundVisible = nodes.some(n => n.depth === i);
        
                  // Only draw the header if the round is visible
                  if (isRoundVisible) {
                          const headerX = depthW - i * colGap;
                          g.append('text')
                             .attr('x', headerX)
                             .attr('y', minX - 24)
                             .attr('text-anchor', 'middle')
                             .attr('font-size', 20)
                             .attr('font-weight', 700)
                             .attr('fill', '#6B7280')
                             .text(roundNames[i] ?? '');
                  }
                    }
                 }

      // Link paths
      const linkGen = linkHorizontal<any, any>()
        .x((d) => cy(d))
        .y((d) => cx(d));

      g.selectAll('.link')
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', linkGen as any)
        .attr('fill', 'none')
        .attr('stroke', '#CBD5E1')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0)
        .transition()
        .duration(200)
        .attr('opacity', 1);

      // Nodes
      const node = g
        .selectAll('.node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${cy(d)},${cx(d)})`)
        .on('click', (_, d: any) => { toggle(d); draw(); })
        .attr('cursor', 'pointer');

      // Card
      node
        .append('rect')
        .attr('x', -nodeW / 2)
        .attr('y', -nodeH / 2)
        .attr('width', nodeW)
        .attr('height', nodeH)
        .attr('rx', 10)
        .attr('fill', '#fff')
        .attr('stroke', '#E5E7EB');

      // Winner / Loser / Score (plain text)
      node.append('text')
        .attr('y', -12)
        .attr('text-anchor', 'middle')
        .attr('font-size', 13)
        .attr('font-weight', 700)
        .text((d: any) => d.data.attributes?.winnerName ?? '');

      node.append('text')
        .attr('y', 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('fill', '#6B7280')
        .text((d: any) => d.data.attributes?.loserName ?? '');

      node.append('text')
        .attr('y', 24)
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('fill', '#6B7280')
        .text((d: any) => d.data.attributes?.score ?? '');

      // Collapse chip (+ / −)
      node.append('rect')
        .attr('x', -nodeW / 2 - 24)
        .attr('y', -12)
        .attr('rx', 6)
        .attr('width', 20)
        .attr('height', 24)
        .attr('fill', '#F3F4F6')
        .attr('stroke', '#D1D5DB');

      node.append('text')
        .attr('x', -nodeW / 2 - 14)
        .attr('y', 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('font-weight', 700)
        .attr('fill', '#4B5563')
        .text((d: any) => (d.children ? '−' : d._children ? '+' : ''))
        .style('pointer-events', 'none');
    }

    draw();

// Redraw on resize using ResizeObserver
const container = svgRef.current?.parentElement;
if (!container) return; // Should not happen, but good to check

let rAF: number | null = null;
const onResize = () => {
  if (rAF) cancelAnimationFrame(rAF);
  rAF = requestAnimationFrame(draw);
};

const resizeObserver = new ResizeObserver(onResize);
resizeObserver.observe(container);

// Cleanup
return () => {
  if (rAF) cancelAnimationFrame(rAF);
  resizeObserver.disconnect();
};

  }, [bracketData, compact, initialCollapsedDepth, minRow, minCol, showRoundHeaders]);

  if (!bracketData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Select a tournament to view its bracket
      </div>
    );
  }


return (
  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
    <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }} />
  </div>
);
}
