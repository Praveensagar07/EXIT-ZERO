import React, { useState, useEffect } from 'react';
import {
  Compass,
  ShieldAlert,
  Download,
  Users,
  Building2,
  Clock,
  ArrowRight,
  Accessibility,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import type { BuildingEvacuationGuidance } from '../types/simulation';

interface EvacuationGuidancePanelProps {
  scenarioId?: string;
  sessionId?: string;
  algorithm?: string;
  onSelectOccupant?: (occupantId: string) => void;
}

export const EvacuationGuidancePanel: React.FC<EvacuationGuidancePanelProps> = ({
  scenarioId = 'scenario_multifloor_demo',
  sessionId,
  algorithm = 'adaptive',
  onSelectOccupant,
}) => {
  const [guidance, setGuidance] = useState<BuildingEvacuationGuidance | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeFloorFilter, setActiveFloorFilter] = useState<string>('all');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const fetchGuidance = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGuidance({
        scenario_id: scenarioId,
        session_id: sessionId,
        algorithm,
      });
      setGuidance(data);
    } catch (err) {
      console.error('Failed to load guidance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidance();
    const interval = setInterval(fetchGuidance, 5000);
    return () => clearInterval(interval);
  }, [scenarioId, sessionId, algorithm]);

  const toggleCheck = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleDownloadReport = () => {
    if (!sessionId) return;
    window.open(api.getGuidanceReportUrl(sessionId), '_blank');
  };

  if (isLoading && !guidance) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[calc(100vh-56px)] bg-[#FAFAF8] text-[#647078]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#167D73] mb-2" />
        <span className="text-xs font-medium">Synthesizing evacuation guidance...</span>
      </div>
    );
  }

  const filteredRooms =
    !guidance || activeFloorFilter === 'all'
      ? guidance?.rooms || []
      : (guidance.rooms || []).filter((r) => r.floorId === activeFloorFilter);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-56px)] bg-[#FAFAF8] text-[#242A30] overflow-y-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-[#E5E7EB] shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[#242A30] flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#167D73]" />
            Multi-Tier Evacuation Guidance & Emergency Directives
          </h2>
          <p className="text-xs text-[#647078]">
            Real-time egress coordination for Building, Floor, Room, and Individual Occupants
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchGuidance}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#242A30] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#647078]" />
            Refresh
          </button>
          {sessionId && (
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#167D73] hover:bg-[#126860] rounded shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export Guidance Brief
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* 2. Building-Level Readiness Status Card */}
        {guidance && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Rating */}
            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#647078] uppercase block mb-1">
                  Readiness Rating
                </span>
                <span
                  className={`text-sm font-bold uppercase px-2.5 py-1 rounded inline-block ${
                    guidance.egressReadinessRating === 'optimal'
                      ? 'bg-[#E6F4F2] text-[#167D73]'
                      : guidance.egressReadinessRating === 'good'
                      ? 'bg-[#ECFDF5] text-[#059669]'
                      : guidance.egressReadinessRating === 'constrained'
                      ? 'bg-[#FEF3C7] text-[#D97706]'
                      : 'bg-[#FEE2E2] text-[#DC2626]'
                  }`}
                >
                  {guidance.egressReadinessRating}
                </span>
              </div>
              <Building2 className="w-8 h-8 text-[#167D73]/30" />
            </div>

            {/* Clearance Time */}
            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#647078] uppercase block mb-1">
                  Est. Building Clearance
                </span>
                <span className="text-xl font-bold text-[#242A30]">
                  {guidance.estimatedClearanceTimeSec} s
                </span>
              </div>
              <Clock className="w-8 h-8 text-[#167D73]/30" />
            </div>

            {/* Total Occupants / Progress */}
            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#647078] uppercase block mb-1">
                  Evacuation Progress
                </span>
                <span className="text-xl font-bold text-[#242A30]">
                  {guidance.evacuatedOccupants} / {guidance.totalOccupants}
                  <span className="text-xs text-[#647078] font-normal ml-1">
                    ({guidance.overallProgressPercent}%)
                  </span>
                </span>
              </div>
              <Users className="w-8 h-8 text-[#167D73]/30" />
            </div>

            {/* Bottleneck Risk Index */}
            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#647078] uppercase block mb-1">
                  Bottleneck Risk Index
                </span>
                <span className="text-xl font-bold text-[#242A30]">
                  {(guidance.bottleneckRiskIndex * 100).toFixed(0)}%
                </span>
              </div>
              <ShieldAlert className="w-8 h-8 text-[#167D73]/30" />
            </div>
          </div>
        )}

        {/* 3. Operational Emergency Checklist */}
        {guidance && guidance.emergencyActionChecklist && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-[#242A30] flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#167D73]" />
              Safety Coordinator Action Checklist
            </h3>
            <div className="space-y-2 text-xs">
              {guidance.emergencyActionChecklist.map((item, idx) => (
                <label
                  key={idx}
                  onClick={() => toggleCheck(idx)}
                  className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                    checkedItems[idx] ? 'bg-[#F9FAFB] line-through text-[#9CA3AF]' : 'bg-[#FAFAF8] text-[#242A30]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checkedItems[idx])}
                    onChange={() => {}}
                    className="mt-0.5 rounded text-[#167D73] focus:ring-[#167D73]"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 4. Floor Egress Directives & Room Assignments */}
        {guidance && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF8]">
              <div>
                <h3 className="text-sm font-semibold text-[#242A30]">
                  Room Egress Assignments & Route Clearance
                </h3>
                <p className="text-xs text-[#647078]">
                  Designated primary exit, backup route, and estimated transit durations per room
                </p>
              </div>

              {/* Floor Filters */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E5E7EB]">
                <button
                  onClick={() => setActiveFloorFilter('all')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    activeFloorFilter === 'all'
                      ? 'bg-[#167D73] text-white shadow-xs'
                      : 'text-[#647078] hover:text-[#242A30]'
                  }`}
                >
                  All Floors
                </button>
                {guidance.floors.map((f) => (
                  <button
                    key={f.floorId}
                    onClick={() => setActiveFloorFilter(f.floorId)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      activeFloorFilter === f.floorId
                        ? 'bg-[#167D73] text-white shadow-xs'
                        : 'text-[#647078] hover:text-[#242A30]'
                    }`}
                  >
                    {f.floorName}
                  </button>
                ))}
              </div>
            </div>

            {/* Room Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] text-[#647078] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Room Name</th>
                    <th className="py-2.5 px-4 font-semibold">Floor</th>
                    <th className="py-2.5 px-4 font-semibold">Primary Exit</th>
                    <th className="py-2.5 px-4 font-semibold">Alternative Backup</th>
                    <th className="py-2.5 px-4 font-semibold">Distance</th>
                    <th className="py-2.5 px-4 font-semibold">Est. Egress Time</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredRooms.map((room) => (
                    <tr key={room.roomId} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#242A30]">
                        <div className="flex items-center gap-1.5">
                          {room.isWheelchairAccessible && (
                            <span title="Wheelchair Accessible">
                              <Accessibility className="w-3.5 h-3.5 text-[#0284c7]" />
                            </span>
                          )}
                          <span>{room.roomName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#647078]">{room.floorName}</td>
                      <td className="py-3 px-4 text-[#167D73] font-medium">{room.primaryExitName}</td>
                      <td className="py-3 px-4 text-[#647078]">{room.alternativeExitName}</td>
                      <td className="py-3 px-4 text-[#242A30] font-mono">{room.routeDistanceMeters.toFixed(1)} m</td>
                      <td className="py-3 px-4 text-[#242A30] font-mono">{room.estimatedEgressTimeSec.toFixed(1)} s</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            room.status === 'clear'
                              ? 'bg-[#E6F4F2] text-[#167D73]'
                              : room.status === 'congested'
                              ? 'bg-[#FEF3C7] text-[#D97706]'
                              : 'bg-[#FEE2E2] text-[#DC2626]'
                          }`}
                        >
                          {room.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Real-Time Turn-by-Turn Occupant Navigation Guidance Feed */}
        {guidance && guidance.occupantsGuidance && guidance.occupantsGuidance.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-[#242A30] flex items-center gap-2 mb-3">
              <Compass className="w-4 h-4 text-[#167D73]" />
              Real-Time Occupant Navigation & Dynamic Reroutes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {guidance.occupantsGuidance.slice(0, 8).map((occ) => (
                <div
                  key={occ.occupantId}
                  onClick={() => onSelectOccupant && onSelectOccupant(occ.occupantId)}
                  className="p-3.5 rounded-lg border border-[#E5E7EB] bg-[#FAFAF8] hover:border-[#167D73] cursor-pointer transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#242A30]">{occ.occupantId}</span>
                      <span className="text-[10px] bg-[#E2E8F0] text-[#475569] px-2 py-0.5 rounded uppercase font-medium">
                        {occ.mobilityCategory}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[#167D73] font-semibold">
                      {occ.distanceRemainingMeters}m rem • ~{occ.estimatedArrivalSec}s
                    </span>
                  </div>

                  <div className="text-[11px] text-[#647078] flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-[#167D73]" />
                    <span>Heading to <strong>{occ.targetExitName}</strong></span>
                  </div>

                  {occ.turnByTurnInstructions && occ.turnByTurnInstructions.length > 0 && (
                    <div className="bg-white p-2 rounded border border-[#E5E7EB] text-[11px] space-y-1">
                      {occ.turnByTurnInstructions.slice(0, 3).map((instr, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[#242A30]">
                          <span className="text-[#167D73] font-mono">{i + 1}.</span>
                          <span>{instr}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {occ.rerouteExplanation && (
                    <div className="bg-[#FEF3C7]/60 border border-[#F59E0B]/30 p-2 rounded text-[11px] text-[#B45309]">
                      {occ.rerouteExplanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
