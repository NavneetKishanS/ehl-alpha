"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import clsx from "clsx";
import { HotspotButton } from "@/components/HotspotButton";
import { BmwLogo } from "@/components/BmwLogo";
import type { ComponentKey, ComponentSentiment, VehicleComponent } from "@/lib/types";
import type { ViewMode, ZoomRequest } from "@/lib/carViewer";

// Any GLB dropped at this path is picked up. The default is the CC BY 4.0
// Khronos "Car Concept" sample (it ships a full cabin). Swap in a BMW model
// with the same orientation (Y-up, nose towards +Z, wheels on y=0) and only
// the hotspot coordinates below need retuning.
export const CAR_MODEL_URL = "/models/car.glb";

// World-space anchors per component, per view. A component without an
// anchor for the current view is simply not shown in that view.
const ANCHORS: Record<ComponentKey, Partial<Record<ViewMode, [number, number, number]>>> = {
  engine: { exterior: [0, 0.86, 1.95] },
  battery: { exterior: [1.13, 0.28, 0.15] },
  exterior: { exterior: [1.06, 0.78, -0.95] },
  windows: { exterior: [0.35, 1.08, 0.7], interior: [0.42, 0.93, 1.3] },
  interior: { exterior: [0.5, 1.05, -0.35], interior: [0.62, 0.86, 1.0] },
  steering: { exterior: [0, 0.74, 1.0], interior: [0, 0.74, 1.0] },
};

// Car is translated so its length is centred on the origin.
const CAR_OFFSET_Z = -0.25;

const VIEWS: Record<ViewMode, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  exterior: { position: new THREE.Vector3(4.7, 1.6, 4.1), target: new THREE.Vector3(0, 0.5, 0) },
  // Driver's eye (central seat in this model). The target sits just ahead so
  // OrbitControls behaves as a look-around camera.
  interior: { position: new THREE.Vector3(0, 1.06, 0.38 + CAR_OFFSET_Z), target: new THREE.Vector3(0, 1.0, 0.5 + CAR_OFFSET_Z) },
};

function CarModel({ paint }: { paint: string }) {
  const { scene } = useGLTF(CAR_MODEL_URL);

  const materials = useMemo(() => {
    const body: THREE.MeshPhysicalMaterial[] = [];
    const seats: THREE.MeshStandardMaterial[] = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (mat.name.startsWith("Paint 1")) body.push(mat);
      if (mat.name.startsWith("Interior 3")) seats.push(mat);
    });
    // Warm ivory leather, closer to a BMW cabin than the stock carmine red.
    seats.forEach((m) => m.color.set("#b9ad9c"));
    return { body };
  }, [scene]);

  useEffect(() => {
    materials.body.forEach((m) => {
      m.color.set(paint);
      m.roughness = 0.28;
      m.metalness = 0.55;
      m.clearcoat = 1;
      m.clearcoatRoughness = 0.04;
    });
  }, [materials, paint]);

  return <primitive object={scene} position={[0, 0, CAR_OFFSET_Z]} />;
}

useGLTF.preload(CAR_MODEL_URL);

// Pull the exterior camera back on narrow (portrait) viewports so the whole car fits.
function exteriorDistanceScale(aspect: number) {
  return Math.max(1, 1.5 / aspect);
}

function CameraRig({ mode, resetKey }: { mode: ViewMode; resetKey: number }) {
  const { camera } = useThree();
  const aspect = useThree((s) => s.size.width / s.size.height);
  const exteriorPos = useMemo(
    () => VIEWS.exterior.position.clone().sub(VIEWS.exterior.target).multiplyScalar(exteriorDistanceScale(aspect)).add(VIEWS.exterior.target),
    [aspect],
  );
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const animating = useRef(true);

  useEffect(() => {
    animating.current = true;
    // Interior: jump straight in (an animated fly-through would clip the body).
    if (mode === "interior" && controls) {
      camera.position.copy(VIEWS.interior.position);
      controls.target.copy(VIEWS.interior.target);
      controls.update();
      animating.current = false;
    }
  }, [mode, resetKey, aspect, camera, controls]);

  useFrame((_, dt) => {
    if (!animating.current || !controls || mode !== "exterior") return;
    const k = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(exteriorPos, k);
    controls.target.lerp(VIEWS.exterior.target, k);
    controls.update();
    if (camera.position.distanceTo(exteriorPos) < 0.02) animating.current = false;
  });

  // Let the user take over mid-animation.
  useEffect(() => {
    if (!controls) return;
    const stop = () => (animating.current = false);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  return null;
}

function Hotspot({
  position,
  ...props
}: { position: [number, number, number] } & React.ComponentProps<typeof HotspotButton>) {
  return (
    <Html position={position} center zIndexRange={[20, 0]}>
      <HotspotButton {...props} />
    </Html>
  );
}

function StudioLights() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer intensity={2.2} form="rect" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} />
      <Lightformer intensity={1.4} form="rect" position={[-6, 2, 1]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
      <Lightformer intensity={1.4} form="rect" position={[6, 2, -1]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
      <Lightformer intensity={0.8} form="rect" position={[0, 2, 7]} scale={[10, 3, 1]} />
      <Lightformer intensity={0.8} form="rect" position={[0, 2, -7]} rotation-y={Math.PI} scale={[10, 3, 1]} />
      <Lightformer intensity={0.5} color="#dfe7f2" form="ring" position={[0, 4, 4]} scale={3} />
    </Environment>
  );
}

function Floor() {
  return (
    <group>
      <ContactShadows position={[0, 0.002, 0]} opacity={0.55} scale={12} blur={2.4} far={2.5} resolution={1024} color="#1a1f26" />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]}>
        <ringGeometry args={[3.55, 3.57, 128]} />
        <meshBasicMaterial color="#9aa1a8" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function LoadingOverlay() {
  const { progress, active } = useProgress();
  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 transition-opacity duration-700",
        active || progress < 100 ? "opacity-100" : "opacity-0",
      )}
    >
      <BmwLogo size={64} className="animate-[splashPulse_1.8s_ease-in-out_infinite]" />
      <div className="h-[2px] w-48 overflow-hidden bg-neutral-300">
        <div className="h-full bg-bmw-blue transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Loading vehicle · {Math.round(progress)}%</p>
    </div>
  );
}

export default function Car3DViewer({
  components,
  mode,
  paint,
  resetKey,
  zoom,
  highlightedId,
  sentiment,
  onHover,
  onSelect,
}: {
  components: VehicleComponent[];
  mode: ViewMode;
  paint: string;
  resetKey: number;
  zoom?: ZoomRequest;
  highlightedId: string | null;
  sentiment?: Record<string, ComponentSentiment>;
  onHover: (id: string | null) => void;
  onSelect: (c: VehicleComponent) => void;
}) {
  const interior = mode === "interior";
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [9, 3.2, 8], fov: 32, near: 0.01, far: 100 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <FovSync fov={interior ? 72 : 32} />
        <Suspense fallback={null}>
          <StudioLights />
          <CarModel paint={paint} />
          {!interior && <Floor />}
          {components.map((c) => {
            const pos = ANCHORS[c.key]?.[mode];
            if (!pos) return null;
            return (
              <Hotspot
                key={`${mode}-${c.id}`}
                component={c}
                sentiment={sentiment?.[c.key]}
                position={[pos[0], pos[1], pos[2] + CAR_OFFSET_Z]}
                highlighted={highlightedId === c.id}
                onSelect={onSelect}
                onHover={onHover}
              />
            );
          })}
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false} // the wheel scrolls the page; zoom is on the page's +/- buttons
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={interior ? -0.35 : 0.6}
          minDistance={interior ? 0.01 : 4.2}
          maxDistance={interior ? 1 : 20}
          minPolarAngle={interior ? Math.PI * 0.2 : Math.PI * 0.18}
          maxPolarAngle={interior ? Math.PI * 0.75 : Math.PI * 0.49}
        />
        <CameraRig mode={mode} resetKey={resetKey} />
        <ZoomHandler zoom={zoom} interior={interior} />
      </Canvas>
      <LoadingOverlay />
    </div>
  );
}

function FovSync({ fov }: { fov: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, fov]);
  return null;
}

// +/- buttons: dolly towards the target outside, narrow the field of view inside.
function ZoomHandler({ zoom, interior }: { zoom?: ZoomRequest; interior: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  useEffect(() => {
    if (!zoom) return;
    if (interior) {
      camera.fov = Math.min(95, Math.max(35, camera.fov - zoom.step * 10));
      camera.updateProjectionMatrix();
      return;
    }
    if (!controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const next = Math.min(20, Math.max(4.2, offset.length() * (zoom.step > 0 ? 0.87 : 1.15)));
    camera.position.copy(controls.target).add(offset.setLength(next));
    controls.update();
    // Only a new click should zoom, not a mode switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom?.nonce]);
  return null;
}
