import PropTypes from 'prop-types';
import KPIGrid from './KPIGrid';
import InventoryTable from './InventoryTable';
import CommandBar from './CommandBar';
import { Search } from 'lucide-react';

function DashboardLayout({
  summary = null,
  simulation = null,
  forecast = null,
  loading = false,
}) {
  return (
    <>
      <CommandBar />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">Optiroute</h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Supply Chain Optimization Platform
              </p>
            </div>
            
            {/* Command Bar Trigger */}
            <button
              onClick={() => {
                const event = new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  bubbles: true,
                });
                document.dispatchEvent(event);
              }}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950 transition-colors text-zinc-400 text-sm font-sans"
            >
              <Search className="w-4 h-4" strokeWidth={1.5} />
              <span>Search</span>
              <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-1.5 font-mono text-[10px] font-medium text-zinc-500">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Grid Section */}
        <section data-section="dashboard" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              Overview
            </h2>
          </div>
          <KPIGrid
            summary={summary}
            simulation={simulation}
            forecast={forecast}
            loading={loading}
          />
        </section>

        {/* Inventory Table Section */}
        <section data-section="inventory" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              Inventory
            </h2>
          </div>
          <InventoryTable summary={summary} />
        </section>
      </main>
    </>
  );
}

DashboardLayout.propTypes = {
  summary: PropTypes.shape({
    current_stock_level: PropTypes.number,
    forecasted_30_day_demand: PropTypes.number,
    optimal_reorder_point: PropTypes.number,
    safety_stock: PropTypes.number,
  }),
  simulation: PropTypes.shape({
    new_reorder_point: PropTypes.number,
    safety_stock: PropTypes.number,
  }),
  forecast: PropTypes.shape({
    forecast: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string,
        demand: PropTypes.number,
      }),
    ),
  }),
  loading: PropTypes.bool,
};

export default DashboardLayout;

