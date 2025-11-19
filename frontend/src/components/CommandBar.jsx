import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { Search, BarChart3, Package, Route, Settings, Database, TrendingUp } from 'lucide-react';

const commands = [
  {
    id: 'dashboard',
    label: 'Go to Dashboard',
    icon: BarChart3,
    action: () => {
      const dashboard = document.querySelector('[data-section="dashboard"]');
      dashboard?.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    id: 'inventory',
    label: 'View Inventory',
    icon: Package,
    action: () => {
      const inventory = document.querySelector('[data-section="inventory"]');
      inventory?.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    id: 'routes',
    label: 'Route Optimizer',
    icon: Route,
    action: () => {
      const routes = document.querySelector('[data-section="routes"]');
      routes?.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    id: 'simulation',
    label: 'Simulation Cockpit',
    icon: TrendingUp,
    action: () => {
      const simulation = document.querySelector('[data-section="simulation"]');
      simulation?.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    id: 'mlops',
    label: 'MLOps Panel',
    icon: Database,
    action: () => {
      const mlops = document.querySelector('[data-section="mlops"]');
      mlops?.scrollIntoView({ behavior: 'smooth' });
    },
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    action: () => {
      // Placeholder for settings
      console.log('Settings');
    },
  },
];

function CommandBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback((command) => {
    command.action();
    setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/80" onClick={() => setOpen(false)} />
      <Command className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 shadow-2xl" shouldFilter={true}>
        <div className="flex items-center border-b border-zinc-800 px-4 py-3">
          <Search className="w-4 h-4 text-zinc-500 mr-3" strokeWidth={1.5} />
          <Command.Input
            className="flex-1 bg-transparent border-0 outline-none text-white placeholder:text-zinc-500 font-sans text-sm"
            placeholder="Type a command or search..."
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-1.5 font-mono text-[10px] font-medium text-zinc-500">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-zinc-500">
            No results found.
          </Command.Empty>
          <Command.Group heading="Navigation">
            {commands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <Command.Item
                  key={cmd.id}
                  value={cmd.label}
                  onSelect={() => handleSelect(cmd)}
                  className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-zinc-300 cursor-pointer hover:bg-zinc-800 hover:text-white data-[selected]:bg-zinc-800 data-[selected]:text-white transition-colors"
                >
                  <Icon className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
                  <span>{cmd.label}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

export default CommandBar;

