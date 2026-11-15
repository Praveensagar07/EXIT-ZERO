import { lazy, Suspense, useCallback, useState, useEffect, useRef } from 'react';
import type {
  AlgorithmType,
  Building,
  Floor,
  NavigationGraphModel,
  Occupant,
  HazardSource,
  Exit,
  ScenarioSummary,
  SimulationMetrics,
  TopologyAuditReport,
  RerouteEvent,
} from './types/simulation';
import { api } from './services/api';
import { TopNavBar, type PrimaryView } from './components/TopNavBar';
import { BuildingViewport3D, type ViewMode3D } from './components/BuildingViewport3D';
import { FloorPlanViewport } from './components/FloorPlanViewport';
import { BuildingStudio } from './components/BuildingStudio';
import { EvacuationGuidancePanel } from './components/EvacuationGuidancePanel';
import { BuildingImportWizard } from './components/BuildingImportWizard';
import {
  Play,
  Pause,
  Square as StopSquare,
  RotateCcw,
  Building2,
  Layers,
  BarChart3,
  Settings as SettingsIcon,
  ChevronDown,
  Eye,
  Accessibility,
  Compass,
  Upload,
} from 'lucide-react';

const ExperimentsDashboard = lazy(() =>
  import('./components/ExperimentsDashboard').then((module) => ({ default: module.ExperimentsDashboard })),
);
const DemonstrationModeModal = lazy(() =>
  import('./components/DemonstrationModeModal').then((module) => ({ default: module.DemonstrationModeModal })),
);

export function App() {
  // Navigation & View
  const [activeView, setActiveView] = useState<PrimaryView>('simulation');
  const [viewType, setViewType] = useState<'3d' | '2d'>('3d');
  const [viewMode3D, setViewMode3D] = useState<ViewMode3D>('exploded');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isScenariosModalOpen, setIsScenariosModalOpen] = useState<boolean>(false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState<boolean>(false);

  // Scenarios & Building
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('scenario_multifloor_demo');
  const [building, setBuilding] = useState<Building | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<string>('floor_2');
  const [followOccupantId, setFollowOccupantId] = useState<string | null>(null);

  // Simulation Parameters
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('adaptive');
  const [seed, setSeed] = useState<number>(42);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);

  // Simulation State
  const [sessionId, setSessionId] = useState<string>('');
  const [floor, setFloor] = useState<Floor | null>(null);
  const [graph, setGraph] = useState<NavigationGraphModel>({ nodes: {}, edges: [] });
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [exits, setExits] = useState<Exit[]>([]);
  const [hazards, setHazards] = useState<HazardSource[]>([]);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [audit, setAudit] = useState<TopologyAuditReport | null>(null);
  const [rerouteEvents, setRerouteEvents] = useState<RerouteEvent[]>([]);

  // Toggle exit blockage
  const handleToggleExit = useCallback(
    async (exitId: string) => {
      if (!sessionId) return;
      try {
        const state = await api.toggleExitBlock(sessionId, exitId);
        setGraph(state.graph);
        setOccupants(state.occupants);
        setExits(state.exits);
        setHazards(state.hazards);
        setMetrics(state.metrics);
        if (state.reroute_events) setRerouteEvents(state.reroute_events);
      } catch (err) {
        console.error('Failed to toggle exit:', err);
      }
    },
    [sessionId]
  );

  // Playback & Timing
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [stepCount, setStepCount] = useState<number>(0);
  const [simTime, setSimTime] = useState<number>(0);

  // Layer Toggles
  const [showOccupants, setShowOccupants] = useState<boolean>(true);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(true);
  const [showExits, setShowExits] = useState<boolean>(true);
  const [showRoomLabels, setShowRoomLabels] = useState<boolean>(false);

  // Selected Area Inspector State
  const [selectedElement, setSelectedElement] = useState<{
    type: 'room' | 'corridor' | 'exit' | 'stair' | 'occupant';
    id: string;
    floorId: string;
    data: any;
  } | null>(null);

  const [activeInspectorTab, setActiveInspectorTab] = useState<'overview' | 'occupancy' | 'safety'>('overview');

  // Playback Refs
  const playbackTimerRef = useRef<number | null>(null);
  const isSteppingRef = useRef<boolean>(false);

  // 1. Initial Load: Scenarios List
  useEffect(() => {
    async function loadScenarios() {
      try {
        const list = await api.getScenarios();
        setScenarios(list);
        if (list.length > 0) {
          // Prefer multi-floor demo
          const defaultSc = list.find((s) => s.id === 'scenario_multifloor_demo') || list[0];
          setSelectedScenarioId(defaultSc.id);
        }
        setIsOnline(true);
      } catch (err) {
        console.error('Failed to connect to backend API:', err);
        setIsOnline(false);
      }
    }
    loadScenarios();
  }, []);

  // 2. Initialize Simulation Session
  const initSimulationSession = useCallback(
    async (scenarioId: string, algo: AlgorithmType, s: number) => {
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
        setBuilding(scenDetail.building);
        setFloor(scenDetail.building.floors[0]);
        setGraph(stateRes.graph);
        setOccupants(stateRes.occupants);
        setExits(stateRes.exits);
        setHazards(stateRes.hazards);
        setMetrics(stateRes.metrics);
        setRerouteEvents(stateRes.reroute_events || []);
        setStepCount(stateRes.step_count);
        setSimTime(stateRes.current_time_sec);

        if (scenDetail.building.floors.length > 1) {
          const f2 = scenDetail.building.floors.find((f) => f.level === 2) || scenDetail.building.floors[0];
          setActiveFloorId(f2.id);
        } else {
          setActiveFloorId(scenDetail.building.floors[0].id);
        }

        setIsOnline(true);
      } catch (err) {
        console.error('Simulation initialization failed:', err);
        setIsOnline(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedScenarioId) {
      initSimulationSession(selectedScenarioId, algorithm, seed);
    }
  }, [selectedScenarioId, algorithm, seed, initSimulationSession]);

  // 3. Step Simulation Handler
  const handleStep = useCallback(
    async (steps = 1) => {
      if (!sessionId || isSteppingRef.current) return;
      isSteppingRef.current = true;
      try {
        const state = await api.stepSimulation(sessionId, steps, 0.5);
        setGraph(state.graph);
        setOccupants(state.occupants);
        setExits(state.exits);
        setHazards(state.hazards);
        setMetrics(state.metrics);
        if (state.reroute_events) setRerouteEvents(state.reroute_events);
        setStepCount(state.step_count);
        setSimTime(state.current_time_sec);

        if (state.status === 'completed') {
          setIsRunning(false);
          if (playbackTimerRef.current) {
            window.clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }
        }
      } catch (err) {
        console.error('Step execution error:', err);
      } finally {
        isSteppingRef.current = false;
      }
    },
    [sessionId]
  );

  // Playback Loop
  useEffect(() => {
    if (isRunning) {
      const intervalMs = Math.max(30, Math.floor(500 / speedMultiplier));
      playbackTimerRef.current = window.setInterval(() => {
        handleStep(1);
      }, intervalMs);
    } else if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    return () => {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isRunning, speedMultiplier, handleStep]);

  const handleTogglePlay = () => {
    setIsRunning((prev) => !prev);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  const handleReset = async () => {
    setIsRunning(false);
    if (!sessionId) return;
    try {
      const state = await api.resetSimulation(sessionId);
      setGraph(state.graph);
      setOccupants(state.occupants);
      setExits(state.exits);
      setHazards(state.hazards);
      setMetrics(state.metrics);
      setRerouteEvents(state.reroute_events || []);
      setStepCount(0);
      setSimTime(0.0);
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  // Launch Studio Building in Simulation
  const handleRunCustomBuilding = async (bldgId: string) => {
    try {
      const state = await api.runBuildingSimulation(bldgId, {
        occupant_count: 140,
        algorithm: algorithm,
        seed: seed,
      });
      setSessionId(state.session_id);
      setGraph(state.graph);
      setOccupants(state.occupants);
      setExits(state.exits);
      setHazards(state.hazards);
      setMetrics(state.metrics);
      setStepCount(0);
      setSimTime(0.0);

      const b = await api.getBuilding(bldgId);
      setBuilding(b);
      setActiveView('simulation');
    } catch (err) {
      console.error('Failed to run custom building simulation:', err);
    }
  };

  // Format time MM:SS
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const evacuatedCount = metrics?.total_evacuated || 0;
  const totalOccupants = metrics?.total_occupants || occupants.length || 140;
  const completionPct = totalOccupants > 0 ? Math.round((evacuatedCount / totalOccupants) * 100) : 0;

  return (
    <div className="flex flex-col w-screen h-screen bg-[#FAFAF8] text-[#242A30] overflow-hidden select-none">
      {/* 1. Top Navigation Bar */}
      <TopNavBar
        activeView={activeView}
        onChangeView={setActiveView}
        isOnline={isOnline}
        onOpenDemonstration={() => setIsDemoModalOpen(true)}
      />

      {/* 2. Main Body: Slim Icon Rail + Primary Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Leftmost Slim Icon Rail */}
        <aside className="w-14 bg-white border-r border-[#E5E7EB] flex flex-col items-center py-3 gap-2 shrink-0 select-none z-20">
          <button
            onClick={() => setActiveView('simulation')}
            title="Live Simulation"
            className={`p-2.5 rounded-lg transition-colors ${
              activeView === 'simulation'
                ? 'bg-[#E6F4F2] text-[#167D73]'
                : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
            }`}
          >
            <Play className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveView('studio')}
            title="Buildings / Building Studio"
            className={`p-2.5 rounded-lg transition-colors ${
              activeView === 'studio'
                ? 'bg-[#E6F4F2] text-[#167D73]'
                : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
            }`}
          >
            <Building2 className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveView('evidence')}
            title="Evidence Lab"
            className={`p-2.5 rounded-lg transition-colors ${
              activeView === 'evidence'
                ? 'bg-[#E6F4F2] text-[#167D73]'
                : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </button>

          <button
            onClick={() => setActiveView('guidance')}
            title="Evacuation Guidance"
            className={`p-2.5 rounded-lg transition-colors ${
              activeView === 'guidance'
                ? 'bg-[#E6F4F2] text-[#167D73]'
                : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
            }`}
          >
            <Compass className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsScenariosModalOpen(true)}
            title="Scenarios Library"
            className={`p-2.5 rounded-lg transition-colors ${
              activeView === 'scenarios'
                ? 'bg-[#E6F4F2] text-[#167D73]'
                : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
            }`}
          >
            <Layers className="w-5 h-5" />
          </button>

          <div className="w-8 h-[1px] bg-[#E5E7EB] my-1" />

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            title="Settings"
            className="p-2.5 rounded-lg text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB] transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </aside>

        {/* 3. Primary Center Workspace depending on activeView */}
        {activeView === 'studio' ? (
          <BuildingStudio
            onRunSimulation={handleRunCustomBuilding}
            onOpenImportWizard={() => setIsImportWizardOpen(true)}
          />
        ) : activeView === 'evidence' ? (
          <div className="flex-1 overflow-y-auto bg-[#FAFAF8] p-6">
              <Suspense fallback={<div className="p-10 text-center text-sm text-[#647078]">Loading Evidence Lab...</div>}>
                <ExperimentsDashboard
                  scenarios={scenarios}
                  onOpenDemonstration={() => setIsDemoModalOpen(true)}
                />
              </Suspense>
          </div>
        ) : activeView === 'guidance' ? (
          <EvacuationGuidancePanel
            scenarioId={selectedScenarioId}
            sessionId={sessionId || undefined}
            algorithm={algorithm}
            onSelectOccupant={(occId) => {
              setActiveView('simulation');
              setFollowOccupantId(occId);
              const targetOcc = occupants.find((o) => o.id === occId);
              if (targetOcc) {
                setSelectedElement({
                  type: 'occupant',
                  id: occId,
                  floorId: targetOcc.floor_id,
                  data: targetOcc,
                });
              }
            }}
          />
        ) : (
          /* Live Simulation Workspace matching Image 2 */
          <div className="flex flex-1 min-w-0 overflow-hidden">
            {/* Secondary Left Sidebar */}
            <aside className="hidden md:flex w-64 bg-white border-r border-[#E5E7EB] flex-col overflow-y-auto shrink-0 select-none">
              {/* Current Building Dropdown */}
              <div className="p-4 border-b border-[#E5E7EB]">
                <label className="block text-[11px] font-semibold text-[#647078] uppercase tracking-wider mb-1.5">
                  Current Building
                </label>
                <div className="relative">
                  <select
                    value={selectedScenarioId}
                    onChange={(e) => setSelectedScenarioId(e.target.value)}
                    className="w-full text-xs font-medium bg-[#F9FAFB] border border-[#E5E7EB] rounded-md px-2.5 py-2 text-[#242A30] focus:ring-1 focus:ring-[#167D73] focus:border-[#167D73] appearance-none cursor-pointer pr-8"
                  >
                    {scenarios.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#647078] absolute right-2.5 top-3 pointer-events-none" />
                </div>
                <button
                  onClick={() => setIsImportWizardOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] text-[#242A30] rounded-md text-xs font-medium shadow-xs transition-colors mt-2"
                >
                  <Upload className="w-3.5 h-3.5 text-[#167D73]" />
                  <span>Import 3D Building</span>
                </button>
              </div>

              {/* Floors (N) List */}
              <div className="p-4 border-b border-[#E5E7EB]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[#647078] uppercase tracking-wider">
                    Floors ({building?.floors.length || 1})
                  </span>
                </div>

                <div className="space-y-1">
                  {[...(building?.floors || (floor ? [floor] : []))].reverse().map((fl) => {
                    const isSelected = activeFloorId === fl.id;
                    return (
                      <div
                        key={fl.id}
                        onClick={() => setActiveFloorId(fl.id)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#E6F4F2] text-[#167D73] font-semibold'
                            : 'text-[#242A30] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Eye className="w-3.5 h-3.5 text-[#647078]" />
                          <span>{fl.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* View Mode (3 pills) */}
              <div className="p-4 border-b border-[#E5E7EB]">
                <span className="block text-[11px] font-semibold text-[#647078] uppercase tracking-wider mb-2">
                  View Mode
                </span>
                <div className="grid grid-cols-3 gap-1.5 bg-[#F9FAFB] p-1 rounded-md border border-[#E5E7EB]">
                  <button
                    onClick={() => setViewMode3D('full')}
                    className={`py-1 text-[11px] font-medium rounded transition-colors ${
                      viewMode3D === 'full'
                        ? 'bg-white text-[#167D73] shadow-xs font-semibold'
                        : 'text-[#647078] hover:text-[#242A30]'
                    }`}
                  >
                    Full Building
                  </button>
                  <button
                    onClick={() => setViewMode3D('exploded')}
                    className={`py-1 text-[11px] font-medium rounded transition-colors ${
                      viewMode3D === 'exploded'
                        ? 'bg-white text-[#167D73] shadow-xs font-semibold'
                        : 'text-[#647078] hover:text-[#242A30]'
                    }`}
                  >
                    Exploded View
                  </button>
                  <button
                    onClick={() => setViewMode3D('floor')}
                    className={`py-1 text-[11px] font-medium rounded transition-colors ${
                      viewMode3D === 'floor'
                        ? 'bg-white text-[#167D73] shadow-xs font-semibold'
                        : 'text-[#647078] hover:text-[#242A30]'
                    }`}
                  >
                    Floor Only
                  </button>
                </div>
              </div>

              {/* Layers */}
              <div className="p-4 space-y-2.5">
                <span className="block text-[11px] font-semibold text-[#647078] uppercase tracking-wider mb-2">
                  Layers
                </span>
                <label className="flex items-center gap-2.5 text-xs text-[#242A30] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOccupants}
                    onChange={(e) => setShowOccupants(e.target.checked)}
                    className="rounded text-[#167D73] focus:ring-[#167D73]"
                  />
                  <span>Occupants</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-[#242A30] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRoutes}
                    onChange={(e) => setShowRoutes(e.target.checked)}
                    className="rounded text-[#167D73] focus:ring-[#167D73]"
                  />
                  <span>Evacuation Routes</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-[#242A30] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHazards}
                    onChange={(e) => setShowHazards(e.target.checked)}
                    className="rounded text-[#167D73] focus:ring-[#167D73]"
                  />
                  <span>Hazard (Smoke/Fire)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-[#242A30] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showExits}
                    onChange={(e) => setShowExits(e.target.checked)}
                    className="rounded text-[#167D73] focus:ring-[#167D73]"
                  />
                  <span>Exits & Safety</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-[#242A30] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRoomLabels}
                    onChange={(e) => setShowRoomLabels(e.target.checked)}
                    className="rounded text-[#167D73] focus:ring-[#167D73]"
                  />
                  <span>Room Labels</span>
                </label>
              </div>
            </aside>

            {/* Center Viewport Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAF8] relative">
              {/* Top View Toggle: 3D View vs 2D Floor Plan */}
              <div className="absolute top-4 left-4 z-30 flex items-center bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] p-1 shadow-sm">
                <button
                  onClick={() => setViewType('3d')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    viewType === '3d'
                      ? 'bg-[#167D73] text-white shadow-sm'
                      : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
                  }`}
                >
                  3D View
                </button>
                <button
                  onClick={() => setViewType('2d')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    viewType === '2d'
                      ? 'bg-[#167D73] text-white shadow-sm'
                      : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
                  }`}
                >
                  2D Floor Plan
                </button>
              </div>

              {/* Viewport Canvas */}
              <div className="w-full flex-1 min-h-0">
                {viewType === '3d' ? (
                  <BuildingViewport3D
                    building={building}
                    activeFloorId={activeFloorId}
                    onSelectFloor={setActiveFloorId}
                    viewMode={viewMode3D}
                    onChangeViewMode={setViewMode3D}
                    occupants={occupants}
                    hazards={hazards}
                    graph={graph}
                    selectedElementId={selectedElement?.id}
                    onSelectElement={setSelectedElement}
                    showOccupants={showOccupants}
                    showRoutes={showRoutes}
                    showHazards={showHazards}
                    showExits={showExits}
                    showRoomLabels={showRoomLabels}
                    isRunning={isRunning}
                    speedMultiplier={speedMultiplier}
                    followOccupantId={followOccupantId}
                    onToggleFollowOccupant={setFollowOccupantId}
                  />
                ) : (
                  <FloorPlanViewport
                    floor={building?.floors.find((f) => f.id === activeFloorId) || floor}
                    graph={graph}
                    occupants={occupants}
                    exits={exits}
                    hazards={hazards}
                    showRooms={true}
                    showGraph={true}
                    showExits={showExits}
                    showOccupants={showOccupants}
                    showHazards={showHazards}
                    showRoutes={showRoutes}
                    showCongestionHeatmap={true}
                    simTime={simTime}
                    selectedOccupantId={selectedElement?.type === 'occupant' ? selectedElement.id : null}
                    onSelectOccupant={(occupantId) => {
                      if (!occupantId) {
                        setSelectedElement(null);
                        return;
                      }
                      const target = occupants.find((occupant) => occupant.id === occupantId);
                      if (target) {
                        setActiveFloorId(target.floor_id);
                        setSelectedElement({
                          type: 'occupant',
                          id: occupantId,
                          floorId: target.floor_id,
                          data: target,
                        });
                      }
                    }}
                    onToggleExit={handleToggleExit}
                    selectedElementId={selectedElement?.id}
                    onSelectElement={setSelectedElement}
                  />
                )}
              </div>

              {/* Bottom Playback Control Bar matching Image 2 */}
              <div className="h-14 bg-white border-t border-[#E5E7EB] px-6 flex items-center justify-between shrink-0 select-none z-10">
                {/* Play, Pause, Stop, Reset Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlay}
                    className="flex h-9 w-9 items-center justify-center rounded-md bg-[#167D73] text-white hover:bg-[#126860] shadow-xs transition-colors"
                    title={isRunning ? 'Pause' : 'Play'}
                  >
                    {isRunning ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  <button
                    onClick={handleStop}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB] transition-colors"
                    title="Stop"
                  >
                    <StopSquare className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleReset}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB] transition-colors"
                    title="Reset Simulation"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Playback Speed Dropdown */}
                  <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-[#E5E7EB]">
                    <span className="text-xs text-[#647078]">Playback Speed</span>
                    <select
                      value={speedMultiplier}
                      onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                      className="bg-[#F9FAFB] border border-[#E5E7EB] text-xs font-medium rounded px-2 py-1 text-[#242A30] cursor-pointer"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1.0}>1.0x</option>
                      <option value={2.0}>2.0x</option>
                      <option value={5.0}>5.0x</option>
                      <option value={10.0}>10.0x</option>
                    </select>
                  </div>
                </div>

                {/* Simulation Time (Digital Counter) */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-[#647078] uppercase font-semibold">Simulation Time</span>
                  <span className="text-sm font-mono font-bold text-[#242A30]">{formatTime(simTime)}</span>
                </div>

                {/* Evacuated Progress & Count */}
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#647078] uppercase font-semibold">Evacuated</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#242A30]">
                        {evacuatedCount} / {totalOccupants}
                      </span>
                    </div>
                  </div>

                  <div className="w-32 bg-[#F3F4F6] h-2 rounded-full overflow-hidden border border-[#E5E7EB]">
                    <div
                      className="bg-[#167D73] h-full rounded-full transition-all duration-300"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#167D73] w-9">{completionPct}%</span>
                </div>

                {/* Routing Strategy Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#647078]">Strategy</span>
                  <select
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value as AlgorithmType)}
                    className="bg-[#F9FAFB] border border-[#E5E7EB] text-xs font-medium rounded-md px-3 py-1.5 text-[#242A30] cursor-pointer focus:ring-1 focus:ring-[#167D73]"
                  >
                    <option value="adaptive">Adaptive (Predictive)</option>
                    <option value="baseline">Baseline (Dijkstra)</option>
                  </select>
                </div>
              </div>
            </main>

            {/* Right Inspector Panel - Dynamic Type-Specific Telemetry */}
            <aside className="hidden lg:flex w-84 bg-white border-l border-[#E5E7EB] flex-col overflow-y-auto shrink-0 select-none">
              <div className="p-4 border-b border-[#E5E7EB]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#167D73] bg-[#E6F4F2] px-2 py-0.5 rounded">
                    {selectedElement ? `${selectedElement.type.toUpperCase()} INSPECTOR` : 'BUILDING OVERVIEW'}
                  </span>
                  {selectedElement && (
                    <button
                      onClick={() => setSelectedElement(null)}
                      className="text-xs text-[#647078] hover:text-[#242A30] font-bold px-1.5 py-0.5 rounded hover:bg-[#F3F4F6]"
                      title="Clear Selection"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <h3 className="text-sm font-bold text-[#242A30] truncate">
                  {selectedElement?.data?.name || selectedElement?.id || building?.name || 'Multi-Floor Facility'}
                </h3>

                {/* Tabs: Overview, Occupancy, Safety */}
                <div className="flex border-b border-[#E5E7EB] mt-3">
                  <button
                    onClick={() => setActiveInspectorTab('overview')}
                    className={`flex-1 py-1.5 text-xs font-medium border-b-2 text-center transition-colors ${
                      activeInspectorTab === 'overview'
                        ? 'border-[#167D73] text-[#167D73] font-semibold'
                        : 'border-transparent text-[#647078] hover:text-[#242A30]'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveInspectorTab('occupancy')}
                    className={`flex-1 py-1.5 text-xs font-medium border-b-2 text-center transition-colors ${
                      activeInspectorTab === 'occupancy'
                        ? 'border-[#167D73] text-[#167D73] font-semibold'
                        : 'border-transparent text-[#647078] hover:text-[#242A30]'
                    }`}
                  >
                    Occupancy
                  </button>
                  <button
                    onClick={() => setActiveInspectorTab('safety')}
                    className={`flex-1 py-1.5 text-xs font-medium border-b-2 text-center transition-colors ${
                      activeInspectorTab === 'safety'
                        ? 'border-[#167D73] text-[#167D73] font-semibold'
                        : 'border-transparent text-[#647078] hover:text-[#242A30]'
                    }`}
                  >
                    Safety
                  </button>
                </div>
              </div>

              {/* Inspector Dynamic Content */}
              <div className="p-4 space-y-4 text-xs">
                {activeInspectorTab === 'overview' ? (
                  <>
                    {/* Case 1: Exit Selected */}
                    {selectedElement?.type === 'exit' ? (
                      (() => {
                        const exit = exits.find((e) => e.id === selectedElement.id) || selectedElement.data;
                        const floorName = building?.floors.find((f) => f.id === exit.floor_id)?.name || 'Ground Level';
                        const queuedCount = occupants.filter((o) => o.target_exit_id === exit.id && o.evacuation_state === 'waiting').length;
                        const targetingCount = occupants.filter((o) => o.target_exit_id === exit.id && o.evacuation_state === 'evacuating').length;

                        return (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Element Type</span>
                                <span className="font-semibold text-[#242A30]">Emergency Egress Exit</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Status</span>
                                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                                  exit.is_blocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {exit.is_blocked ? 'BLOCKED / CLOSED' : 'OPERATIONAL / OPEN'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Floor</span>
                                <span className="font-medium text-[#242A30]">{floorName}</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Discharge Width</span>
                                <span className="font-medium text-[#242A30]">{(exit.width || 2.4).toFixed(1)} m</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Flow Capacity</span>
                                <span className="font-medium text-[#242A30]">{(exit.throughput_per_sec || 2.0).toFixed(1)} peds/s</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Accessibility</span>
                                <span className={`font-medium ${exit.is_wheelchair_accessible ? 'text-[#167D73]' : 'text-amber-700'}`}>
                                  {exit.is_wheelchair_accessible ? 'ADA Compliant (Ramped)' : 'Stairs Only'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Queued Occupants</span>
                                <span className="font-bold text-[#242A30]">{queuedCount} persons</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">En Route Evacuees</span>
                                <span className="font-bold text-[#167D73]">{targetingCount} persons</span>
                              </div>
                            </div>

                            {/* Emergency Override Interactive Button */}
                            <div className="pt-2">
                              <button
                                onClick={() => handleToggleExit(exit.id)}
                                className={`w-full py-2 px-3 rounded-md text-xs font-bold text-white transition-colors shadow-xs ${
                                  exit.is_blocked
                                    ? 'bg-[#167D73] hover:bg-[#126860]'
                                    : 'bg-red-600 hover:bg-red-700'
                                }`}
                              >
                                {exit.is_blocked ? '✓ Reopen Emergency Exit' : '⚠️ Emergency Close / Block Exit'}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : selectedElement?.type === 'room' ? (
                      (() => {
                        const room = selectedElement.data || {};
                        const floorName = building?.floors.find((f) => f.id === (room.floor_id || selectedElement.floorId))?.name || 'Main Floor';
                        const rw = room.bounds?.width ?? room.width ?? 6.0;
                        const rh = room.bounds?.height ?? room.height ?? 6.0;
                        const rx = room.bounds?.x ?? 0.0;
                        const ry = room.bounds?.y ?? 0.0;
                        const occCount = occupants.filter((o) =>
                          o.current_node_id === `node_room_${room.id}` ||
                          (o.x >= rx && o.x <= rx + rw && o.y >= ry && o.y <= ry + rh)
                        ).length;

                        return (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Room Type</span>
                                <span className="font-semibold text-[#242A30] capitalize">{room.room_type || 'Office'}</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Floor</span>
                                <span className="font-medium text-[#242A30]">{floorName}</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Dimensions</span>
                                <span className="font-medium text-[#242A30]">
                                  {rw.toFixed(1)}m × {rh.toFixed(1)}m
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Floor Area</span>
                                <span className="font-medium text-[#242A30]">{(rw * rh).toFixed(1)} m²</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Max Capacity</span>
                                <span className="font-medium text-[#242A30]">{room.max_capacity || 6} occupants</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Current Occupants</span>
                                <span className="font-bold text-[#167D73]">{occCount} occupants</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Accessibility</span>
                                <span className="font-medium text-[#167D73] flex items-center gap-1">
                                  <Accessibility className="w-3.5 h-3.5" />
                                  {room.is_accessible ?? true ? 'Wheelchair Accessible' : 'Standard'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : selectedElement?.type === 'occupant' ? (
                      (() => {
                        const occ = occupants.find((o) => o.id === selectedElement.id) || selectedElement.data;
                        const floorName = building?.floors.find((f) => f.id === occ.floor_id)?.name || 'Ground Floor';
                        const isTracking = followOccupantId === occ.id;

                        return (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Mobility Classification</span>
                                <span className={`font-semibold ${
                                  occ.mobility_category === 'wheelchair' ? 'text-[#0284c7]' : 'text-[#242A30]'
                                }`}>
                                  {occ.mobility_category === 'wheelchair'
                                    ? '♿ Wheelchair User'
                                    : occ.mobility_category === 'reduced_speed'
                                    ? 'Reduced Speed'
                                    : 'Standard Ambulatory'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Evacuation State</span>
                                <span className={`font-bold px-2 py-0.5 rounded text-[11px] capitalize ${
                                  occ.evacuation_state === 'exited'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : occ.evacuation_state === 'trapped'
                                    ? 'bg-red-100 text-red-700'
                                    : occ.evacuation_state === 'waiting'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {occ.evacuation_state}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Current Floor</span>
                                <span className="font-medium text-[#242A30]">{floorName}</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">3D Coordinates (X, Y, Z)</span>
                                <span className="font-mono text-[#242A30]">
                                  {occ.x.toFixed(1)}m, {occ.y.toFixed(1)}m, {(occ.z ?? 0).toFixed(1)}m
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Velocity</span>
                                <span className="font-bold text-[#242A30]">
                                  {occ.movement_speed.toFixed(2)} m/s (Free: {occ.free_speed.toFixed(2)} m/s)
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Distance Traveled</span>
                                <span className="font-medium text-[#242A30]">{occ.distance_traveled.toFixed(1)} m</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Hazard Exposure</span>
                                <span className={`font-medium ${occ.hazard_exposure > 0 ? 'text-red-600 font-bold' : 'text-[#647078]'}`}>
                                  {(occ.hazard_exposure || 0).toFixed(3)} dosage
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Adaptive Reroutes</span>
                                <span className="font-medium text-[#167D73]">{occ.reroute_count || 0}</span>
                              </div>
                            </div>

                            {/* Camera Follow Toggle */}
                            <div className="pt-2">
                              <button
                                onClick={() => setFollowOccupantId(isTracking ? null : occ.id)}
                                className={`w-full py-2 px-3 rounded-md text-xs font-bold text-white transition-colors shadow-xs ${
                                  isTracking ? 'bg-[#D97706] hover:bg-[#B45309]' : 'bg-[#167D73] hover:bg-[#126860]'
                                }`}
                              >
                                {isTracking ? '✕ Stop Following Agent' : '🎥 Follow Agent in 3D Viewport'}
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : selectedElement?.type === 'stair' ? (
                      (() => {
                        const stair = selectedElement.data;
                        const fromFloor = building?.floors.find((f) => f.id === stair.from_floor)?.name || stair.from_floor;
                        const toFloor = building?.floors.find((f) => f.id === stair.to_floor)?.name || stair.to_floor;
                        const isRamp = stair.is_ramp || stair.is_wheelchair_accessible;

                        return (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Connector Type</span>
                                <span className="font-semibold text-[#242A30]">
                                  {isRamp ? '♿ Accessible Incline Ramp' : 'Staircase Flight'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Levels Connected</span>
                                <span className="font-medium text-[#242A30]">{fromFloor} ↔ {toFloor}</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Passage Width</span>
                                <span className="font-medium text-[#242A30]">{(stair.width || 1.8).toFixed(1)} m</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Throughput Rating</span>
                                <span className="font-medium text-[#242A30]">{(stair.throughput_per_sec || 1.8).toFixed(1)} peds/s</span>
                              </div>
                              <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                                <span className="text-[#647078]">Wheelchair Allowed</span>
                                <span className={`font-medium ${isRamp ? 'text-[#167D73]' : 'text-red-600'}`}>
                                  {isRamp ? 'Yes (Compliant Slope)' : 'No (Steps Inaccessible)'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      /* Default Building Overview */
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                            <span className="text-[#647078]">Facility Complex</span>
                            <span className="font-bold text-[#242A30]">{building?.name || 'Healthcare Wing'}</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                            <span className="text-[#647078]">Building Stories</span>
                            <span className="font-medium text-[#242A30]">{building?.floors.length || 1} Floors</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                            <span className="text-[#647078]">Total Rooms</span>
                            <span className="font-medium text-[#242A30]">
                              {building?.floors.reduce((acc, f) => acc + (f.rooms?.length || 0), 0) || 0} Rooms
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                            <span className="text-[#647078]">Ground Exterior Exits</span>
                            <span className="font-bold text-[#167D73]">{exits.length} Exits</span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                            <span className="text-[#647078]">Active Evacuees</span>
                            <span className="font-bold text-[#242A30]">
                              {occupants.filter((o) => o.evacuation_state === 'evacuating').length} occupants
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                            <span className="text-[#647078]">Wheelchair Evacuees</span>
                            <span className="font-semibold text-[#0284c7]">
                              {occupants.filter((o) => o.mobility_category === 'wheelchair').length} occupants
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-[#F3F4F6]">
                            <span className="text-[#647078]">Evacuated Safely</span>
                            <span className="font-bold text-emerald-700">
                              {evacuatedCount} / {totalOccupants} ({completionPct}%)
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#F9FAFB] rounded border border-[#E5E7EB] text-[#647078] leading-relaxed">
                          💡 <strong>Interactive Inspection:</strong> Click on any room, door, staircase, emergency exit, or evacuating human figure in the 3D viewport to inspect live properties.
                        </div>
                      </div>
                    )}
                  </>
                ) : activeInspectorTab === 'occupancy' ? (
                  <div className="space-y-3">
                    <span className="block font-semibold text-[11px] text-[#242A30] uppercase">Occupant Density</span>
                    <div className="p-3 bg-[#F9FAFB] rounded border border-[#E5E7EB] space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[#647078]">Local Crowd Density:</span>
                        <span className="font-semibold text-[#242A30]">
                          {(metrics?.mean_crowd_density || 0.42).toFixed(2)} pers/m²
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#647078]">Peak Observed:</span>
                        <span className="font-semibold text-[#242A30]">
                          {(metrics?.max_crowd_density || 1.15).toFixed(2)} pers/m²
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#647078]">Total Moving Agents:</span>
                        <span className="font-semibold text-[#167D73]">
                          {occupants.filter((o) => o.evacuation_state === 'evacuating').length}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="block font-semibold text-[11px] text-[#242A30] uppercase">Safety Telemetry</span>
                    <div className="p-3 bg-[#F9FAFB] rounded border border-[#E5E7EB] space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[#647078]">Topology Verification:</span>
                        <span className="font-semibold text-[#15803D]">
                          {audit?.is_valid ? 'Verified Connected' : 'Compliant'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#647078]">Accessible Coverage:</span>
                        <span className="font-semibold text-[#167D73]">
                          {audit?.wheelchair_accessible_coverage_percent ?? 100}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#647078]">Reroute Events Logged:</span>
                        <span className="font-semibold text-[#242A30]">{rerouteEvents.length} events</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#647078]">Simulation Step:</span>
                        <span className="font-semibold text-[#242A30]">Step {stepCount}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Demonstration Rehearsal Modal */}
      {isDemoModalOpen && (
        <Suspense fallback={null}>
          <DemonstrationModeModal
            isOpen={isDemoModalOpen}
            onClose={() => setIsDemoModalOpen(false)}
            onLoadScenario={(scId: string, algo: 'baseline' | 'adaptive', s: number) => {
              setSelectedScenarioId(scId);
              setAlgorithm(algo);
              setSeed(s);
              setIsDemoModalOpen(false);
              setActiveView('simulation');
            }}
          />
        </Suspense>
      )}

      {/* Scenarios Selection Modal */}
      {isScenariosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-[#E5E7EB] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#242A30]">Scenarios Library</h3>
                <p className="text-xs text-[#647078]">Select a benchmark or multi-floor digital twin scenario</p>
              </div>
              <button
                onClick={() => setIsScenariosModalOpen(false)}
                className="text-[#647078] hover:text-[#242A30] text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {scenarios.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => {
                    setSelectedScenarioId(sc.id);
                    setIsScenariosModalOpen(false);
                    setActiveView('simulation');
                  }}
                  className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                    selectedScenarioId === sc.id
                      ? 'border-[#167D73] bg-[#E6F4F2]/50 ring-1 ring-[#167D73]'
                      : 'border-[#E5E7EB] hover:border-[#167D73] hover:bg-[#F9FAFB]'
                  }`}
                >
                  <h4 className="font-semibold text-xs text-[#242A30] mb-1">{sc.name}</h4>
                  <p className="text-[11px] text-[#647078] line-clamp-2 mb-2">{sc.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-[#647078]">
                    <span>Floors: {sc.floor_count}</span>
                    <span>Rooms: {sc.room_count}</span>
                    <span>Exits: {sc.exit_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-[#E5E7EB] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#242A30]">Digital Twin Settings</h3>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-[#647078] hover:text-[#242A30] text-sm"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[#647078] mb-1 font-medium">Random Simulation Seed</label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value) || 42)}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded p-2 text-[#242A30]"
                />
              </div>
              <div>
                <label className="block text-[#647078] mb-1 font-medium">Simulation Physics Step dt (s)</label>
                <input
                  type="text"
                  value="0.50 s (Fixed Discrete Step)"
                  readOnly
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded p-2 text-[#647078]"
                />
              </div>
              <div>
                <label className="block text-[#647078] mb-1 font-medium">Weidmann Jam Density (pers/m²)</label>
                <input
                  type="text"
                  value="5.40 persons/m²"
                  readOnly
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded p-2 text-[#647078]"
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="w-full py-2 bg-[#167D73] text-white font-medium rounded shadow-xs"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Building Import Wizard Modal */}
      <BuildingImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImportComplete={(_summary, action) => {
          setIsImportWizardOpen(false);
          if (action === 'studio') {
            setActiveView('studio');
          } else {
            setActiveView('simulation');
          }
          // Refresh buildings
          api.getBuildings().catch(console.error);
        }}
      />
    </div>
  );
}

export default App;
