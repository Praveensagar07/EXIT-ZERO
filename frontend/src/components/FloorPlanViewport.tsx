import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import type {
  Floor,
  NavigationGraphModel,
  Occupant,
  HazardSource,
  Exit,
} from '../types/simulation';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Compass,
  Activity,
} from 'lucide-react';

interface FloorPlanViewportProps {
  floor: Floor | null;
  graph: NavigationGraphModel;
  occupants: Occupant[];
  hazards: HazardSource[];
  exits: Exit[];
  showRooms: boolean;
  showGraph: boolean;
  showExits: boolean;
  showOccupants: boolean;
  showHazards: boolean;
  showRoutes: boolean;
  showCongestionHeatmap: boolean;
  simTime?: number;
  selectedOccupantId?: string | null;
  onSelectOccupant?: (id: string | null) => void;
  onToggleExit?: (exitId: string) => void;
}

export const FloorPlanViewport: React.FC<FloorPlanViewportProps> = ({
  floor,
  graph,
  occupants,
  hazards,
  exits,
  showRooms,
  showGraph,
  showExits,
  showOccupants,
  showHazards,
  showRoutes,
  showCongestionHeatmap,
  simTime = 0,
  selectedOccupantId,
  onSelectOccupant,
  onToggleExit,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [scale, setScale] = useState<number>(14); // pixels per meter
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tooltip on hover
  const [hoveredEntity, setHoveredEntity] = useState<{
    type: 'room' | 'exit' | 'node' | 'edge' | 'occupant';
    label: string;
    details: string;
    x: number;
    y: number;
  } | null>(null);

  // Auto-fit to container
  const handleFitToView = useCallback(() => {
    if (!containerRef.current || !floor) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const fWidth = floor.width || 80.0;
    const fHeight = floor.height || 45.0;
    const scaleX = (clientWidth - 80) / Math.max(10, fWidth);
    const scaleY = (clientHeight - 80) / Math.max(10, fHeight);
    const optimalScale = Math.max(6, Math.min(scaleX, scaleY, 24));
    setScale(optimalScale);

    const centerX = (clientWidth - fWidth * optimalScale) / 2;
    const centerY = (clientHeight - fHeight * optimalScale) / 2;
    setPan({ x: Math.max(20, centerX), y: Math.max(20, centerY) });
  }, [floor]);

  useEffect(() => {
    if (floor) {
      handleFitToView();
    }
  }, [floor, handleFitToView]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.min(Math.max(scale * zoomFactor, 5), 45);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
      const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  // Drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Selected occupant route points
  const selectedRoutePoints = useMemo(() => {
    if (!selectedOccupantId) return [];
    const occ = occupants.find((o) => o.id === selectedOccupantId);
    if (!occ || !occ.current_path || occ.current_path.length === 0) return [];

    const pts: { x: number; y: number }[] = [];
    pts.push({ x: occ.x, y: occ.y });
    for (let i = occ.path_index; i < occ.current_path.length; i++) {
      const nid = occ.current_path[i];
      const node = graph.nodes[nid];
      if (node) {
        pts.push({ x: node.x, y: node.y });
      }
    }
    return pts;
  }, [selectedOccupantId, occupants, graph]);

  // Selected occupant previous route points (for adaptive reroute comparison)
  const selectedPreviousRoutePoints = useMemo(() => {
    if (!selectedOccupantId) return [];
    const occ = occupants.find((o) => o.id === selectedOccupantId);
    if (!occ || !occ.previous_path || occ.previous_path.length === 0) return [];

    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < occ.previous_path.length; i++) {
      const nid = occ.previous_path[i];
      const node = graph.nodes[nid];
      if (node) {
        pts.push({ x: node.x, y: node.y });
      }
    }
    return pts;
  }, [selectedOccupantId, occupants, graph]);

  // Helper function to colorize density
  const getDensityColor = (density: number) => {
    if (density < 0.6) return 'rgba(16, 185, 129, 0.4)'; // Emerald (free flow)
    if (density < 1.8) return 'rgba(234, 179, 8, 0.65)';  // Amber yellow (dense)
    if (density < 3.2) return 'rgba(249, 115, 22, 0.8)';  // Orange (crowded)
    return 'rgba(239, 68, 68, 0.95)';                     // Crimson (crush bottleneck)
  };

  if (!floor) {
    return (
      <div className="relative w-full h-full bg-[#FAFAF8] flex items-center justify-center text-xs text-[#647078]">
        No floor selected
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-950 overflow-hidden select-none border border-slate-800 rounded-lg shadow-inner cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top HUD Overlays & Controls */}
      <div className="absolute top-16 left-4 z-10 flex items-center space-x-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-md border border-[#E5E7EB] text-xs text-[#242A30] shadow-sm">
        <Compass className="w-3.5 h-3.5 text-[#167D73]" />
        <span className="font-semibold text-[#242A30]">{floor.name}</span>
        <span className="text-[#647078]">|</span>
        <span className="text-[#647078]">
          {floor.width}m × {floor.height}m
        </span>
        {showCongestionHeatmap && (
          <>
            <span className="text-[#647078]">|</span>
            <span className="text-amber-600 font-semibold flex items-center space-x-1">
              <Activity className="w-3 h-3" />
              <span>DENSITY HEATMAP ACTIVE</span>
            </span>
          </>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-1 bg-white/95 backdrop-blur-md p-1 rounded-md border border-[#E5E7EB] shadow-sm">
        <button
          onClick={() => setScale((s) => Math.min(s * 1.2, 45))}
          title="Zoom In"
          className="p-1.5 hover:bg-slate-100 text-[#647078] hover:text-[#242A30] rounded transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(s * 0.8, 5))}
          title="Zoom Out"
          className="p-1.5 hover:bg-slate-100 text-[#647078] hover:text-[#242A30] rounded transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitToView}
          title="Fit to Screen"
          className="p-1.5 hover:bg-slate-100 text-[#647078] hover:text-[#242A30] rounded transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg className="w-full h-full pointer-events-auto">
        <defs>
          {/* Subtle grid pattern */}
          <pattern id="grid" width={scale * 5} height={scale * 5} patternUnits="userSpaceOnUse">
            <path
              d={`M ${scale * 5} 0 L 0 0 0 ${scale * 5}`}
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="1"
            />
          </pattern>

          {/* Diagonal hatch for obstacles */}
          <pattern
            id="obstacleHatch"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" strokeWidth="2" opacity="0.6" />
          </pattern>

          {/* Fire gradient glow */}
          <radialGradient id="fireGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#f97316" stopOpacity="0.5" />
            <stop offset="85%" stopColor="#eab308" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>

          {/* Directional arrowhead for route lines */}
          <marker
            id="routeArrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="3.5"
            markerHeight="3.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
          </marker>
        </defs>

        {/* Pan & Zoom Transform Group */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Base Floor Plate */}
          <rect
            x={0}
            y={0}
            width={floor.width}
            height={floor.height}
            fill="#0f172a"
            stroke="#334155"
            strokeWidth={0.4}
            rx={0.5}
          />

          {/* 5m Grid Fill */}
          <rect x={0} y={0} width={floor.width} height={floor.height} fill="url(#grid)" />

          {/* 1. ROOMS & HALLWAYS */}
          {showRooms &&
            floor.rooms.map((room) => {
              const isCorridor = room.room_type === 'corridor';
              const isAtrium = room.room_type === 'cafeteria';
              const fillColor = isCorridor ? '#1e293b' : isAtrium ? '#1e2837' : '#141d2f';
              const strokeColor = isAtrium ? '#38bdf8' : '#334155';

              return (
                <g key={room.id}>
                  <rect
                    x={room.bounds.x}
                    y={room.bounds.y}
                    width={room.bounds.width}
                    height={room.bounds.height}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={0.25}
                    className="transition-colors hover:fill-slate-800/80 cursor-pointer"
                    onMouseEnter={(e) =>
                      setHoveredEntity({
                        type: 'room',
                        label: room.name,
                        details: `Type: ${room.room_type.toUpperCase()} | Capacity: ${room.max_capacity} pers | Area: ${(room.bounds.width * room.bounds.height).toFixed(0)} m²`,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }
                    onMouseLeave={() => setHoveredEntity(null)}
                  />
                  <text
                    x={room.bounds.x + room.bounds.width / 2}
                    y={room.bounds.y + room.bounds.height / 2}
                    fill="#94a3b8"
                    fontSize={Math.max(1.1, Math.min(2.0, room.bounds.width / 10))}
                    fontWeight="500"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="pointer-events-none select-none font-sans"
                  >
                    {room.name}
                  </text>
                </g>
              );
            })}

          {/* 2. DOORWAYS */}
          {showRooms &&
            floor.doorways.map((door) => (
              <g key={door.id}>
                <circle
                  cx={door.x}
                  cy={door.y}
                  r={door.width / 2}
                  fill="#0f172a"
                  stroke="#64748b"
                  strokeWidth={0.15}
                  strokeDasharray="0.3 0.2"
                />
              </g>
            ))}

          {/* 3. STRUCTURAL OBSTACLES */}
          {floor.obstacles.map((obs) => (
            <rect
              key={obs.id}
              x={obs.x}
              y={obs.y}
              width={obs.width}
              height={obs.height}
              fill="url(#obstacleHatch)"
              stroke="#dc2626"
              strokeWidth={0.2}
            />
          ))}

          {/* 4. CONGESTION HEATMAP OVERLAY (Edges colored by actual crowd density) */}
          {showCongestionHeatmap && (
            <g className="congestion-heatmap-layer">
              {graph.edges.map((edge, idx) => {
                const uNode = graph.nodes[edge.u];
                const vNode = graph.nodes[edge.v];
                if (!uNode || !vNode) return null;

                const density = edge.current_density || 0;
                const hazardLevel = edge.hazard_level || 0;
                const isImpassable = hazardLevel >= 0.85;
                const strokeColor = isImpassable
                  ? '#dc2626'
                  : hazardLevel >= 0.4
                    ? '#f97316'
                    : getDensityColor(density);
                const strokeW = Math.max(0.6, edge.width * 0.7);

                return (
                  <g key={`density_${edge.u}_${edge.v}_${idx}`}>
                    {(density >= 3.0 || isImpassable) && (
                      <line
                        x1={uNode.x}
                        y1={uNode.y}
                        x2={vNode.x}
                        y2={vNode.y}
                        stroke="#ef4444"
                        strokeWidth={strokeW + 0.6}
                        strokeLinecap="round"
                        opacity={0.6}
                        className="animate-pulse"
                      />
                    )}
                    <line
                      x1={uNode.x}
                      y1={uNode.y}
                      x2={vNode.x}
                      y2={vNode.y}
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      className="transition-colors duration-300 cursor-pointer"
                      onMouseEnter={(e) =>
                        setHoveredEntity({
                          type: 'edge',
                          label: `Corridor Segment (${uNode.label || edge.u} ↔ ${vNode.label || edge.v})`,
                          details: `Occupants: ${edge.current_occupants} | Local Density: ${density.toFixed(2)} pers/m² | Flow Capacity: ${edge.capacity_per_sec.toFixed(1)} pers/s`,
                          x: e.clientX,
                          y: e.clientY,
                        })
                      }
                      onMouseLeave={() => setHoveredEntity(null)}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* 5. NAVIGATION GRAPH (EDGES & NODES) */}
          {showGraph && !showCongestionHeatmap && (
            <g className="graph-layer">
              {graph.edges.map((edge, idx) => {
                const uNode = graph.nodes[edge.u];
                const vNode = graph.nodes[edge.v];
                if (!uNode || !vNode) return null;

                const isAccessible = edge.wheelchair_accessible;
                return (
                  <line
                    key={`edge_${edge.u}_${edge.v}_${idx}`}
                    x1={uNode.x}
                    y1={uNode.y}
                    x2={vNode.x}
                    y2={vNode.y}
                    stroke={isAccessible ? 'rgba(56, 189, 248, 0.45)' : 'rgba(234, 179, 8, 0.5)'}
                    strokeWidth={0.2}
                    strokeDasharray={isAccessible ? undefined : '0.4 0.3'}
                  />
                );
              })}

              {Object.values(graph.nodes).map((node) => {
                let nodeColor = '#38bdf8';
                let nodeR = 0.35;

                if (node.node_type === 'exit') {
                  nodeColor = '#10b981';
                  nodeR = 0.6;
                } else if (node.node_type === 'room_center') {
                  nodeColor = '#60a5fa';
                  nodeR = 0.45;
                } else if (node.node_type === 'doorway') {
                  nodeColor = '#f59e0b';
                  nodeR = 0.35;
                }

                return (
                  <circle
                    key={node.id}
                    cx={node.x}
                    cy={node.y}
                    r={nodeR}
                    fill={nodeColor}
                    stroke="#020617"
                    strokeWidth={0.1}
                    className="cursor-pointer hover:r-1 hover:fill-white transition-all"
                    onMouseEnter={(e) =>
                      setHoveredEntity({
                        type: 'node',
                        label: node.label || node.id,
                        details: `Type: ${node.node_type.toUpperCase()} | (${node.x.toFixed(1)}m, ${node.y.toFixed(1)}m) | Accessible: ${node.is_accessible ? 'YES' : 'NO'}${node.queue_length ? ` | Queue: ${node.queue_length}` : ''}`,
                        x: e.clientX,
                        y: e.clientY,
                      })
                    }
                    onMouseLeave={() => setHoveredEntity(null)}
                  />
                );
              })}
            </g>
          )}

          {/* 6. ACTIVE & PREVIOUS ROUTES (ADAPTIVE ROUTE COMPARISON) */}
          {showRoutes && (
            <g className="routes-comparison-layer">
              {/* Previous Route (Ghost Dotted Amber) */}
              {selectedPreviousRoutePoints.length > 1 && (
                <polyline
                  points={selectedPreviousRoutePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={0.35}
                  strokeDasharray="0.6 0.3"
                  opacity={0.8}
                />
              )}

              {/* Current Active Route (Solid / Pulse Emerald Green with Directional Arrow) */}
              {selectedRoutePoints.length > 1 && (
                <polyline
                  points={selectedRoutePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={0.55}
                  strokeDasharray="0.8 0.4"
                  markerEnd="url(#routeArrow)"
                  className="animate-pulse"
                />
              )}
            </g>
          )}

          {/* 7. HAZARDS (Layered Dynamic Smoke Plumes & Danger Ribbon) */}
          {showHazards &&
            hazards.map((h) => {
              const isActive = simTime >= h.start_time_sec;
              if (!isActive) {
                const countdown = Math.max(0, h.start_time_sec - simTime);
                return (
                  <g key={h.id} className="pointer-events-none">
                    <circle
                      cx={h.x}
                      cy={h.y}
                      r={2.0}
                      fill="rgba(245, 158, 11, 0.12)"
                      stroke="#f59e0b"
                      strokeWidth={0.18}
                      strokeDasharray="0.5 0.4"
                    />
                    <circle cx={h.x} cy={h.y} r={0.6} fill="#f59e0b" stroke="#ffffff" strokeWidth={0.18} />
                    <text
                      x={h.x}
                      y={h.y - 2.4}
                      fill="#fcd34d"
                      fontSize={0.95}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ⚠ {h.hazard_type.toUpperCase()} ZONE (T-{countdown.toFixed(0)}s)
                    </text>
                  </g>
                );
              }

              const timeActive = simTime - h.start_time_sec;
              const radius = Math.max(1.2, Math.min(h.max_radius, timeActive * h.growth_rate));
              return (
                <g key={h.id} className="pointer-events-none">
                  {/* Outer smoke dissipation zone */}
                  <circle cx={h.x} cy={h.y} r={radius * 1.25} fill="rgba(100, 116, 139, 0.22)" className="animate-pulse" />
                  {/* Core fire glow */}
                  <circle cx={h.x} cy={h.y} r={radius} fill="url(#fireGlow)" />
                  {/* Danger perimeter warning ribbon */}
                  <circle cx={h.x} cy={h.y} r={radius} fill="none" stroke="#f59e0b" strokeWidth={0.2} strokeDasharray="0.8 0.4" />
                  {/* Fire ignition epicenter */}
                  <circle cx={h.x} cy={h.y} r={0.9} fill="#ef4444" stroke="#ffffff" strokeWidth={0.25} />
                  <text
                    x={h.x}
                    y={h.y - radius - 0.4}
                    fill="#fca5a5"
                    fontSize={1.1}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    🔥 {h.hazard_type.toUpperCase()} (r={radius.toFixed(1)}m)
                  </text>
                </g>
              );
            })}

          {/* 8. OCCUPANTS (Smooth CSS Coordinate Transitions & Visual Mobility Types) */}
          {showOccupants &&
            occupants.map((occ) => {
              if (occ.evacuation_state === 'exited') return null;

              const isSelected = occ.id === selectedOccupantId;
              const isWaiting = occ.evacuation_state === 'waiting';
              const isTrapped = occ.evacuation_state === 'trapped';

              let occColor = '#3b82f6';
              if (occ.mobility_category === 'wheelchair') occColor = '#f59e0b';
              if (occ.mobility_category === 'reduced_speed') occColor = '#a855f7';
              if (isTrapped) occColor = '#ef4444';

              return (
                <g
                  key={occ.id}
                  data-testid={`occupant-${occ.id}`}
                  className="cursor-pointer transition-transform duration-300"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOccupant?.(isSelected ? null : occ.id);
                  }}
                  onMouseEnter={(e) =>
                    setHoveredEntity({
                      type: 'occupant',
                      label: `Occupant ${occ.id}`,
                      details: `Status: ${occ.evacuation_state.toUpperCase()} | Speed: ${occ.movement_speed.toFixed(2)} m/s (Free: ${occ.free_speed.toFixed(2)}) | Mobility: ${occ.mobility_category.toUpperCase()} | Wait: ${occ.waiting_time_sec ? occ.waiting_time_sec.toFixed(1) : 0}s | Target Exit: ${occ.target_exit_id || 'Evaluating'}`,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onMouseLeave={() => setHoveredEntity(null)}
                >
                  {/* Queue Waiting Halo Ring */}
                  {isWaiting && (
                    <circle
                      cx={occ.x}
                      cy={occ.y}
                      r={0.85}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={0.16}
                      strokeDasharray="0.3 0.2"
                      style={{ transition: 'cx 0.35s ease-out, cy 0.35s ease-out' }}
                    />
                  )}

                  {/* Selection Highlight Spotlight Ring */}
                  {isSelected && (
                    <circle
                      cx={occ.x}
                      cy={occ.y}
                      r={1.1}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth={0.22}
                      strokeDasharray="0.3 0.2"
                      style={{ transition: 'cx 0.35s ease-out, cy 0.35s ease-out' }}
                    />
                  )}

                  {/* Occupant Main Dot with Smooth Physical Transitions */}
                  <circle
                    cx={occ.x}
                    cy={occ.y}
                    r={isSelected ? 0.65 : 0.46}
                    fill={occColor}
                    stroke="#ffffff"
                    strokeWidth={0.12}
                    style={{ transition: 'cx 0.35s ease-out, cy 0.35s ease-out' }}
                  />

                  {/* Wheelchair Accessible Inner Indicator */}
                  {occ.mobility_category === 'wheelchair' && (
                    <circle
                      cx={occ.x}
                      cy={occ.y}
                      r={0.2}
                      fill="#ffffff"
                      style={{ transition: 'cx 0.35s ease-out, cy 0.35s ease-out' }}
                    />
                  )}
                </g>
              );
            })}

          {/* 8.5 SELECTED OCCUPANT IN-VIEWPORT FLOATING HUD CARD */}
          {selectedOccupantId && (() => {
            const selOcc = occupants.find((o) => o.id === selectedOccupantId);
            if (!selOcc || selOcc.evacuation_state === 'exited') return null;
            return (
              <g transform={`translate(${selOcc.x}, ${selOcc.y - 2.8})`} className="pointer-events-none select-none">
                <rect
                  x={-6.5}
                  y={-2.4}
                  width={13.0}
                  height={2.4}
                  rx={0.5}
                  fill="#020617"
                  stroke="#22c55e"
                  strokeWidth={0.2}
                  opacity={0.94}
                />
                <text x={0} y={-1.3} fill="#4ade80" fontSize={0.62} fontWeight="bold" textAnchor="middle">
                  {selOcc.id} · {selOcc.mobility_category.toUpperCase()} ({selOcc.movement_speed.toFixed(2)} m/s)
                </text>
                <text x={0} y={-0.35} fill="#e2e8f0" fontSize={0.5} textAnchor="middle">
                  Exit: {selOcc.target_exit_id || 'Evaluating'} · Dist: {selOcc.distance_traveled.toFixed(1)}m · Wait: {(selOcc.waiting_time_sec ?? 0).toFixed(1)}s
                </text>
                <polygon points="0,0.1 -0.5,-0.4 0.5,-0.4" fill="#22c55e" />
              </g>
            );
          })()}

          {/* 9. EMERGENCY EXITS & EXIT QUEUE BADGES (INTERACTIVE TOGGLE) */}
          {showExits &&
            exits.map((exit) => {
              const isBlocked = exit.is_blocked;
              const queueLen = exit.current_queue || 0;

              return (
                <g
                  key={exit.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Toggle ${exit.name} (${isBlocked ? 'blocked' : 'open'})`}
                  data-testid={`exit-portal-${exit.id}`}
                  className="cursor-pointer group focus:outline focus:outline-2 focus:outline-emerald-400"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleExit) onToggleExit(exit.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onToggleExit) onToggleExit(exit.id);
                    }
                  }}
                  onMouseEnter={(e) =>
                    setHoveredEntity({
                      type: 'exit',
                      label: `${exit.name} ${isBlocked ? '[BLOCKED]' : '[OPEN]'}`,
                      details: `Status: ${isBlocked ? 'BLOCKED ❌' : 'CLEAR ✅'} (Click portal to toggle) | Queue: ${queueLen} queued | Total Exited: ${exit.total_exited || 0} | Flow: ${exit.throughput_per_sec.toFixed(1)} pers/s | Wheelchair: ${exit.is_wheelchair_accessible ? 'YES ♿' : 'NO'}`,
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onMouseLeave={() => setHoveredEntity(null)}
                >
                  {/* Exit Portal Box */}
                  <rect
                    x={exit.x - 1.6}
                    y={exit.y - 0.75}
                    width={3.2}
                    height={1.5}
                    rx={0.3}
                    fill={isBlocked ? '#991b1b' : '#059669'}
                    stroke={isBlocked ? '#ef4444' : '#10b981'}
                    strokeWidth={0.25}
                    className="shadow-lg transition-all hover:stroke-white"
                  />
                  {/* Barrier Cross Hazard Warning for Blocked Portals */}
                  {isBlocked && (
                    <g className="pointer-events-none">
                      <line x1={exit.x - 1.4} y1={exit.y - 0.6} x2={exit.x + 1.4} y2={exit.y + 0.6} stroke="#fca5a5" strokeWidth={0.25} strokeLinecap="round" />
                      <line x1={exit.x - 1.4} y1={exit.y + 0.6} x2={exit.x + 1.4} y2={exit.y - 0.6} stroke="#fca5a5" strokeWidth={0.25} strokeLinecap="round" />
                    </g>
                  )}
                  <text
                    x={exit.x}
                    y={exit.y + 0.25}
                    fill="#ffffff"
                    fontSize={0.75}
                    fontWeight="bold"
                    textAnchor="middle"
                    className="font-mono select-none pointer-events-none"
                  >
                    {isBlocked ? 'BLOCKED' : `EXIT ${exit.is_wheelchair_accessible ? '♿' : ''}`}
                  </text>

                  {/* Interactive toggle prompt text */}
                  <text
                    x={exit.x}
                    y={exit.y + 1.25}
                    fill={isBlocked ? '#f87171' : '#6ee7b7'}
                    fontSize={0.52}
                    fontWeight="600"
                    textAnchor="middle"
                    className="font-mono select-none pointer-events-none"
                  >
                    ⚡ {isBlocked ? 'Click to UNBLOCK' : 'Click to BLOCK'}
                  </text>

                  {/* Exit Queue Badge */}
                  {queueLen > 0 && (
                    <g transform={`translate(${exit.x}, ${exit.y - 1.5})`}>
                      <rect
                        x={-1.8}
                        y={-0.6}
                        width={3.6}
                        height={1.2}
                        rx={0.3}
                        fill="#b45309"
                        stroke="#f59e0b"
                        strokeWidth={0.15}
                      />
                      <text
                        x={0}
                        y={0.25}
                        fill="#ffffff"
                        fontSize={0.65}
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-mono"
                      >
                        QUEUE: {queueLen}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
        </g>
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredEntity && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-md shadow-2xl text-xs text-white max-w-xs"
          style={{ left: hoveredEntity.x, top: hoveredEntity.y - 12 }}
        >
          <div className="font-bold text-emerald-400 flex items-center space-x-1">
            <span>{hoveredEntity.label}</span>
          </div>
          <div className="text-slate-300 mt-0.5 leading-relaxed">{hoveredEntity.details}</div>
        </div>
      )}

      {/* Bottom Right Scale & Legend */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-wrap items-center gap-2.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-md border border-slate-800 text-[11px] text-slate-300 shadow-md">
        {showCongestionHeatmap ? (
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Density:</span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>&lt;0.6</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span>0.6–1.8</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
              <span>1.8–3.2</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
              <span>&ge;3.2 pers/m²</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              <span>Standard</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span>Wheelchair ♿</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
              <span>Reduced</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-1 ring-amber-300 inline-block"></span>
              <span>Queued</span>
            </div>
          </div>
        )}

        <div className="border-l border-slate-700 h-3"></div>

        {/* 10m scale */}
        <div className="flex flex-col items-center">
          <div
            className="h-1 bg-emerald-400 border border-emerald-300"
            style={{ width: `${scale * 10}px` }}
          ></div>
          <span className="text-[9px] text-slate-400 font-mono mt-0.5">10 meters</span>
        </div>
      </div>
    </div>
  );
};
