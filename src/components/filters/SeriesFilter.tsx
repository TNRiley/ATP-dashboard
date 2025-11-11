/**
 * Series filter component
 */

import { useStore } from '../../state/store';
import type { Series } from '../../types';

const series: Series[] = ['Grand Slam', 'Masters', 'ATP500', 'ATP250'];

export function SeriesFilter() {
  const { series: selectedSeries, setSeries } = useStore();
  
  return (
    <div className="filter-group">
      <label className="filter-label">Series</label>
      <div className="filter-buttons">
        <button
          className={`filter-button ${selectedSeries === null ? 'active' : ''}`}
          onClick={() => setSeries(null)}
        >
          All
        </button>
        {series.map(s => (
          <button
            key={s}
            className={`filter-button ${selectedSeries === s ? 'active' : ''}`}
            onClick={() => setSeries(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

