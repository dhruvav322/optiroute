import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { Calculator, Truck, Search, BarChart3, Zap, Package, Settings, LayoutDashboard, TrendingUp, Sliders } from 'lucide-react';

export function CommandMenu({ onRunSimulation }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Toggle with Cmd+K
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

  const handleSelect = (path) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" />
        <Dialog.Content 
          className="fixed top-[20vh] left-1/2 -translate-x-1/2 z-[9999] w-full max-w-xl bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl overflow-hidden outline-none"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Global Command Menu</Dialog.Title>
          </VisuallyHidden.Root>
          
          <Command shouldFilter={true} className="bg-[#18181b]">
            <div className="flex items-center border-b border-[#27272a] px-3">
              <Search className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
              <Command.Input 
                placeholder="Type a command or search..." 
                className="w-full bg-transparent border-none focus:ring-0 h-12 text-sm text-white placeholder:text-zinc-500 outline-none"
              />
            </div>
              
            <Command.List className="p-2 max-h-[300px] overflow-y-auto">
              <Command.Empty className="py-6 text-center text-sm text-zinc-500">No results found.</Command.Empty>

              <Command.Group heading="Actions" className="text-xs font-medium text-zinc-500 px-2 py-1.5 mb-1">
                <Item onSelect={() => { onRunSimulation?.(); setOpen(false); }}>
                  <Zap className="w-4 h-4 mr-2" />
                  Run Forecast Simulation
                </Item>
                <Item onSelect={() => { handleSelect('/logistics'); }}>
                  <Truck className="w-4 h-4 mr-2" />
                  Optimize Routes
                </Item>
              </Command.Group>

              <Command.Group heading="Navigation" className="text-xs font-medium text-zinc-500 px-2 py-1.5 mb-1 mt-2">
                <Item onSelect={() => handleSelect('/')}>
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Overview
                </Item>
                <Item onSelect={() => handleSelect('/planning')}>
                  <Sliders className="w-4 h-4 mr-2" />
                  Planning & Simulation
                </Item>
                <Item onSelect={() => handleSelect('/forecast')}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Intelligence
                </Item>
                <Item onSelect={() => handleSelect('/logistics')}>
                  <Truck className="w-4 h-4 mr-2" />
                  Logistics
                </Item>
                <Item onSelect={() => handleSelect('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  MLOps & Data
                </Item>
              </Command.Group>
            </Command.List>

            <div className="border-t border-[#27272a] px-3 py-2 flex justify-between items-center bg-[#09090b]">
              <span className="text-[10px] text-zinc-500">Optiroute Command</span>
              <div className="flex gap-1 items-center">
                <Kbd>↵</Kbd> <span className="text-[10px] text-zinc-600">to select</span>
              </div>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Helper components for the menu styling
function Item({ children, onSelect }) {
  return (
    <Command.Item 
      onSelect={onSelect}
      className="flex items-center px-2 py-2 rounded text-sm text-zinc-300 aria-selected:bg-blue-600 aria-selected:text-white cursor-pointer transition-colors"
    >
      {children}
    </Command.Item>
  );
}

function Kbd({ children }) {
  return <span className="bg-[#27272a] px-1.5 py-0.5 rounded text-[10px] text-zinc-400 font-mono">{children}</span>;
}

