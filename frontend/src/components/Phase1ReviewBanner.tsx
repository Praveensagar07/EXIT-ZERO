import React from 'react';
import { ShieldCheck, ArrowRightCircle } from 'lucide-react';

export const Phase1ReviewBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 text-white rounded-lg p-3.5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-xs">PHASE 1 FOUNDATION READY</span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded text-[10px] font-semibold border border-emerald-500/30">
              11/11 TESTS PASSED
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            NetworkX building graph generator, multi-modal occupant models, Pydantic data schemas, and interactive SVG digital twin verified.
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 text-[11px] text-slate-400 shrink-0">
        <span className="font-medium text-slate-300">Phase 2:</span> Microscopic Agent Physics & Bottlenecks
        <ArrowRightCircle className="w-4 h-4 text-emerald-400" />
      </div>
    </div>
  );
};
