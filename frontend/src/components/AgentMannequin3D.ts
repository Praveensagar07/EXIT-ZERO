import * as THREE from 'three';
import type { Occupant } from '../types/simulation';

// Shared Materials for High-Performance Rendering across hundreds of agents
const MAT_AMBULATORY = new THREE.MeshStandardMaterial({
  color: 0x475569, // Neutral slate architectural mannequin
  roughness: 0.5,
  metalness: 0.1,
});

const MAT_AMBULATORY_SELECTED = new THREE.MeshStandardMaterial({
  color: 0x167d73, // Teal accent for selected agent
  roughness: 0.3,
  metalness: 0.2,
  emissive: 0x0f514b,
  emissiveIntensity: 0.3,
});

const MAT_AMBULATORY_TRAPPED = new THREE.MeshStandardMaterial({
  color: 0xef4444, // Red for high danger / trapped
  roughness: 0.4,
  metalness: 0.1,
  emissive: 0x991b1b,
  emissiveIntensity: 0.4,
});

const MAT_WHEELCHAIR_FRAME = new THREE.MeshStandardMaterial({
  color: 0x0284c7, // Distinct cyan accessibility blue
  roughness: 0.35,
  metalness: 0.4,
});

const MAT_WHEELCHAIR_TIRE = new THREE.MeshStandardMaterial({
  color: 0x1e293b, // Dark rubber wheels
  roughness: 0.8,
  metalness: 0.1,
});

const MAT_WHEELCHAIR_SPOKES = new THREE.MeshStandardMaterial({
  color: 0x94a3b8, // Metallic spokes
  roughness: 0.3,
  metalness: 0.8,
});

// Shared Procedural Geometries (Reused across all instances to minimize memory and draw calls)
const GEO_HEAD = new THREE.SphereGeometry(0.12, 10, 8);
const GEO_TORSO = new THREE.BoxGeometry(0.34, 0.46, 0.20);
const GEO_UPPER_LEG = new THREE.BoxGeometry(0.11, 0.38, 0.12);
const GEO_LOWER_LEG = new THREE.BoxGeometry(0.10, 0.38, 0.11);
const GEO_ARM = new THREE.BoxGeometry(0.09, 0.44, 0.09);

// Wheelchair Geometries
const GEO_WC_SEAT = new THREE.BoxGeometry(0.50, 0.05, 0.48);
const GEO_WC_BACK = new THREE.BoxGeometry(0.48, 0.46, 0.05);
const GEO_WC_FOOTREST = new THREE.BoxGeometry(0.38, 0.04, 0.22);
const GEO_WC_BIG_WHEEL = new THREE.TorusGeometry(0.30, 0.028, 8, 20);
const GEO_WC_HUB = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8);
const GEO_WC_CASTER = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
const GEO_WC_SEATED_TORSO = new THREE.BoxGeometry(0.32, 0.44, 0.18);
const GEO_WC_THIGH = new THREE.BoxGeometry(0.28, 0.11, 0.38);
const GEO_WC_CALF = new THREE.BoxGeometry(0.26, 0.32, 0.11);

export interface AgentRig {
  root: THREE.Group;
  type: 'ambulatory' | 'wheelchair';
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  leftWheel?: THREE.Mesh;
  rightWheel?: THREE.Mesh;
  walkPhase: number;
  lastX: number;
  lastY: number;
  lastZ: number;
  currentSpeed: number;
}

/**
 * Creates a low-poly articulated human mannequin.
 * Proportions: ~1.75m total height, standing naturally.
 */
export function createAmbulatoryMannequin(occId: string): AgentRig {
  const root = new THREE.Group();
  root.name = `agent_${occId}`;

  // Pelvis / Torso Anchor
  const torsoMesh = new THREE.Mesh(GEO_TORSO, MAT_AMBULATORY);
  torsoMesh.position.set(0, 1.08, 0);
  torsoMesh.castShadow = true;
  root.add(torsoMesh);

  // Head
  const headMesh = new THREE.Mesh(GEO_HEAD, MAT_AMBULATORY);
  headMesh.position.set(0, 1.45, 0);
  headMesh.castShadow = true;
  root.add(headMesh);

  // Left Leg Pivot (at hip joint)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.10, 0.82, 0);

  const leftUpperLeg = new THREE.Mesh(GEO_UPPER_LEG, MAT_AMBULATORY);
  leftUpperLeg.position.set(0, -0.19, 0);
  leftUpperLeg.castShadow = true;
  leftLeg.add(leftUpperLeg);

  const leftLowerLeg = new THREE.Mesh(GEO_LOWER_LEG, MAT_AMBULATORY);
  leftLowerLeg.position.set(0, -0.56, 0);
  leftLowerLeg.castShadow = true;
  leftLeg.add(leftLowerLeg);
  root.add(leftLeg);

  // Right Leg Pivot (at hip joint)
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.10, 0.82, 0);

  const rightUpperLeg = new THREE.Mesh(GEO_UPPER_LEG, MAT_AMBULATORY);
  rightUpperLeg.position.set(0, -0.19, 0);
  rightUpperLeg.castShadow = true;
  rightLeg.add(rightUpperLeg);

  const rightLowerLeg = new THREE.Mesh(GEO_LOWER_LEG, MAT_AMBULATORY);
  rightLowerLeg.position.set(0, -0.56, 0);
  rightLowerLeg.castShadow = true;
  rightLeg.add(rightLowerLeg);
  root.add(rightLeg);

  // Left Arm Pivot (at shoulder joint)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.23, 1.26, 0);

  const leftArmMesh = new THREE.Mesh(GEO_ARM, MAT_AMBULATORY);
  leftArmMesh.position.set(0, -0.22, 0);
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);
  root.add(leftArm);

  // Right Arm Pivot (at shoulder joint)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.23, 1.26, 0);

  const rightArmMesh = new THREE.Mesh(GEO_ARM, MAT_AMBULATORY);
  rightArmMesh.position.set(0, -0.22, 0);
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);
  root.add(rightArm);

  return {
    root,
    type: 'ambulatory',
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    walkPhase: Math.random() * Math.PI * 2,
    lastX: 0,
    lastY: 0,
    lastZ: 0,
    currentSpeed: 0,
  };
}

/**
 * Creates a detailed low-poly wheelchair and seated human occupant.
 * Proportions: ~1.25m seated height, recognizable wheelchair geometry.
 */
export function createWheelchairFigure(occId: string): AgentRig {
  const root = new THREE.Group();
  root.name = `agent_${occId}`;

  // 1. Wheelchair Frame
  const seat = new THREE.Mesh(GEO_WC_SEAT, MAT_WHEELCHAIR_FRAME);
  seat.position.set(0, 0.44, 0);
  seat.castShadow = true;
  root.add(seat);

  const back = new THREE.Mesh(GEO_WC_BACK, MAT_WHEELCHAIR_FRAME);
  back.position.set(0, 0.70, -0.22);
  back.castShadow = true;
  root.add(back);

  const footrest = new THREE.Mesh(GEO_WC_FOOTREST, MAT_WHEELCHAIR_FRAME);
  footrest.position.set(0, 0.14, 0.28);
  footrest.castShadow = true;
  root.add(footrest);

  // Large Drive Wheels (Left & Right)
  const leftWheel = new THREE.Mesh(GEO_WC_BIG_WHEEL, MAT_WHEELCHAIR_TIRE);
  leftWheel.position.set(-0.29, 0.32, -0.04);
  leftWheel.rotation.y = Math.PI / 2;
  leftWheel.castShadow = true;

  const leftHub = new THREE.Mesh(GEO_WC_HUB, MAT_WHEELCHAIR_SPOKES);
  leftHub.rotation.z = Math.PI / 2;
  leftWheel.add(leftHub);
  root.add(leftWheel);

  const rightWheel = new THREE.Mesh(GEO_WC_BIG_WHEEL, MAT_WHEELCHAIR_TIRE);
  rightWheel.position.set(0.29, 0.32, -0.04);
  rightWheel.rotation.y = Math.PI / 2;
  rightWheel.castShadow = true;

  const rightHub = new THREE.Mesh(GEO_WC_HUB, MAT_WHEELCHAIR_SPOKES);
  rightHub.rotation.z = Math.PI / 2;
  rightWheel.add(rightHub);
  root.add(rightWheel);

  // Front Casters
  const leftCaster = new THREE.Mesh(GEO_WC_CASTER, MAT_WHEELCHAIR_TIRE);
  leftCaster.position.set(-0.20, 0.05, 0.24);
  leftCaster.rotation.z = Math.PI / 2;
  root.add(leftCaster);

  const rightCaster = new THREE.Mesh(GEO_WC_CASTER, MAT_WHEELCHAIR_TIRE);
  rightCaster.position.set(0.20, 0.05, 0.24);
  rightCaster.rotation.z = Math.PI / 2;
  root.add(rightCaster);

  // 2. Seated Human Figure
  const seatedTorso = new THREE.Mesh(GEO_WC_SEATED_TORSO, MAT_AMBULATORY);
  seatedTorso.position.set(0, 0.68, -0.08);
  seatedTorso.rotation.x = 0.08; // Slight forward tilt
  seatedTorso.castShadow = true;
  root.add(seatedTorso);

  const head = new THREE.Mesh(GEO_HEAD, MAT_AMBULATORY);
  head.position.set(0, 1.02, -0.05);
  head.castShadow = true;
  root.add(head);

  const thighs = new THREE.Mesh(GEO_WC_THIGH, MAT_AMBULATORY);
  thighs.position.set(0, 0.49, 0.12);
  thighs.castShadow = true;
  root.add(thighs);

  const calves = new THREE.Mesh(GEO_WC_CALF, MAT_AMBULATORY);
  calves.position.set(0, 0.28, 0.28);
  calves.castShadow = true;
  root.add(calves);

  // Seated Arms (resting forward on armrests/rims)
  const leftArm = new THREE.Mesh(GEO_ARM, MAT_AMBULATORY);
  leftArm.position.set(-0.21, 0.64, 0.05);
  leftArm.rotation.x = 0.65;
  leftArm.castShadow = true;
  root.add(leftArm);

  const rightArm = new THREE.Mesh(GEO_ARM, MAT_AMBULATORY);
  rightArm.position.set(0.21, 0.64, 0.05);
  rightArm.rotation.x = 0.65;
  rightArm.castShadow = true;
  root.add(rightArm);

  return {
    root,
    type: 'wheelchair',
    leftWheel,
    rightWheel,
    walkPhase: 0,
    lastX: 0,
    lastY: 0,
    lastZ: 0,
    currentSpeed: 0,
  };
}

/**
 * Updates agent material depending on state (selected, trapped, etc.)
 */
export function updateAgentMaterials(
  rig: AgentRig,
  occ: Occupant,
  isSelected: boolean
) {
  const isTrapped = occ.evacuation_state === 'trapped';
  const targetMat = isTrapped
    ? MAT_AMBULATORY_TRAPPED
    : isSelected
    ? MAT_AMBULATORY_SELECTED
    : MAT_AMBULATORY;

  rig.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material === MAT_AMBULATORY || child.material === MAT_AMBULATORY_SELECTED || child.material === MAT_AMBULATORY_TRAPPED) {
        child.material = targetMat;
      }
    }
  });
}

/**
 * Animates agent limbs or wheels based on actual movement velocity and simulation running state.
 * Stationary agents relax to idle standing/seated posture.
 */
export function animateAgentRig(
  rig: AgentRig,
  dt: number,
  isSimRunning: boolean,
  speedMultiplier: number
) {
  if (rig.type === 'ambulatory') {
    const isMoving = isSimRunning && rig.currentSpeed > 0.08;

    if (isMoving) {
      // Step cadence proportional to movement speed
      const cadence = Math.max(3.5, rig.currentSpeed * 7.5) * speedMultiplier;
      rig.walkPhase += dt * cadence;

      const legAngle = Math.sin(rig.walkPhase) * 0.52;
      const armAngle = -Math.sin(rig.walkPhase) * 0.42;

      if (rig.leftLeg && rig.rightLeg) {
        rig.leftLeg.rotation.x = legAngle;
        rig.rightLeg.rotation.x = -legAngle;
      }
      if (rig.leftArm && rig.rightArm) {
        rig.leftArm.rotation.x = armAngle;
        rig.rightArm.rotation.x = -armAngle;
      }
    } else {
      // Smoothly return limbs to resting stance when stopped or paused
      if (rig.leftLeg && rig.rightLeg) {
        rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, 0, 0.15);
        rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, 0, 0.15);
      }
      if (rig.leftArm && rig.rightArm) {
        rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, 0, 0.15);
        rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, 0, 0.15);
      }
    }
  } else if (rig.type === 'wheelchair') {
    const isMoving = isSimRunning && rig.currentSpeed > 0.08;

    if (isMoving && rig.leftWheel && rig.rightWheel) {
      const wheelRoll = (rig.currentSpeed / 0.30) * dt * speedMultiplier * 1.5;
      rig.leftWheel.rotation.x += wheelRoll;
      rig.rightWheel.rotation.x += wheelRoll;
    }
  }
}
