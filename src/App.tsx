/**
 * Main App Component with Routing
 */

import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { UpsetScatterPage } from './pages/UpsetScatterPage';
import { HeadToHeadPage } from './pages/HeadToHeadPage';
import { PointsTimelinePage } from './pages/PointsTimelinePage';
import { BracketPage } from './pages/BracketPage';
import { useStore } from './state/store';

function AppContent() {
  const location = useLocation();
  const { clearFilters } = useStore();
  
  return (
    <div className="app">
      <header className="app-header">
        <h1>ATP 2025 Match Analytics</h1>
        <nav className="app-nav">
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}
          >
            Analytics Dashboard
          </Link>
          <Link 
            to="/upset-scatter" 
            className={location.pathname === '/upset-scatter' ? 'nav-link active' : 'nav-link'}
          >
            Upset Scatter Plot
          </Link>
          <Link 
            to="/head-to-head" 
            className={location.pathname === '/head-to-head' ? 'nav-link active' : 'nav-link'}
          >
            Head-to-Head
          </Link>
          <Link 
            to="/points-timeline" 
            className={location.pathname === '/points-timeline' ? 'nav-link active' : 'nav-link'}
          >
            Points Timeline
          </Link>
          <Link 
            to="/brackets" 
            className={location.pathname === '/brackets' ? 'nav-link active' : 'nav-link'}
          >
            Tournament Brackets
          </Link>
        </nav>
        <div className="header-actions">
          <button onClick={clearFilters} className="clear-button">
            Clear Filters
          </button>
        </div>
      </header>
      
      <main className="app-main">
        <Routes>
          <Route path="/" element={<AnalyticsPage />} />
          <Route path="/upset-scatter" element={<UpsetScatterPage />} />
          <Route path="/head-to-head" element={<HeadToHeadPage />} />
          <Route path="/points-timeline" element={<PointsTimelinePage />} />
          <Route path="/brackets" element={<BracketPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;