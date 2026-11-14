import React from 'react';
import type { Exit, HazardSource, TopologyAuditReport } from '../types/simulation';
import {
  Network,
  CheckCircle2,
  AlertTriangle,
  DoorOpen,
  Flame,
  Accessibility,
} from 'lucide-react';

interface TopologyAuditorPanelProps {
  audit: TopologyAuditReport | null;
  exits: Exit[];
  hazards: HazardSource[];
}

export const TopologyAuditorPanel: React.FC<TopologyAuditorPanelProps> = ({
  audit,
  exits,
  hazards,
}) => {
  return (
    <div className="flex flex-col space-y-4 text-slate-800">
      {/* 1. Topology & Connectivity Overview */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Network className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-slate-900">Building Navigation Graph</h3>
          </div>
          {audit?.is_valid ? (
            <span className="flex items-center space-x-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Valid Topology</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Issues Detected</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Total Graph Nodes</span>
            <span className="text-base font-bold text-slate-800 font-mono">
              {audit ? audit.total_nodes : '--'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Total Graph Edges</span>
            <span className="text-base font-bold text-slate-800 font-mono">
              {audit ? audit.total_edges : '--'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Graph Connected</span>
            <span
              className={`text-sm font-semibold ${
                audit?.is_connected ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {audit ? (audit.is_connected ? 'Yes (Single Component)' : `${audit.connected_components_count} Subgraphs`) : '--'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Avg Edge Spacing</span>
            <span className="text-sm font-bold text-slate-800 font-mono">
              {audit ? `${audit.average_edge_length_meters}m` : '--'}
            </span>
          </div>
        </div>

        {/* Wheelchair Accessibility Audit */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center space-x-1 text-slate-600 font-medium">
              <Accessibility className="w-3.5 h-3.5 text-blue-600" />
              <span>ADA / Wheelchair Egress Coverage</span>
            </div>
            <span className="font-bold text-slate-800 font-mono">
              {audit ? `${audit.wheelchair_accessible_coverage_percent}%` : '--'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${audit ? audit.wheelchair_accessible_coverage_percent : 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 2. Emergency Exit Directory */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <DoorOpen className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-slate-900">Emergency Exits ({exits.length})</h3>
          </div>
          <span className="text-[11px] text-slate-500">Flow Throughput</span>
        </div>

        <div className="space-y-2">
          {exits.map((exit) => (
            <div
              key={exit.id}
              className={`p-2.5 rounded border text-xs flex items-center justify-between ${
                exit.is_blocked
                  ? 'bg-red-50/70 border-red-200'
                  : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="font-semibold text-slate-800 flex items-center space-x-1">
                  <span>{exit.name}</span>
                  {exit.is_wheelchair_accessible && (
                    <span className="text-blue-600 font-normal" title="Wheelchair Accessible">
                      ♿
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Width: {exit.width}m · {exit.throughput_per_sec} pers/s max flow
                </div>
              </div>
              <div>
                {exit.is_blocked ? (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 uppercase">
                    BLOCKED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-700 uppercase">
                    CLEAR
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Hazard Sources */}
      {hazards.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center space-x-2 pb-2 mb-2 border-b border-slate-100">
            <Flame className="w-4 h-4 text-red-600" />
            <h3 className="font-semibold text-sm text-slate-900">Hazard Origins ({hazards.length})</h3>
          </div>
          <div className="space-y-2 text-xs">
            {hazards.map((h) => (
              <div key={h.id} className="p-2.5 rounded border border-red-100 bg-red-50/50">
                <div className="flex justify-between items-center font-medium text-red-900">
                  <span className="capitalize">{h.hazard_type} Source</span>
                  <span className="font-mono text-[11px]">Starts: {h.start_time_sec}s</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-1">
                  Location: ({h.x.toFixed(1)}m, {h.y.toFixed(1)}m) · Growth: {h.growth_rate}m/s · Max: {h.max_radius}m
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
