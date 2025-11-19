import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Layouts
import DashboardLayout from './layouts/DashboardLayout.jsx';
import { RouteProgress } from './components/RouteProgress.jsx';
import { GlobalHotkeys } from './components/GlobalHotkeys.jsx';
import PageTransition from './components/PageTransition.jsx';

// Pages
import Overview from './pages/Overview.jsx';
import Planning from './pages/Planning.jsx';
import Forecast from './pages/Forecast.jsx';
import Logistics from './pages/Logistics.jsx';
import Settings from './pages/Settings.jsx';

// API
import {
  getForecast,
  getInventorySummary,
  getModelStatus,
  runSimulation,
  login,
} from './api/client.js';

const INITIAL_SIM_PARAMS = {
  // client_id removed - now extracted from JWT token on backend
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
      
      // Load all data in parallel instead of sequentially (Waterfall → Parallel)
      // This dramatically reduces initial load time
      const [summaryResult, forecastResult, modelResult] = await Promise.allSettled([
        getInventorySummary().catch(error => {
          console.error('Failed to load inventory summary:', error);
          throw error;
        }),
        getForecast().catch(error => {
          // 404 is expected if no model exists yet - suppress console errors for this
          if (error.status === 404) {
            return null; // Silently return null for 404 (no model exists)
          }
          // Only log unexpected errors
          console.error('Failed to load forecast data:', error.message);
          return null;
        }),
        getModelStatus().catch(error => {
          // 404 is expected if no model exists yet - suppress console errors for this
          if (error.status === 404) {
            return null; // Silently return null for 404 (no model exists)
          }
          // Only log unexpected errors
          console.error('Failed to fetch model status:', error.message);
          return null;
        }),
      ]);

      // Process results
      if (summaryResult.status === 'fulfilled') {
        setInventorySummary(summaryResult.value);
        } else {
        toast.error('Failed to load inventory summary', {
          description: summaryResult.reason?.message || 'Unknown error occurred',
        });
        }

      if (forecastResult.status === 'fulfilled') {
        setForecast(forecastResult.value);
      }

      if (modelResult.status === 'fulfilled') {
        const modelData = modelResult.value;
        if (modelData) {
        setModelStatus(modelData);
        setModelReady(true);
        } else {
          setModelStatus(null);
          setModelReady(false);
        }
      } else {
        // Only show error toast if it's not a 404 (expected when no model exists)
        if (modelResult.reason?.status !== 404) {
          toast.error('Failed to fetch model status', {
            description: modelResult.reason?.message || 'Unknown error occurred',
          });
        }
        setModelStatus(null);
        setModelReady(false);
      }
    } catch (error) {
      toast.error('Failed to load initial data', {
        description: error.message || 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-login for development/testing
  useEffect(() => {
    const initializeAuth = async () => {
      // Check if we already have a token
      const existingToken = localStorage.getItem('auth_token');
      
      if (!existingToken) {
        // Auto-login with default credentials for development
        // In production, users would log in through a login page
        try {
          await login('user_1', 'default', null);
          toast.success('Authenticated', {
            description: 'Logged in with default credentials',
          });
        } catch (error) {
          console.error('Auto-login failed:', error);
          toast.error('Authentication failed', {
            description: 'Please log in manually',
          });
        }
      }
      
      // Load data after authentication
    loadInitialData();
    };
    
    initializeAuth();
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
          toast.warning('Train the forecast model before running simulations.');
        } else {
          toast.error('Simulation run failed', {
            description: error.message || 'Unknown error occurred',
          });
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
            toast.error('Failed to refresh model status', {
              description: error.message || 'Unknown error occurred',
            });
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
    <BrowserRouter>
      <RouteProgress />
      <GlobalHotkeys onRunSimulation={() => runSimulationWithParams(simulationParams)} />
      <DashboardLayout onRunSimulation={() => runSimulationWithParams(simulationParams)}>
        <Routes>
          {/* 1. Overview Page */}
          <Route 
            path="/" 
            element={
              <PageTransition>
                <Overview 
                  inventorySummary={inventorySummary}
            simulation={simulation}
            forecast={forecast}
                  onRunSimulation={() => runSimulationWithParams(simulationParams)}
                  loading={loading || loadingSimulation}
          />
              </PageTransition>
            } 
          />

          {/* 2. Planning Page (Simulation + Cost) */}
          <Route 
            path="/planning" 
            element={
              <PageTransition>
                <Planning 
                  simulationParams={simulationParams}
                  onSliderChange={onSliderChange}
                  costBreakdown={costBreakdown}
                  loadingSimulation={loadingSimulation}
            />
              </PageTransition>
            } 
          />

          {/* 3. Intelligence Page (Deep ML Insights) */}
          <Route 
            path="/forecast" 
            element={
              <PageTransition>
                <Forecast />
              </PageTransition>
            } 
          />

          {/* 4. Logistics Page (Route Optimizer) */}
          <Route 
            path="/logistics" 
            element={
              <PageTransition>
                <Logistics />
              </PageTransition>
            } 
          />

          {/* 5. Settings/MLOps Page */}
          <Route 
            path="/settings" 
            element={
              <PageTransition>
                <Settings
                  modelStatus={modelStatus}
                  modelReady={modelReady}
            onUploadSuccess={loadInitialData}
            onRetrainSuccess={handleRetrainSuccess}
          />
              </PageTransition>
            } 
          />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DashboardLayout>
      <Toaster theme="dark" position="bottom-right" />
    </BrowserRouter>
  );
}

export default App;
