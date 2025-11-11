/**
 * Surface filter component
 */

import { useStore } from '../../state/store';
import type { Surface } from '../../types';

const surfaces: Surface[] = ['Hard', 'Clay', 'Grass', 'Carpet'];

export function SurfaceFilter() {
  const { surface, setSurface } = useStore();
  
  return (
    <div className="filter-group">
      <label className="filter-label">Surface</label>
      <div className="filter-buttons">
        <button
          className={`filter-button ${surface === null ? 'active' : ''}`}
          onClick={() => setSurface(null)}
        >
          All
        </button>
        {surfaces.map(s => (
          <button
            key={s}
            className={`filter-button ${surface === s ? 'active' : ''}`}
            onClick={() => setSurface(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

