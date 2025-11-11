/**
 * D3 tooltip utilities
 */

import { select, Selection } from 'd3-selection';

export interface TooltipData {
  title?: string;
  content: string | string[];
  x?: number;
  y?: number;
}

let tooltip: Selection<HTMLDivElement, unknown, HTMLElement, any> | null = null;

export function initTooltip(container: string | HTMLElement): void {
  const containerElement = typeof container === 'string' 
    ? document.querySelector(container) || document.body
    : container;
  
  tooltip = select(containerElement)
    .append('div')
    .attr('class', 'd3-tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('opacity', 0)
    .style('background', 'rgba(0, 0, 0, 0.85)')
    .style('color', 'white')
    .style('padding', '8px 12px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('z-index', '1000')
    .style('max-width', '300px')
    .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)');
}

export function showTooltip(data: TooltipData, event: MouseEvent): void {
  if (!tooltip) {
    initTooltip(document.body);
  }
  
  if (!tooltip) return;
  
  const content = Array.isArray(data.content) 
    ? data.content.join('<br/>')
    : data.content;
  
  const html = data.title 
    ? `<strong>${data.title}</strong><br/>${content}`
    : content;
  
  tooltip
    .html(html)
    .style('opacity', 1)
    .style('left', `${(data.x || event.pageX) + 10}px`)
    .style('top', `${(data.y || event.pageY) - 10}px`);
}

export function hideTooltip(): void {
  if (tooltip) {
    tooltip.style('opacity', 0);
  }
}

export function moveTooltip(event: MouseEvent): void {
  if (tooltip) {
    tooltip
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 10}px`);
  }
}

