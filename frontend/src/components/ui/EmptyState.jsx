import PropTypes from 'prop-types';
import { UploadCloud, Database, AlertCircle } from 'lucide-react';
import { Button } from './LinearComponents.jsx';

export function EmptyState({ title, description, actionLabel, onAction, icon = 'upload' }) {
  const icons = {
    upload: UploadCloud,
    database: Database,
    alert: AlertCircle,
  };

  const Icon = icons[icon] || UploadCloud;

  return (
    <div className="h-64 w-full border border-dashed border-[#27272a] rounded-xl flex flex-col items-center justify-center text-center bg-[#09090b]/50">
      <div className="h-12 w-12 bg-zinc-900 rounded-full flex items-center justify-center mb-4 text-zinc-500">
        <Icon size={24} />
      </div>
      <h3 className="text-white font-medium mb-1">{title}</h3>
      <p className="text-zinc-500 text-sm max-w-xs mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="secondary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  icon: PropTypes.oneOf(['upload', 'database', 'alert']),
};

