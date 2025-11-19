import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, ArrowRight, Database, AlertCircle } from 'lucide-react';
import { Card, Metric, Button, Badge } from './ui/LinearComponents';
import { CustomTooltip } from './ui/ChartTooltip';
import { toast } from 'sonner';

// Helper to format currency
const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

// Export data as CSV
function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    toast.warning('No data to export');
    return;
  }

  // Convert array of objects to CSV string
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  
  // Create blob and download
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast.success('Data exported', {
    description: `Downloaded ${filename}`,
  });
}

export default function NewDashboard({ 
  inventorySummary, 
  simulation, 
  forecast, 
  onRunSimulation,
  loading 
}) {
  const navigate = useNavigate();
  
  // Mock chart data if forecast is null (for visual safety)
  const chartData = forecast?.forecast?.map(f => ({
    date: new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    demand: f.demand,
    upper: f.demand * 1.1,
    lower: f.demand * 0.9
  })) || [];

  const handleExportData = () => {
    const exportData = [];
    
    // Export forecast data if available
    if (forecast?.forecast && forecast.forecast.length > 0) {
      const forecastData = forecast.forecast.map(f => ({
        date: new Date(f.date).toISOString().split('T')[0], // YYYY-MM-DD format
        demand: f.demand.toFixed(2),
        upper_bound: f.upper_bound?.toFixed(2) ?? '',
        lower_bound: f.lower_bound?.toFixed(2) ?? '',
      }));
      exportToCSV(forecastData, `forecast_${new Date().toISOString().split('T')[0]}.csv`);
    } else if (inventorySummary || simulation) {
      // Export inventory and simulation summary if no forecast
      const summaryData = [{
        metric: 'Current Stock Level',
        value: inventorySummary?.current_stock_level ?? 0,
      }, {
        metric: 'Forecasted 30-Day Demand',
        value: inventorySummary?.forecasted_30_day_demand ?? 0,
      }, {
        metric: 'Optimal Reorder Point',
        value: simulation?.new_reorder_point?.toFixed(0) ?? 0,
      }, {
        metric: 'Safety Stock',
        value: simulation?.safety_stock?.toFixed(0) ?? 0,
      }, {
        metric: 'New EOQ',
        value: simulation?.new_eoq ?? 0,
      }, {
        metric: 'Total Projected Cost',
        value: simulation?.total_projected_cost?.toFixed(2) ?? 0,
      }];
      exportToCSV(summaryData, `inventory_summary_${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      toast.warning('No data available to export');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Supply Chain Overview</h1>
          <p className="text-muted text-sm mt-1">Real-time inventory intelligence and optimization.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleExportData}>
            <Database size={14} />
            Export Data
          </Button>
          <Button variant="primary" onClick={() => onRunSimulation?.()}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Run Simulation
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <Metric 
            label="Current Stock" 
            value={inventorySummary?.current_stock_level?.toLocaleString() ?? 0} 
            unit="units"
            trend="down"
            trendValue="4% vs last week"
            loading={loading}
          />
        </Card>
        <Card>
          <Metric 
            label="Forecast (30d)" 
            value={inventorySummary?.forecasted_30_day_demand?.toLocaleString() ?? 0} 
            unit="units"
            loading={loading}
          />
        </Card>
        <Card>
          <Metric 
            label="Reorder Point" 
            value={simulation?.new_reorder_point?.toFixed(0) ?? 0} 
            unit="trigger"
            trend="up"
            trendValue="Optimized"
            loading={loading}
          />
        </Card>
        <Card>
          <Metric 
            label="Proj. Cost" 
            value={formatCurrency(simulation?.total_projected_cost ?? 0)} 
            unit="annual"
            loading={loading}
          />
        </Card>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
        
        {/* Chart Section - Spans 2 columns */}
        <Card className="lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-medium text-white">Demand Forecast</h3>
              <p className="text-xs text-muted">Prophet Model Confidence Interval (95%)</p>
            </div>
            <Badge variant="success">High Accuracy</Badge>
          </div>
          
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#52525b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ stroke: '#27272a', strokeWidth: 1 }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="demand" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorDemand)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Actionable Insights / Control - Spans 1 column */}
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <AlertCircle size={18} />
            <h3 className="font-medium text-white">Optimization Status</h3>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            <div className="bg-zinc-900/50 p-3 rounded border border-border">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">Safety Stock</span>
                <span className="text-white font-mono">{simulation?.safety_stock?.toFixed(0) ?? 0}</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: '70%' }}></div>
              </div>
            </div>

            <div className="bg-zinc-900/50 p-3 rounded border border-border">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">Service Level</span>
                <span className="text-white font-mono">{(simulation?.details?.parameters?.service_level * 100)?.toFixed(1) ?? '95.0'}%</span>
              </div>
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full" style={{ width: '95%' }}></div>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-4">
              <h4 className="text-sm font-medium text-white mb-3">Quick Actions</h4>
              <Button 
                variant="secondary" 
                className="w-full justify-between mb-2"
                onClick={() => navigate('/planning')}
              >
                Adjust Lead Time <ArrowRight size={14} />
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-between"
                onClick={() => onRunSimulation?.()}
              >
                Recalculate EOQ <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

