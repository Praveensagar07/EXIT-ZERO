import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { Building, Floor, Occupant, HazardSource, NavigationGraphModel } from '../types/simulation';
import {
  type AgentRig,
  createAmbulatoryMannequin,
  createWheelchairFigure,
  updateAgentMaterials,
  animateAgentRig,
} from './AgentMannequin3D';
import {
  Maximize2,
  Activity,
  User,
} from 'lucide-react';

export type ViewMode3D = 'full' | 'exploded' | 'floor';

export interface BuildingViewport3DProps {
  building: Building | null;
  activeFloorId?: string;
  onSelectFloor?: (floorId: string) => void;
  viewMode?: ViewMode3D;
  onChangeViewMode?: (mode: ViewMode3D) => void;
  occupants?: Occupant[];
  hazards?: HazardSource[];
  graph?: NavigationGraphModel | null;
  selectedElementId?: string | null;
  onSelectElement?: (element: {
    type: 'room' | 'exit' | 'occupant' | 'stair' | 'corridor';
    id: string;
    floorId: string;
    data: any;
  } | null) => void;
  showExits?: boolean;
  showOccupants?: boolean;
  showHazards?: boolean;
  showRoutes?: boolean;
  showCongestionHeatmap?: boolean;
  showRoomLabels?: boolean;
  isStudioMode?: boolean;
  simTime?: number;
  isRunning?: boolean;
  speedMultiplier?: number;
  followOccupantId?: string | null;
  onToggleFollowOccupant?: (id: string | null) => void;
}

export const BuildingViewport3D: React.FC<BuildingViewport3DProps> = ({
  building,
  activeFloorId,
  onSelectFloor,
  viewMode = 'exploded',
  onChangeViewMode,
  occupants = [],
  hazards = [],
  graph,
  selectedElementId,
  onSelectElement,
  showExits = true,
  showOccupants = true,
  showHazards = true,
  showRoutes = true,
  isRunning = false,
  speedMultiplier = 1.0,
  followOccupantId = null,
  onToggleFollowOccupant,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js Core Systems
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Interactive Groups
  const buildingGroupRef = useRef<THREE.Group | null>(null);
  const agentRigsRef = useRef<Map<string, AgentRig>>(new Map());
  const routeLineGroupRef = useRef<THREE.Group | null>(null);
  const hazardGroupRef = useRef<THREE.Group | null>(null);
  const interactiveMeshesRef = useRef<Map<string, { type: 'room' | 'exit' | 'occupant' | 'stair'; id: string; floorId: string; data: any }>>(new Map());
  const flameMeshesRef = useRef<THREE.Mesh[]>([]);

  // Camera Orbit State
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(40, 6, 22.5));
  const cameraRadiusRef = useRef<number>(95);
  const cameraThetaRef = useRef<number>(Math.PI * 0.28); // Azimuthal angle
  const cameraPhiRef = useRef<number>(Math.PI * 0.32);   // Polar angle
  const isDraggingRef = useRef<boolean>(false);
  const dragModeRef = useRef<'orbit' | 'pan'>('orbit');
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Runtime State Refs for smooth render loop updates without scene recreation
  const isRunningRef = useRef(isRunning);
  const speedMultiplierRef = useRef(speedMultiplier);
  const followOccupantIdRef = useRef(followOccupantId);

  useEffect(() => {
    isRunningRef.current = isRunning;
    speedMultiplierRef.current = speedMultiplier;
    followOccupantIdRef.current = followOccupantId;
  }, [isRunning, speedMultiplier, followOccupantId]);

  // Exploded spacing
  const explodeSpacing = 8.5; // Meters separation in exploded view

  // Continuous Exploded Elevation Calculator
  const getExplodedElevation = useCallback((trueZ: number, floors: Floor[], spacing: number) => {
    if (floors.length <= 1) return trueZ;
    for (let i = 0; i < floors.length - 1; i++) {
      const z1 = floors[i].elevation ?? i * 3.2;
      const z2 = floors[i + 1].elevation ?? (i + 1) * 3.2;
      if (trueZ >= z1 && trueZ <= z2) {
        const t = (z2 - z1) > 0.01 ? (trueZ - z1) / (z2 - z1) : 0;
        const y1 = z1 + i * spacing;
        const y2 = z2 + (i + 1) * spacing;
        return y1 + t * (y2 - y1);
      }
    }
    if (trueZ < (floors[0].elevation ?? 0)) return trueZ;
    const lastIdx = floors.length - 1;
    const lastZ = floors[lastIdx].elevation ?? lastIdx * 3.2;
    return lastZ + lastIdx * spacing + (trueZ - lastZ);
  }, []);

  // Update Camera Matrix
  const updateCameraPosition = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const r = cameraRadiusRef.current;
    const phi = Math.max(0.08, Math.min(Math.PI * 0.48, cameraPhiRef.current));
    const theta = cameraThetaRef.current;
    const target = cameraTargetRef.current;

    camera.position.x = target.x + r * Math.sin(phi) * Math.sin(theta);
    camera.position.y = target.y + r * Math.cos(phi);
    camera.position.z = target.z + r * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(target);
  }, []);

  // 1. Initialize Three.js Scene and Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfafaf8); // Professional light architectural background
    scene.fog = new THREE.FogExp2(0xfafaf8, 0.0035);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 800);
    cameraRef.current = camera;
    updateCameraPosition();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    // Architectural Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe5e7eb, 0.6);
    hemiLight.position.set(0, 100, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbf0, 1.25);
    sunLight.position.set(80, 120, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -70;
    sunLight.shadow.camera.right = 70;
    sunLight.shadow.camera.top = 70;
    sunLight.shadow.camera.bottom = -70;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.4);
    fillLight.position.set(-60, 40, -40);
    scene.add(fillLight);

    // Ground Plane Grid
    const groundGrid = new THREE.GridHelper(140, 70, 0x167d73, 0xe5e7eb);
    groundGrid.position.set(40, -0.05, 22.5);
    scene.add(groundGrid);

    // Continuous Animation Loop
    let lastTime = performance.now();
    const renderLoop = (now: number) => {
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Follow camera if an agent is tracked
      const currentTrackId = followOccupantIdRef.current;
      if (currentTrackId && agentRigsRef.current.has(currentTrackId)) {
        const rig = agentRigsRef.current.get(currentTrackId)!;
        cameraTargetRef.current.lerp(rig.root.position, 0.08);
        updateCameraPosition();
      }

      // Animate agent limb kinematics & wheel rotations
      const simRunning = isRunningRef.current;
      const simSpeed = speedMultiplierRef.current;
      agentRigsRef.current.forEach((rig) => {
        animateAgentRig(rig, dt, simRunning, simSpeed);
      });

      // Animate fire flame pulsations
      flameMeshesRef.current.forEach((flame, idx) => {
        const pulse = 1.0 + Math.sin(now * 0.006 + idx * 1.5) * 0.18;
        flame.scale.set(pulse, 0.9 + Math.cos(now * 0.008 + idx) * 0.22, pulse);
        flame.rotation.y += dt * 1.2;
      });

      renderer.render(scene, camera);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
    };
  }, [updateCameraPosition]);

  // 2. Build Realistic Architectural Building Geometry
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !building) return;

    if (buildingGroupRef.current) {
      scene.remove(buildingGroupRef.current);
      buildingGroupRef.current = null;
    }
    interactiveMeshesRef.current.clear();

    const floors = building.floors || [];
    if (floors.length === 0) return;

    // Materials - Crisp architectural engineering BIM palette
    const slabMaterial = new THREE.MeshStandardMaterial({
      color: 0xededeb,
      roughness: 0.65,
      metalness: 0.04,
    });
    const slabEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0xd1d5db,
      transparent: true,
      opacity: 0.8,
    });
    const interiorWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.6,
      metalness: 0.02,
    });
    const columnMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569, // Structural dark slate columns
      roughness: 0.4,
      metalness: 0.2,
    });
    const glassCurtainMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdcfce7,
      transmission: 0.82,
      opacity: 0.22,
      transparent: true,
      roughness: 0.1,
      ior: 1.5,
    });
    const stairStepMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.5,
    });
    const railingMaterial = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // Brushed stainless steel railing
      roughness: 0.25,
      metalness: 0.85,
    });
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: 0x167d73, // Signature teal non-slip surface
      roughness: 0.45,
      metalness: 0.1,
    });

    const buildingGroup = new THREE.Group();
    buildingGroup.userData = { isBuildingComponent: true };

    floors.forEach((floor, floorIndex) => {
      const isFloorActive = !activeFloorId || floor.id === activeFloorId;

      let floorY = (floor.elevation ?? floorIndex * 3.2);
      if (viewMode === 'exploded') {
        floorY += floorIndex * explodeSpacing;
      } else if (viewMode === 'floor' && !isFloorActive) {
        return; // Isolate selected floor
      }

      const floorGroup = new THREE.Group();
      floorGroup.position.set(0, floorY, 0);
      floorGroup.userData = { isBuildingComponent: true, floorId: floor.id };

      const fWidth = floor.width || 80.0;
      const fHeight = floor.height || 45.0;
      const wallHeight = floor.floor_height ? floor.floor_height - 0.3 : 2.9;

      // A. Solid Architectural Floor Slab with Chamfered Edges
      const slabThickness = 0.35;
      const slabGeo = new THREE.BoxGeometry(fWidth, slabThickness, fHeight);
      const slabMesh = new THREE.Mesh(slabGeo, slabMaterial);
      slabMesh.position.set(fWidth / 2, -slabThickness / 2, fHeight / 2);
      slabMesh.receiveShadow = true;
      slabMesh.castShadow = true;
      floorGroup.add(slabMesh);

      const slabEdges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), slabEdgeMaterial);
      slabEdges.position.copy(slabMesh.position);
      floorGroup.add(slabEdges);

      // B. Perimeter Architectural Glass Curtain Wall with Structural Columns
      const columnSpacing = 16.0;
      const colGeo = new THREE.BoxGeometry(0.45, wallHeight, 0.45);

      // Place perimeter structural columns
      for (let cx = 0; cx <= fWidth; cx += columnSpacing) {
        const c1 = new THREE.Mesh(colGeo, columnMaterial);
        c1.position.set(cx, wallHeight / 2, 0.2);
        c1.castShadow = true;
        floorGroup.add(c1);

        const c2 = new THREE.Mesh(colGeo, columnMaterial);
        c2.position.set(cx, wallHeight / 2, fHeight - 0.2);
        c2.castShadow = true;
        floorGroup.add(c2);
      }

      // Exterior Glass Curtain Walls (Ensures interior occupants are 100% visible from outside)
      const northGlass = new THREE.Mesh(new THREE.BoxGeometry(fWidth, wallHeight, 0.08), glassCurtainMaterial);
      northGlass.position.set(fWidth / 2, wallHeight / 2, 0.1);
      floorGroup.add(northGlass);

      const southGlass = new THREE.Mesh(new THREE.BoxGeometry(fWidth, wallHeight, 0.08), glassCurtainMaterial);
      southGlass.position.set(fWidth / 2, wallHeight / 2, fHeight - 0.1);
      floorGroup.add(southGlass);

      const westGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, fHeight), glassCurtainMaterial);
      westGlass.position.set(0.1, wallHeight / 2, fHeight / 2);
      floorGroup.add(westGlass);

      const eastGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, wallHeight, fHeight), glassCurtainMaterial);
      eastGlass.position.set(fWidth - 0.1, wallHeight / 2, fHeight / 2);
      floorGroup.add(eastGlass);

      // C. Interior Rooms with Door Openings & Interactive Highlights
      (floor.rooms || []).forEach((room) => {
        const rx = room.bounds.x;
        const ry = room.bounds.y;
        const rw = room.bounds.width;
        const rh = room.bounds.height;
        const isSelected = selectedElementId === room.id;

        // Interactive bounding volume
        const roomBoxGeo = new THREE.BoxGeometry(rw - 0.15, wallHeight, rh - 0.15);
        const roomBoxMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x167d73 : (room.room_type === 'office' ? 0xf8fafc : 0xf1f5f9),
          transparent: true,
          opacity: isSelected ? 0.35 : 0.04,
          roughness: 0.3,
        });
        const roomMesh = new THREE.Mesh(roomBoxGeo, roomBoxMat);
        roomMesh.position.set(rx + rw / 2, wallHeight / 2, ry + rh / 2);
        roomMesh.userData = { type: 'room', id: room.id, floorId: floor.id, data: room };
        floorGroup.add(roomMesh);
        interactiveMeshesRef.current.set(roomMesh.uuid, { type: 'room', id: room.id, floorId: floor.id, data: room });

        // Room perimeter walls with realistic thickness
        const wallThick = 0.18;
        const rNorth = new THREE.Mesh(new THREE.BoxGeometry(rw, wallHeight, wallThick), interiorWallMaterial);
        rNorth.position.set(rx + rw / 2, wallHeight / 2, ry);
        rNorth.receiveShadow = true;
        floorGroup.add(rNorth);

        const rSouth = new THREE.Mesh(new THREE.BoxGeometry(rw, wallHeight, wallThick), interiorWallMaterial);
        rSouth.position.set(rx + rw / 2, wallHeight / 2, ry + rh);
        rSouth.receiveShadow = true;
        floorGroup.add(rSouth);

        const rWest = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, rh), interiorWallMaterial);
        rWest.position.set(rx, wallHeight / 2, ry + rh / 2);
        rWest.receiveShadow = true;
        floorGroup.add(rWest);

        const rEast = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, rh), interiorWallMaterial);
        rEast.position.set(rx + rw, wallHeight / 2, ry + rh / 2);
        rEast.receiveShadow = true;
        floorGroup.add(rEast);

        // Low glass corridor partition along inner corridor edge
        const glassPartition = new THREE.Mesh(new THREE.BoxGeometry(rw, 1.1, 0.06), glassCurtainMaterial);
        glassPartition.position.set(rx + rw / 2, 0.55, ry < fHeight / 2 ? ry + rh + 0.12 : ry - 0.12);
        floorGroup.add(glassPartition);
      });

      // D. Doorways with Distinct Architectural Frames
      (floor.doorways || []).forEach((door) => {
        const doorW = door.width || 1.4;
        const doorH = 2.3;
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4 });

        // Door frame header
        const headerMesh = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.1, 0.15, 0.28), frameMat);
        headerMesh.position.set(door.x, doorH + 0.075, door.y);
        floorGroup.add(headerMesh);

        // Left jamb
        const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorH, 0.28), frameMat);
        leftJamb.position.set(door.x - doorW / 2, doorH / 2, door.y);
        floorGroup.add(leftJamb);

        // Right jamb
        const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorH, 0.28), frameMat);
        rightJamb.position.set(door.x + doorW / 2, doorH / 2, door.y);
        floorGroup.add(rightJamb);
      });

      // E. Emergency Exits (3D Double Doors with Illuminated Overhead Egress Signs)
      if (showExits) {
        (floor.exits || []).forEach((exit) => {
          const isSelected = selectedElementId === exit.id;
          const exitW = exit.width || 2.4;
          const exitH = 2.4;

          const exitFrameMat = new THREE.MeshStandardMaterial({
            color: exit.is_blocked ? 0xef4444 : (isSelected ? 0x167d73 : 0x10b981),
            emissive: exit.is_blocked ? 0x7f1d1d : 0x059669,
            emissiveIntensity: 0.35,
            roughness: 0.3,
          });

          // Double door frame
          const exitMesh = new THREE.Mesh(new THREE.BoxGeometry(exitW, exitH, 0.35), exitFrameMat);
          exitMesh.position.set(exit.x, exitH / 2, exit.y);
          exitMesh.userData = { type: 'exit', id: exit.id, floorId: floor.id, data: exit };
          floorGroup.add(exitMesh);
          interactiveMeshesRef.current.set(exitMesh.uuid, { type: 'exit', id: exit.id, floorId: floor.id, data: exit });

          // Overhead Illuminated Exit Sign
          const signBox = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.4, 0.2),
            new THREE.MeshStandardMaterial({
              color: exit.is_blocked ? 0xef4444 : 0x10b981,
              emissive: exit.is_blocked ? 0xb91c1c : 0x10b981,
              emissiveIntensity: 0.8,
            })
          );
          signBox.position.set(exit.x, exitH + 0.3, exit.y);
          floorGroup.add(signBox);
        });
      }

      // F. Staircases with Individual Steps & Stainless Steel Railings
      (floor.stairwells || []).forEach((stair) => {
        const isRamp = stair.is_ramp || stair.is_wheelchair_accessible;
        const stairW = stair.width || 2.0;

        const targetX = stair.target_x ?? stair.x;
        const targetY = stair.target_y ?? stair.y;
        const dx = targetX - stair.x;
        const dy = targetY - stair.y;
        const runDist = Math.max(3.0, Math.hypot(dx, dy));

        if (isRamp) {
          // Render Ramp: Smooth inclined surface with safety curbs and dual-height railings
          const rampLength = runDist;
          const rampGeo = new THREE.BoxGeometry(stairW, 0.18, rampLength);
          const rampMesh = new THREE.Mesh(rampGeo, rampMaterial);
          const midX = (stair.x + targetX) / 2;
          const midY = (stair.y + targetY) / 2;
          const angle = Math.atan2(dy, dx);

          rampMesh.position.set(midX, wallHeight / 2, midY);
          rampMesh.rotation.y = -angle + Math.PI / 2;
          rampMesh.rotation.x = 0.22; // Ramp slope
          rampMesh.userData = { type: 'stair', id: stair.id, floorId: floor.id, data: stair };
          floorGroup.add(rampMesh);
          interactiveMeshesRef.current.set(rampMesh.uuid, { type: 'stair', id: stair.id, floorId: floor.id, data: stair });

          // Ramp Safety Handrails
          const railGeo = new THREE.CylinderGeometry(0.03, 0.03, rampLength, 8);
          const leftRail = new THREE.Mesh(railGeo, railingMaterial);
          leftRail.position.set(-stairW / 2, 0.8, 0);
          leftRail.rotation.x = Math.PI / 2;
          rampMesh.add(leftRail);

          const rightRail = new THREE.Mesh(railGeo, railingMaterial);
          rightRail.position.set(stairW / 2, 0.8, 0);
          rightRail.rotation.x = Math.PI / 2;
          rampMesh.add(rightRail);
        } else {
          // Render Staircase: 14 individual steps with solid treads and side stringers
          const numSteps = 14;
          const stepRise = wallHeight / numSteps;
          const stepRun = runDist / numSteps;

          for (let s = 0; s < numSteps; s++) {
            const stepT = s / numSteps;
            const sx = stair.x + dx * stepT;
            const sy = stair.y + dy * stepT;
            const sz = s * stepRise + stepRise / 2;

            const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(stairW, stepRise, stepRun + 0.05), stairStepMaterial);
            stepMesh.position.set(sx, sz, sy);
            stepMesh.receiveShadow = true;
            stepMesh.castShadow = true;
            stepMesh.userData = { type: 'stair', id: stair.id, floorId: floor.id, data: stair };
            floorGroup.add(stepMesh);
            interactiveMeshesRef.current.set(stepMesh.uuid, { type: 'stair', id: stair.id, floorId: floor.id, data: stair });
          }

          // Brushed Steel Handrails
          const railGeo = new THREE.CylinderGeometry(0.035, 0.035, Math.hypot(runDist, wallHeight), 8);
          const stairRail = new THREE.Mesh(railGeo, railingMaterial);
          stairRail.position.set(stair.x + dx / 2 + stairW / 2 + 0.05, wallHeight / 2 + 0.9, stair.y + dy / 2);
          stairRail.rotation.x = Math.PI / 2 - Math.atan2(wallHeight, runDist);
          floorGroup.add(stairRail);
        }
      });

      // G. Exploded View: Floating 3D Floor Badge on Left Edge
      if (viewMode === 'exploded') {
        const badgeGeo = new THREE.BoxGeometry(7.0, 1.8, 0.15);
        const isSelectedFloor = activeFloorId === floor.id;
        const badgeMat = new THREE.MeshStandardMaterial({
          color: isSelectedFloor ? 0x167d73 : 0xffffff,
          roughness: 0.3,
        });
        const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
        badgeMesh.position.set(-6.5, 1.2, fHeight / 2);
        floorGroup.add(badgeMesh);
      }

      buildingGroup.add(floorGroup);
    });

    scene.add(buildingGroup);
    buildingGroupRef.current = buildingGroup;

    // Center camera target on building midpoint
    const firstFloor = floors[0];
    const bWidth = firstFloor?.width || 80;
    const bHeight = firstFloor?.height || 45;
    const totalElev = viewMode === 'exploded' ? floors.length * explodeSpacing : (floors.length * 3.2);
    cameraTargetRef.current.set(bWidth / 2, totalElev / 2, bHeight / 2);
    updateCameraPosition();
  }, [building, activeFloorId, viewMode, selectedElementId, showExits, updateCameraPosition]);

  // 3. Update 3D Occupant Mannequins and Wheelchair Rigs
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !building) return;

    if (!showOccupants) {
      agentRigsRef.current.forEach((rig) => {
        rig.root.visible = false;
      });
      return;
    }

    const currentAgentIds = new Set<string>();
    const floors = building.floors || [];

    occupants.forEach((occ) => {
      currentAgentIds.add(occ.id);
      let rig = agentRigsRef.current.get(occ.id);

      // Floor Visibility Filter: In 'floor' view mode, only show agents belonging to active floor
      if (viewMode === 'floor' && activeFloorId && occ.floor_id !== activeFloorId) {
        if (rig) rig.root.visible = false;
        return;
      }

      const isExited = occ.evacuation_state === 'exited';
      if (isExited) {
        if (rig) rig.root.visible = false;
        return;
      }

      const isWheelchair = occ.mobility_category === 'wheelchair';
      const isSelected = selectedElementId === occ.id;

      // Create new rig if not existing
      if (!rig) {
        rig = isWheelchair
          ? createWheelchairFigure(occ.id)
          : createAmbulatoryMannequin(occ.id);

        rig.lastX = occ.x;
        rig.lastY = occ.y;
        rig.lastZ = occ.z ?? 0.0;
        rig.root.userData = { type: 'occupant', id: occ.id, floorId: occ.floor_id, data: occ };

        scene.add(rig.root);
        agentRigsRef.current.set(occ.id, rig);

        // Register raycast targets
        rig.root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            interactiveMeshesRef.current.set(child.uuid, { type: 'occupant', id: occ.id, floorId: occ.floor_id, data: occ });
          }
        });
      }

      rig.root.visible = true;

      // Continuous 3D Elevation Calculation (Handles stair traversal smoothly without jumping)
      let targetElevation = occ.z ?? 0.0;
      if (viewMode === 'exploded') {
        targetElevation = getExplodedElevation(targetElevation, floors, explodeSpacing);
      }

      // Smooth Position Interpolation
      const currPos = rig.root.position;
      const targetPos = new THREE.Vector3(occ.x, targetElevation, occ.y);

      // Calculate instantaneous velocity vector for heading and animation
      const dx = targetPos.x - currPos.x;
      const dz = targetPos.z - currPos.z;
      const stepDist = Math.hypot(dx, dz);

      if (stepDist > 0.001) {
        // Smoothly rotate facing direction
        const targetAngle = Math.atan2(dx, dz);
        rig.root.rotation.y = THREE.MathUtils.lerp(rig.root.rotation.y, targetAngle, 0.25);
        rig.currentSpeed = occ.movement_speed || (stepDist / 0.1);
      } else {
        rig.currentSpeed = 0;
      }

      currPos.lerp(targetPos, 0.45);

      // Material updates (selected highlight or trapped red)
      updateAgentMaterials(rig, occ, isSelected);
    });

    // Cleanup exited or removed agents
    agentRigsRef.current.forEach((rig, id) => {
      if (!currentAgentIds.has(id)) {
        scene.remove(rig.root);
        agentRigsRef.current.delete(id);
      }
    });
  }, [occupants, showOccupants, viewMode, activeFloorId, building, selectedElementId, getExplodedElevation]);

  // 4. Update 3D Flowing Evacuation Route Spline Tubes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !building) return;

    if (routeLineGroupRef.current) {
      scene.remove(routeLineGroupRef.current);
      routeLineGroupRef.current = null;
    }

    if (!showRoutes || !graph || occupants.length === 0) return;

    const routeGroup = new THREE.Group();
    routeGroup.userData = { isBuildingComponent: true };
    const floors = building.floors || [];

    // Render routes for selected agent, or sample active evacuees
    const targetAgents = selectedElementId && occupants.some((o) => o.id === selectedElementId)
      ? occupants.filter((o) => o.id === selectedElementId)
      : occupants
          .filter((o) => o.evacuation_state === 'evacuating' && o.current_path && o.current_path.length > 1)
          .slice(0, 16);

    targetAgents.forEach((occ) => {
      const points: THREE.Vector3[] = [];

      let startZ = occ.z ?? 0.0;
      if (viewMode === 'exploded') {
        startZ = getExplodedElevation(startZ, floors, explodeSpacing);
      }
      points.push(new THREE.Vector3(occ.x, startZ + 0.35, occ.y));

      for (let pIdx = occ.path_index; pIdx < occ.current_path.length; pIdx++) {
        const nid = occ.current_path[pIdx];
        const node = graph.nodes[nid];
        if (node) {
          let nz = node.z ?? 0.0;
          if (viewMode === 'exploded') {
            nz = getExplodedElevation(nz, floors, explodeSpacing);
          }
          points.push(new THREE.Vector3(node.x, nz + 0.35, node.y));
        }
      }

      if (points.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(points);
        const isSelectedOcc = occ.id === selectedElementId;
        const tubeGeo = new THREE.TubeGeometry(curve, points.length * 4, isSelectedOcc ? 0.20 : 0.12, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: isSelectedOcc ? 0x0284c7 : 0x167d73,
          transparent: true,
          opacity: isSelectedOcc ? 0.95 : 0.75,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        routeGroup.add(tubeMesh);
      }
    });

    scene.add(routeGroup);
    routeLineGroupRef.current = routeGroup;
  }, [occupants, graph, showRoutes, viewMode, building, selectedElementId, getExplodedElevation]);

  // 5. Update Realistic Restrained Hazards (Fire & Volumetric Smoke)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !building) return;

    if (hazardGroupRef.current) {
      scene.remove(hazardGroupRef.current);
      hazardGroupRef.current = null;
    }
    flameMeshesRef.current = [];

    if (!showHazards || hazards.length === 0) return;

    const hazardGroup = new THREE.Group();
    hazardGroup.userData = { isBuildingComponent: true };
    const floors = building.floors || [];

    hazards.forEach((h) => {
      let hz = 0.0;
      const floorIdx = floors.findIndex((f) => f.id === h.floor_id);
      if (floorIdx >= 0) {
        const fl = floors[floorIdx];
        hz = fl.elevation ?? floorIdx * 3.2;
        if (viewMode === 'exploded') hz += floorIdx * explodeSpacing;
      }

      // A. Ground Ember Base Ring
      const ringGeo = new THREE.RingGeometry(0.8, 1.4, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x7c2d12, side: THREE.DoubleSide });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(h.x, hz + 0.04, h.y);
      hazardGroup.add(ringMesh);

      // B. Localized Animated Fire Cones (Flickering flames)
      for (let i = 0; i < 3; i++) {
        const flameGeo = new THREE.ConeGeometry(0.6 + i * 0.2, 1.8 + i * 0.3, 8);
        const flameMat = new THREE.MeshStandardMaterial({
          color: i === 0 ? 0xf97316 : 0xef4444,
          emissive: 0xd97706,
          emissiveIntensity: 0.9,
          transparent: true,
          opacity: 0.85,
        });
        const flameMesh = new THREE.Mesh(flameGeo, flameMat);
        flameMesh.position.set(h.x + (i - 1) * 0.4, hz + 0.9, h.y + (i % 2 === 0 ? 0.3 : -0.3));
        hazardGroup.add(flameMesh);
        flameMeshesRef.current.push(flameMesh);
      }

      // C. Restrained Floor Perimeter Hazard Boundary
      const currentRadius = Math.max(2.0, ((h as any).current_radius ?? h.max_radius ?? 4.0));
      const boundaryGeo = new THREE.RingGeometry(currentRadius - 0.15, currentRadius, 32);
      const boundaryMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      });
      const boundaryMesh = new THREE.Mesh(boundaryGeo, boundaryMat);
      boundaryMesh.rotation.x = -Math.PI / 2;
      boundaryMesh.position.set(h.x, hz + 0.06, h.y);
      hazardGroup.add(boundaryMesh);

      // D. Layered Stratified Smoke Plumes (Elevated near ceiling, semi-transparent)
      const smokeGeo = new THREE.SphereGeometry(currentRadius * 0.7, 12, 10);
      smokeGeo.scale(1.2, 0.45, 1.2); // Flattened puff
      const smokeMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.28,
        roughness: 0.9,
      });
      const smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
      smokeMesh.position.set(h.x, hz + 2.4, h.y);
      hazardGroup.add(smokeMesh);
    });

    scene.add(hazardGroup);
    hazardGroupRef.current = hazardGroup;
  }, [hazards, showHazards, viewMode, building]);

  // 6. Camera Orbit, Pan & Element Raycasting Controls
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (e.button === 1 || e.shiftKey) {
      dragModeRef.current = 'pan';
    } else {
      dragModeRef.current = 'orbit';
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - prevMousePosRef.current.x;
      const dy = e.clientY - prevMousePosRef.current.y;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (dragModeRef.current === 'orbit') {
        cameraThetaRef.current -= dx * 0.007;
        cameraPhiRef.current -= dy * 0.007;
        updateCameraPosition();
      } else if (dragModeRef.current === 'pan') {
        const panFactor = cameraRadiusRef.current * 0.0012;
        const camera = cameraRef.current;
        if (camera) {
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
          cameraTargetRef.current.addScaledVector(right, -dx * panFactor);
          cameraTargetRef.current.addScaledVector(up, dy * panFactor);
          updateCameraPosition();
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;

    // Raycast selection on click
    const canvas = canvasRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!canvas || !camera || !scene || !onSelectElement) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
      for (const hit of intersects) {
        const meta = interactiveMeshesRef.current.get(hit.object.uuid);
        if (meta) {
          if (onSelectFloor && meta.floorId) {
            onSelectFloor(meta.floorId);
          }
          onSelectElement({
            type: meta.type,
            id: meta.id,
            floorId: meta.floorId,
            data: meta.data,
          });
          return;
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraRadiusRef.current = Math.max(15, Math.min(220, cameraRadiusRef.current * zoomFactor));
    updateCameraPosition();
  };

  const handlePresetView = (type: 'iso' | 'top' | 'front') => {
    if (type === 'iso') {
      cameraThetaRef.current = Math.PI * 0.28;
      cameraPhiRef.current = Math.PI * 0.32;
    } else if (type === 'top') {
      cameraThetaRef.current = 0;
      cameraPhiRef.current = 0.05;
    } else if (type === 'front') {
      cameraThetaRef.current = 0;
      cameraPhiRef.current = Math.PI * 0.48;
    }
    updateCameraPosition();
  };

  const handleFitToFrame = () => {
    const floors = building?.floors || [];
    const f = floors[0];
    const bw = f?.width || 80;
    const bh = f?.height || 45;
    const totalH = viewMode === 'exploded' ? floors.length * explodeSpacing : floors.length * 3.2;
    cameraTargetRef.current.set(bw / 2, totalH / 2, bh / 2);
    cameraRadiusRef.current = 95;
    cameraThetaRef.current = Math.PI * 0.28;
    cameraPhiRef.current = Math.PI * 0.32;
    updateCameraPosition();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[500px] bg-[#FAFAF8] overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Floating Top Viewport Controls - Clean, Non-Overlapping Layout */}
      <div className="absolute top-4 left-44 right-4 flex items-center justify-between pointer-events-none z-20">
        {/* Center: 3D View Modes (Full Building / Exploded / Floor Only) */}
        {onChangeViewMode && (
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-lg border border-[#E5E7EB] shadow-xs pointer-events-auto">
            <button
              onClick={() => onChangeViewMode('full')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'full'
                  ? 'bg-[#167D73] text-white shadow-xs font-semibold'
                  : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
              }`}
            >
              Full Building
            </button>
            <button
              onClick={() => onChangeViewMode('exploded')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'exploded'
                  ? 'bg-[#167D73] text-white shadow-xs font-semibold'
                  : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
              }`}
            >
              Exploded View
            </button>
            <button
              onClick={() => onChangeViewMode('floor')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                viewMode === 'floor'
                  ? 'bg-[#167D73] text-white shadow-xs font-semibold'
                  : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
              }`}
            >
              Single Floor
            </button>
          </div>
        )}

        {/* Right: Camera Presets & Tools */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Tool switchers */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-lg border border-[#E5E7EB] shadow-xs">
            <button
              onClick={() => handlePresetView('iso')}
              title="Isometric 3D View"
              className="px-2 py-1 text-xs text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded"
            >
              Iso
            </button>
            <button
              onClick={() => handlePresetView('top')}
              title="Top-Down Plan View"
              className="px-2 py-1 text-xs text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded"
            >
              Top
            </button>
            <button
              onClick={() => handlePresetView('front')}
              title="Front Elevation View"
              className="px-2 py-1 text-xs text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded"
            >
              Front
            </button>
            <div className="w-[1px] h-4 bg-[#E5E7EB] mx-1" />
            <button
              onClick={handleFitToFrame}
              title="Fit Building to Screen"
              className="p-1.5 text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Follow Occupant Mode Indicator */}
          {followOccupantId && (
            <div className="flex items-center gap-1.5 bg-[#E6F4F2] border border-[#167D73]/30 text-[#167D73] px-2.5 py-1 rounded-lg text-xs font-medium shadow-xs">
              <User className="w-3.5 h-3.5" />
              <span>Tracking: {followOccupantId}</span>
              {onToggleFollowOccupant && (
                <button
                  onClick={() => onToggleFollowOccupant(null)}
                  className="ml-1 text-[#647078] hover:text-[#242A30] text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Left: 3D Scene Status Badge */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-xs text-[#647078] shadow-xs">
        <Activity className="w-3.5 h-3.5 text-[#167D73]" />
        <span className="font-semibold text-[#242A30]">{building?.name || 'Multi-Floor Complex'}</span>
        <span>•</span>
        <span>{occupants.filter((o) => o.evacuation_state === 'evacuating').length} Active Evacuees</span>
        <span>•</span>
        <span>{building?.floors.length || 1} Floors</span>
      </div>
    </div>
  );
};
