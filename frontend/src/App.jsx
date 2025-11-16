import { useCallback, useEffect, useMemo, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Dashboard from './components/Dashboard.jsx';
import SimulationCockpit from './components/SimulationCockpit.jsx';
import CostChart from './components/CostChart.jsx';
import MLOpsPanel from './components/MLOpsPanel.jsx';
import ModelEvaluation from './components/ModelEvaluation.jsx';
import FeatureInsights from './components/FeatureInsights.jsx';
import RouteOptimizer from './components/RouteOptimizer.jsx';
import {
  getForecast,
  getInventorySummary,
  getModelStatus,
  runSimulation,
} from './api/client.js';
import './App.css';

const INITIAL_SIM_PARAMS = {
  client_id: 'default',
  holding_cost_per_unit_per_year: 2.5,
  order_cost: 50,
  unit_cost: 10,
  lead_time_days: 10,
  service_level: 0.95,
  forecast_days: 30,
};

function App() {
  const [inventorySummary, setInventorySummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const [simulationParams, setSimulationParams] = useState(INITIAL_SIM_PARAMS);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modelReady, setModelReady] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const summaryData = await getInventorySummary();
      setInventorySummary(summaryData);

      try {
        const forecastData = await getForecast();
        setForecast(forecastData);
      } catch (error) {
        if (error.status === 404) {
          setForecast(null);
        } else {
          toast.error(error.message || 'Failed to load forecast data');
        }
      }

      try {
        const modelData = await getModelStatus();
        setModelStatus(modelData);
        setModelReady(true);
      } catch (error) {
        if (error.status !== 404) {
          toast.error(error.message || 'Failed to fetch model status');
        }
        setModelStatus(null);
        setModelReady(false);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const runSimulationWithParams = useCallback(
    async (params) => {
      try {
        setLoadingSimulation(true);
        const result = await runSimulation(params);
        setSimulation(result);
        const summaryData = await getInventorySummary();
        setInventorySummary(summaryData);
        return result;
      } catch (error) {
        if (error.status === 404) {
          toast.warn('Train the forecast model before running simulations.');
        } else {
          toast.error(error.message || 'Simulation run failed');
        }
        throw error;
      } finally {
        setLoadingSimulation(false);
      }
    },
  []);

  useEffect(() => {
    if (!modelReady) {
      return undefined;
    }

    const handle = setTimeout(() => {
      runSimulationWithParams(simulationParams).catch(() => {});
    }, 200);

    return () => clearTimeout(handle);
  }, [modelReady, simulationParams, runSimulationWithParams]);

  const onSliderChange = useCallback((updated) => {
    setSimulationParams((prev) => ({ ...prev, ...updated }));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      getModelStatus()
        .then((data) => {
          setModelStatus(data);
          setModelReady(true);
        })
        .catch((error) => {
          if (error.status !== 404) {
            toast.error(error.message || 'Failed to refresh model status');
          }
        });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleRetrainSuccess = useCallback(
    async () => {
      await loadInitialData();
      try {
        await runSimulationWithParams(simulationParams);
      } catch (error) {
        // runSimulationWithParams already surfaces toast messaging; suppress here
        console.error(error);
      }
    },
    [loadInitialData, runSimulationWithParams, simulationParams],
  );

  const costBreakdown = useMemo(() => {
    if (!simulation) {
      return null;
    }
    const orderingCost = simulation.annual_ordering_cost;
    const holdingCost = simulation.annual_holding_cost;
    const purchaseCost = simulation.annual_demand * simulation.details.parameters.unit_cost;
    return {
      orderingCost,
      holdingCost,
      purchaseCost,
      total: simulation.total_projected_cost,
    };
  }, [simulation]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Optiroute — Supply Chain Optimization</h1>
          <p className="subtitle">AI-powered demand forecasting, inventory optimization, and route planning for smarter supply chain decisions.</p>
        </div>
      </header>

      <main className="app-content">
        <section>
          <Dashboard
            summary={inventorySummary}
            simulation={simulation}
            forecast={forecast}
            loading={loading}
          />
        </section>

        <section className="grid-layout">
          <div className="panel">
            <SimulationCockpit
              values={simulationParams}
              onChange={onSliderChange}
              isRunning={loadingSimulation}
            />
          </div>

          <div className="panel">
            <CostChart data={costBreakdown} />
          </div>
        </section>

        <section className="panel">
          <ModelEvaluation />
        </section>

        <section className="panel">
          <FeatureInsights />
        </section>

        <section className="panel">
          <MLOpsPanel
            onUploadSuccess={loadInitialData}
            onRetrainSuccess={handleRetrainSuccess}
            modelStatus={modelStatus}
            modelReady={modelReady}
          />
        </section>

        <section className="panel">
          <RouteOptimizer />
        </section>
      </main>

      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  );
}

export default App;
