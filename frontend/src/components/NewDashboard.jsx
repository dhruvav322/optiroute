import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CalendarClock,
  Download,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Badge, Button, Card, Metric } from './ui/LinearComponents';
import { CustomTooltip } from './ui/ChartTooltip';
import { toast } from 'sonner';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function exportToCsv(data, filename) {
  if (!data.length) {
    toast.warning('No forecast is available to export yet.');
    return;
  }

  const csv = [
    'date,forecast_demand',
    ...data.map(({ rawDate, demand }) => `${rawDate},${demand}`),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('Forecast exported');
}

function getDecision({ inventorySummary, simulation, forecast }) {
  const forecastDemand = forecast?.forecast?.reduce((sum, point) => sum + (point.demand || 0), 0) ||
    inventorySummary?.forecasted_30_day_demand || 0;
  const daysInForecast = forecast?.forecast?.length || 30;
  const dailyDemand = forecastDemand / daysInForecast;
  const currentStock = inventorySummary?.current_stock_level || 0;
  const reorderPoint = simulation?.new_reorder_point ?? inventorySummary?.optimal_reorder_point ?? 0;
  const leadTime = simulation?.details?.parameters?.lead_time_days;
  const daysOfCover = dailyDemand > 0 ? currentStock / dailyDemand : null;
  const recommendedQuantity = simulation?.new_eoq ?? 0;

  if (!forecastDemand) {
    return {
      label: 'Forecast needed',
      tone: 'neutral',
      description: 'Upload demand history and train a model before Optiroute can make a recommendation.',
      daysOfCover,
      forecastDemand,
      leadTime,
      reorderPoint,
      recommendedQuantity,
    };
  }

  if (currentStock <= reorderPoint) {
    return {
      label: 'Order now',
      tone: 'critical',
      description: `Current stock is at or below the ${numberFormatter.format(reorderPoint)}-unit reorder point.`,
      daysOfCover,
      forecastDemand,
      leadTime,
      reorderPoint,
      recommendedQuantity,
    };
  }

  if (leadTime && daysOfCover <= leadTime + 3) {
    return {
      label: 'Monitor closely',
      tone: 'warning',
      description: `Stock cover is approaching the ${leadTime}-day replenishment lead time.`,
      daysOfCover,
      forecastDemand,
      leadTime,
      reorderPoint,
      recommendedQuantity,
    };
  }

  return {
    label: 'On track',
    tone: 'success',
    description: 'Current inventory is above the calculated reorder point.',
    daysOfCover,
    forecastDemand,
    leadTime,
    reorderPoint,
    recommendedQuantity,
  };
}

function statusClass(tone) {
  return {
    critical: 'border-red-500/40 bg-red-500/10 text-red-200',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
    neutral: 'border-zinc-700 bg-zinc-900 text-zinc-200',
  }[tone];
}

export default function NewDashboard({ inventorySummary, simulation, forecast, onRunSimulation, loading }) {
  const navigate = useNavigate();
  const decision = getDecision({ inventorySummary, simulation, forecast });
  const chartData = (forecast?.forecast || []).map((point) => ({
    rawDate: point.date,
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    demand: point.demand,
  }));
  const savings = simulation?.total_projected_cost;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Inventory decision center</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Make the next replenishment decision clear.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Review stock cover, forecast demand, and the policy recommendation in one place.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => exportToCsv(chartData, 'optiroute-forecast.csv')}>
            <Download size={14} /> Export forecast
          </Button>
          <Button variant="primary" onClick={() => onRunSimulation?.()} disabled={loading || !forecast}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh recommendation
          </Button>
        </div>
      </header>

      <section className={`rounded-xl border p-5 md:p-6 ${statusClass(decision.tone)}`} aria-live="polite">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="mt-1 rounded-lg bg-black/15 p-2.5">
              {decision.tone === 'critical' ? <ShieldAlert size={22} /> : <PackageCheck size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{decision.label}</h2>
                <Badge variant={decision.tone === 'critical' ? 'danger' : decision.tone === 'warning' ? 'warning' : 'success'}>
                  Inventory policy
                </Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm opacity-85">{decision.description}</p>
            </div>
          </div>
          <div className="flex gap-7 border-t border-current/15 pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div>
              <p className="text-xs uppercase tracking-wider opacity-65">Recommended quantity</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{decision.recommendedQuantity ? `${numberFormatter.format(decision.recommendedQuantity)} units` : 'Run planning'}</p>
            </div>
            <Button variant="secondary" onClick={() => navigate('/planning')}>
              Review plan <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><Metric label="Days of cover" value={decision.daysOfCover === null ? '—' : decision.daysOfCover.toFixed(1)} unit="days" loading={loading} /></Card>
        <Card><Metric label="Forecast demand" value={numberFormatter.format(decision.forecastDemand)} unit="next 30 days" loading={loading} /></Card>
        <Card><Metric label="Reorder point" value={numberFormatter.format(decision.reorderPoint)} unit="units" loading={loading} /></Card>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="min-h-[360px] lg:col-span-2">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium text-white">Projected demand</h2>
              <p className="mt-1 text-xs text-muted">The next 30 days of demand from the latest trained model.</p>
            </div>
            <Badge variant="neutral">{chartData.length ? `${chartData.length} days` : 'No forecast'}</Badge>
          </div>
          {chartData.length ? (
            <div className="h-[275px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs><linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3f3f46', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="demand" name="Forecast demand" stroke="#3b82f6" strokeWidth={2} fill="url(#demandGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-24 text-center text-sm text-muted">Train a forecast model to see projected demand.</p>}
        </Card>

        <Card className="flex flex-col">
          <div className="flex items-center gap-2"><CalendarClock size={18} className="text-primary" /><h2 className="font-medium text-white">Why this recommendation</h2></div>
          <dl className="mt-6 space-y-5 text-sm">
            <div className="flex items-center justify-between gap-4"><dt className="text-muted">Current stock</dt><dd className="font-mono text-white">{numberFormatter.format(inventorySummary?.current_stock_level || 0)} units</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-muted">Safety stock</dt><dd className="font-mono text-white">{numberFormatter.format(simulation?.safety_stock || 0)} units</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-muted">Lead time</dt><dd className="font-mono text-white">{decision.leadTime ? `${decision.leadTime} days` : 'Not set'}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="text-muted">Projected annual cost</dt><dd className="font-mono text-white">{savings === undefined ? 'Run planning' : currencyFormatter.format(savings)}</dd></div>
          </dl>
          <div className="mt-auto border-t border-border pt-5">
            <p className="text-xs leading-relaxed text-muted">This recommendation is based on the currently selected inventory policy. Change lead time, service level, or costs in Planning.</p>
            <Button variant="secondary" className="mt-4 w-full justify-between" onClick={() => navigate('/planning')}>Adjust assumptions <ArrowRight size={14} /></Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

NewDashboard.propTypes = {
  inventorySummary: PropTypes.object,
  simulation: PropTypes.object,
  forecast: PropTypes.object,
  onRunSimulation: PropTypes.func,
  loading: PropTypes.bool,
};
