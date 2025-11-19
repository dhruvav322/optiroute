import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNameMap = {
  '': 'Overview',
  'planning': 'Planning & Simulation',
  'forecast': 'Intelligence',
  'logistics': 'Logistics',
  'settings': 'System Settings'
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <div className="flex items-center text-sm text-zinc-500 mb-4">
      <Link to="/" className="hover:text-white transition-colors flex items-center">
        <Home size={14} />
      </Link>
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        
        return (
          <div key={to} className="flex items-center">
            <ChevronRight size={14} className="mx-2 text-zinc-700" />
            {isLast ? (
              <span className="text-white font-medium">{routeNameMap[value] || value}</span>
            ) : (
              <Link to={to} className="hover:text-white transition-colors">
                {routeNameMap[value] || value}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

