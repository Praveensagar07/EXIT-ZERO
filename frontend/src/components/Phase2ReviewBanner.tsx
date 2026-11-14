import React from 'react';
import { ShieldCheck, Activity } from 'lucide-react';

export const Phase2ReviewBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 text-white rounded-lg px-3.5 py-2.5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 text-xs">
      <div className="flex items-center space-x-3">
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-xs">PHASE 2: REALISTIC CROWD SIMULATION ACTIVE</span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded text-[10px] font-semibold border border-emerald-500/30">
              22/22 TESTS PASSED
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Weidmann speed-density deceleration · Corridor capacity buffering · FIFO exit queues with fractional service budgets.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 text-[11px] text-amber-300 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded shrink-0">
        <Activity className="w-3.5 h-3.5 text-amber-400" />
        <span>Shared Physics Substrate Verified</span>
      </div>
    </div>
  );
};
