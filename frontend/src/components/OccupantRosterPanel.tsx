import React from 'react';
import type { Occupant } from '../types/simulation';
import { Users, Activity } from 'lucide-react';

interface OccupantRosterPanelProps {
  occupants: Occupant[];
  selectedOccupantId: string | null;
  onSelectOccupant: (id: string | null) => void;
}

export const OccupantRosterPanel: React.FC<OccupantRosterPanelProps> = ({
  occupants,
  selectedOccupantId,
  onSelectOccupant,
}) => {
  const total = occupants.length;
  const evacuated = occupants.filter((o) => o.evacuation_state === 'exited').length;
  const trapped = occupants.filter((o) => o.evacuation_state === 'trapped').length;
  const active = occupants.filter((o) => o.evacuation_state === 'evacuating').length;

  const standardCount = occupants.filter((o) => o.mobility_category === 'standard').length;
  const wheelchairCount = occupants.filter((o) => o.mobility_category === 'wheelchair').length;
  const reducedCount = occupants.filter((o) => o.mobility_category === 'reduced_speed').length;

  const selectedOccupant = occupants.find((o) => o.id === selectedOccupantId);

  return (
    <div className="flex flex-col space-y-4 text-slate-800">
      {/* 1. Population Overview */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-slate-900">Occupant Population</h3>
          </div>
          <span className="font-mono font-bold text-sm text-slate-800">{total} Agents</span>
        </div>

        {/* Status Counters */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          <div className="bg-blue-50/70 p-2.5 rounded border border-blue-100 text-center">
            <span className="text-blue-600 block text-[10px] font-medium">IN TRANSIT</span>
            <span className="text-base font-bold text-blue-900 font-mono">{active}</span>
          </div>
          <div className="bg-emerald-50/70 p-2.5 rounded border border-emerald-100 text-center">
            <span className="text-emerald-600 block text-[10px] font-medium">EVACUATED</span>
            <span className="text-base font-bold text-emerald-900 font-mono">{evacuated}</span>
          </div>
          <div className="bg-red-50/70 p-2.5 rounded border border-red-100 text-center">
            <span className="text-red-600 block text-[10px] font-medium">TRAPPED</span>
            <span className="text-base font-bold text-red-900 font-mono">{trapped}</span>
          </div>
        </div>

        {/* Mobility Category Breakdown */}
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Standard Mobility (1.2–1.5 m/s)</span>
            </div>
            <span className="font-mono font-semibold text-slate-800">
              {standardCount} ({Math.round((standardCount / Math.max(1, total)) * 100)}%)
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Wheelchair Accessible ♿ (0.65–0.85 m/s)</span>
            </div>
            <span className="font-mono font-semibold text-slate-800">
              {wheelchairCount} ({Math.round((wheelchairCount / Math.max(1, total)) * 100)}%)
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span>Reduced Speed / Elderly (0.75–0.95 m/s)</span>
            </div>
            <span className="font-mono font-semibold text-slate-800">
              {reducedCount} ({Math.round((reducedCount / Math.max(1, total)) * 100)}%)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Selected Occupant Telemetry Inspector */}
      {selectedOccupant ? (
        <div className="bg-white rounded-lg border border-emerald-300 p-4 shadow-sm bg-gradient-to-b from-emerald-50/30 to-white">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <h4 className="font-semibold text-xs text-slate-900">
                Agent Inspector: <span className="font-mono text-emerald-700">{selectedOccupant.id}</span>
              </h4>
            </div>
            <button
              onClick={() => onSelectOccupant(null)}
              className="text-[10px] text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2.5 text-xs">
            <div className="bg-white p-2 rounded border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Mobility Class</span>
              <span className="font-semibold text-slate-800 uppercase text-[11px]">
                {selectedOccupant.mobility_category}
              </span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Movement Speed</span>
              <span className="font-mono font-semibold text-slate-800">
                {selectedOccupant.movement_speed.toFixed(2)} m/s
              </span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Assigned Exit</span>
              <span className="font-semibold text-emerald-700 text-[11px]">
                {selectedOccupant.target_exit_id || 'Evaluating'}
              </span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-100">
              <span className="text-slate-400 block text-[10px]">Hazard Exposure</span>
              <span className={`font-mono font-semibold ${selectedOccupant.hazard_exposure > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {selectedOccupant.hazard_exposure.toFixed(2)}
              </span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-100 col-span-2">
              <span className="text-slate-400 block text-[10px]">Distance Traveled / Coordinates</span>
              <span className="font-mono text-slate-700 text-[11px]">
                {selectedOccupant.distance_traveled.toFixed(1)}m traveled · ({selectedOccupant.x.toFixed(1)}m, {selectedOccupant.y.toFixed(1)}m)
              </span>
            </div>

            {/* Phase 3 Adaptive Routing Telemetry */}
            <div className="bg-emerald-50/50 p-2 rounded border border-emerald-200 col-span-2 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-emerald-800 font-medium">Adaptive Reroutes:</span>
                <span className="font-mono font-bold text-emerald-900 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                  {selectedOccupant.reroute_count || 0} times
                </span>
              </div>
              {selectedOccupant.current_route_cost !== undefined && selectedOccupant.current_route_cost > 0 && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-600">Objective Cost J(P):</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedOccupant.current_route_cost.toFixed(2)}s delay
                  </span>
                </div>
              )}
              {selectedOccupant.last_replan_time_sec !== undefined && selectedOccupant.last_replan_time_sec > 0 && (
                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>Last Evaluated:</span>
                  <span className="font-mono">t = {selectedOccupant.last_replan_time_sec.toFixed(1)}s</span>
                </div>
              )}
              {selectedOccupant.previous_path && selectedOccupant.previous_path.length > 0 && (
                <div className="mt-1 pt-1 border-t border-emerald-200 text-[10px] text-emerald-800 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                  <span>Previous route (dashed amber) vs current route (green) visible on map.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
          Click any occupant dot on the floor plan to inspect its individual speed, assigned exit, and planned route.
        </div>
      )}
    </div>
  );
};
