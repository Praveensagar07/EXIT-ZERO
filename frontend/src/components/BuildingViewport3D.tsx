import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type {
  Building,
  Occupant,
  HazardSource,
  NavigationGraphModel,
} from '../types/simulation';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  Move,
  MousePointer,
  Rotate3d,
} from 'lucide-react';

export type ViewMode3D = 'full' | 'exploded' | 'floor';

interface BuildingViewport3DProps {
  building: Building | null;
  activeFloorId?: string;
  onSelectFloor?: (floorId: string) => void;
  viewMode: ViewMode3D;
  onChangeViewMode: (mode: ViewMode3D) => void;
  // Simulation overlays
  occupants?: Occupant[];
  hazards?: HazardSource[];
  graph?: NavigationGraphModel;
  selectedElementId?: string | null;
  onSelectElement?: (element: {
    type: 'room' | 'corridor' | 'exit' | 'stair' | 'occupant';
    id: string;
    floorId: string;
    data: any;
  } | null) => void;
  // Layer visibility
  showOccupants?: boolean;
  showRoutes?: boolean;
  showHazards?: boolean;
  showExits?: boolean;
  showRoomLabels?: boolean;
  isStudioMode?: boolean;
  // Grid snap settings for Studio
  gridSnap?: boolean;
  snapToWalls?: boolean;
  gridSize?: number;
}

export const BuildingViewport3D: React.FC<BuildingViewport3DProps> = ({
  building,
  activeFloorId,
  viewMode,
  onChangeViewMode,
  occupants = [],
  hazards = [],
  graph,
  selectedElementId,
  onSelectElement,
  showOccupants = true,
  showRoutes = true,
  showHazards = true,
  showExits = true,
  isStudioMode = false,
  gridSnap = true,
  snapToWalls = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Interactive controls state
  const isDraggingRef = useRef<boolean>(false);
  const dragModeRef = useRef<'orbit' | 'pan'>('orbit');
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(40, 0, 22.5));
  const cameraRadiusRef = useRef<number>(95);
  const cameraThetaRef = useRef<number>(Math.PI * 0.28); // Horizontal azimuth
  const cameraPhiRef = useRef<number>(Math.PI * 0.32);   // Vertical elevation

  // Active tool
  const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'orbit'>('select');

  // Meshes & Raycasting
  const interactiveMeshesRef = useRef<Map<string, { type: any; id: string; floorId: string; data: any }>>(new Map());
  const agentMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const routeLineGroupRef = useRef<THREE.Group | null>(null);
  const hazardGroupRef = useRef<THREE.Group | null>(null);

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const radius = cameraRadiusRef.current;
    const theta = cameraThetaRef.current;
    const phi = cameraPhiRef.current;
    const target = cameraTargetRef.current;

    const x = target.x + radius * Math.sin(phi) * Math.cos(theta);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * Math.sin(phi) * Math.sin(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(target);
  }, []);

  // 1. Initialize Scene & Three.js Canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    // Scene with clean light architectural background #FAFAF8
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#FAFAF8');
    sceneRef.current = scene;

    // Perspective Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 1000);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    // Architectural Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.82);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbf0, 1.15);
    sunLight.position.set(60, 110, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe5e7eb, 0.55);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    // Subtle fill light for shadows
    const fillLight = new THREE.DirectionalLight(0xecfdf5, 0.35);
    fillLight.position.set(-50, 40, -40);
    scene.add(fillLight);

    // Initial camera position
    updateCameraPosition();

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
    };
  }, [updateCameraPosition]);

  // 2. Rebuild 3D Architectural Building Geometry
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !building) return;

    // Clear previous building objects
    const objectsToRemove: THREE.Object3D[] = [];
    scene.children.forEach((child) => {
      if (child.userData?.isBuildingComponent) {
        objectsToRemove.push(child);
      }
    });
    objectsToRemove.forEach((obj) => scene.remove(obj));
    interactiveMeshesRef.current.clear();

    const floors = building.floors || [];
    if (floors.length === 0) return;

    // Materials - Crisp architectural engineering palette
    const slabMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f1ee,
      roughness: 0.65,
      metalness: 0.05,
    });
    const slabEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0xd1d5db,
      transparent: true,
      opacity: 0.8,
    });
    const exteriorWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.02,
    });
    const interiorWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf9fafb,
      roughness: 0.55,
      metalness: 0.02,
    });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdcfce7,
      transmission: 0.75,
      opacity: 0.35,
      transparent: true,
      roughness: 0.1,
      ior: 1.5,
    });
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: 0x167d73,
      roughness: 0.4,
      metalness: 0.1,
    });
    const stairStepMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.5,
    });

    // Ground plane grid
    const groundGrid = new THREE.GridHelper(120, 60, 0x167d73, 0xe5e7eb);
    groundGrid.position.set(40, -0.05, 22.5);
    groundGrid.userData = { isBuildingComponent: true };
    scene.add(groundGrid);

    // Calculate vertical floor offsets based on view mode
    const explodeSpacing = 8.5; // Meters of separation in exploded view
    const buildingGroup = new THREE.Group();
    buildingGroup.userData = { isBuildingComponent: true };

    floors.forEach((floor, floorIndex) => {
      const isFloorActive = !activeFloorId || floor.id === activeFloorId;

      // Base elevation
      let floorY = (floor.elevation ?? floorIndex * 3.2);
      if (viewMode === 'exploded') {
        floorY += floorIndex * explodeSpacing;
      } else if (viewMode === 'floor' && !isFloorActive) {
        // In floor isolation, hide other floors
        return;
      }

      const floorGroup = new THREE.Group();
      floorGroup.position.set(0, floorY, 0);
      floorGroup.userData = { isBuildingComponent: true, floorId: floor.id };

      const fWidth = floor.width || 80.0;
      const fHeight = floor.height || 45.0;
      const wallHeight = floor.floor_height ? floor.floor_height - 0.3 : 2.9;

      // 1. Floor Slab (Solid architectural slab with thickness)
      const slabThickness = 0.35;
      const slabGeo = new THREE.BoxGeometry(fWidth, slabThickness, fHeight);
      const slabMesh = new THREE.Mesh(slabGeo, slabMaterial);
      slabMesh.position.set(fWidth / 2, -slabThickness / 2, fHeight / 2);
      slabMesh.receiveShadow = true;
      slabMesh.castShadow = true;
      floorGroup.add(slabMesh);

      // Floor slab outline edges
      const slabEdges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), slabEdgeMaterial);
      slabEdges.position.copy(slabMesh.position);
      floorGroup.add(slabEdges);

      // 2. Exterior Low Perimeter & Windows
      const extWallThickness = 0.35;
      // North Wall
      const northWall = new THREE.Mesh(new THREE.BoxGeometry(fWidth, wallHeight, extWallThickness), exteriorWallMaterial);
      northWall.position.set(fWidth / 2, wallHeight / 2, extWallThickness / 2);
      northWall.receiveShadow = true;
      floorGroup.add(northWall);

      // South Wall
      const southWall = new THREE.Mesh(new THREE.BoxGeometry(fWidth, wallHeight, extWallThickness), exteriorWallMaterial);
      southWall.position.set(fWidth / 2, wallHeight / 2, fHeight - extWallThickness / 2);
      southWall.receiveShadow = true;
      floorGroup.add(southWall);

      // West Wall
      const westWall = new THREE.Mesh(new THREE.BoxGeometry(extWallThickness, wallHeight, fHeight), exteriorWallMaterial);
      westWall.position.set(extWallThickness / 2, wallHeight / 2, fHeight / 2);
      westWall.receiveShadow = true;
      floorGroup.add(westWall);

      // East Wall
      const eastWall = new THREE.Mesh(new THREE.BoxGeometry(extWallThickness, wallHeight, fHeight), exteriorWallMaterial);
      eastWall.position.set(fWidth - extWallThickness / 2, wallHeight / 2, fHeight / 2);
      eastWall.receiveShadow = true;
      floorGroup.add(eastWall);

      // 3. Interior Rooms & Partitions
      (floor.rooms || []).forEach((room) => {
        const rx = room.bounds.x;
        const ry = room.bounds.y;
        const rw = room.bounds.width;
        const rh = room.bounds.height;
        const isSelected = selectedElementId === room.id;

        // Room interactive bounding volume
        const roomBoxGeo = new THREE.BoxGeometry(rw - 0.2, wallHeight, rh - 0.2);
        const roomBoxMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x167d73 : (room.room_type === 'office' ? 0xf8fafc : 0xf1f5f9),
          transparent: true,
          opacity: isSelected ? 0.45 : 0.08,
          roughness: 0.3,
        });
        const roomMesh = new THREE.Mesh(roomBoxGeo, roomBoxMat);
        roomMesh.position.set(rx + rw / 2, wallHeight / 2, ry + rh / 2);
        roomMesh.userData = { type: 'room', id: room.id, floorId: floor.id, data: room };
        floorGroup.add(roomMesh);
        interactiveMeshesRef.current.set(roomMesh.uuid, { type: 'room', id: room.id, floorId: floor.id, data: room });

        // Room perimeter walls
        const wallThick = 0.22;
        // North wall
        const rNorth = new THREE.Mesh(new THREE.BoxGeometry(rw, wallHeight, wallThick), interiorWallMaterial);
        rNorth.position.set(rx + rw / 2, wallHeight / 2, ry);
        rNorth.receiveShadow = true;
        floorGroup.add(rNorth);

        // South wall
        const rSouth = new THREE.Mesh(new THREE.BoxGeometry(rw, wallHeight, wallThick), interiorWallMaterial);
        rSouth.position.set(rx + rw / 2, wallHeight / 2, ry + rh);
        rSouth.receiveShadow = true;
        floorGroup.add(rSouth);

        // West wall
        const rWest = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, rh), interiorWallMaterial);
        rWest.position.set(rx, wallHeight / 2, ry + rh / 2);
        rWest.receiveShadow = true;
        floorGroup.add(rWest);

        // East wall
        const rEast = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, rh), interiorWallMaterial);
        rEast.position.set(rx + rw, wallHeight / 2, ry + rh / 2);
        rEast.receiveShadow = true;
        floorGroup.add(rEast);

        // Glass corridor partition along inner corridor edge
        const glassRailing = new THREE.Mesh(new THREE.BoxGeometry(rw, 1.1, 0.08), glassMaterial);
        glassRailing.position.set(rx + rw / 2, 0.55, ry < fHeight / 2 ? ry + rh + 0.15 : ry - 0.15);
        floorGroup.add(glassRailing);
      });

      // 4. Doors
      (floor.doorways || []).forEach((door) => {
        const doorGeo = new THREE.BoxGeometry(door.width || 1.2, wallHeight * 0.85, 0.35);
        const doorMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.6,
        });
        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
        doorMesh.position.set(door.x, (wallHeight * 0.85) / 2, door.y);
        floorGroup.add(doorMesh);
      });

      // 5. Exits (Illuminated 3D Green Exit Sign)
      if (showExits) {
        (floor.exits || []).forEach((exit) => {
          const exitGeo = new THREE.BoxGeometry(exit.width || 2.0, 2.4, 0.4);
          const exitMat = new THREE.MeshStandardMaterial({
            color: exit.is_blocked ? 0xef4444 : 0x10b981,
            emissive: exit.is_blocked ? 0x991b1b : 0x059669,
            emissiveIntensity: 0.4,
            roughness: 0.2,
          });
          const exitMesh = new THREE.Mesh(exitGeo, exitMat);
          exitMesh.position.set(exit.x, 1.2, exit.y);
          exitMesh.userData = { type: 'exit', id: exit.id, floorId: floor.id, data: exit };
          floorGroup.add(exitMesh);
          interactiveMeshesRef.current.set(exitMesh.uuid, { type: 'exit', id: exit.id, floorId: floor.id, data: exit });
        });
      }

      // 6. Staircases & Ramps
      (floor.stairwells || []).forEach((stair) => {
        const isRamp = stair.is_ramp || stair.is_wheelchair_accessible;

        if (isRamp) {
          // Render Ramp: Smooth inclined plane with teal accent
          const rampLength = 8.0;
          const rampWidth = stair.width || 2.4;
          const rampGeo = new THREE.BoxGeometry(rampWidth, 0.2, rampLength);
          const rampMesh = new THREE.Mesh(rampGeo, rampMaterial);
          rampMesh.position.set(stair.x, 1.5, stair.y);
          rampMesh.rotation.x = 0.25; // Gentle slope
          rampMesh.userData = { type: 'stair', id: stair.id, floorId: floor.id, data: stair };
          floorGroup.add(rampMesh);
          interactiveMeshesRef.current.set(rampMesh.uuid, { type: 'stair', id: stair.id, floorId: floor.id, data: stair });
        } else {
          // Render Staircase: 12 stepped tiers
          const numSteps = 10;
          const stepW = stair.width || 1.8;
          const stepD = 0.35;
          const stepH = 3.0 / numSteps;

          for (let s = 0; s < numSteps; s++) {
            const stepGeo = new THREE.BoxGeometry(stepW, stepH, stepD);
            const stepMesh = new THREE.Mesh(stepGeo, stairStepMaterial);
            stepMesh.position.set(stair.x, s * stepH + stepH / 2, stair.y + s * stepD);
            stepMesh.receiveShadow = true;
            floorGroup.add(stepMesh);
          }
        }
      });

      // 7. Exploded View: Floating 3D Floor Badge on Left
      if (viewMode === 'exploded') {
        const badgeGeo = new THREE.BoxGeometry(6.0, 1.8, 0.2);
        const isSelectedFloor = activeFloorId === floor.id;
        const badgeMat = new THREE.MeshBasicMaterial({
          color: isSelectedFloor ? 0x167d73 : 0xffffff,
        });
        const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
        badgeMesh.position.set(-6.0, 1.0, fHeight / 2);
        floorGroup.add(badgeMesh);
      }

      buildingGroup.add(floorGroup);
    });

    scene.add(buildingGroup);

    // Center camera target on building midpoint
    const firstFloor = floors[0];
    const bWidth = firstFloor?.width || 80;
    const bHeight = firstFloor?.height || 45;
    const totalElev = viewMode === 'exploded' ? floors.length * explodeSpacing : (floors.length * 3.2);
    cameraTargetRef.current.set(bWidth / 2, totalElev / 2, bHeight / 2);
    updateCameraPosition();
  }, [building, activeFloorId, viewMode, selectedElementId, showExits, updateCameraPosition]);

  // 3. Update 3D Occupant Agents
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !showOccupants) return;

    // Create or update agent meshes
    const currentAgentIds = new Set<string>();

    occupants.forEach((occ) => {
      currentAgentIds.add(occ.id);
      let mesh = agentMeshesRef.current.get(occ.id);

      // Floor elevation offset
      let agentZ = occ.z ?? 0.0;
      if (viewMode === 'exploded' && building) {
        const floorIdx = building.floors.findIndex((f) => f.id === occ.floor_id);
        if (floorIdx >= 0) agentZ += floorIdx * 8.5;
      }

      const isWheelchair = occ.mobility_category === 'wheelchair';
      const isTrapped = occ.evacuation_state === 'trapped';
      const isExited = occ.evacuation_state === 'exited';

      if (isExited) {
        if (mesh) {
          mesh.visible = false;
        }
        return;
      }

      if (!mesh) {
        const agentGeo = isWheelchair
          ? new THREE.BoxGeometry(0.8, 0.8, 0.8)
          : new THREE.CylinderGeometry(0.3, 0.3, 1.5, 8);

        const agentMat = new THREE.MeshStandardMaterial({
          color: isTrapped ? 0xef4444 : (isWheelchair ? 0x0284c7 : 0x167d73),
          roughness: 0.3,
          metalness: 0.2,
        });

        mesh = new THREE.Mesh(agentGeo, agentMat);
        mesh.castShadow = true;
        mesh.userData = { type: 'occupant', id: occ.id, floorId: occ.floor_id, data: occ, isAgent: true };
        scene.add(mesh);
        agentMeshesRef.current.set(occ.id, mesh);
        interactiveMeshesRef.current.set(mesh.uuid, { type: 'occupant', id: occ.id, floorId: occ.floor_id, data: occ });
      }

      // Smooth position update
      mesh.visible = true;
      mesh.position.set(occ.x, agentZ + (isWheelchair ? 0.4 : 0.75), occ.y);
    });

    // Cleanup agents who exited or removed
    agentMeshesRef.current.forEach((mesh, id) => {
      if (!currentAgentIds.has(id)) {
        scene.remove(mesh);
        agentMeshesRef.current.delete(id);
      }
    });
  }, [occupants, showOccupants, viewMode, building]);

  // 4. Update 3D Flowing Evacuation Route Polylines
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (routeLineGroupRef.current) {
      scene.remove(routeLineGroupRef.current);
      routeLineGroupRef.current = null;
    }

    if (!showRoutes || !graph || occupants.length === 0) return;

    const routeGroup = new THREE.Group();
    routeGroup.userData = { isBuildingComponent: true };

    // Find sample active occupants with distinct paths
    const sampledOccupants = occupants
      .filter((o) => o.evacuation_state === 'evacuating' && o.current_path && o.current_path.length > 1)
      .slice(0, 16);

    sampledOccupants.forEach((occ) => {
      const points: THREE.Vector3[] = [];
      // Start at occupant current 3D position
      let startZ = occ.z ?? 0.0;
      if (viewMode === 'exploded' && building) {
        const floorIdx = building.floors.findIndex((f) => f.id === occ.floor_id);
        if (floorIdx >= 0) startZ += floorIdx * 8.5;
      }
      points.push(new THREE.Vector3(occ.x, startZ + 0.3, occ.y));

      for (let pIdx = occ.path_index; pIdx < occ.current_path.length; pIdx++) {
        const nid = occ.current_path[pIdx];
        const node = graph.nodes[nid];
        if (node) {
          let nz = node.z ?? 0.0;
          if (viewMode === 'exploded' && building) {
            const fIdx = building.floors.findIndex((f) => f.id === node.floor_id);
            if (fIdx >= 0) nz += fIdx * 8.5;
          }
          points.push(new THREE.Vector3(node.x, nz + 0.3, node.y));
        }
      }

      if (points.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, points.length * 4, 0.12, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: 0x167d73,
          transparent: true,
          opacity: 0.85,
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        routeGroup.add(tubeMesh);
      }
    });

    scene.add(routeGroup);
    routeLineGroupRef.current = routeGroup;
  }, [occupants, graph, showRoutes, viewMode, building]);

  // 5. Update 3D Hazards (Fire/Smoke Clusters)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (hazardGroupRef.current) {
      scene.remove(hazardGroupRef.current);
      hazardGroupRef.current = null;
    }

    if (!showHazards || hazards.length === 0) return;

    const hazardGroup = new THREE.Group();
    hazardGroup.userData = { isBuildingComponent: true };

    hazards.forEach((h) => {
      let hz = 0.0;
      if (viewMode === 'exploded' && building) {
        const floorIdx = building.floors.findIndex((f) => f.id === h.floor_id);
        if (floorIdx >= 0) hz += floorIdx * 8.5;
      }

      // Fire flame cluster
      const fireGeo = new THREE.SphereGeometry(h.max_radius * 0.35, 16, 16);
      const fireMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xef4444,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.65,
      });
      const fireMesh = new THREE.Mesh(fireGeo, fireMat);
      fireMesh.position.set(h.x, hz + 1.5, h.y);
      hazardGroup.add(fireMesh);

      // Warning sign floating above
      const markerGeo = new THREE.OctahedronGeometry(1.2);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.set(h.x, hz + 4.5, h.y);
      hazardGroup.add(markerMesh);
    });

    scene.add(hazardGroup);
    hazardGroupRef.current = hazardGroup;
  }, [hazards, showHazards, viewMode, building]);

  // 6. Pointer & Raycasting Interactions
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    if (activeTool === 'pan' || e.button === 1 || e.shiftKey) {
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
        cameraThetaRef.current -= dx * 0.008;
        cameraPhiRef.current = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraPhiRef.current - dy * 0.008));
        updateCameraPosition();
      } else if (dragModeRef.current === 'pan') {
        const panSpeed = cameraRadiusRef.current * 0.0012;
        const forward = new THREE.Vector3();
        cameraRef.current?.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3(0, 1, 0);

        cameraTargetRef.current.addScaledVector(right, -dx * panSpeed);
        cameraTargetRef.current.addScaledVector(up, dy * panSpeed);
        updateCameraPosition();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;

    // Check if click was a selection
    if (activeTool === 'select' && canvasRef.current && cameraRef.current && sceneRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const interactiveObjects: THREE.Object3D[] = [];
      sceneRef.current.traverse((child) => {
        if (child.userData?.type) {
          interactiveObjects.push(child);
        }
      });

      const intersects = raycaster.intersectObjects(interactiveObjects, false);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const meta = hit.userData;
        if (onSelectElement) {
          onSelectElement({
            type: meta.type,
            id: meta.id,
            floorId: meta.floorId,
            data: meta.data,
          });
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraRadiusRef.current = Math.max(20, Math.min(220, cameraRadiusRef.current * zoomFactor));
    updateCameraPosition();
  };

  // Preset Views
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
    const totalH = viewMode === 'exploded' ? floors.length * 8.5 : floors.length * 3.2;
    cameraTargetRef.current.set(bw / 2, totalH / 2, bh / 2);
    cameraRadiusRef.current = 95;
    cameraThetaRef.current = Math.PI * 0.28;
    cameraPhiRef.current = Math.PI * 0.32;
    updateCameraPosition();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[500px] bg-[#FAFAF8] overflow-hidden select-none">
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Floating Top Viewport Controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        {/* Left: View Mode Switches */}
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-2 py-1.5 rounded-lg border border-[#E5E7EB] shadow-sm pointer-events-auto">
          <button
            onClick={() => onChangeViewMode('full')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === 'full'
                ? 'bg-[#167D73] text-white shadow-sm'
                : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
            }`}
          >
            Full Building
          </button>
          <button
            onClick={() => onChangeViewMode('exploded')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === 'exploded'
                ? 'bg-[#167D73] text-white shadow-sm'
                : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
            }`}
          >
            Exploded View
          </button>
          <button
            onClick={() => onChangeViewMode('floor')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === 'floor'
                ? 'bg-[#167D73] text-white shadow-sm'
                : 'text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]'
            }`}
          >
            Single Floor
          </button>
        </div>

        {/* Center/Right: Viewport Navigation Toolbar */}
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-lg border border-[#E5E7EB] shadow-sm pointer-events-auto">
          <button
            onClick={() => setActiveTool('select')}
            title="Selection Tool"
            className={`p-1.5 rounded ${activeTool === 'select' ? 'bg-[#E6F4F2] text-[#167D73]' : 'text-[#647078] hover:text-[#242A30]'}`}
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('pan')}
            title="Pan View"
            className={`p-1.5 rounded ${activeTool === 'pan' ? 'bg-[#E6F4F2] text-[#167D73]' : 'text-[#647078] hover:text-[#242A30]'}`}
          >
            <Move className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('orbit')}
            title="Orbit Camera"
            className={`p-1.5 rounded ${activeTool === 'orbit' ? 'bg-[#E6F4F2] text-[#167D73]' : 'text-[#647078] hover:text-[#242A30]'}`}
          >
            <Rotate3d className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-[#E5E7EB] mx-1" />
          <button
            onClick={() => {
              cameraRadiusRef.current = Math.max(20, cameraRadiusRef.current * 0.85);
              updateCameraPosition();
            }}
            title="Zoom In"
            className="p-1.5 rounded text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              cameraRadiusRef.current = Math.min(220, cameraRadiusRef.current * 1.15);
              updateCameraPosition();
            }}
            title="Zoom Out"
            className="p-1.5 rounded text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitToFrame}
            title="Fit to Frame"
            className="p-1.5 rounded text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6]"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Bottom Studio Controls (Grid Snap & Orientation) */}
      {isStudioMode && (
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#E5E7EB] shadow-sm pointer-events-auto text-xs text-[#242A30]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={gridSnap} readOnly className="rounded text-[#167D73] focus:ring-[#167D73]" />
              <span className="font-medium">Grid Snap</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={snapToWalls} readOnly className="rounded text-[#167D73] focus:ring-[#167D73]" />
              <span className="font-medium">Snap to Walls</span>
            </label>
            <div className="w-[1px] h-3.5 bg-[#E5E7EB]" />
            <span className="text-[#647078]">Grid: <strong className="text-[#242A30]">0.50 m</strong></span>
          </div>

          {/* Quick Perspective Views */}
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-lg border border-[#E5E7EB] shadow-sm pointer-events-auto">
            <button
              onClick={() => handlePresetView('iso')}
              className="px-2.5 py-1 text-xs font-medium text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded"
            >
              Isometric
            </button>
            <button
              onClick={() => handlePresetView('top')}
              className="px-2.5 py-1 text-xs font-medium text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded"
            >
              Top
            </button>
            <button
              onClick={() => handlePresetView('front')}
              className="px-2.5 py-1 text-xs font-medium text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded"
            >
              Front
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
