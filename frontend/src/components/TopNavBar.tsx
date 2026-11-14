import React from 'react';
import {
  Play,
  Building2,
  BarChart3,
  Layers,
  Settings,
  User,
  WifiOff,
  Sparkles,
  Compass,
} from 'lucide-react';

export type PrimaryView =
  | 'simulation'
  | 'studio'
  | 'evidence'
  | 'guidance'
  | 'scenarios'
  | 'settings';

interface TopNavBarProps {
  activeView: PrimaryView;
  onChangeView: (view: PrimaryView) => void;
  isOnline: boolean;
  onOpenDemonstration?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeView,
  onChangeView,
  isOnline,
  onOpenDemonstration,
}) => {
  return (
    <header className="z-30 flex h-14 w-full items-center justify-between border-b border-[#E5E7EB] bg-white px-4 text-[#242A30] shadow-xs select-none">
      {/* 1. Left: Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#167D73] text-white font-bold font-mono text-xs shadow-xs">
            E0
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold tracking-tight text-[#242A30] text-base">
              EXIT-ZERO<sup className="text-[10px] font-normal text-[#647078]">®</sup>
            </span>
            <span className="text-[#E5E7EB] font-light">|</span>
            <span className="text-xs text-[#647078] hidden sm:inline font-normal">
              Emergency Evacuation Digital Twin
            </span>
          </div>
        </div>

        {/* Online Status indicator */}
        <div className="hidden lg:flex items-center gap-1.5 ml-2 pl-3 border-l border-[#E5E7EB]">
          {isOnline ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-[#167D73]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#167D73] animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-[#EF4444]">
              <WifiOff className="w-3 h-3" />
              Offline
            </span>
          )}
        </div>
      </div>

      {/* 2. Center: Primary Navigation Tabs */}
      <nav aria-label="Primary views" className="flex items-center gap-1">
        <button
          onClick={() => onChangeView('simulation')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeView === 'simulation'
              ? 'bg-[#E6F4F2] text-[#167D73] font-semibold'
              : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Simulation</span>
        </button>

        <button
          onClick={() => onChangeView('studio')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeView === 'studio'
              ? 'bg-[#E6F4F2] text-[#167D73] font-semibold'
              : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Building Studio</span>
        </button>

        <button
          onClick={() => onChangeView('guidance')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeView === 'guidance'
              ? 'bg-[#E6F4F2] text-[#167D73] font-semibold'
              : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Guidance</span>
        </button>

        <button
          onClick={() => onChangeView('evidence')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeView === 'evidence'
              ? 'bg-[#E6F4F2] text-[#167D73] font-semibold'
              : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Evidence Lab</span>
        </button>

        <button
          onClick={() => onChangeView('scenarios')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeView === 'scenarios'
              ? 'bg-[#E6F4F2] text-[#167D73] font-semibold'
              : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Scenarios</span>
        </button>

        <button
          onClick={() => onChangeView('settings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeView === 'settings'
              ? 'bg-[#E6F4F2] text-[#167D73] font-semibold'
              : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F9FAFB]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </nav>

      {/* 3. Right: Rehearsal Demo Launcher & Profile */}
      <div className="flex items-center gap-2.5">
        {onOpenDemonstration && (
          <button
            onClick={onOpenDemonstration}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#167D73] bg-[#E6F4F2] hover:bg-[#d0ece8] border border-[#167D73]/30 rounded-md shadow-xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Judge Demo</span>
          </button>
        )}

        <button
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] text-[#647078] hover:text-[#242A30] hover:border-[#D1D5DB] transition-colors"
          aria-label="User account"
        >
          <User className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
