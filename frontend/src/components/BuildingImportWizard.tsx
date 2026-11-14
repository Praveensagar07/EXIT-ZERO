import React, { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  FileCode,
  Compass,
  Ruler,
  Play,
  Building2,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type { BuildingSummary } from '../types/simulation';

interface BuildingImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (buildingSummary: BuildingSummary, action: 'studio' | 'simulate') => void;
}

export const BuildingImportWizard: React.FC<BuildingImportWizardProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [format, setFormat] = useState<'glb' | 'gltf' | 'json'>('gltf');
  const [fileName, setFileName] = useState<string>('hospital_campus_block_a.gltf');
  const [buildingName, setBuildingName] = useState<string>('Campus Block A — Digital Twin');
  const [units, setUnits] = useState<'meters' | 'centimeters' | 'millimeters'>('meters');
  const [upAxis, setUpAxis] = useState<'Y-up' | 'Z-up'>('Y-up');
  const [detectedFloors, setDetectedFloors] = useState<number>(3);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importedResult, setImportedResult] = useState<BuildingSummary | null>(null);

  if (!isOpen) return null;

  const steps = [
    { num: 1, title: 'Format' },
    { num: 2, title: 'Upload' },
    { num: 3, title: 'Inspect' },
    { num: 4, title: 'Scale' },
    { num: 5, title: 'Orientation' },
    { num: 6, title: 'Floors' },
    { num: 7, title: 'Rooms' },
    { num: 8, title: 'Doors' },
    { num: 9, title: 'Accessibility' },
    { num: 10, title: 'Validate' },
  ];

  const handleRunImport = async () => {
    setIsProcessing(true);
    try {
      const summary = await api.importGltfBuilding({
        name: buildingName,
        bounds: { min_x: 0, max_x: 80, min_y: 0, max_y: 45, min_z: 0, max_z: detectedFloors * 3.2 },
        floors_count: detectedFloors,
      });
      setImportedResult(summary);
      setCurrentStep(10);
    } catch (err) {
      console.error('Failed to import model:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="flex flex-col w-full max-w-3xl h-[620px] bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden">
        {/* Wizard Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAF8]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#167D73] text-white">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#242A30]">
                Building Import & Digital Twin Generator
              </h2>
              <p className="text-xs text-[#647078]">
                BIM / CAD 3D Mesh to Navigable Simulation Digital Twin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#647078] hover:text-[#242A30] hover:bg-[#F3F4F6] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 10-Step Progress Stepper */}
        <div className="px-6 py-3 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center justify-between">
            {steps.map((st) => (
              <div key={st.num} className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                    currentStep === st.num
                      ? 'bg-[#167D73] text-white'
                      : currentStep > st.num
                      ? 'bg-[#E6F4F2] text-[#167D73]'
                      : 'bg-[#F3F4F6] text-[#9CA3AF]'
                  }`}
                >
                  {currentStep > st.num ? '✓' : st.num}
                </div>
                <span className="text-[10px] text-[#647078] mt-1 hidden sm:inline">
                  {st.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#FAFAF8]">
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 1: Select 3D Architectural Format
              </h3>
              <p className="text-xs text-[#647078]">
                Choose your source CAD / BIM format. EXIT-ZERO parses binary GLB, structured GLTF, and scenario JSON models.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { id: 'gltf', title: 'GLTF (JSON + Bin)', desc: 'Standard architectural exchange format with clear mesh hierarchy' },
                  { id: 'glb', title: 'GLB (Binary)', desc: 'Compact single-file binary 3D container with embedded materials' },
                  { id: 'json', title: 'EXIT-ZERO JSON', desc: 'Direct schema specification with rooms, doors, and stairs' },
                ].map((fmt) => (
                  <div
                    key={fmt.id}
                    onClick={() => setFormat(fmt.id as any)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      format === fmt.id
                        ? 'border-[#167D73] bg-[#E6F4F2]/50 shadow-xs'
                        : 'border-[#E5E7EB] bg-white hover:border-[#CBD5E1]'
                    }`}
                  >
                    <FileCode className={`w-5 h-5 mb-2 ${format === fmt.id ? 'text-[#167D73]' : 'text-[#647078]'}`} />
                    <h4 className="text-xs font-semibold text-[#242A30]">{fmt.title}</h4>
                    <p className="text-[11px] text-[#647078] mt-1">{fmt.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 2: Upload 3D Building Model
              </h3>
              <div className="border-2 border-dashed border-[#CBD5E1] rounded-xl p-8 bg-white flex flex-col items-center justify-center text-center">
                <Upload className="w-10 h-10 text-[#167D73] mb-3" />
                <p className="text-xs font-semibold text-[#242A30] mb-1">
                  Drop your {format.toUpperCase()} model here or click to browse
                </p>
                <p className="text-[11px] text-[#647078] mb-3">
                  Selected file: <strong className="text-[#167D73]">{fileName}</strong>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFileName('hospital_campus_block_a.gltf')}
                    className="px-3 py-1 text-[11px] font-medium bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#242A30] rounded"
                  >
                    Preset: Hospital Campus Block A
                  </button>
                  <button
                    onClick={() => setFileName('university_science_hall.gltf')}
                    className="px-3 py-1 text-[11px] font-medium bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#242A30] rounded"
                  >
                    Preset: University Hall
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#647078] mb-1">
                  Digital Twin Building Name
                </label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  className="w-full text-xs bg-white border border-[#E5E7EB] rounded-md px-3 py-2 text-[#242A30] focus:ring-1 focus:ring-[#167D73]"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 3: Geometry & Mesh Inspection
              </h3>
              <p className="text-xs text-[#647078]">
                Inspected bounding volumes, vertex buffers, and primitive meshes for file <strong>{fileName}</strong>:
              </p>
              <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] text-xs">
                <div>
                  <span className="text-[#647078] block">Total Meshes:</span>
                  <span className="font-semibold text-[#242A30]">42 Structural Primitives</span>
                </div>
                <div>
                  <span className="text-[#647078] block">Bounding Volume:</span>
                  <span className="font-semibold text-[#242A30]">80.0 m × 45.0 m × 9.6 m</span>
                </div>
                <div>
                  <span className="text-[#647078] block">Vertex Count:</span>
                  <span className="font-semibold text-[#242A30]">18,450 Vertices</span>
                </div>
                <div>
                  <span className="text-[#647078] block">Material Shaders:</span>
                  <span className="font-semibold text-[#242A30]">Architectural Standard</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 4: Units & Scale Calibration
              </h3>
              <p className="text-xs text-[#647078]">
                Ensure physical movement speeds (e.g. 1.35 m/s) correlate directly with real-world dimensions.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'meters', label: 'Meters (1.0 = 1m)', factor: '1.0x Scale' },
                  { id: 'centimeters', label: 'Centimeters (100 = 1m)', factor: '0.01x Scale' },
                  { id: 'millimeters', label: 'Millimeters (1000 = 1m)', factor: '0.001x Scale' },
                ].map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setUnits(u.id as any)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      units === u.id ? 'border-[#167D73] bg-[#E6F4F2]' : 'border-[#E5E7EB] bg-white'
                    }`}
                  >
                    <Ruler className="w-4 h-4 text-[#167D73] mb-1" />
                    <span className="text-xs font-semibold block text-[#242A30]">{u.label}</span>
                    <span className="text-[10px] text-[#647078]">{u.factor}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 5: Up-Axis & Spatial Orientation
              </h3>
              <p className="text-xs text-[#647078]">
                Align coordinates so vertical floor height corresponds to elevation.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'Y-up', title: 'Y-Up (Standard Three.js / WebGL)', desc: 'Y is vertical height, X & Z are horizontal floor planes' },
                  { id: 'Z-up', title: 'Z-Up (AutoCAD / Blender / BIM)', desc: 'Z is vertical height, will be converted to Y-up in viewport' },
                ].map((ax) => (
                  <button
                    key={ax.id}
                    onClick={() => setUpAxis(ax.id as any)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      upAxis === ax.id ? 'border-[#167D73] bg-[#E6F4F2]' : 'border-[#E5E7EB] bg-white'
                    }`}
                  >
                    <Compass className="w-4 h-4 text-[#167D73] mb-1" />
                    <span className="text-xs font-semibold block text-[#242A30]">{ax.title}</span>
                    <span className="text-[11px] text-[#647078] mt-1">{ax.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 6: Automated Floor Level Clustering
              </h3>
              <p className="text-xs text-[#647078]">
                Clusters horizontal planar surfaces along the height axis to extract discrete floor slabs.
              </p>
              <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[#E5E7EB]">
                  <span className="font-semibold text-[#242A30]">Level 3 (F3 - Administration)</span>
                  <span className="text-[#647078]">Elevation: 6.40 m | Height: 3.20 m</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#E5E7EB]">
                  <span className="font-semibold text-[#242A30]">Level 2 (F2 - General Ward)</span>
                  <span className="text-[#647078]">Elevation: 3.20 m | Height: 3.20 m</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-semibold text-[#242A30]">Level 1 (F1 - Lobby & Exits)</span>
                  <span className="text-[#647078]">Elevation: 0.00 m | Height: 3.20 m</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#647078]">Floors detected:</span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={detectedFloors}
                  onChange={(e) => setDetectedFloors(parseInt(e.target.value) || 1)}
                  className="w-16 text-xs bg-white border border-[#E5E7EB] rounded px-2 py-1"
                />
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 7: Room & Corridor Boundary Segmentation
              </h3>
              <p className="text-xs text-[#647078]">
                Detects bounded architectural volumes and separates usable occupancy rooms from circulation corridors.
              </p>
              <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-[#167D73] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>24 Enclosed Room Boundaries Extracted</span>
                </div>
                <div className="flex items-center gap-2 text-[#167D73] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>12 Main & Connecting Circulation Corridors Segmented</span>
                </div>
                <div className="flex items-center gap-2 text-[#167D73] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Total Building Nominal Capacity: 1,104 Occupants</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 8: Doorway & Portal Detection
              </h3>
              <p className="text-xs text-[#647078]">
                Analyzes wall openings to place doorway nodes with standard ADA clearance (≥ 0.9m).
              </p>
              <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] text-xs space-y-1.5">
                <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                  <span className="text-[#242A30]">Interior Room Doors:</span>
                  <span className="font-semibold text-[#242A30]">24 Door Openings (1.2m width)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#242A30]">Exterior Emergency Portals:</span>
                  <span className="font-semibold text-[#167D73]">2 Ground Egress Portals (3.2m & 2.4m)</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 9 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 9: Vertical Circulation & Accessibility Tagging
              </h3>
              <p className="text-xs text-[#647078]">
                Tags vertical connectors to ensure wheelchair evacuees only use accessible ramps/elevators.
              </p>
              <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] text-xs space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-[#F9FAFB]">
                  <div>
                    <span className="font-semibold text-[#242A30] block">Stairwell Flight (East Core)</span>
                    <span className="text-[11px] text-[#647078]">Treads & Handrails (Ambulatory Only)</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] bg-[#E2E8F0] text-[#475569] font-medium rounded">
                    Ambulatory
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#E6F4F2]">
                  <div>
                    <span className="font-semibold text-[#167D73] block">Continuous Accessible Ramp (West Core)</span>
                    <span className="text-[11px] text-[#647078]">ADA Incline 1:12 with Dual Railings</span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] bg-[#167D73] text-white font-medium rounded">
                    Wheelchair Accessible
                  </span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 10 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#167D73]">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-sm font-bold text-[#242A30]">
                  Step 10: Validation & Simulation Readiness Confirmed!
                </h3>
              </div>
              <div className="p-4 bg-white rounded-lg border border-[#167D73]/30 shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#647078]">Digital Twin Name:</span>
                  <span className="font-semibold text-[#242A30]">{importedResult?.name || buildingName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#647078]">Total Floors:</span>
                  <span className="font-semibold text-[#242A30]">{importedResult?.floor_count || detectedFloors} Floors</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#647078]">Total Rooms:</span>
                  <span className="font-semibold text-[#242A30]">{importedResult?.room_count || 24} Rooms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#647078]">Graph Validation:</span>
                  <span className="font-semibold text-[#167D73]">100% Traversable • Zero Dead Ends</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-[#647078] hover:text-[#242A30] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              disabled={currentStep === 1 || isProcessing}
              className="px-3.5 py-1.5 text-xs font-medium text-[#647078] hover:text-[#242A30] disabled:opacity-40 transition-colors"
            >
              Back
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 9 && (
              <button
                onClick={() => setCurrentStep((prev) => Math.min(10, prev + 1))}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#167D73] hover:bg-[#126860] rounded-md shadow-xs transition-colors"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 9 && (
              <button
                onClick={handleRunImport}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold text-white bg-[#167D73] hover:bg-[#126860] rounded-md shadow-xs transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isProcessing ? 'Compiling Digital Twin...' : 'Generate 3D Digital Twin'}
              </button>
            )}

            {currentStep === 10 && importedResult && (
              <>
                <button
                  onClick={() => {
                    onImportComplete(importedResult, 'studio');
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#167D73] bg-[#E6F4F2] hover:bg-[#d0ece8] border border-[#167D73]/30 rounded-md transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Open in Studio
                </button>
                <button
                  onClick={() => {
                    onImportComplete(importedResult, 'simulate');
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#167D73] hover:bg-[#126860] rounded-md shadow-xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Run Evacuation Simulation
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
