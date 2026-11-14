import { lazy, Suspense, useCallback, useState, useEffect, useRef } from 'react';
import type {
  AlgorithmType,
  Floor,
  NavigationGraphModel,
  Occupant,
  HazardSource,
  Exit,
  ScenarioSummary,
  SimulationMetrics,
  SimulationState,
  TopologyAuditReport,
  RerouteEvent,
} from './types/simulation';
import { api } from './services/api';
import { TopNavBar } from './components/TopNavBar';
import { FloorPlanViewport } from './components/FloorPlanViewport';
import { TopologyAuditorPanel } from './components/TopologyAuditorPanel';
import { OccupantRosterPanel } from './components/OccupantRosterPanel';
import { LayerControls } from './components/LayerControls';
import { Phase3ReviewBanner } from './components/Phase3ReviewBanner';
import { RerouteEventFeed } from './components/RerouteEventFeed';
import { MetricsPanel } from './components/MetricsPanel';
import { Network, Users, BarChart3, GitFork } from 'lucide-react';

const ExperimentsDashboard = lazy(() =>
  import('./components/ExperimentsDashboard').then((module) => ({ default: module.ExperimentsDashboard })),
);
const DemonstrationModeModal = lazy(() =>
  import('./components/DemonstrationModeModal').then((module) => ({ default: module.DemonstrationModeModal })),
);

export function App() {
  // Scenario & Simulation Parameters
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('scenario_hq_floor1');
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('baseline');
  const [seed, setSeed] = useState<number>(42);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);

  // Simulation Session State
  const [sessionId, setSessionId] = useState<string>('');
  const [floor, setFloor] = useState<Floor | null>(null);
  const [graph, setGraph] = useState<NavigationGraphModel>({ nodes: {}, edges: [] });
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [exits, setExits] = useState<Exit[]>([]);
  const [hazards, setHazards] = useState<HazardSource[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [audit, setAudit] = useState<TopologyAuditReport | null>(null);
  const [rerouteEvents, setRerouteEvents] = useState<RerouteEvent[]>([]);

  // Playback & Status
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [stepCount, setStepCount] = useState<number>(0);
  const [simTime, setSimTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'metrics' | 'occupants' | 'reroutes' | 'topology'>('metrics');
  const [selectedOccupantId, setSelectedOccupantId] = useState<string | null>(null);

  // Phase 4: Views & Interactive Demonstration
  const [activeView, setActiveView] = useState<'simulation' | 'experiments'>('simulation');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [sessionNonce, setSessionNonce] = useState<number>(0);

  // Playback refs to prevent race conditions
  const playbackTimerRef = useRef<number | null>(null);
  const isSteppingRef = useRef<boolean>(false);
  const pendingAutoStartRef = useRef<boolean>(false);

  const handleLoadDemoScenario = (
    scenarioId: string,
    algo: AlgorithmType,
    s: number,
    autoStart = false,
  ) => {
    pendingAutoStartRef.current = autoStart;
    if (scenarioId === selectedScenarioId && algo === algorithm && s === seed) {
      setSessionNonce((n) => n + 1);
    } else {
      setSelectedScenarioId(scenarioId);
      setAlgorithm(algo);
      setSeed(s);
    }
    setActiveView('simulation');
  };

  // Layer Toggles
  const [showRooms, setShowRooms] = useState<boolean>(true);
  const [showGraph, setShowGraph] = useState<boolean>(true);
  const [showExits, setShowExits] = useState<boolean>(true);
  const [showOccupants, setShowOccupants] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(true);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [showCongestionHeatmap, setShowCongestionHeatmap] = useState<boolean>(true);

  const applyStateUpdate = useCallback((state: SimulationState) => {
    setGraph(state.graph);
    setOccupants(state.occupants);
    setExits(state.exits);
    setHazards(state.hazards);
    setMetrics(state.metrics);
    if (state.reroute_events) setRerouteEvents(state.reroute_events);
    setStepCount(state.step_count);
    setSimTime(state.current_time_sec);
  }, []);

  // 1. Initial Load: Fetch Scenarios
  useEffect(() => {
    async function loadScenarios() {
      try {
        const list = await api.getScenarios();
        setScenarios(list);
        if (list.length > 0) {
          setSelectedScenarioId((prev) => prev || list[0].id);
        }
        setIsOnline(true);
      } catch (err) {
        console.error('Failed to connect to backend API:', err);
        setIsOnline(false);
      }
    }
    loadScenarios();
  }, []);

  // 2. Initialize simulation whenever Scenario, Algorithm, or Seed changes
  const initSimulationSession = useCallback(async (scenarioId: string, algo: AlgorithmType, s: number) => {
    try {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      setIsRunning(false);

      const [valRes, stateRes, scenDetail] = await Promise.all([
        api.validateTopology(scenarioId),
        api.initSimulation({ scenarioId, algorithm: algo, seed: s }),
        api.getScenario(scenarioId),
      ]);

      setAudit(valRes.audit);
      setSessionId(stateRes.session_id);
      setFloor(scenDetail.building.floors[0]);
      setGraph(stateRes.graph);
      setOccupants(stateRes.occupants);
      setExits(stateRes.exits);
      setHazards(stateRes.hazards);
      setMetrics(stateRes.metrics);
      setRerouteEvents(stateRes.reroute_events || []);
      setStepCount(stateRes.step_count);
      setSimTime(stateRes.current_time_sec);
      setSelectedOccupantId(null);
      setIsOnline(true);
      isSteppingRef.current = false;
      if (pendingAutoStartRef.current) {
        pendingAutoStartRef.current = false;
        setIsRunning(true);
      }
    } catch (err) {
      pendingAutoStartRef.current = false;
      console.error('Failed to initialize simulation session:', err);
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    if (selectedScenarioId) {
      // Initializing an external backend session is the synchronization this effect owns.
      // oxlint-disable-next-line react/set-state-in-effect
      initSimulationSession(selectedScenarioId, algorithm, seed);
    }
  }, [selectedScenarioId, algorithm, seed, sessionNonce, initSimulationSession]);

  // 3. Single-step forward
  const handleStep = async () => {
    if (!sessionId || isSteppingRef.current) return;
    try {
      isSteppingRef.current = true;
      const updated = await api.stepSimulation(sessionId, 1, 0.5);
      applyStateUpdate(updated);
    } catch (err) {
      console.error('Step execution failed:', err);
    } finally {
      isSteppingRef.current = false;
    }
  };

  // 4. Reset simulation
  const handleReset = async () => {
    if (!sessionId) return;
    try {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      setIsRunning(false);
      const resetState = await api.resetSimulation(sessionId);
      applyStateUpdate(resetState);
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  // 5. Playback Loop with exact Speed Multiplier (controls simulated time progression, not walking speed)
  useEffect(() => {
    if (isRunning) {
      const intervalMs = Math.max(50, Math.round(500 / speedMultiplier));
      playbackTimerRef.current = window.setInterval(async () => {
        if (isSteppingRef.current || !sessionId) return;
        try {
          isSteppingRef.current = true;
          const updated = await api.stepSimulation(sessionId, 1, 0.5);
          applyStateUpdate(updated);
          if (updated.status === 'completed') {
            setIsRunning(false);
            if (playbackTimerRef.current) {
              window.clearInterval(playbackTimerRef.current);
              playbackTimerRef.current = null;
            }
          }
        } catch (err) {
          console.error('Live step failed:', err);
          setIsRunning(false);
          if (playbackTimerRef.current) {
            window.clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }
        } finally {
          isSteppingRef.current = false;
        }
      }, intervalMs);

      return () => {
        if (playbackTimerRef.current) {
          window.clearInterval(playbackTimerRef.current);
          playbackTimerRef.current = null;
        }
      };
    } else {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
  }, [isRunning, speedMultiplier, sessionId, applyStateUpdate]);

  const handleTogglePlay = () => {
    setIsRunning((prev) => !prev);
  };

  // Interactive Exit Block Toggle
  const handleToggleExit = async (exitId: string) => {
    if (!sessionId) return;
    try {
      const updated = await api.toggleExitBlock(sessionId, exitId);
      applyStateUpdate(updated);
    } catch (err) {
      console.error('Failed to toggle exit:', err);
    }
  };

  // Live crowd counts
  const total = occupants.length;
  const evacuated = occupants.filter((o) => o.evacuation_state === 'exited').length;
  const waiting = occupants.filter((o) => o.evacuation_state === 'waiting').length;
  const moving = occupants.filter((o) => o.evacuation_state === 'evacuating').length;
  const trapped = occupants.filter((o) => o.evacuation_state === 'trapped').length;

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 text-slate-800 lg:h-screen lg:overflow-hidden">
      {/* 1. Global Navigation Bar */}
      <TopNavBar
        scenarios={scenarios}
        selectedScenarioId={selectedScenarioId}
        onSelectScenario={(id) => setSelectedScenarioId(id)}
        algorithm={algorithm}
        onChangeAlgorithm={(algo) => setAlgorithm(algo)}
        seed={seed}
        onChangeSeed={(s) => setSeed(s)}
        isRunning={isRunning}
        onTogglePlay={handleTogglePlay}
        onStep={handleStep}
        onReset={handleReset}
        speedMultiplier={speedMultiplier}
        onChangeSpeed={(spd) => setSpeedMultiplier(spd)}
        isOnline={isOnline}
        stepCount={stepCount}
        simTime={simTime}
        counts={{ evacuated, moving, waiting, trapped, total }}
        activeView={activeView}
        onChangeView={(v) => setActiveView(v)}
        onOpenDemonstration={() => setIsDemoModalOpen(true)}
      />

      {/* 2. Main Workspace View Switcher */}
      {activeView === 'simulation' ? (
        <main className="flex flex-1 flex-col gap-2.5 overflow-visible p-2.5 lg:overflow-hidden">
          {/* Phase 3 Banner */}
          <Phase3ReviewBanner algorithm={algorithm} rerouteCount={rerouteEvents.length} />

          {/* Core Digital Twin & Telemetry Grid */}
          <div className="grid flex-1 grid-cols-1 gap-2.5 lg:min-h-0 lg:grid-cols-4 lg:overflow-hidden">
            {/* Central Architectural Viewport (3 Cols on desktop) */}
            <div className="flex min-h-0 flex-col gap-2 lg:col-span-3 lg:h-full">
              <div className="relative h-[56vh] min-h-[360px] flex-1 overflow-hidden rounded-xl border border-slate-300 bg-slate-950 shadow-sm lg:h-auto lg:min-h-0">
                {floor ? (
                  <FloorPlanViewport
                    floor={floor}
                    graph={graph}
                    occupants={occupants}
                    hazards={hazards}
                    exits={exits}
                    showRooms={showRooms}
                    showGraph={showGraph}
                    showExits={showExits}
                    showOccupants={showOccupants}
                    showHazards={showHazards}
                    showRoutes={showRoutes}
                    showCongestionHeatmap={showCongestionHeatmap}
                    simTime={simTime}
                    selectedOccupantId={selectedOccupantId}
                    onSelectOccupant={(id) => setSelectedOccupantId(id)}
                    onToggleExit={handleToggleExit}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    Connecting to EXIT-ZERO simulation backend...
                  </div>
                )}
              </div>

              {/* Bottom Layer Controls */}
              <LayerControls
                showRooms={showRooms}
                setShowRooms={setShowRooms}
                showGraph={showGraph}
                setShowGraph={setShowGraph}
                showExits={showExits}
                setShowExits={setShowExits}
                showOccupants={showOccupants}
                setShowOccupants={setShowOccupants}
                showHazards={showHazards}
                setShowHazards={setShowHazards}
                showRoutes={showRoutes}
                setShowRoutes={setShowRoutes}
                showCongestionHeatmap={showCongestionHeatmap}
                setShowCongestionHeatmap={setShowCongestionHeatmap}
              />
            </div>

            {/* Right Telemetry Sidebar (1 Col) */}
            <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-full lg:min-h-0">
              {/* Sidebar Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-medium">
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`flex-1 py-2 px-1 flex items-center justify-center space-x-1 transition ${
                    activeTab === 'metrics'
                      ? 'bg-white text-slate-900 border-b-2 border-emerald-500 font-semibold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Live Metrics</span>
                </button>
                <button
                  onClick={() => setActiveTab('occupants')}
                  className={`flex-1 py-2 px-1 flex items-center justify-center space-x-1 transition ${
                    activeTab === 'occupants'
                      ? 'bg-white text-slate-900 border-b-2 border-emerald-500 font-semibold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Occupants</span>
                </button>
                <button
                  onClick={() => setActiveTab('reroutes')}
                  className={`flex-1 py-2 px-1 flex items-center justify-center space-x-1 transition ${
                    activeTab === 'reroutes'
                      ? 'bg-white text-slate-900 border-b-2 border-emerald-500 font-semibold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <GitFork className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reroutes {rerouteEvents.length > 0 ? `(${rerouteEvents.length})` : ''}</span>
                </button>
                <button
                  onClick={() => setActiveTab('topology')}
                  className={`flex-1 py-2 px-1 flex items-center justify-center space-x-1 transition ${
                    activeTab === 'topology'
                      ? 'bg-white text-slate-900 border-b-2 border-emerald-500 font-semibold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>Topology</span>
                </button>
              </div>

              {/* Tab Body */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {activeTab === 'metrics' && (
                  <MetricsPanel metrics={metrics} simTime={simTime} />
                )}

                {activeTab === 'occupants' && (
                  <OccupantRosterPanel
                    occupants={occupants}
                    selectedOccupantId={selectedOccupantId}
                    onSelectOccupant={(id) => setSelectedOccupantId(id)}
                  />
                )}

                {activeTab === 'reroutes' && (
                  <RerouteEventFeed
                    events={rerouteEvents}
                    selectedOccupantId={selectedOccupantId}
                    onSelectOccupant={(id) => setSelectedOccupantId(id)}
                    algorithm={algorithm}
                  />
                )}

                {activeTab === 'topology' && (
                  <TopologyAuditorPanel
                    audit={audit}
                    exits={exits}
                    hazards={hazards}
                  />
                )}
              </div>

              {/* Sidebar Status Footer */}
              <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center font-mono">
                <span>Session: {sessionId || 'Connecting'}</span>
                <span>Speed: {speedMultiplier}x</span>
              </div>
            </aside>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-2.5 lg:overflow-hidden">
          <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading evidence workspace…</div>}>
            <ExperimentsDashboard scenarios={scenarios} onOpenDemonstration={() => setIsDemoModalOpen(true)} />
          </Suspense>
        </main>
      )}

      {/* Interactive Demonstration Walkthrough Modal */}
      <Suspense fallback={null}>
        <DemonstrationModeModal
          isOpen={isDemoModalOpen}
          onClose={() => setIsDemoModalOpen(false)}
          onLoadScenario={handleLoadDemoScenario}
          onToggleExit={handleToggleExit}
          onSwitchView={(view) => setActiveView(view)}
          metrics={metrics}
          simTime={simTime}
        />
      </Suspense>
    </div>
  );
}

export default App;
