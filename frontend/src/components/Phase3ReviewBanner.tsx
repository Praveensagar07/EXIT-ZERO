import React from 'react';
import { ShieldCheck, GitFork, AlertTriangle } from 'lucide-react';

interface Phase3ReviewBannerProps {
  algorithm: 'baseline' | 'adaptive';
  rerouteCount?: number;
}

export const Phase3ReviewBanner: React.FC<Phase3ReviewBannerProps> = ({ algorithm, rerouteCount = 0 }) => {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 text-xs">
      <div className="flex items-center space-x-3">
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-xs">
              PHASE 5: EVIDENCE-READY DIGITAL TWIN
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded text-[10px] font-semibold border border-emerald-500/30">
              RESEARCH PROTOTYPE
            </span>
            <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded text-[10px] font-mono border border-blue-500/30">
              REPRODUCIBLE SEEDS
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Shared physical substrate · 20% reroute hysteresis · 20s inflow lookahead · Interactive exit toggle · Validate claims in the Evidence Lab.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0">
        <div className={`flex items-center space-x-1.5 text-[11px] font-mono px-2.5 py-1 rounded border ${
          algorithm === 'adaptive'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          {algorithm === 'adaptive' ? (
            <>
              <GitFork className="w-3.5 h-3.5 text-emerald-400" />
              <span>EXIT-ZERO ADAPTIVE ({rerouteCount} reroutes)</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>BASELINE (Static Shortest-Path)</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
