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
                Building Reference & Navigation Scaffold
              </h2>
              <p className="text-xs text-[#647078]">
                Bounds-based simulation authoring; source geometry is not decoded
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
                Record the reference format. This build does not decode GLTF/GLB/CAD geometry; only structured EXIT-ZERO JSON contains authored rooms, doors, and stairs.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { id: 'gltf', title: 'GLTF Reference', desc: 'Reference label only; mesh geometry is not parsed' },
                  { id: 'glb', title: 'GLB Reference', desc: 'Reference label only; binary geometry is not parsed' },
                  { id: 'json', title: 'EXIT-ZERO JSON', desc: 'Supported structured rooms, doors, exits, and stairs' },
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
                Step 2: Reference Metadata
              </h3>
              <div className="border-2 border-dashed border-[#CBD5E1] rounded-xl p-8 bg-white flex flex-col items-center justify-center text-center">
                <Upload className="w-10 h-10 text-[#167D73] mb-3" />
                <p className="text-xs font-semibold text-[#242A30] mb-1">
                  Name the {format.toUpperCase()} reference used while authoring the scaffold
                </p>
                <p className="text-[11px] text-[#647078] mb-3">
                  Reference label: <strong className="text-[#167D73]">{fileName}</strong> (not uploaded or parsed)
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
                Step 3: Scaffold Inputs
              </h3>
              <p className="text-xs text-[#647078]">
                The generator uses declared bounds and floor count. It has not inspected geometry in <strong>{fileName}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] text-xs">
                <div>
                  <span className="text-[#647078] block">Geometry extraction:</span>
                  <span className="font-semibold text-amber-700">Not implemented</span>
                </div>
                <div>
                  <span className="text-[#647078] block">Declared scaffold bounds:</span>
                  <span className="font-semibold text-[#242A30]">80.0 m × 45.0 m × 9.6 m</span>
                </div>
                <div>
                  <span className="text-[#647078] block">Rooms / doors:</span>
                  <span className="font-semibold text-[#242A30]">Generated placeholders</span>
                </div>
                <div>
                  <span className="text-[#647078] block">Stairs / ramps:</span>
                  <span className="font-semibold text-[#242A30]">Generated placeholders</span>
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
                Step 6: Scaffold Floor Count
              </h3>
              <p className="text-xs text-[#647078]">
                Choose the number of evenly spaced placeholder levels. No floor slabs are extracted from geometry.
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
                <span className="text-xs text-[#647078]">Floors to generate:</span>
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
                Step 7: Generated Room Layout
              </h3>
              <p className="text-xs text-[#647078]">
                Creates a regular placeholder room layout and central circulation graph for later manual verification.
              </p>
              <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-[#167D73] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Placeholder room boundaries will be generated</span>
                </div>
                <div className="flex items-center gap-2 text-[#167D73] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Corridor waypoints will be generated from declared bounds</span>
                </div>
                <div className="flex items-center gap-2 text-[#167D73] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Capacities are estimates and require author review</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#242A30]">
                Step 8: Generated Doorways & Exits
              </h3>
              <p className="text-xs text-[#647078]">
                Adds placeholder doorways and two ground-level exits; no wall openings are detected from the reference file.
              </p>
              <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] text-xs space-y-1.5">
                <div className="flex justify-between py-1 border-b border-[#E5E7EB]">
                  <span className="text-[#242A30]">Interior Room Doors:</span>
                  <span className="font-semibold text-[#242A30]">Generated 1.2m placeholder doors</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#242A30]">Exterior Emergency Portals:</span>
                  <span className="font-semibold text-[#167D73]">2 generated ground exits</span>
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
                Adds one ambulatory stair and one accessible ramp between generated levels. Verify both against the real building before use.
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
                  Step 10: Navigation Scaffold Generated
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
                  <span className="text-[#647078]">Source fidelity:</span>
                  <span className="font-semibold text-amber-700">Placeholder geometry — manual verification required</span>
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
                {isProcessing ? 'Generating Scaffold...' : 'Generate Navigation Scaffold'}
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
