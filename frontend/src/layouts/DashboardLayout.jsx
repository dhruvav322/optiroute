import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Truck, TrendingUp, Sliders, Settings, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CommandMenu } from '../components/ui/CommandMenu.jsx';
import { Breadcrumbs } from '../components/ui/Breadcrumbs.jsx';

function cn(...inputs) { 
  return twMerge(clsx(inputs)); 
}

export default function DashboardLayout({ children, onRunSimulation }) {
  return (
    <>
      <CommandMenu onRunSimulation={onRunSimulation} />
      <div className="flex h-screen bg-background text-white overflow-hidden font-sans">
        {/* Sidebar */}
        <aside className="w-16 hover:w-64 transition-all duration-300 border-r border-border bg-surface/30 flex flex-col group z-50">
          <div className="h-14 flex items-center justify-center border-b border-border group-hover:justify-start group-hover:px-6">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Zap size={18} className="text-white" />
            </div>
            <span className="ml-3 font-bold tracking-tight opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              Optiroute
            </span>
          </div>

          <nav className="flex-1 py-6 flex flex-col gap-2 px-2">
            <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Overview" />
            <NavItem to="/planning" icon={<Sliders size={20} />} label="Planning & Sim" />
            <NavItem to="/forecast" icon={<TrendingUp size={20} />} label="Intelligence" />
            <NavItem to="/logistics" icon={<Truck size={20} />} label="Logistics" />
          </nav>

          <div className="p-2 border-t border-border">
            <NavItem to="/settings" icon={<Settings size={20} />} label="MLOps & Data" />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Command Bar */}
          <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_10px_#22c55e]" />
              <span>System Operational</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs font-mono text-zinc-500">v2.4.0-stable</div>
              <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs">
                JD
              </div>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto w-full">
              <Breadcrumbs />
              {children}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// Updated NavItem to handle Routing
function NavItem({ icon, label, to }) {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => cn(
        "flex items-center h-10 px-3 rounded-md transition-colors w-full overflow-hidden group-hover:w-full",
        isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="ml-3 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
        {label}
      </span>
    </NavLink>
  );
}

