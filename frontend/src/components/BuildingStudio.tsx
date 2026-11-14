import React, { useState, useEffect, useCallback } from 'react';
import type {
  Building,
  BuildingSummary,
  BuildingValidationReport,
  Floor,
} from '../types/simulation';
import { api } from '../services/api';
import { BuildingViewport3D, type ViewMode3D } from './BuildingViewport3D';
import { FloorPlanViewport } from './FloorPlanViewport';
import {
  Plus,
  Save,
  Download,
  Upload,
  Eye,
  MoreVertical,
  Square,
  Minus,
  DoorOpen,
  LogOut,
  TrendingUp,
  Accessibility,
  Box,
  Layers,
  MousePointer,
  Move,
  Maximize,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Edit2,
  Building2,
} from 'lucide-react';

interface BuildingStudioProps {
  onRunSimulation?: (buildingId: string) => void;
}

export const BuildingStudio: React.FC<BuildingStudioProps> = ({ onRunSimulation }) => {
  const [buildings, setBuildings] = useState<BuildingSummary[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('bldg_multifloor_demo');
  const [currentBuilding, setCurrentBuilding] = useState<Building | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<string>('floor_2');
  const [viewType, setViewType] = useState<'3d' | '2d'>('3d');
  const [viewMode3D, setViewMode3D] = useState<ViewMode3D>('exploded');

  // Selected Element in Studio Inspector
  const [selectedElement, setSelectedElement] = useState<{
    type: 'room' | 'corridor' | 'exit' | 'stair' | 'occupant';
    id: string;
    floorId: string;
    data: any;
  } | null>({
    type: 'room',
    id: 'R-204',
    floorId: 'floor_2',
    data: {
      id: 'R-204',
      floor_id: 'floor_2',
      name: 'Patient Room 204',
      room_type: 'office',
      bounds: { x: 41.0, y: 5.0, width: 8.0, height: 6.0 },
      max_capacity: 6,
      height: 3.2,
      is_accessible: true,
    },
  });

  const [activePropertyTab, setActivePropertyTab] = useState<'element' | 'connectivity'>('element');
  const [activeStudioTool, setActiveStudioTool] = useState<'select' | 'move' | 'resize' | 'rotate' | 'delete'>('select');

  // Validation report
  const [validationReport, setValidationReport] = useState<BuildingValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const validateBuildingData = useCallback(async (b: Building) => {
    setIsValidating(true);
    try {
      const rep = await api.validateBuilding(b);
      setValidationReport(rep);
    } catch (err) {
      console.error('Building validation failed:', err);
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Load building list
  useEffect(() => {
    async function loadBuildings() {
      try {
        const list = await api.getBuildings();
        setBuildings(list);
        if (list.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load buildings:', err);
      }
    }
    loadBuildings();
  }, [selectedBuildingId]);

  // Load selected building
  useEffect(() => {
    if (!selectedBuildingId) return;
    async function fetchBuilding() {
      try {
        const b = await api.getBuilding(selectedBuildingId);
        setCurrentBuilding(b);
        if (b.floors && b.floors.length > 0) {
          // Default to F2 or first floor
          const f2 = b.floors.find((f) => f.level === 2) || b.floors[0];
          setActiveFloorId(f2.id);

          // Find sample room
          if (f2.rooms && f2.rooms.length > 0) {
            const r204 = f2.rooms.find((r) => r.id === 'R-204') || f2.rooms[0];
            setSelectedElement({
              type: 'room',
              id: r204.id,
              floorId: f2.id,
              data: r204,
            });
          }
        }
        // Validate building
        validateBuildingData(b);
      } catch (err) {
        console.error('Failed to fetch building details:', err);
      }
    }
    fetchBuilding();
  }, [selectedBuildingId, validateBuildingData]);

  // Save current building
  const handleSaveBuilding = async () => {
    if (!currentBuilding) return;
    try {
      await api.updateBuilding(currentBuilding.id, currentBuilding);
      setSaveStatus('Saved successfully');
      validateBuildingData(currentBuilding);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to save building:', err);
      setSaveStatus('Save failed');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Export Building JSON
  const handleExportJSON = () => {
    if (!currentBuilding) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentBuilding, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentBuilding.id}_studio.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Building JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.floors && parsed.id) {
          await api.createBuilding(parsed);
          const list = await api.getBuildings();
          setBuildings(list);
          setSelectedBuildingId(parsed.id);
          setCurrentBuilding(parsed);
        }
      } catch {
        alert('Invalid building JSON format');
      }
    };
    reader.readAsText(file);
  };

  // Create New Building
  const handleNewBuilding = () => {
    const newId = `bldg_custom_${Date.now()}`;
    const newBldg: Building = {
      id: newId,
      name: 'New Custom Digital Twin',
      description: 'Architectural model designed in EXIT-ZERO Studio',
      author: 'EXIT-ZERO Architect',
      version: '1.0',
      floors: [
        {
          id: 'floor_custom_1',
          name: 'F1 - Ground Floor',
          level: 1,
          elevation: 0.0,
          floor_height: 3.2,
          width: 80.0,
          height: 45.0,
          rooms: [
            {
              id: 'R-101',
              floor_id: 'floor_custom_1',
              name: 'Main Hall',
              room_type: 'lobby',
              bounds: { x: 10.0, y: 10.0, width: 20.0, height: 15.0 },
              max_capacity: 40,
              height: 3.2,
              is_accessible: true,
            },
          ],
          doorways: [],
          obstacles: [],
          exits: [
            {
              id: 'exit_1',
              floor_id: 'floor_custom_1',
              name: 'Main Entrance',
              x: 20.0,
              y: 2.0,
              width: 3.0,
              throughput_per_sec: 3.0,
              is_wheelchair_accessible: true,
              is_blocked: false,
            },
          ],
          stairwells: [],
        },
      ],
    };
    setCurrentBuilding(newBldg);
    setSelectedBuildingId(newId);
    setActiveFloorId('floor_custom_1');
    validateBuildingData(newBldg);
  };

  // Stats calculation
  const floorsCount = currentBuilding?.floors.length || 0;
  const roomsCount = currentBuilding?.floors.reduce((acc, f) => acc + (f.rooms?.length || 0), 0) || 0;
  const corridorsCount = floorsCount * 4;
  const exitsCount = currentBuilding?.floors.reduce((acc, f) => acc + (f.exits?.length || 0), 0) || 0;
  const stairsCount = currentBuilding?.floors.reduce((acc, f) => acc + (f.stairwells?.filter((s) => !s.is_ramp).length || 0), 0) || 0;
  const rampsCount = currentBuilding?.floors.reduce((acc, f) => acc + (f.stairwells?.filter((s) => s.is_ramp).length || 0), 0) || 0;
  const capacityTotal = currentBuilding?.floors.reduce(
    (acc, f) => acc + f.rooms.reduce((rAcc, r) => rAcc + (r.max_capacity || 0), 0),
    0
  ) || 0;

  const activeFloor = currentBuilding?.floors.find((f) => f.id === activeFloorId);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-56px)] bg-[#FAFAF8] text-[#242A30] overflow-hidden">
      {/* Studio Sub-Header & Actions Bar */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-[#E5E7EB] shrink-0">
        <div>
          <h2 className="text-base font-semibold text-[#242A30] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#167D73]" />
            Building Studio
          </h2>
          <p className="text-xs text-[#647078]">Create, edit, and configure buildings for evacuation simulation</p>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs text-[#167D73] font-medium bg-[#E6F4F2] px-2.5 py-1 rounded">
              {saveStatus}
            </span>
          )}
          <button
            onClick={handleNewBuilding}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#242A30] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Building
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#242A30] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-sm cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Import
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#242A30] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={handleSaveBuilding}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#167D73] hover:bg-[#126860] rounded shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          {onRunSimulation && selectedBuildingId && (
            <button
              onClick={() => onRunSimulation(selectedBuildingId)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#167D73] bg-[#E6F4F2] hover:bg-[#d0ece8] border border-[#167D73]/30 rounded shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-[#167D73]" />
              Run Simulation
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Workspace: Left Sidebar + Center Viewport + Right Inspector */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Secondary Left Sidebar */}
        <aside className="w-64 bg-white border-r border-[#E5E7EB] flex flex-col overflow-y-auto shrink-0 select-none">
          {/* Project Selector */}
          <div className="p-4 border-b border-[#E5E7EB]">
            <label className="block text-[11px] font-semibold text-[#647078] uppercase tracking-wider mb-1.5">
              Project
            </label>
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="w-full text-xs font-medium bg-[#F9FAFB] border border-[#E5E7EB] rounded-md px-2.5 py-2 text-[#242A30] focus:ring-1 focus:ring-[#167D73] focus:border-[#167D73]"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Floors List */}
          <div className="p-4 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#647078] uppercase tracking-wider">
                Floors ({currentBuilding?.floors.length || 0})
              </span>
              <button
                onClick={() => {
                  if (!currentBuilding) return;
                  const newLevel = currentBuilding.floors.length + 1;
                  const newFloor: Floor = {
                    id: `floor_${newLevel}`,
                    name: `F${newLevel} - Level ${newLevel}`,
                    level: newLevel,
                    elevation: (newLevel - 1) * 3.2,
                    floor_height: 3.2,
                    width: 80.0,
                    height: 45.0,
                    rooms: [],
                    doorways: [],
                    obstacles: [],
                    exits: [],
                    stairwells: [],
                  };
                  setCurrentBuilding({
                    ...currentBuilding,
                    floors: [...currentBuilding.floors, newFloor],
                  });
                  setActiveFloorId(newFloor.id);
                }}
                className="p-1 text-[#647078] hover:text-[#167D73] rounded hover:bg-[#F3F4F6]"
                title="Add Floor"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {[...(currentBuilding?.floors || [])].reverse().map((floor) => {
                const isSelected = activeFloorId === floor.id;
                return (
                  <div
                    key={floor.id}
                    onClick={() => setActiveFloorId(floor.id)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#E6F4F2] text-[#167D73] font-semibold'
                        : 'text-[#242A30] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-[#647078]" />
                      <span>{floor.name}</span>
                    </div>
                    <MoreVertical className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Elements Grid */}
          <div className="p-4 border-b border-[#E5E7EB]">
            <span className="block text-[11px] font-semibold text-[#647078] uppercase tracking-wider mb-2.5">
              Add Elements
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: 'Room', icon: Square },
                { name: 'Corridor', icon: Minus },
                { name: 'Wall', icon: Box },
                { name: 'Door', icon: DoorOpen },
                { name: 'Exit', icon: LogOut },
                { name: 'Stairs', icon: TrendingUp },
                { name: 'Ramp', icon: Accessibility, label: 'Ramp (Accessible)' },
                { name: 'Elevator', icon: Layers },
                { name: 'Zone', icon: Square, label: 'Occupancy Zone' },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    className="flex flex-col items-center justify-center p-2 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-white hover:border-[#167D73] text-[#242A30] transition-colors"
                  >
                    <Icon className="w-4 h-4 text-[#647078] mb-1" />
                    <span className="text-[10px] text-center leading-tight">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Editing Tools */}
          <div className="p-4">
            <span className="block text-[11px] font-semibold text-[#647078] uppercase tracking-wider mb-2">
              Editing Tools
            </span>
            <div className="space-y-1">
              {[
                { id: 'select', label: 'Select', icon: MousePointer },
                { id: 'move', label: 'Move', icon: Move },
                { id: 'resize', label: 'Resize', icon: Maximize },
                { id: 'rotate', label: 'Rotate', icon: RotateCw },
                { id: 'delete', label: 'Delete', icon: Trash2 },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeStudioTool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveStudioTool(t.id as any)}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      isActive
                        ? 'bg-[#E6F4F2] text-[#167D73] font-medium'
                        : 'text-[#647078] hover:bg-[#F9FAFB] hover:text-[#242A30]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center 3D / 2D Viewport Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAF8] relative">
          {/* Top 3D View vs 2D Floor Plan Toggle */}
          <div className="absolute top-4 left-4 z-30 flex items-center bg-white/95 backdrop-blur-sm rounded-lg border border-[#E5E7EB] p-1 shadow-sm">
            <button
              onClick={() => setViewType('3d')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewType === '3d'
                  ? 'bg-[#167D73] text-white shadow-sm'
                  : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
              }`}
            >
              3D View
            </button>
            <button
              onClick={() => setViewType('2d')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewType === '2d'
                  ? 'bg-[#167D73] text-white shadow-sm'
                  : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
              }`}
            >
              2D Floor Plan
            </button>
          </div>

          {/* Viewport Content */}
          <div className="w-full h-full">
            {viewType === '3d' ? (
              <BuildingViewport3D
                building={currentBuilding}
                activeFloorId={activeFloorId}
                onSelectFloor={setActiveFloorId}
                viewMode={viewMode3D}
                onChangeViewMode={setViewMode3D}
                selectedElementId={selectedElement?.id}
                onSelectElement={setSelectedElement}
                isStudioMode={true}
              />
            ) : (
              <FloorPlanViewport
                floor={activeFloor || null}
                graph={{ nodes: {}, edges: [] }}
                occupants={[]}
                exits={activeFloor?.exits || []}
                hazards={[]}
                showRooms={true}
                showGraph={true}
                showExits={true}
                showOccupants={false}
                showHazards={false}
                showRoutes={false}
                showCongestionHeatmap={false}
              />
            )}
          </div>
        </main>

        {/* Right Properties Inspector */}
        <aside className="w-80 bg-white border-l border-[#E5E7EB] flex flex-col overflow-y-auto shrink-0 select-none">
          <div className="p-4 border-b border-[#E5E7EB]">
            <h3 className="text-sm font-semibold text-[#242A30] mb-3">Properties</h3>
            {/* Tabs: Element vs Connectivity */}
            <div className="flex border-b border-[#E5E7EB]">
              <button
                onClick={() => setActivePropertyTab('element')}
                className={`flex-1 py-1.5 text-xs font-medium border-b-2 text-center transition-colors ${
                  activePropertyTab === 'element'
                    ? 'border-[#167D73] text-[#167D73]'
                    : 'border-transparent text-[#647078] hover:text-[#242A30]'
                }`}
              >
                Element
              </button>
              <button
                onClick={() => setActivePropertyTab('connectivity')}
                className={`flex-1 py-1.5 text-xs font-medium border-b-2 text-center transition-colors ${
                  activePropertyTab === 'connectivity'
                    ? 'border-[#167D73] text-[#167D73]'
                    : 'border-transparent text-[#647078] hover:text-[#242A30]'
                }`}
              >
                Connectivity
              </button>
            </div>
          </div>

          {selectedElement?.data ? (
            <div className="p-4 space-y-4 text-xs">
              {/* Element Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <Square className="w-4 h-4 text-[#167D73]" />
                  <div>
                    <h4 className="font-semibold text-[#242A30]">{selectedElement.data.name || selectedElement.id}</h4>
                    <span className="text-[10px] text-[#647078]">ID: {selectedElement.id}</span>
                  </div>
                </div>
                <Edit2 className="w-3.5 h-3.5 text-[#647078] cursor-pointer" />
              </div>

              {activePropertyTab === 'element' ? (
                <>
                  {/* Floor */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#647078] mb-1">Floor</label>
                    <select
                      value={selectedElement.floorId}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2.5 py-1.5 text-xs text-[#242A30]"
                      disabled
                    >
                      {currentBuilding?.floors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Room Type */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#647078] mb-1">Type</label>
                    <select
                      value={selectedElement.data.room_type || 'office'}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2.5 py-1.5 text-xs text-[#242A30]"
                    >
                      <option value="office">Patient Room</option>
                      <option value="lab">Treatment Room / Lab</option>
                      <option value="lobby">Lobby & Reception</option>
                      <option value="conference">Conference Suite</option>
                      <option value="cafeteria">Cafeteria / Lounge</option>
                      <option value="storage">Storage & Utilities</option>
                    </select>
                  </div>

                  {/* Dimensions */}
                  <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                    <span className="block font-medium text-[11px] text-[#647078] uppercase">Dimensions</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#647078] block">Length</span>
                        <span className="font-semibold text-[#242A30]">
                          {(selectedElement.data.bounds?.width || 8.0).toFixed(2)} m
                        </span>
                      </div>
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#647078] block">Width</span>
                        <span className="font-semibold text-[#242A30]">
                          {(selectedElement.data.bounds?.height || 6.0).toFixed(2)} m
                        </span>
                      </div>
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#647078] block">Height</span>
                        <span className="font-semibold text-[#242A30]">3.20 m</span>
                      </div>
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#647078] block">Area</span>
                        <span className="font-semibold text-[#242A30]">
                          {((selectedElement.data.bounds?.width || 8.0) * (selectedElement.data.bounds?.height || 6.0)).toFixed(1)} m²
                        </span>
                      </div>
                    </div>
                    <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB] flex items-center justify-between">
                      <span className="text-[10px] text-[#647078]">Capacity</span>
                      <span className="font-semibold text-[#242A30]">
                        {selectedElement.data.max_capacity || 6} occupants
                      </span>
                    </div>
                  </div>

                  {/* Accessibility */}
                  <div className="pt-2 border-t border-[#E5E7EB]">
                    <span className="block font-medium text-[11px] text-[#647078] uppercase mb-2">Accessibility</span>
                    <label className="flex items-center gap-2 cursor-pointer bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                      <input
                        type="checkbox"
                        checked={selectedElement.data.is_accessible ?? true}
                        readOnly
                        className="rounded text-[#167D73] focus:ring-[#167D73]"
                      />
                      <span className="font-medium text-[#242A30]">Accessible (Wheelchair)</span>
                    </label>
                  </div>
                </>
              ) : (
                /* Connectivity Tab */
                <div className="space-y-3">
                  <span className="block font-medium text-[11px] text-[#647078] uppercase">Connected Doors</span>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2 rounded border border-[#E5E7EB] bg-[#F9FAFB]">
                      <span className="text-xs">D-201 (Corridor C-203)</span>
                      <Trash2 className="w-3.5 h-3.5 text-[#9CA3AF] hover:text-[#EF4444] cursor-pointer" />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded border border-[#E5E7EB] bg-[#F9FAFB]">
                      <span className="text-xs">D-202 (Corridor C-204)</span>
                      <Trash2 className="w-3.5 h-3.5 text-[#9CA3AF] hover:text-[#EF4444] cursor-pointer" />
                    </div>
                  </div>

                  <button className="w-full mt-2 py-1.5 text-xs font-medium text-[#167D73] bg-[#E6F4F2] hover:bg-[#d0ece8] rounded transition-colors">
                    + Add Connection
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-[#647078] text-xs">
              Click on any room, wall, door, or exit in the 3D viewport to inspect its properties.
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Status Bar (Full Width across bottom matching screenshot) */}
      <footer className="h-9 px-4 bg-white border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#647078] shrink-0 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-medium text-[#242A30]">
            <Building2 className="w-4 h-4 text-[#167D73]" />
            <span>{currentBuilding?.name || 'EXIT-ZERO Multi-Floor Demo'}</span>
          </div>
          <div className="w-[1px] h-3.5 bg-[#E5E7EB]" />
          <span>Floors: <strong className="text-[#242A30]">{floorsCount}</strong></span>
          <div className="w-[1px] h-3.5 bg-[#E5E7EB]" />
          <span>Rooms: <strong className="text-[#242A30]">{roomsCount}</strong></span>
          <div className="w-[1px] h-3.5 bg-[#E5E7EB]" />
          <span>Corridors: <strong className="text-[#242A30]">{corridorsCount}</strong></span>
          <div className="w-[1px] h-3.5 bg-[#E5E7EB]" />
          <span>Exits: <strong className="text-[#242A30]">{exitsCount}</strong></span>
          <div className="w-[1px] h-3.5 bg-[#E5E7EB]" />
          <span>Stairs: <strong className="text-[#242A30]">{stairsCount}</strong></span>
          <div className="w-[1px] h-3.5 bg-[#E5E7EB]" />
          <span>Ramps: <strong className="text-[#242A30]">{rampsCount}</strong></span>
          <div className="w-[1px] h-3.5 bg-[#E5E7EB]" />
          <span>Capacity: <strong className="text-[#242A30]">{capacityTotal}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          {isValidating ? (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#B45309]">
              <AlertTriangle className="w-3.5 h-3.5 animate-spin" />
              Validating Geometry...
            </span>
          ) : validationReport?.is_valid ? (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Building Valid
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEE2E2] text-[#B91C1C]">
              <AlertTriangle className="w-3.5 h-3.5" />
              Validation Issues
            </span>
          )}
        </div>
      </footer>
    </div>
  );
};
