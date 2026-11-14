import React from 'react';
import type { SimulationMetrics } from '../types/simulation';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

interface MetricsPanelProps {
  metrics: SimulationMetrics | null;
  simTime: number;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics, simTime }) => {
  if (!metrics) {
    return (
      <div className="p-4 text-center text-xs text-slate-400">
        Initializing telemetry streams...
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 text-slate-800">
      {/* 1. Primary Progress Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-slate-900">Evacuation Progress</h3>
          </div>
          <span className="font-mono font-bold text-sm text-emerald-600">
            {metrics.completion_percentage.toFixed(1)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 my-2.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${metrics.completion_percentage}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 p-2 rounded border border-slate-100">
            <span className="text-[10px] text-slate-500 block">Evacuated</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {metrics.total_evacuated} / {metrics.total_occupants}
            </span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-slate-100">
            <span className="text-[10px] text-slate-500 block">Elapsed Clock</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {simTime.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* 2. Instantaneous / Dynamic Physical Measurements */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center space-x-1.5 pb-2 border-b border-slate-100 mb-2.5">
          <Activity className="w-4 h-4 text-amber-600" />
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
            Current Physical State
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          {/* Mean Density */}
          <div className="bg-amber-50/50 p-2.5 rounded border border-amber-100">
            <span className="text-[10px] text-slate-500 block">Corridor Mean Density</span>
            <span className="font-mono font-bold text-amber-900 text-sm">
              {metrics.mean_crowd_density?.toFixed(2) ?? '0.00'}{' '}
              <span className="text-[10px] text-slate-400 font-normal">pers/m²</span>
            </span>
          </div>

          {/* Current Queues */}
          <div className="bg-amber-50/50 p-2.5 rounded border border-amber-100">
            <span className="text-[10px] text-slate-500 block">Occupants In Queues</span>
            <span className="font-mono font-bold text-amber-900 text-sm">
              {metrics.current_exit_queue_length ?? 0}{' '}
              <span className="text-[10px] text-slate-400 font-normal">waiting</span>
            </span>
          </div>

          {/* Mean Walking Speed */}
          <div className="bg-blue-50/50 p-2.5 rounded border border-blue-100">
            <span className="text-[10px] text-slate-500 block">Mean Walking Speed</span>
            <span className="font-mono font-bold text-blue-900 text-sm">
              {metrics.mean_occupant_speed?.toFixed(2) ?? '0.00'}{' '}
              <span className="text-[10px] text-slate-400 font-normal">m/s</span>
            </span>
          </div>

          {/* Current Throughput */}
          <div className="bg-emerald-50/50 p-2.5 rounded border border-emerald-100">
            <span className="text-[10px] text-slate-500 block">Exit Throughput Rate</span>
            <span className="font-mono font-bold text-emerald-900 text-sm">
              {metrics.current_exit_throughput?.toFixed(2) ?? '0.00'}{' '}
              <span className="text-[10px] text-slate-400 font-normal">pers/s</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Cumulative / Peak Statistics */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center space-x-1.5 pb-2 border-b border-slate-100 mb-2.5">
          <TrendingUp className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
            Cumulative Benchmarks
          </h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-50">
            <span className="text-slate-500">Peak Local Density:</span>
            <span className="font-mono font-bold text-red-600">
              {metrics.max_crowd_density.toFixed(2)} pers/m²
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-50">
            <span className="text-slate-500">Peak Exit Queue Length:</span>
            <span className="font-mono font-bold text-amber-700">
              {metrics.max_exit_queue_length} occupants
            </span>
          </div>
          {metrics.total_reroutes !== undefined && (
            <div className="flex justify-between items-center py-1 border-b border-slate-50">
              <span className="text-slate-500">Adaptive Reroutes Logged:</span>
              <span className="font-mono font-bold text-emerald-700">
                {metrics.total_reroutes} events
              </span>
            </div>
          )}
          <div className="flex justify-between items-center py-1 border-b border-slate-50">
            <span className="text-slate-500">Mean Queue Waiting Time:</span>
            <span className="font-mono font-semibold text-slate-800">
              {metrics.mean_waiting_time_sec?.toFixed(1) ?? '0.0'}s
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-50">
            <span className="text-slate-500">Cumulative Hazard Dosage:</span>
            <span className="font-mono font-semibold text-red-600">
              {(metrics.cumulative_hazard_exposure ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-50">
            <span className="text-slate-500">Median Evacuation Time:</span>
            <span className="font-mono font-semibold text-slate-800">
              {metrics.median_evacuation_time_sec ? `${metrics.median_evacuation_time_sec}s` : 'In Progress'}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500">95th Percentile Time (P95):</span>
            <span className="font-mono font-semibold text-slate-800">
              {metrics.p95_evacuation_time_sec ? `${metrics.p95_evacuation_time_sec}s` : 'In Progress'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Safety Warnings / Trapped Occupants */}
      {(metrics.trapped_occupants > 0 || (metrics.wheelchair_unreachable_count ?? 0) > 0) && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-red-800 text-xs">
          <div className="flex items-center space-x-1.5 font-bold mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>Egress Inaccessibility Alerts</span>
          </div>
          {metrics.trapped_occupants > 0 && (
            <p className="mt-0.5">
              • <span className="font-semibold">{metrics.trapped_occupants}</span> occupants are cut off from exits.
            </p>
          )}
          {(metrics.wheelchair_unreachable_count ?? 0) > 0 && (
            <p className="mt-0.5">
              • <span className="font-semibold">{metrics.wheelchair_unreachable_count}</span> wheelchair occupants cannot reach an accessible exit.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
