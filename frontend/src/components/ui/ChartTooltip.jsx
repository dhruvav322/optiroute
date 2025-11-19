import PropTypes from 'prop-types';

export function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#09090b]/90 border border-[#27272a] p-3 rounded-lg shadow-xl backdrop-blur-sm text-xs">
        <p className="text-zinc-400 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }} 
            />
            <span className="text-zinc-300 font-medium capitalize">
              {entry.name}:
            </span>
            <span className="text-white font-mono">
              {typeof entry.value === 'number' 
                ? entry.value.toLocaleString() 
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

