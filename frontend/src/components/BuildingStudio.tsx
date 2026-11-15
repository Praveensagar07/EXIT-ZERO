import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Building,
  BuildingSummary,
  BuildingValidationReport,
  Floor,
  Room,
  Doorway,
  Exit,
  Stairwell,
  Obstacle,
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
  Building2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  X,
} from 'lucide-react';

interface BuildingStudioProps {
  onRunSimulation?: (buildingId: string) => void;
  onOpenImportWizard?: () => void;
}

export const BuildingStudio: React.FC<BuildingStudioProps> = ({ onRunSimulation, onOpenImportWizard }) => {
  const [buildings, setBuildings] = useState<BuildingSummary[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('bldg_multifloor_demo');
  const [currentBuilding, setCurrentBuilding] = useState<Building | null>(null);
  const [activeFloorId, setActiveFloorId] = useState<string>('floor_2');
  const [viewType, setViewType] = useState<'3d' | '2d'>('3d');
  const [viewMode3D, setViewMode3D] = useState<ViewMode3D>('exploded');

  // Selected Element in Studio Inspector
  const [selectedElement, setSelectedElement] = useState<{
    type: 'room' | 'corridor' | 'door' | 'exit' | 'stair' | 'ramp' | 'wall' | 'obstacle' | 'occupant';
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

  // Validation report & notifications
  const [validationReport, setValidationReport] = useState<BuildingValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showValidationModal, setShowValidationModal] = useState<boolean>(false);

  // New Building Modal State
  const [isNewBuildingModalOpen, setIsNewBuildingModalOpen] = useState<boolean>(false);
  const [newBldgForm, setNewBldgForm] = useState({
    name: 'Campus Building C — Digital Twin',
    width: 80.0,
    height: 45.0,
    floorCount: 2,
    floorHeight: 3.2,
  });

  // Undo / Redo History Stack
  const historyRef = useRef<Building[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((b: Building) => {
    const clone = JSON.parse(JSON.stringify(b)) as Building;
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    nextHistory.push(clone);
    if (nextHistory.length > 20) nextHistory.shift();
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prev = historyRef.current[historyIndexRef.current];
      setCurrentBuilding(JSON.parse(JSON.stringify(prev)));
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
      validateBuildingData(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const next = historyRef.current[historyIndexRef.current];
      setCurrentBuilding(JSON.parse(JSON.stringify(next)));
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      validateBuildingData(next);
    }
  };

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
        historyRef.current = [JSON.parse(JSON.stringify(b))];
        historyIndexRef.current = 0;
        setCanUndo(false);
        setCanRedo(false);

        if (b.floors && b.floors.length > 0) {
          const f2 = b.floors.find((f) => f.level === 2) || b.floors[0];
          setActiveFloorId(f2.id);

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
        validateBuildingData(b);
      } catch (err) {
        console.error('Failed to fetch building details:', err);
      }
    }
    fetchBuilding();
  }, [selectedBuildingId, validateBuildingData]);

  // Update Building state helper
  const updateBuildingState = useCallback((updater: (prev: Building) => Building) => {
    setCurrentBuilding((prev) => {
      if (!prev) return prev;
      const updated = updater(JSON.parse(JSON.stringify(prev)));
      pushHistory(updated);
      validateBuildingData(updated);
      // Persist draft to local storage
      try {
        localStorage.setItem(`exit_zero_draft_${updated.id}`, JSON.stringify(updated));
      } catch (e) {
        // ignore storage errors
      }
      return updated;
    });
  }, [pushHistory, validateBuildingData]);

  // Save current building
  const handleSaveBuilding = async () => {
    if (!currentBuilding) return;
    try {
      await api.updateBuilding(currentBuilding.id, currentBuilding);
      setSaveStatus('Saved to Server');
      validateBuildingData(currentBuilding);
      const list = await api.getBuildings();
      setBuildings(list);
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.warn('Backend update failed, attempting create:', err);
      try {
        await api.createBuilding(currentBuilding);
        setSaveStatus('Created & Saved');
        const list = await api.getBuildings();
        setBuildings(list);
        setTimeout(() => setSaveStatus(null), 3500);
      } catch (createErr) {
        console.error('Save failed:', createErr);
        setSaveStatus('Saved Locally (Draft)');
        setTimeout(() => setSaveStatus(null), 3500);
      }
    }
  };

  // Export Building JSON
  const handleExportJSON = () => {
    if (!currentBuilding) return;
    const payload = {
      ...currentBuilding,
      schema_version: '2.0.0',
      exported_at: new Date().toISOString(),
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentBuilding.id}_exit_zero.json`);
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
        if (parsed.floors && (parsed.id || parsed.name)) {
          const validId = parsed.id || `bldg_imported_${Date.now()}`;
          const normalized: Building = {
            id: validId,
            name: parsed.name || 'Imported Building Digital Twin',
            description: parsed.description || 'Custom imported model',
            author: parsed.author || 'User Upload',
            version: parsed.version || '1.0',
            floors: parsed.floors || [],
          };
          try {
            await api.createBuilding(normalized);
          } catch (e) {
            console.warn('Server create failed, using local instance:', e);
          }
          const list = await api.getBuildings().catch(() => []);
          setBuildings(list);
          setSelectedBuildingId(normalized.id);
          setCurrentBuilding(normalized);
          if (normalized.floors.length > 0) {
            setActiveFloorId(normalized.floors[0].id);
          }
          pushHistory(normalized);
          validateBuildingData(normalized);
        } else {
          alert('Invalid EXIT-ZERO building schema: missing "floors" array.');
        }
      } catch {
        alert('Invalid JSON file. Please ensure it is a valid EXIT-ZERO building JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Create New Building Workflow
  const handleCreateNewBuildingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `bldg_custom_${Date.now()}`;
    const generatedFloors: Floor[] = [];

    for (let i = 1; i <= newBldgForm.floorCount; i++) {
      const floorId = `floor_${i}`;
      const elevation = (i - 1) * newBldgForm.floorHeight;

      // Initial rooms & corridor on floor
      const initialRooms: Room[] = [
        {
          id: `R-${i}01`,
          floor_id: floorId,
          name: `Room ${i}01 (Lobby / Office)`,
          room_type: i === 1 ? 'lobby' : 'office',
          bounds: { x: 8.0, y: 6.0, width: 16.0, height: 10.0 },
          max_capacity: 12,
          height: newBldgForm.floorHeight,
          is_accessible: true,
        },
        {
          id: `R-${i}02`,
          floor_id: floorId,
          name: `Room ${i}02 (Workstation)`,
          room_type: 'office',
          bounds: { x: 28.0, y: 6.0, width: 16.0, height: 10.0 },
          max_capacity: 10,
          height: newBldgForm.floorHeight,
          is_accessible: true,
        },
      ];

      const initialDoorways: Doorway[] = [
        {
          id: `D-${i}01`,
          floor_id: floorId,
          x: 16.0,
          y: 16.0,
          width: 1.2,
          connects_rooms: [`R-${i}01`],
          is_open: true,
          is_emergency_exit: false,
        },
        {
          id: `D-${i}02`,
          floor_id: floorId,
          x: 36.0,
          y: 16.0,
          width: 1.2,
          connects_rooms: [`R-${i}02`],
          is_open: true,
          is_emergency_exit: false,
        },
      ];

      // Ground floor gets exterior emergency exits
      const initialExits: Exit[] =
        i === 1
          ? [
              {
                id: 'exit_north_main',
                floor_id: floorId,
                name: 'Exit A: North Grand Portal',
                x: newBldgForm.width / 2.0,
                y: 2.0,
                width: 3.2,
                throughput_per_sec: 3.2,
                is_wheelchair_accessible: true,
                is_blocked: false,
              },
              {
                id: 'exit_south_service',
                floor_id: floorId,
                name: 'Exit B: South Service Exit',
                x: newBldgForm.width / 2.0,
                y: newBldgForm.height - 2.0,
                width: 2.4,
                throughput_per_sec: 2.5,
                is_wheelchair_accessible: true,
                is_blocked: false,
              },
            ]
          : [];

      // Inter-floor vertical stairs & ramps
      const initialStairwells: Stairwell[] = [];
      if (i > 1) {
        const lowerFloorId = `floor_${i - 1}`;
        initialStairwells.push({
          id: `stair_${lowerFloorId}_to_${floorId}`,
          from_floor: lowerFloorId,
          to_floor: floorId,
          x: 14.0,
          y: 22.0,
          target_x: 14.0,
          target_y: 26.0,
          width: 1.8,
          throughput_per_sec: 1.8,
          is_wheelchair_accessible: false,
          is_ramp: false,
        });
        initialStairwells.push({
          id: `ramp_${lowerFloorId}_to_${floorId}`,
          from_floor: lowerFloorId,
          to_floor: floorId,
          x: 48.0,
          y: 22.0,
          target_x: 56.0,
          target_y: 22.0,
          width: 2.4,
          throughput_per_sec: 2.4,
          is_wheelchair_accessible: true,
          is_ramp: true,
        });
      }

      generatedFloors.push({
        id: floorId,
        name: `F${i} - Level ${i}`,
        level: i,
        elevation: elevation,
        floor_height: newBldgForm.floorHeight,
        width: newBldgForm.width,
        height: newBldgForm.height,
        rooms: initialRooms,
        doorways: initialDoorways,
        obstacles: [],
        exits: initialExits,
        stairwells: initialStairwells,
      });
    }

    const newBuilding: Building = {
      id: newId,
      name: newBldgForm.name,
      description: `Architectural digital twin with ${newBldgForm.floorCount} floors (${newBldgForm.width}m × ${newBldgForm.height}m)`,
      author: 'EXIT-ZERO Architect',
      version: '1.0',
      floors: generatedFloors,
    };

    // Save to backend and set as current
    api.createBuilding(newBuilding).catch(console.warn);
    setCurrentBuilding(newBuilding);
    setSelectedBuildingId(newId);
    setActiveFloorId('floor_1');
    setIsNewBuildingModalOpen(false);
    pushHistory(newBuilding);
    validateBuildingData(newBuilding);

    // Refresh buildings list
    api.getBuildings().then(setBuildings).catch(console.warn);
  };

  // -------------------------------------------------------------
  // ADD ELEMENTS HANDLERS
  // -------------------------------------------------------------
  const handleAddElement = (type: 'Room' | 'Corridor' | 'Wall' | 'Door' | 'Exit' | 'Stairs' | 'Ramp' | 'Elevator' | 'Zone') => {
    if (!currentBuilding) return;
    const activeFloor = currentBuilding.floors.find((f) => f.id === activeFloorId) || currentBuilding.floors[0];
    if (!activeFloor) return;

    updateBuildingState((bldg) => {
      const fl = bldg.floors.find((f) => f.id === activeFloor.id);
      if (!fl) return bldg;

      if (type === 'Room') {
        const rCount = fl.rooms.length + 1;
        const col = (rCount - 1) % 4;
        const row = Math.floor((rCount - 1) / 4);
        const rx = 6.0 + col * 18.0;
        const ry = row === 0 ? 6.0 : 28.0;
        const rw = 14.0;
        const rh = 10.0;
        const newRoomId = `R-${fl.level}${String(rCount).padStart(2, '0')}`;
        const newDoorId = `D-${fl.level}${String(rCount).padStart(2, '0')}`;

        const newRoom: Room = {
          id: newRoomId,
          floor_id: fl.id,
          name: `Room ${fl.level}${String(rCount).padStart(2, '0')}`,
          room_type: 'office',
          bounds: { x: rx, y: ry, width: rw, height: rh },
          max_capacity: 8,
          height: fl.floor_height,
          is_accessible: true,
        };

        const newDoor: Doorway = {
          id: newDoorId,
          floor_id: fl.id,
          x: rx + rw / 2.0,
          y: row === 0 ? ry + rh : ry,
          width: 1.2,
          connects_rooms: [newRoomId],
          is_open: true,
          is_emergency_exit: false,
        };

        fl.rooms.push(newRoom);
        fl.doorways.push(newDoor);

        setSelectedElement({
          type: 'room',
          id: newRoom.id,
          floorId: fl.id,
          data: newRoom,
        });
      } else if (type === 'Corridor') {
        const cCount = fl.rooms.filter((r) => r.room_type === 'corridor').length + 1;
        const newCorridor: Room = {
          id: `C-${fl.level}${String(cCount).padStart(2, '0')}`,
          floor_id: fl.id,
          name: `Hallway Corridor ${fl.level}-${cCount}`,
          room_type: 'corridor',
          bounds: { x: 5.0, y: 19.0, width: Math.max(20.0, fl.width - 10.0), height: 5.0 },
          max_capacity: 40,
          height: fl.floor_height,
          is_accessible: true,
        };
        fl.rooms.push(newCorridor);
        setSelectedElement({
          type: 'corridor',
          id: newCorridor.id,
          floorId: fl.id,
          data: newCorridor,
        });
      } else if (type === 'Wall') {
        const wCount = fl.obstacles.length + 1;
        const newWall: Obstacle = {
          id: `W-${fl.level}${String(wCount).padStart(2, '0')}`,
          floor_id: fl.id,
          x: 25.0 + (wCount * 6.0) % 30.0,
          y: 12.0,
          width: 0.4,
          height: 8.0,
          obstacle_type: 'wall',
          passable: false,
        };
        fl.obstacles.push(newWall);
        setSelectedElement({
          type: 'wall',
          id: newWall.id,
          floorId: fl.id,
          data: newWall,
        });
      } else if (type === 'Door') {
        const dCount = fl.doorways.length + 1;
        const targetRoomId = selectedElement?.type === 'room' ? selectedElement.id : fl.rooms[0]?.id;
        const newDoor: Doorway = {
          id: `D-${fl.level}${String(dCount).padStart(2, '0')}`,
          floor_id: fl.id,
          x: 20.0 + (dCount * 5.0) % 40.0,
          y: 18.0,
          width: 1.2,
          connects_rooms: targetRoomId ? [targetRoomId] : [],
          is_open: true,
          is_emergency_exit: false,
        };
        fl.doorways.push(newDoor);
        setSelectedElement({
          type: 'door',
          id: newDoor.id,
          floorId: fl.id,
          data: newDoor,
        });
      } else if (type === 'Exit') {
        const eCount = fl.exits.length + 1;
        const newExit: Exit = {
          id: `exit_${fl.level}_${eCount}`,
          floor_id: fl.id,
          name: `Exit ${String.fromCharCode(65 + eCount - 1)}: Perimeter Egress`,
          x: 10.0 + eCount * 18.0,
          y: 2.0,
          width: 2.4,
          throughput_per_sec: 2.5,
          is_wheelchair_accessible: true,
          is_blocked: false,
        };
        fl.exits.push(newExit);
        setSelectedElement({
          type: 'exit',
          id: newExit.id,
          floorId: fl.id,
          data: newExit,
        });
      } else if (type === 'Stairs' || type === 'Ramp') {
        const isRamp = type === 'Ramp';
        // Determine adjacent floor
        const otherFloor =
          bldg.floors.find((f) => f.level === fl.level + 1) ||
          bldg.floors.find((f) => f.level === fl.level - 1) ||
          bldg.floors[0];
        const sCount = fl.stairwells.length + 1;
        const newStair: Stairwell = {
          id: `${isRamp ? 'ramp' : 'stair'}_${fl.id}_to_${otherFloor.id}_${sCount}`,
          from_floor: fl.id,
          to_floor: otherFloor.id,
          x: isRamp ? 36.0 : 16.0,
          y: 21.0,
          target_x: isRamp ? 46.0 : 16.0,
          target_y: isRamp ? 21.0 : 26.0,
          width: isRamp ? 2.4 : 1.8,
          throughput_per_sec: isRamp ? 2.4 : 1.8,
          is_wheelchair_accessible: isRamp,
          is_ramp: isRamp,
        };
        fl.stairwells.push(newStair);
        setSelectedElement({
          type: isRamp ? 'ramp' : 'stair',
          id: newStair.id,
          floorId: fl.id,
          data: newStair,
        });
      } else if (type === 'Elevator') {
        const otherFloor = bldg.floors.find((f) => f.level !== fl.level) || fl;
        const newElev: Stairwell = {
          id: `elevator_${fl.id}_to_${otherFloor.id}`,
          from_floor: fl.id,
          to_floor: otherFloor.id,
          x: 60.0,
          y: 22.0,
          target_x: 60.0,
          target_y: 22.0,
          width: 2.0,
          throughput_per_sec: 2.0,
          is_wheelchair_accessible: true,
          is_ramp: true,
        };
        fl.stairwells.push(newElev);
        setSelectedElement({
          type: 'ramp',
          id: newElev.id,
          floorId: fl.id,
          data: newElev,
        });
      } else if (type === 'Zone') {
        const zCount = fl.rooms.length + 1;
        const newZone: Room = {
          id: `Zone-${fl.level}${String(zCount).padStart(2, '0')}`,
          floor_id: fl.id,
          name: `Occupancy Staging Zone ${zCount}`,
          room_type: 'conference',
          bounds: { x: 45.0, y: 6.0, width: 14.0, height: 10.0 },
          max_capacity: 25,
          height: fl.floor_height,
          is_accessible: true,
        };
        fl.rooms.push(newZone);
        setSelectedElement({
          type: 'room',
          id: newZone.id,
          floorId: fl.id,
          data: newZone,
        });
      }

      return bldg;
    });
  };

  // -------------------------------------------------------------
  // EDITING TOOLS & PROPERTIES UPDATE
  // -------------------------------------------------------------
  const handleDeleteSelected = () => {
    if (!selectedElement || !currentBuilding) return;
    const { id, floorId } = selectedElement;

    updateBuildingState((bldg) => {
      const fl = bldg.floors.find((f) => f.id === floorId);
      if (!fl) return bldg;

      fl.rooms = fl.rooms.filter((r) => r.id !== id);
      fl.doorways = fl.doorways.filter((d) => d.id !== id);
      fl.exits = fl.exits.filter((e) => e.id !== id);
      fl.stairwells = fl.stairwells.filter((s) => s.id !== id);
      fl.obstacles = fl.obstacles.filter((o) => o.id !== id);

      return bldg;
    });

    setSelectedElement(null);
  };

  const handleRotateSelected = () => {
    if (!selectedElement || !currentBuilding) return;
    const { id, floorId } = selectedElement;

    updateBuildingState((bldg) => {
      const fl = bldg.floors.find((f) => f.id === floorId);
      if (!fl) return bldg;

      const targetRoom = fl.rooms.find((r) => r.id === id);
      if (targetRoom && targetRoom.bounds) {
        const temp = targetRoom.bounds.width;
        targetRoom.bounds.width = targetRoom.bounds.height;
        targetRoom.bounds.height = temp;
        setSelectedElement({
          ...selectedElement,
          data: { ...targetRoom },
        });
      }

      const targetWall = fl.obstacles.find((o) => o.id === id);
      if (targetWall) {
        const temp = targetWall.width;
        targetWall.width = targetWall.height;
        targetWall.height = temp;
        setSelectedElement({
          ...selectedElement,
          data: { ...targetWall },
        });
      }

      return bldg;
    });
  };

  const handleNudgePosition = (dx: number, dy: number) => {
    if (!selectedElement || !currentBuilding) return;
    const { id, floorId } = selectedElement;

    updateBuildingState((bldg) => {
      const fl = bldg.floors.find((f) => f.id === floorId);
      if (!fl) return bldg;

      const targetRoom = fl.rooms.find((r) => r.id === id);
      if (targetRoom && targetRoom.bounds) {
        targetRoom.bounds.x = Math.max(0, Math.min(fl.width - targetRoom.bounds.width, targetRoom.bounds.x + dx));
        targetRoom.bounds.y = Math.max(0, Math.min(fl.height - targetRoom.bounds.height, targetRoom.bounds.y + dy));
        setSelectedElement({ ...selectedElement, data: { ...targetRoom } });
      }

      const targetDoor = fl.doorways.find((d) => d.id === id);
      if (targetDoor) {
        targetDoor.x = Math.max(0, Math.min(fl.width, targetDoor.x + dx));
        targetDoor.y = Math.max(0, Math.min(fl.height, targetDoor.y + dy));
        setSelectedElement({ ...selectedElement, data: { ...targetDoor } });
      }

      const targetExit = fl.exits.find((e) => e.id === id);
      if (targetExit) {
        targetExit.x = Math.max(0, Math.min(fl.width, targetExit.x + dx));
        targetExit.y = Math.max(0, Math.min(fl.height, targetExit.y + dy));
        setSelectedElement({ ...selectedElement, data: { ...targetExit } });
      }

      const targetStair = fl.stairwells.find((s) => s.id === id);
      if (targetStair) {
        targetStair.x = Math.max(0, Math.min(fl.width, targetStair.x + dx));
        targetStair.y = Math.max(0, Math.min(fl.height, targetStair.y + dy));
        if (targetStair.target_x !== null && targetStair.target_x !== undefined) targetStair.target_x += dx;
        if (targetStair.target_y !== null && targetStair.target_y !== undefined) targetStair.target_y += dy;
        setSelectedElement({ ...selectedElement, data: { ...targetStair } });
      }

      const targetWall = fl.obstacles.find((o) => o.id === id);
      if (targetWall) {
        targetWall.x = Math.max(0, Math.min(fl.width - targetWall.width, targetWall.x + dx));
        targetWall.y = Math.max(0, Math.min(fl.height - targetWall.height, targetWall.y + dy));
        setSelectedElement({ ...selectedElement, data: { ...targetWall } });
      }

      return bldg;
    });
  };

  const handleNudgeDimensions = (dw: number, dh: number) => {
    if (!selectedElement || !currentBuilding) return;
    const { id, floorId } = selectedElement;

    updateBuildingState((bldg) => {
      const fl = bldg.floors.find((f) => f.id === floorId);
      if (!fl) return bldg;

      const targetRoom = fl.rooms.find((r) => r.id === id);
      if (targetRoom && targetRoom.bounds) {
        targetRoom.bounds.width = Math.max(2.0, targetRoom.bounds.width + dw);
        targetRoom.bounds.height = Math.max(2.0, targetRoom.bounds.height + dh);
        setSelectedElement({ ...selectedElement, data: { ...targetRoom } });
      }

      const targetWall = fl.obstacles.find((o) => o.id === id);
      if (targetWall) {
        targetWall.width = Math.max(0.2, targetWall.width + dw);
        targetWall.height = Math.max(0.5, targetWall.height + dh);
        setSelectedElement({ ...selectedElement, data: { ...targetWall } });
      }

      return bldg;
    });
  };

  const handleUpdateElementProperty = (key: string, value: any) => {
    if (!selectedElement || !currentBuilding) return;
    const { id, floorId } = selectedElement;

    updateBuildingState((bldg) => {
      const fl = bldg.floors.find((f) => f.id === floorId);
      if (!fl) return bldg;

      // Check rooms
      const targetRoom = fl.rooms.find((r) => r.id === id);
      if (targetRoom) {
        if (key === 'name') targetRoom.name = value;
        if (key === 'room_type') targetRoom.room_type = value;
        if (key === 'max_capacity') targetRoom.max_capacity = parseInt(value) || 1;
        if (key === 'is_accessible') targetRoom.is_accessible = Boolean(value);
        if (key === 'width') targetRoom.bounds.width = Math.max(1.0, parseFloat(value) || 1.0);
        if (key === 'height') targetRoom.bounds.height = Math.max(1.0, parseFloat(value) || 1.0);
        if (key === 'x') targetRoom.bounds.x = parseFloat(value) || 0.0;
        if (key === 'y') targetRoom.bounds.y = parseFloat(value) || 0.0;
        setSelectedElement({ ...selectedElement, data: { ...targetRoom } });
      }

      // Check exits
      const targetExit = fl.exits.find((e) => e.id === id);
      if (targetExit) {
        if (key === 'name') targetExit.name = value;
        if (key === 'width') targetExit.width = Math.max(0.8, parseFloat(value) || 1.0);
        if (key === 'throughput_per_sec') targetExit.throughput_per_sec = parseFloat(value) || 2.0;
        if (key === 'is_wheelchair_accessible') targetExit.is_wheelchair_accessible = Boolean(value);
        if (key === 'is_blocked') targetExit.is_blocked = Boolean(value);
        if (key === 'x') targetExit.x = parseFloat(value) || 0.0;
        if (key === 'y') targetExit.y = parseFloat(value) || 0.0;
        setSelectedElement({ ...selectedElement, data: { ...targetExit } });
      }

      // Check stairwells
      const targetStair = fl.stairwells.find((s) => s.id === id);
      if (targetStair) {
        if (key === 'width') targetStair.width = parseFloat(value) || 1.5;
        if (key === 'throughput_per_sec') targetStair.throughput_per_sec = parseFloat(value) || 1.5;
        if (key === 'is_wheelchair_accessible') targetStair.is_wheelchair_accessible = Boolean(value);
        if (key === 'is_ramp') targetStair.is_ramp = Boolean(value);
        if (key === 'to_floor') targetStair.to_floor = value;
        if (key === 'x') targetStair.x = parseFloat(value) || 0.0;
        if (key === 'y') targetStair.y = parseFloat(value) || 0.0;
        setSelectedElement({ ...selectedElement, data: { ...targetStair } });
      }

      // Check doorways
      const targetDoor = fl.doorways.find((d) => d.id === id);
      if (targetDoor) {
        if (key === 'width') targetDoor.width = parseFloat(value) || 1.2;
        if (key === 'x') targetDoor.x = parseFloat(value) || 0.0;
        if (key === 'y') targetDoor.y = parseFloat(value) || 0.0;
        setSelectedElement({ ...selectedElement, data: { ...targetDoor } });
      }

      return bldg;
    });
  };

  // Launch Simulation Check
  const handleLaunchSimulation = () => {
    if (!currentBuilding) return;
    if (validationReport && !validationReport.is_valid) {
      setShowValidationModal(true);
      return;
    }
    // Save building first then trigger
    api.updateBuilding(currentBuilding.id, currentBuilding).catch(console.warn);
    if (onRunSimulation) {
      onRunSimulation(currentBuilding.id);
    }
  };

  // Stats calculation
  const floorsCount = currentBuilding?.floors.length || 0;
  const roomsCount = currentBuilding?.floors.reduce((acc, f) => acc + (f.rooms?.length || 0), 0) || 0;
  const corridorsCount = currentBuilding?.floors.reduce(
    (acc, f) => acc + (f.rooms?.filter((r) => r.room_type === 'corridor').length || 0),
    0
  ) || floorsCount * 4;
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
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#242A30] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#167D73]" />
              Building Studio
            </h2>
            <p className="text-xs text-[#647078]">Create, edit, and configure buildings for evacuation simulation</p>
          </div>

          {/* Undo / Redo Toolbar */}
          <div className="hidden sm:flex items-center gap-1 border-l border-[#E5E7EB] pl-3 ml-2">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo Edit"
              className="p-1.5 text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded disabled:opacity-30 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo Edit"
              className="p-1.5 text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded disabled:opacity-30 transition-colors"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs text-[#167D73] font-medium bg-[#E6F4F2] px-2.5 py-1 rounded">
              {saveStatus}
            </span>
          )}
          <button
            onClick={() => setIsNewBuildingModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#242A30] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Building
          </button>
          <button
            onClick={() => onOpenImportWizard?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#242A30] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-sm transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-[#167D73]" />
            Import 3D / CAD
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#242A30] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-sm cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            Import JSON
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
          {onRunSimulation && (
            <button
              onClick={handleLaunchSimulation}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#167D73] bg-[#E6F4F2] hover:bg-[#d0ece8] border border-[#167D73]/30 rounded shadow-sm transition-colors font-semibold"
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
                    width: currentBuilding.floors[0]?.width || 80.0,
                    height: currentBuilding.floors[0]?.height || 45.0,
                    rooms: [],
                    doorways: [],
                    obstacles: [],
                    exits: [],
                    stairwells: [],
                  };
                  updateBuildingState((bldg) => ({
                    ...bldg,
                    floors: [...bldg.floors, newFloor],
                  }));
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
                { type: 'Room' as const, name: 'Room', icon: Square },
                { type: 'Corridor' as const, name: 'Corridor', icon: Minus },
                { type: 'Wall' as const, name: 'Wall', icon: Box },
                { type: 'Door' as const, name: 'Door', icon: DoorOpen },
                { type: 'Exit' as const, name: 'Exit', icon: LogOut },
                { type: 'Stairs' as const, name: 'Stairs', icon: TrendingUp },
                { type: 'Ramp' as const, name: 'Ramp', icon: Accessibility },
                { type: 'Elevator' as const, name: 'Elevator', icon: Layers },
                { type: 'Zone' as const, name: 'Zone', icon: Square },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAddElement(item.type)}
                    title={`Add ${item.name} to ${activeFloor?.name || 'Active Floor'}`}
                    className="flex flex-col items-center justify-center p-2 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] hover:bg-white hover:border-[#167D73] text-[#242A30] transition-colors cursor-pointer group"
                  >
                    <Icon className="w-4 h-4 text-[#647078] group-hover:text-[#167D73] mb-1" />
                    <span className="text-[10px] text-center leading-tight font-medium">{item.name}</span>
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
                { id: 'move', label: 'Move (Nudge / Drag)', icon: Move },
                { id: 'resize', label: 'Resize (Length / Width)', icon: Maximize },
                { id: 'rotate', label: 'Rotate 90°', icon: RotateCw },
                { id: 'delete', label: 'Delete Selected', icon: Trash2 },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = activeStudioTool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveStudioTool(t.id as any);
                      if (t.id === 'delete') handleDeleteSelected();
                      if (t.id === 'rotate') handleRotateSelected();
                    }}
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

            {/* Move & Resize On-Screen Direct Pad */}
            {selectedElement && (activeStudioTool === 'move' || activeStudioTool === 'resize') && (
              <div className="mt-4 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] space-y-2">
                <span className="block text-[10px] font-semibold text-[#647078] uppercase text-center">
                  {activeStudioTool === 'move' ? 'Nudge Position (±1m)' : 'Resize Dimensions (±1m)'}
                </span>
                {activeStudioTool === 'move' ? (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleNudgePosition(0, -1)}
                      className="p-1.5 bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-xs"
                      title="Move Up (-Y)"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-[#242A30]" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleNudgePosition(-1, 0)}
                        className="p-1.5 bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-xs"
                        title="Move Left (-X)"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-[#242A30]" />
                      </button>
                      <button
                        onClick={() => handleNudgePosition(1, 0)}
                        className="p-1.5 bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-xs"
                        title="Move Right (+X)"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-[#242A30]" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleNudgePosition(0, 1)}
                      className="p-1.5 bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded shadow-xs"
                      title="Move Down (+Y)"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-[#242A30]" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] text-[#647078] block">Width / X</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleNudgeDimensions(-1, 0)}
                          className="flex-1 py-1 bg-white border border-[#E5E7EB] rounded font-mono font-bold"
                        >
                          -1m
                        </button>
                        <button
                          onClick={() => handleNudgeDimensions(1, 0)}
                          className="flex-1 py-1 bg-white border border-[#E5E7EB] rounded font-mono font-bold"
                        >
                          +1m
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-[#647078] block">Length / Y</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleNudgeDimensions(0, -1)}
                          className="flex-1 py-1 bg-white border border-[#E5E7EB] rounded font-mono font-bold"
                        >
                          -1m
                        </button>
                        <button
                          onClick={() => handleNudgeDimensions(0, 1)}
                          className="flex-1 py-1 bg-white border border-[#E5E7EB] rounded font-mono font-bold"
                        >
                          +1m
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                selectedElementId={selectedElement?.id}
                onSelectElement={setSelectedElement}
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
                <button
                  onClick={handleDeleteSelected}
                  title="Delete element"
                  className="p-1 text-[#647078] hover:text-[#EF4444] rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {activePropertyTab === 'element' ? (
                <>
                  {/* Name Input */}
                  <div>
                    <label className="block text-[11px] font-medium text-[#647078] mb-1">Name</label>
                    <input
                      type="text"
                      value={selectedElement.data.name || ''}
                      onChange={(e) => handleUpdateElementProperty('name', e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2.5 py-1.5 text-xs text-[#242A30] focus:ring-1 focus:ring-[#167D73]"
                    />
                  </div>

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

                  {/* Room Type (if room) */}
                  {selectedElement.data.room_type !== undefined && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#647078] mb-1">Type</label>
                      <select
                        value={selectedElement.data.room_type || 'office'}
                        onChange={(e) => handleUpdateElementProperty('room_type', e.target.value)}
                        className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2.5 py-1.5 text-xs text-[#242A30] focus:ring-1 focus:ring-[#167D73]"
                      >
                        <option value="office">Patient Room / Office</option>
                        <option value="lab">Treatment Room / Laboratory</option>
                        <option value="lobby">Lobby & Reception</option>
                        <option value="conference">Conference Suite</option>
                        <option value="corridor">Hallway Corridor</option>
                        <option value="storage">Storage & Utilities</option>
                      </select>
                    </div>
                  )}

                  {/* Coordinates & Dimensions */}
                  <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                    <span className="block font-medium text-[11px] text-[#647078] uppercase">
                      Spatial Coordinates & Dimensions
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <label className="text-[10px] text-[#647078] block">X Pos (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedElement.data.bounds?.x ?? selectedElement.data.x ?? 0}
                          onChange={(e) => handleUpdateElementProperty('x', e.target.value)}
                          className="w-full font-semibold text-[#242A30] bg-transparent border-none p-0 focus:ring-0 text-xs"
                        />
                      </div>
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <label className="text-[10px] text-[#647078] block">Y Pos (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedElement.data.bounds?.y ?? selectedElement.data.y ?? 0}
                          onChange={(e) => handleUpdateElementProperty('y', e.target.value)}
                          className="w-full font-semibold text-[#242A30] bg-transparent border-none p-0 focus:ring-0 text-xs"
                        />
                      </div>
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <label className="text-[10px] text-[#647078] block">Width / X (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={selectedElement.data.bounds?.width ?? selectedElement.data.width ?? 1.5}
                          onChange={(e) => handleUpdateElementProperty('width', e.target.value)}
                          className="w-full font-semibold text-[#242A30] bg-transparent border-none p-0 focus:ring-0 text-xs"
                        />
                      </div>
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <label className="text-[10px] text-[#647078] block">Length / Y (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={selectedElement.data.bounds?.height ?? 1.5}
                          onChange={(e) => handleUpdateElementProperty('height', e.target.value)}
                          className="w-full font-semibold text-[#242A30] bg-transparent border-none p-0 focus:ring-0 text-xs"
                        />
                      </div>
                    </div>

                    {/* Capacity */}
                    {selectedElement.data.max_capacity !== undefined && (
                      <div className="bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB] flex items-center justify-between">
                        <span className="text-[10px] text-[#647078]">Max Capacity</span>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={selectedElement.data.max_capacity || 6}
                          onChange={(e) => handleUpdateElementProperty('max_capacity', e.target.value)}
                          className="w-16 text-right font-semibold text-[#242A30] bg-transparent border-b border-[#E5E7EB] px-1 py-0.5 text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Accessibility */}
                  <div className="pt-2 border-t border-[#E5E7EB]">
                    <span className="block font-medium text-[11px] text-[#647078] uppercase mb-2">Accessibility</span>
                    <label className="flex items-center gap-2 cursor-pointer bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                      <input
                        type="checkbox"
                        checked={
                          selectedElement.data.is_accessible ??
                          selectedElement.data.is_wheelchair_accessible ??
                          true
                        }
                        onChange={(e) => {
                          handleUpdateElementProperty('is_accessible', e.target.checked);
                          handleUpdateElementProperty('is_wheelchair_accessible', e.target.checked);
                        }}
                        className="rounded text-[#167D73] focus:ring-[#167D73]"
                      />
                      <span className="font-medium text-[#242A30]">Accessible (Wheelchair Standard)</span>
                    </label>
                  </div>

                  {/* Exit specific controls */}
                  {selectedElement.type === 'exit' && (
                    <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                      <span className="block font-medium text-[11px] text-[#647078] uppercase">Exit Controls</span>
                      <label className="flex items-center gap-2 cursor-pointer bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                        <input
                          type="checkbox"
                          checked={selectedElement.data.is_blocked || false}
                          onChange={(e) => handleUpdateElementProperty('is_blocked', e.target.checked)}
                          className="rounded text-[#EF4444] focus:ring-[#EF4444]"
                        />
                        <span className="font-medium text-[#EF4444]">Simulate Exit Blockage</span>
                      </label>
                    </div>
                  )}

                  {/* Delete Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleDeleteSelected}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#FEE2E2] hover:bg-[#FCD8D8] text-[#B91C1C] rounded text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Element
                    </button>
                  </div>
                </>
              ) : (
                /* Connectivity Tab */
                <div className="space-y-3">
                  <span className="block font-medium text-[11px] text-[#647078] uppercase">Connected Portals & Stairs</span>
                  <div className="space-y-1.5">
                    {activeFloor?.doorways.map((door) => (
                      <div key={door.id} className="flex items-center justify-between p-2 rounded border border-[#E5E7EB] bg-[#F9FAFB]">
                        <span className="text-xs font-medium">Door {door.id} (Width: {door.width}m)</span>
                        <Trash2
                          onClick={() => {
                            updateBuildingState((b) => {
                              const fl = b.floors.find((f) => f.id === activeFloor.id);
                              if (fl) fl.doorways = fl.doorways.filter((d) => d.id !== door.id);
                              return b;
                            });
                          }}
                          className="w-3.5 h-3.5 text-[#9CA3AF] hover:text-[#EF4444] cursor-pointer"
                        />
                      </div>
                    ))}
                    {activeFloor?.stairwells.map((stair) => (
                      <div key={stair.id} className="flex items-center justify-between p-2 rounded border border-[#E5E7EB] bg-[#F9FAFB]">
                        <span className="text-xs font-medium">
                          {stair.is_ramp ? 'Accessible Ramp' : 'Staircase'} to {stair.to_floor}
                        </span>
                        <Trash2
                          onClick={() => {
                            updateBuildingState((b) => {
                              const fl = b.floors.find((f) => f.id === activeFloor.id);
                              if (fl) fl.stairwells = fl.stairwells.filter((s) => s.id !== stair.id);
                              return b;
                            });
                          }}
                          className="w-3.5 h-3.5 text-[#9CA3AF] hover:text-[#EF4444] cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleAddElement('Door')}
                    className="w-full mt-2 py-1.5 text-xs font-medium text-[#167D73] bg-[#E6F4F2] hover:bg-[#d0ece8] rounded transition-colors"
                  >
                    + Add Connected Doorway
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

      {/* Bottom Status Bar */}
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
            <button
              onClick={() => setShowValidationModal(true)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEE2E2] text-[#B91C1C] hover:bg-[#FCD8D8] transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Validation Issues ({validationReport?.errors.length || 0})
            </button>
          )}
        </div>
      </footer>

      {/* New Building Modal */}
      {isNewBuildingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
          <div className="flex flex-col w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF8]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#167D73] text-white">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#242A30]">Create New Digital Twin Building</h3>
                  <p className="text-xs text-[#647078]">Initialize architectural structure and floor levels</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewBuildingModalOpen(false)}
                className="p-1 text-[#647078] hover:text-[#242A30] rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewBuildingSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#647078] uppercase mb-1">
                  Building Name
                </label>
                <input
                  type="text"
                  required
                  value={newBldgForm.name}
                  onChange={(e) => setNewBldgForm({ ...newBldgForm, name: e.target.value })}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-3 py-2 text-xs text-[#242A30] focus:ring-1 focus:ring-[#167D73]"
                  placeholder="e.g. Innovation Hall"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#647078] uppercase mb-1">
                    Width (m)
                  </label>
                  <input
                    type="number"
                    required
                    min="20"
                    max="200"
                    step="1"
                    value={newBldgForm.width}
                    onChange={(e) => setNewBldgForm({ ...newBldgForm, width: parseFloat(e.target.value) || 80.0 })}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-3 py-2 text-xs text-[#242A30]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#647078] uppercase mb-1">
                    Length / Depth (m)
                  </label>
                  <input
                    type="number"
                    required
                    min="15"
                    max="150"
                    step="1"
                    value={newBldgForm.height}
                    onChange={(e) => setNewBldgForm({ ...newBldgForm, height: parseFloat(e.target.value) || 45.0 })}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-3 py-2 text-xs text-[#242A30]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#647078] uppercase mb-1">
                    Floor Count
                  </label>
                  <select
                    value={newBldgForm.floorCount}
                    onChange={(e) => setNewBldgForm({ ...newBldgForm, floorCount: parseInt(e.target.value) || 2 })}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-3 py-2 text-xs text-[#242A30]"
                  >
                    <option value={1}>1 Floor (Single Level)</option>
                    <option value={2}>2 Floors (Standard Multi-Floor)</option>
                    <option value={3}>3 Floors (Complex Facility)</option>
                    <option value={4}>4 Floors (Multi-Story Tower)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#647078] uppercase mb-1">
                    Floor Height (m)
                  </label>
                  <input
                    type="number"
                    required
                    min="2.5"
                    max="5.0"
                    step="0.1"
                    value={newBldgForm.floorHeight}
                    onChange={(e) => setNewBldgForm({ ...newBldgForm, floorHeight: parseFloat(e.target.value) || 3.2 })}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded px-3 py-2 text-xs text-[#242A30]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewBuildingModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E7EB] rounded text-[#647078] hover:bg-[#F3F4F6] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#167D73] hover:bg-[#126860] text-white rounded font-semibold shadow-xs"
                >
                  Create Digital Twin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Validation Issues Modal */}
      {showValidationModal && validationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
          <div className="flex flex-col w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#FEF2F2]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                <h3 className="text-sm font-bold text-[#991B1B]">Building Validation Errors</h3>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="p-1 text-[#647078] hover:text-[#242A30] rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <p className="text-[#647078]">
                Please address the following architectural defects before launching evacuation simulation:
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {validationReport.errors.map((err, i) => (
                  <div key={i} className="p-2 rounded bg-[#FEE2E2] text-[#B91C1C] flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>{err}</span>
                  </div>
                ))}
                {validationReport.warnings.map((warn, i) => (
                  <div key={i} className="p-2 rounded bg-[#FEF3C7] text-[#B45309] flex items-start gap-2">
                    <span className="font-bold">▲</span>
                    <span>{warn}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end">
                <button
                  onClick={() => setShowValidationModal(false)}
                  className="px-4 py-2 bg-[#167D73] text-white rounded font-medium"
                >
                  Return to Studio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
