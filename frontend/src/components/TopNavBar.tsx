import React from 'react';
import type { AlgorithmType, ScenarioSummary } from '../types/simulation';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Cpu,
  Layers,
  Gauge,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react';

interface TopNavBarProps {
  scenarios: ScenarioSummary[];
  selectedScenarioId: string;
  onSelectScenario: (id: string) => void;
  algorithm: AlgorithmType;
  onChangeAlgorithm: (algo: AlgorithmType) => void;
  seed: number;
  onChangeSeed: (seed: number) => void;
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  speedMultiplier: number;
  onChangeSpeed: (spd: number) => void;
  isOnline: boolean;
  stepCount: number;
  simTime: number;
  counts: {
    evacuated: number;
    moving: number;
    waiting: number;
    trapped: number;
    total: number;
  };
  activeView: 'simulation' | 'experiments';
  onChangeView: (view: 'simulation' | 'experiments') => void;
  onOpenDemonstration: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  algorithm,
  onChangeAlgorithm,
  seed,
  onChangeSeed,
  isRunning,
  onTogglePlay,
  onStep,
  onReset,
  speedMultiplier,
  onChangeSpeed,
  isOnline,
  stepCount,
  simTime,
  counts,
  activeView,
  onChangeView,
  onOpenDemonstration,
}) => {
  return (
    <header className="z-30 flex w-full flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950 px-3 py-2.5 text-white shadow-md sm:px-4">
      {/* 1. Brand & Mission Tag */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono text-base">
            E0
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold tracking-tight text-white text-base">
                EXIT-ZERO
              </span>
              <span className="hidden text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider 2xl:inline">
                INNOVEX 2026 DIGITAL TWIN
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Physically-Constrained Adaptive Emergency Evacuation
            </p>
          </div>
        </div>

        {/* View Switcher: Live Simulation vs Evidence Dashboard */}
        <nav aria-label="Primary views" className="flex items-center rounded-md border border-slate-700 bg-slate-800 p-0.5 text-xs font-semibold">
          <button
            onClick={() => onChangeView('simulation')}
            className={`px-2.5 py-1 rounded transition flex items-center space-x-1 ${
              activeView === 'simulation'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Live Simulation</span>
          </button>
          <button
            onClick={() => onChangeView('experiments')}
            className={`px-2.5 py-1 rounded transition flex items-center space-x-1 ${
              activeView === 'experiments'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>Evidence Dashboard</span>
          </button>
        </nav>

        {/* Interactive Demonstration Mode Pill Button */}
        <button
          onClick={onOpenDemonstration}
          className="hidden md:flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded text-xs text-amber-300 font-medium transition cursor-pointer"
          title="Launch Guided 6-Step Demonstration"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Interactive Demo</span>
        </button>
      </div>

      {/* 2. Center Controls: Scenario, Algorithm, Speed & Playback */}
      <div className="order-3 flex w-full flex-wrap items-center gap-2 2xl:order-none 2xl:w-auto 2xl:flex-nowrap">
        {/* Scenario Select */}
        <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2 py-1 rounded border border-slate-700 text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <select
            aria-label="Simulation scenario"
            value={selectedScenarioId}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline focus:outline-2 focus:outline-emerald-400 rounded cursor-pointer pr-1"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Algorithm Select */}
        <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2 py-1 rounded border border-slate-700 text-xs">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <select
            aria-label="Routing strategy"
            value={algorithm}
            onChange={(e) => onChangeAlgorithm(e.target.value as AlgorithmType)}
            className="bg-transparent text-xs text-white focus:outline focus:outline-2 focus:outline-emerald-400 rounded cursor-pointer pr-1"
          >
            <option value="baseline" className="bg-slate-900 text-white">
              Baseline (Shortest-Path Dijkstra)
            </option>
            <option value="adaptive" className="bg-slate-900 text-emerald-400 font-semibold">
              EXIT-ZERO (Adaptive Predictive)
            </option>
          </select>
        </div>

        {/* Deterministic Seed */}
        <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded border border-slate-700 text-xs">
          <span className="text-[11px] text-slate-400 font-mono">Seed:</span>
          <input
            aria-label="Deterministic random seed"
            type="number"
            value={seed}
            onChange={(e) => onChangeSeed(parseInt(e.target.value) || 0)}
            className="w-12 bg-transparent text-xs font-mono text-emerald-300 text-right focus:outline focus:outline-2 focus:outline-emerald-400 rounded"
          />
        </div>

        {/* Speed Multiplier (0.5x, 1x, 2x, 5x) */}
        <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded border border-slate-700 text-xs">
          <Gauge className="w-3.5 h-3.5 text-slate-400" />
          <select
            aria-label="Simulation speed"
            value={speedMultiplier}
            onChange={(e) => onChangeSpeed(parseFloat(e.target.value))}
            className="bg-transparent text-xs text-emerald-300 font-mono focus:outline focus:outline-2 focus:outline-emerald-400 rounded cursor-pointer"
            title="Simulation Progression Rate"
          >
            <option value={0.5} className="bg-slate-900 text-white">0.5x</option>
            <option value={1.0} className="bg-slate-900 text-white">1.0x</option>
            <option value={2.0} className="bg-slate-900 text-white">2.0x</option>
            <option value={5.0} className="bg-slate-900 text-white">5.0x</option>
          </select>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-md border border-slate-700">
          <button
            aria-label={isRunning ? 'Pause simulation' : 'Start simulation'}
            onClick={onTogglePlay}
            className={`p-1.5 rounded transition ${
              isRunning
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
            title={isRunning ? 'Pause Simulation' : 'Start Simulation'}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            aria-label="Advance simulation by 0.5 seconds"
            onClick={onStep}
            disabled={isRunning}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 transition"
            title="Single-Step Forward (+0.5s)"
          >
            <StepForward className="w-3.5 h-3.5" />
          </button>
          <button
            aria-label="Reset simulation"
            onClick={onReset}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition"
            title="Reset Simulation (Reproducible Seed)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Right: Live Crowd Counts & Sim Clock */}
      <div className="ml-auto flex items-center space-x-3 text-xs">
        {/* Real-Time Live Status Census */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700 text-[11px] font-mono">
          <span className="text-emerald-400 font-bold" title="Evacuated">
            ✓ {counts.evacuated}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-blue-300" title="Moving along corridors">
            ➔ {counts.moving}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400 font-semibold" title="Queued at exits">
            ⏳ {counts.waiting}
          </span>
          {counts.trapped > 0 && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-red-400 font-bold" title="Trapped">
                ⚠ {counts.trapped}
              </span>
            </>
          )}
        </div>

        {/* Sim Clock & Step */}
        <div className="flex items-center space-x-2 text-right font-mono">
          <div>
            <span className="text-slate-400 text-[9px] block">CLOCK</span>
            <span className="text-emerald-400 font-bold text-xs">{simTime.toFixed(1)}s</span>
          </div>
          <div className="border-l border-slate-800 h-5"></div>
          <div>
            <span className="text-slate-400 text-[9px] block">STEP</span>
            <span className="text-slate-300 font-semibold text-xs">{stepCount}</span>
          </div>
        </div>

        {/* Backend Online Indicator */}
        <div
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="text-[10px] font-medium hidden sm:inline">{isOnline ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
    </header>
  );
};
