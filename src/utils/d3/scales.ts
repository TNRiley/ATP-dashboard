/**
 * D3 scale utilities
 */

import { scaleLinear, scaleBand, scaleOrdinal, ScaleLinear, ScaleBand, ScaleOrdinal } from 'd3-scale';
import type { Surface, Series, Round } from '../../types';

export function createLinearScale(
  domain: [number, number],
  range: [number, number]
): ScaleLinear<number, number> {
  return scaleLinear().domain(domain).range(range).nice();
}

export function createBandScale(
  domain: string[],
  range: [number, number]
): ScaleBand<string> {
  return scaleBand().domain(domain).range(range).padding(0.1);
}

export function createOrdinalScale<T extends string>(
  domain: T[],
  range: string[]
): ScaleOrdinal<T, string> {
  return scaleOrdinal<T, string>().domain(domain).range(range);
}

// Color schemes
export const surfaceColors = createOrdinalScale<Surface>(
  ['Hard', 'Clay', 'Grass', 'Carpet'],
  ['#4A90E2', '#D4A574', '#7CB342', '#9E9E9E']
);

export const seriesColors = createOrdinalScale<Series>(
  ['Grand Slam', 'Masters', 'ATP500', 'ATP250'],
  ['#E91E63', '#9C27B0', '#2196F3', '#00BCD4']
);

export const roundColors = createOrdinalScale<Round>(
  ['1R', '2R', '3R', '4R', 'QF', 'SF', 'F', 'RR', 'Q1', 'Q2', 'Q3'],
  [
    '#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6',
    '#42A5F5', '#2196F3', '#1E88E5', '#1976D2',
    '#1565C0', '#0D47A1', '#0A3D91'
  ]
);

