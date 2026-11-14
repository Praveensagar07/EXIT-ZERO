import React from 'react';
import type { RerouteEvent } from '../types/simulation';
import { GitFork, AlertTriangle, Activity, ArrowRight, ShieldAlert } from 'lucide-react';

interface RerouteEventFeedProps {
  events: RerouteEvent[];
  selectedOccupantId: string | null;
  onSelectOccupant: (id: string | null) => void;
  algorithm: 'baseline' | 'adaptive';
}

export const RerouteEventFeed: React.FC<RerouteEventFeedProps> = ({
  events,
  selectedOccupantId,
  onSelectOccupant,
  algorithm,
}) => {
  const reversedEvents = [...events].reverse();

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case 'EMERGENCY_OVERRIDE':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 border border-red-200">
            <ShieldAlert className="w-3 h-3 text-red-600" />
            <span>EMERGENCY OVERRIDE</span>
          </span>
        );
      case 'CONGESTION_ADVANTAGE':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Activity className="w-3 h-3 text-amber-600" />
            <span>QUEUE AVOIDANCE</span>
          </span>
        );
      case 'HAZARD_SPREAD':
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-800 border border-orange-200">
            <AlertTriangle className="w-3 h-3 text-orange-600" />
            <span>HAZARD EVASION</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
            <span>{reason}</span>
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col space-y-3 text-slate-800">
      {/* Header Summary */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <GitFork className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-xs text-slate-900">Adaptive Reroute Feed</h3>
          </div>
          <span className="bg-emerald-50 text-emerald-700 font-mono font-bold text-xs px-2 py-0.5 rounded border border-emerald-200">
            {events.length} Events
          </span>
        </div>

        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          EXIT-ZERO evaluates predictive cost <span className="font-mono text-slate-700 font-semibold">J(P)</span> every 4.0s. 
          Rerouting requires <span className="font-semibold text-emerald-700">≥20% improvement</span> to suppress route chatter, 
          or an immediate override upon exit failure.
        </p>
      </div>

      {/* Baseline Advisory Note */}
      {algorithm === 'baseline' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px]">
            <span className="font-semibold block text-amber-900">Baseline Strategy Active</span>
            Conventional shortest-path does not evaluate predictive congestion or dynamic reroutes. Switch to EXIT-ZERO to enable adaptive rerouting.
          </div>
        </div>
      )}

      {/* Events Stream */}
      {reversedEvents.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-700">No Reroute Events Logged Yet</p>
          <p className="text-[11px] text-slate-400">
            {algorithm === 'adaptive'
              ? 'Agents are progressing along optimal initial paths. Events will trigger if bottlenecks emerge or exits are blocked.'
              : 'Switch strategy to EXIT-ZERO in the top navigation bar to observe real-time reroutes.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {reversedEvents.map((ev, idx) => {
            const isSelected = selectedOccupantId === ev.occupant_id;
            return (
              <div
                key={`ev_${idx}_${ev.occupant_id}_${ev.time_sec}`}
                onClick={() => onSelectOccupant(isSelected ? null : ev.occupant_id)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-400 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                    <span className="font-bold text-slate-900">{ev.occupant_id}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">t = {ev.time_sec.toFixed(1)}s</span>
                  </div>
                  {getReasonBadge(ev.reason)}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                  <div className="flex items-center space-x-1 text-slate-600 font-mono">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      {ev.previous_exit_id || 'Init'}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">
                      {ev.new_exit_id}
                    </span>
                  </div>

                  {ev.cost_improvement_percent > 0 && (
                    <span className="text-emerald-700 font-semibold font-mono text-[10px]">
                      +{ev.cost_improvement_percent.toFixed(1)}% gain
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
