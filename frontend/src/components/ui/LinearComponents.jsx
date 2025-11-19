import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for cleaner class merging
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// 1. The Base Card
export function Card({ children, className, noPadding }) {
  return (
    <div className={cn(
      "bg-surface/50 border border-border backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-200 hover:border-zinc-600",
      noPadding ? "p-0" : "p-5",
      className
    )}>
      {children}
    </div>
  );
}

// 2. Skeleton Loader
export function Skeleton({ className }) {
  return (
    <div className={cn("animate-pulse bg-zinc-800 rounded", className)} />
  );
}

// 3. Metric Display (The "Industrial" Stat)
export function Metric({ label, value, unit, trend, trendValue, loading }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      {loading ? (
        <Skeleton className="h-9 w-24 my-0.5" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-medium text-white tracking-tight">
            {value}
          </span>
          {unit && <span className="text-sm text-zinc-500 font-mono">{unit}</span>}
        </div>
      )}
      {trend && !loading && (
        <div className={cn("text-xs font-mono flex items-center gap-1", 
          trend === 'up' ? "text-success" : "text-danger"
        )}>
          {trend === 'up' ? '↑' : '↓'} {trendValue}
        </div>
      )}
    </div>
  );
}

// 4. The "Apple/Linear" Button
export function Button({ children, variant = 'primary', className, ...props }) {
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]",
    secondary: "bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600",
    ghost: "bg-transparent text-muted hover:text-white hover:bg-white/5"
  };

  return (
    <button 
      className={cn(
        "h-9 px-4 py-2 rounded-md text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// 5. Status Badge
export function Badge({ children, variant = 'neutral' }) {
  const styles = {
    neutral: "bg-zinc-800 text-zinc-400 border-zinc-700",
    success: "bg-green-500/10 text-green-400 border-green-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  
  return (
    <span className={cn("px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border", styles[variant])}>
      {children}
    </span>
  );
}

