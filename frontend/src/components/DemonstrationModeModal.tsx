import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Play,
  Activity,
  GitFork,
  Flame,
  BarChart3,
  Minimize2,
  Maximize2,
  ShieldCheck,
  DoorClosed,
} from 'lucide-react';
import type { SimulationMetrics } from '../types/simulation';

interface DemonstrationModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadScenario: (
    scenarioId: string,
    algorithm: 'baseline' | 'adaptive',
    seed: number,
    autoStart?: boolean,
  ) => void;
  onToggleExit?: (exitId: string) => void;
  onStartSimulation?: () => void;
  onSwitchView?: (view: 'simulation' | 'experiments') => void;
  metrics?: SimulationMetrics | null;
  simTime?: number;
}

export const DemonstrationModeModal: React.FC<DemonstrationModeModalProps> = ({
  isOpen,
  onClose,
  onLoadScenario,
  onToggleExit,
  onSwitchView,
  metrics,
  simTime = 0,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps = [
    {
      stepNumber: 1,
      title: '1. Building Layout & Occupant Distribution',
      subtitle: 'Physical Digital Twin Architecture',
      icon: Activity,
      summary:
        'EXIT-ZERO models a realistic commercial headquarters containing 10 office suites, central cafeteria atrium, 4 exits, and 200 occupants.',
      explanation:
        'Notice how occupants have different physical mobility classes: standard walkers (blue), wheelchair users (amber), and reduced-speed individuals (purple). Each occupant has physically bounded speeds and cannot pass through walls or obstacles.',
      actionLabel: 'Load Building Layout & Reset',
      action: () => onLoadScenario('scenario_congested_corridor', 'baseline', 101),
      callout: '200 Occupants · 4 Exits (North, East, South, West Ramp) · Seed 101',
    },
    {
      stepNumber: 2,
      title: '2. Conventional Shortest-Path Evacuation',
      subtitle: 'Standard Building Code Baseline',
      icon: AlertTriangle,
      summary:
        'Conventional building emergency plans direct every person to the geographically closest exit door (Dijkstra shortest path).',
      explanation:
        'Press Play to watch the baseline in action. Notice how almost all occupants in the central atrium and north suites rush towards the same north exit door, ignoring the fact that other doors are wide open!',
      actionLabel: 'Load & Run Baseline',
      action: () => {
        onLoadScenario('scenario_congested_corridor', 'baseline', 101, true);
      },
      callout: 'Baseline Algorithm: Uncoordinated nearest-exit routing',
    },
    {
      stepNumber: 3,
      title: '3. Formation of Congestion & Bottlenecks',
      subtitle: 'Weidmann Speed Deceleration Physics',
      icon: Flame,
      summary:
        'When too many people squeeze into the central corridor, crowd density spikes above 3.0 persons/m², slowing walking speeds to a crawl.',
      explanation:
        'Look at the red and orange glow on the central hallway. As queue lengths grow at the main exit, people are stuck waiting in line while other perimeter exits sit completely idle. This creates dangerous crowd crush risks.',
      actionLabel: 'Inspect Bottleneck Telemetry',
      action: undefined,
      callout: `t = ${simTime.toFixed(1)}s · Peak Density: ${metrics ? metrics.max_crowd_density.toFixed(2) : '0.00'} pers/m² · Peak Queue: ${metrics ? metrics.max_exit_queue_length : 0} people`,
    },
    {
      stepNumber: 4,
      title: '4. Predictive Adaptive Routing (EXIT-ZERO)',
      subtitle: 'Dynamic Queue Balancing & 20s Lookahead',
      icon: GitFork,
      summary:
        'EXIT-ZERO functions like Google Maps for emergency evacuations: predicting bottlenecks 20 seconds into the future and rerouting occupants.',
      explanation:
        'Load EXIT-ZERO with the exact same seed (101). Watch how the algorithm proactively steers occupants away from the crowded central atrium into secondary exits (West Ramp and East Fire Escape) before lines ever form!',
      actionLabel: 'Run EXIT-ZERO Adaptive Simulation',
      action: () => {
        onLoadScenario('scenario_congested_corridor', 'adaptive', 101, true);
      },
      callout: 'Evaluates Travel Time + Queue Delay + Congestion + Reroute Hysteresis',
    },
    {
      stepNumber: 5,
      title: '5. Live Emergency Exit Failure & Resilience',
      subtitle: 'Dynamic Incident Response Demonstration',
      icon: DoorClosed,
      summary:
        'What happens when a fire or structural collapse suddenly blocks an emergency exit during evacuation?',
      explanation:
        'Click the button below to simulate an unexpected emergency closure of the East Fire Escape. Under EXIT-ZERO, occupants instantly calculate alternative routes with zero trapped occupants and zero panic cycling.',
      actionLabel: '⚡ Block East Fire Escape',
      action: () => {
        if (onToggleExit) onToggleExit('exit_east_fire');
      },
      callout: 'Simulates sudden exit closure at runtime. Watch dynamic reroute arrows appear on screen!',
    },
    {
      stepNumber: 6,
      title: '6. Experimental Evidence & Scientific Rigor',
      subtitle: '20 Paired Seeds & Bootstrap Confidence Intervals',
      icon: BarChart3,
      summary:
        'We tested both algorithms across 20 paired random seeds under strictly identical physical physics.',
      explanation:
        'In Scenario B (Congested Corridor, N=200, 20 paired seeds), EXIT-ZERO improves mean evacuation from 84.45s to 72.92s — a 13.65% speedup (saving 11.53s, p = 0.0001) while cutting peak queues by 7.3 occupants. Open the Evidence Dashboard to inspect the full statistical charts and exports.',
      actionLabel: 'Open Evidence Dashboard',
      action: () => {
        if (onSwitchView) onSwitchView('experiments');
        onClose();
      },
      callout: '95% Bootstrap CI: [6.50s, 16.60s] · Permutation p = 0.0001 · 16 Wins / 3 Losses / 1 Tie',
    },
  ];

  const activeStep = steps[currentStep];

  // Minimized Floating Pill Mode
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-slate-900/95 hover:bg-slate-800 text-white border border-emerald-500/60 shadow-2xl rounded-full px-4 py-2 flex items-center space-x-2.5 backdrop-blur transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="font-semibold text-xs text-emerald-400">
            Judge Walkthrough · Step {currentStep + 1}/6
          </span>
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
        </button>
      </div>
    );
  }

  // Floating Docked Walkthrough Card (Non-blocking)
  return (
    <div
      role="region"
      aria-label="Judge Demonstration Walkthrough"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[480px] z-50 pointer-events-auto"
    >
      <div className="bg-slate-900/95 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden flex flex-col transition-all">
        {/* Header Bar */}
        <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-xs text-white uppercase tracking-wider">
              Judge Demonstration Guide
            </h3>
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.5 rounded-full font-mono">
              Step {currentStep + 1} of 6
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsMinimized(true)}
              title="Minimize to floating pill"
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close demonstration"
              title="Close demonstration"
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Stepper Ribbon */}
        <div className="bg-slate-950/40 px-4 py-1.5 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex space-x-1 w-full">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all flex-1 ${
                  idx === currentStep
                    ? 'bg-emerald-400'
                    : idx < currentStep
                    ? 'bg-emerald-700'
                    : 'bg-slate-800'
                }`}
                title={`Jump to Step ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Step Body */}
        <div className="p-4 space-y-3">
          <div>
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wide">
              {activeStep.subtitle}
            </span>
            <h4 className="text-sm font-bold text-white mt-0.5 flex items-center space-x-1.5">
              <span>{activeStep.title}</span>
            </h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed font-sans">
              {activeStep.summary}
            </p>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-sans bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              💡 <span className="text-slate-200">{activeStep.explanation}</span>
            </p>
          </div>

          {/* Live Data Callout Banner */}
          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-mono text-emerald-300">{activeStep.callout}</span>
            </div>
          </div>

          {/* Action Trigger Button */}
          {activeStep.action && (
            <button
              onClick={activeStep.action}
              className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-lg shadow-md transition flex items-center justify-center space-x-2"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{activeStep.actionLabel}</span>
            </button>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-slate-950/90 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
            disabled={currentStep === 0}
            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center space-x-1 ${
              currentStep === 0
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <span className="text-[10px] font-mono text-slate-500">
            {currentStep + 1} of {steps.length}
          </span>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded text-xs transition flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => {
                if (onSwitchView) onSwitchView('experiments');
                onClose();
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded text-xs transition flex items-center space-x-1 shadow-sm"
            >
              <span>View Evidence</span>
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
