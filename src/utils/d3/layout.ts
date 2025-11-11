/**
 * D3 layout utilities
 */

import { forceSimulation, forceLink, forceManyBody, forceCenter, Simulation } from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

export interface Node extends SimulationNodeDatum {
  id: string;
  name: string;
  value?: number;
}

export interface Link extends SimulationLinkDatum<Node> {
  source: Node | string;
  target: Node | string;
  value?: number;
}

export function createForceSimulation(
  nodes: Node[],
  links: Link[],
  width: number,
  height: number
): Simulation<Node, Link> {
  return forceSimulation<Node>(nodes)
    .force('link', forceLink<Node, Link>(links).id(d => d.id).distance(100))
    .force('charge', forceManyBody().strength(-300))
    .force('center', forceCenter(width / 2, height / 2));
}

// Beeswarm layout helper
export function beeswarmLayout(
  data: Array<{ value: number; [key: string]: any }>,
  xScale: (d: number) => number,
  radius: number = 4
): Array<{ x: number; y: number; [key: string]: any }> {
  // Simple greedy algorithm for beeswarm
  const result: Array<{ x: number; y: number; [key: string]: any }> = [];
  const bins = new Map<number, number[]>(); // x position -> list of y positions
  
  for (const d of data) {
    const x = xScale(d.value);
    let y = 0;
    let found = false;
    
    // Try to place at y = 0, then try offsets
    for (let offset = 0; offset < 1000; offset += radius * 2.1) {
      const candidates = [offset, -offset];
      for (const candidateY of candidates) {
        let collision = false;
        const existingYs = bins.get(Math.round(x)) || [];
        
        for (const existingY of existingYs) {
          if (Math.abs(existingY - candidateY) < radius * 2.1) {
            collision = true;
            break;
          }
        }
        
        if (!collision) {
          y = candidateY;
          found = true;
          break;
        }
      }
      
      if (found) break;
    }
    
    if (!bins.has(Math.round(x))) {
      bins.set(Math.round(x), []);
    }
    bins.get(Math.round(x))!.push(y);
    
    result.push({ ...d, x, y });
  }
  
  return result;
}

