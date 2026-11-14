import React from 'react';
import { Layers, Eye, EyeOff, Activity } from 'lucide-react';

interface LayerControlsProps {
  showRooms: boolean;
  setShowRooms: (v: boolean | ((prev: boolean) => boolean)) => void;
  showGraph: boolean;
  setShowGraph: (v: boolean | ((prev: boolean) => boolean)) => void;
  showExits: boolean;
  setShowExits: (v: boolean | ((prev: boolean) => boolean)) => void;
  showOccupants: boolean;
  setShowOccupants: (v: boolean | ((prev: boolean) => boolean)) => void;
  showHazards: boolean;
  setShowHazards: (v: boolean | ((prev: boolean) => boolean)) => void;
  showRoutes: boolean;
  setShowRoutes: (v: boolean | ((prev: boolean) => boolean)) => void;
  showCongestionHeatmap: boolean;
  setShowCongestionHeatmap: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  showRooms,
  setShowRooms,
  showGraph,
  setShowGraph,
  showExits,
  setShowExits,
  showOccupants,
  setShowOccupants,
  showHazards,
  setShowHazards,
  showRoutes,
  setShowRoutes,
  showCongestionHeatmap,
  setShowCongestionHeatmap,
}) => {
  const layers = [
    { label: 'Rooms & Walls', state: showRooms, toggle: () => setShowRooms((p) => !p) },
    { label: 'Navigation Graph', state: showGraph, toggle: () => setShowGraph((p) => !p) },
    { label: 'Emergency Exits', state: showExits, toggle: () => setShowExits((p) => !p) },
    { label: 'Occupants', state: showOccupants, toggle: () => setShowOccupants((p) => !p) },
    { label: 'Hazard Zones', state: showHazards, toggle: () => setShowHazards((p) => !p) },
    { label: 'Planned Routes', state: showRoutes, toggle: () => setShowRoutes((p) => !p) },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-sm flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 text-slate-800 pr-2 border-r border-slate-200">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <h4 className="font-semibold text-xs text-slate-900">Layers</h4>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {layers.map((l) => (
            <button
              key={l.label}
              onClick={l.toggle}
              className={`flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded transition font-medium ${
                l.state
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {l.state ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Prominent Congestion Heatmap Toggle */}
      <div>
        <button
          onClick={() => setShowCongestionHeatmap((p) => !p)}
          className={`flex items-center space-x-1.5 text-[11px] px-3 py-1 rounded-md font-semibold transition shadow-xs ${
            showCongestionHeatmap
              ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 ring-offset-1'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
          }`}
          title="Toggle corridor crowd density heatmap"
        >
          <Activity className={`w-3.5 h-3.5 ${showCongestionHeatmap ? 'text-slate-950 animate-pulse' : 'text-amber-600'}`} />
          <span>{showCongestionHeatmap ? 'Congestion Heatmap ON' : 'Show Congestion Heatmap'}</span>
        </button>
      </div>
    </div>
  );
};
