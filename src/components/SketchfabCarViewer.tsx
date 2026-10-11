"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import type { ComponentKey, VehicleComponent } from "@/lib/types";
import type { ViewMode, ZoomRequest } from "@/lib/carViewer";
import { HotspotButton } from "@/components/HotspotButton";
import { BmwLogo } from "@/components/BmwLogo";

// Offline / blocked-network fallback: the local three.js viewer.
const Car3DViewer = dynamic(() => import("@/components/Car3DViewer"), { ssr: false });

// "2025 BMW 330i xDrive" by Ddiaz Design, CC BY-NC-SA 4.0.
export const SKETCHFAB_MODEL = {
  uid: "a587961a125340738ca1c6ba53c57cd8",
  title: "2025 BMW 330i xDrive",
  author: "Ddiaz Design",
  url: "https://sketchfab.com/3d-models/2025-bmw-330i-xdrive-a587961a125340738ca1c6ba53c57cd8",
  authorUrl: "https://sketchfab.com/ddiaz-design",
  license: "CC BY-NC-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

const API_SRC = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
const LOAD_TIMEOUT_MS = 30000;

// Materials that make up the body paint (bodykit = bumpers and skirts).
const PAINT_MATERIALS = ["bmw:car_body1", "bmw:car_hood1", "bmw:car_bodykit1"];

type Vec3 = [number, number, number];

// Model space is Z-up, ~1 unit = 100 m, nose towards -Y, driver (LHD) at +X.
// `facing` is an outward normal: exterior hotspots hide when the camera is
// behind it, so markers on the far side of the car don't show through.
const ANCHORS: Record<ComponentKey, Partial<Record<ViewMode, { at: Vec3; facing?: Vec3 }>>> = {
  engine: { exterior: { at: [0.0035, -0.0165, 0.0098], facing: [0, -0.4, 1] } },
  battery: { exterior: { at: [0.0089, 0.0005, 0.0034], facing: [1, 0, 0] } },
  exterior: { exterior: { at: [0.0091, 0.0075, 0.0078], facing: [1, 0, 0] } },
  windows: {
    exterior: { at: [-0.002, -0.0062, 0.0119], facing: [0, -0.6, 1] },
    interior: { at: [-0.0015, -0.0105, 0.0117] },
  },
  interior: {
    exterior: { at: [0.0072, 0.0035, 0.0108], facing: [1, 0, 0.3] },
    interior: { at: [-0.0018, -0.0068, 0.0097] },
  },
  steering: {
    exterior: { at: [0.0037, -0.0046, 0.0096], facing: [0, -0.6, 1] },
    interior: { at: [0.0037, -0.0049, 0.0091] },
  },
};

// Driver's eye. The target sits a hair ahead so orbiting turns into looking around.
const INTERIOR_EYE: Vec3 = [0.0037, 0.0015, 0.0112];
const INTERIOR_TARGET: Vec3 = [0.0037, 0.0005, 0.01108];
const INTERIOR_FOV = 70;

// ---- Minimal typing for the bits of the Sketchfab Viewer API we use ----
interface SketchfabMaterial {
  name: string;
  channels: { AlbedoPBR?: { color: Vec3 } };
}
interface CameraLookAt {
  position: Vec3;
  target: Vec3;
}
interface SketchfabApi {
  addEventListener(event: "viewerready", cb: () => void): void;
  getCameraLookAt(cb: (err: unknown, cam: CameraLookAt) => void): void;
  setCameraLookAt(position: Vec3, target: Vec3, duration: number, cb?: () => void): void;
  getFov(cb: (err: unknown, fov: number) => void): void;
  setFov(fov: number, cb?: () => void): void;
  getMaterialList(cb: (err: unknown, materials: SketchfabMaterial[]) => void): void;
  setMaterial(material: SketchfabMaterial, cb?: () => void): void;
  getWorldToScreenCoordinates(coords: Vec3, cb: (res: { canvasCoord: Record<number, number> }) => void): void;
}
interface SketchfabClient {
  init(uid: string, options: Record<string, unknown>): void;
}
declare global {
  interface Window {
    Sketchfab?: new (iframe: HTMLIFrameElement) => SketchfabClient;
  }
}

let apiScript: Promise<void> | null = null;
function loadApiScript() {
  if (window.Sketchfab) return Promise.resolve();
  apiScript ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = API_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      apiScript = null;
      reject(new Error("Sketchfab API failed to load"));
    };
    document.head.appendChild(el);
  });
  return apiScript;
}

function hexToLinear(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

const call = <T,>(fn: (cb: (err: unknown, v: T) => void) => void) =>
  new Promise<T>((resolve, reject) => fn((err, v) => (err ? reject(err) : resolve(v))));

export default function SketchfabCarViewer(props: {
  components: VehicleComponent[];
  mode: ViewMode;
  paint: string;
  resetKey: number;
  zoom?: ZoomRequest;
  highlightedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (c: VehicleComponent) => void;
}) {
  const { components, mode, paint, resetKey, zoom, highlightedId, onHover, onSelect } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<SketchfabApi | null>(null);
  const homeRef = useRef<{ cam: CameraLookAt; fov: number } | null>(null);
  const exteriorDistRef = useRef<number | null>(null); // framed distance, the reference for zoom limits
  const markerRefs = useRef(new Map<string, HTMLDivElement>());
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  // Boot the viewer once.
  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => !cancelled && setStatus((s) => (s === "loading" ? "failed" : s)), LOAD_TIMEOUT_MS);
    loadApiScript()
      .then(() => {
        if (cancelled || !iframeRef.current || !window.Sketchfab) return;
        new window.Sketchfab(iframeRef.current).init(SKETCHFAB_MODEL.uid, {
          autostart: 1,
          preload: 1,
          camera: 0,
          transparent: 1,
          ui_hint: 0,
          ui_infos: 0,
          ui_controls: 0,
          ui_stop: 0,
          ui_watermark: 0,
          ui_watermark_link: 0,
          ui_ar: 0,
          ui_help: 0,
          ui_settings: 0,
          ui_vr: 0,
          ui_fullscreen: 0,
          ui_annotations: 0,
          ui_inspector: 0,
          ui_loading: 0,
          scrollwheel: 0, // the wheel scrolls the page; zoom is on the page's +/- buttons
          success: (api: SketchfabApi) => {
            api.addEventListener("viewerready", async () => {
              if (cancelled) return;
              const [cam, fov] = await Promise.all([call<CameraLookAt>((cb) => api.getCameraLookAt(cb)), call<number>((cb) => api.getFov(cb))]);
              homeRef.current = { cam, fov };
              apiRef.current = api;
              setStatus("ready");
            });
          },
          error: () => !cancelled && setStatus("failed"),
        });
      })
      .catch(() => !cancelled && setStatus("failed"));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  // Paint.
  useEffect(() => {
    const api = apiRef.current;
    if (status !== "ready" || !api) return;
    const color = hexToLinear(paint);
    call<SketchfabMaterial[]>((cb) => api.getMaterialList(cb)).then((materials) => {
      materials
        .filter((m) => PAINT_MATERIALS.includes(m.name) && m.channels.AlbedoPBR)
        .forEach((m) => {
          m.channels.AlbedoPBR!.color = color;
          api.setMaterial(m);
        });
    });
  }, [paint, status]);

  // Camera: exterior <-> interior, and "reset view".
  useEffect(() => {
    const api = apiRef.current;
    const home = homeRef.current;
    if (status !== "ready" || !api || !home) return;
    if (mode === "interior") {
      api.setFov(INTERIOR_FOV);
      api.setCameraLookAt(INTERIOR_EYE, INTERIOR_TARGET, 1.2);
    } else {
      // The author's framing is tight; pull back, and further on portrait screens.
      const el = iframeRef.current;
      const aspect = el ? el.clientWidth / Math.max(1, el.clientHeight) : 1.6;
      const k = 1.3 * Math.max(1, 1.5 / aspect);
      const { position, target } = home.cam;
      exteriorDistRef.current = Math.hypot(...position.map((v, i) => (v - target[i]) * k));
      api.setFov(home.fov);
      api.setCameraLookAt(position.map((v, i) => target[i] + (v - target[i]) * k) as Vec3, target, 1.2);
    }
  }, [mode, resetKey, status]);

  // +/- buttons: dolly towards the target outside, narrow the field of view inside.
  useEffect(() => {
    const api = apiRef.current;
    if (status !== "ready" || !api || !zoom) return;
    if (mode === "interior") {
      call<number>((cb) => api.getFov(cb)).then((fov) => api.setFov(Math.min(95, Math.max(35, fov - zoom.step * 10))));
      return;
    }
    call<CameraLookAt>((cb) => api.getCameraLookAt(cb)).then(({ position, target }) => {
      const offset = position.map((v, i) => v - target[i]);
      const dist = Math.hypot(...offset);
      const framed = exteriorDistRef.current ?? dist;
      const next = Math.min(framed * 1.7, Math.max(framed * 0.6, dist * (zoom.step > 0 ? 0.87 : 1.15)));
      api.setCameraLookAt(target.map((v, i) => v + offset[i] * (next / dist)) as Vec3, target, 0.35);
    });
    // Only a new click should zoom, not a mode switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom?.nonce]);

  // Track hotspots: project each anchor every frame and move the DOM nodes directly.
  useEffect(() => {
    const api = apiRef.current;
    if (status !== "ready" || !api) return;
    let running = true;
    let frame = 0;
    const visible = components.filter((c) => ANCHORS[c.key]?.[mode]);

    const tick = async () => {
      if (!running) return;
      try {
        const cam = await call<CameraLookAt>((cb) => api.getCameraLookAt(cb));
        const iframe = iframeRef.current;
        await Promise.all(
          visible.map(
            (c) =>
              new Promise<void>((resolve) => {
                const anchor = ANCHORS[c.key]![mode]!;
                api.getWorldToScreenCoordinates(anchor.at, (res) => {
                  const el = markerRefs.current.get(c.id);
                  if (el && res?.canvasCoord) {
                    const x = res.canvasCoord[0];
                    const y = res.canvasCoord[1];
                    const facing = anchor.facing;
                    const toCam = cam.position.map((v, i) => v - anchor.at[i]);
                    const front = !facing || facing.reduce((sum, v, i) => sum + v * toCam[i], 0) > 0;
                    const onScreen = iframe ? x > -20 && y > -20 && x < iframe.clientWidth + 20 && y < iframe.clientHeight + 20 : true;
                    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
                    el.style.opacity = front && onScreen ? "1" : "0";
                    el.style.pointerEvents = front && onScreen ? "auto" : "none";
                  }
                  resolve();
                });
              }),
          ),
        );
      } catch {
        // Viewer busy (e.g. mid-transition); try again next frame.
      }
      if (running) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [components, mode, status]);

  if (status === "failed") return <Car3DViewer {...props} />;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <iframe
        ref={iframeRef}
        title={SKETCHFAB_MODEL.title}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; fullscreen; xr-spatial-tracking"
      />

      {/* Soft studio fades so the headline and controls stay legible over the viewer's backdrop. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-80 bg-gradient-to-b from-white/85 via-white/50 to-transparent" />

      {status === "ready" &&
        components.map((c) =>
          ANCHORS[c.key]?.[mode] ? (
            <div
              key={`${mode}-${c.id}`}
              ref={(el) => {
                if (el) markerRefs.current.set(c.id, el);
                else markerRefs.current.delete(c.id);
              }}
              className="absolute left-0 top-0 z-20 opacity-0 transition-opacity duration-200"
              style={{ willChange: "transform" }}
            >
              <HotspotButton component={c} highlighted={highlightedId === c.id} onSelect={onSelect} onHover={onHover} />
            </div>
          ) : null,
        )}

      <div
        className={clsx(
          "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(120%_90%_at_50%_35%,#ffffff_0%,#eceeef_45%,#d6d9dc_100%)] transition-opacity duration-700",
          status === "ready" ? "opacity-0" : "opacity-100",
        )}
      >
        <BmwLogo size={64} className="animate-[splashPulse_1.8s_ease-in-out_infinite]" />
        <div className="h-[2px] w-48 overflow-hidden bg-neutral-300">
          <div className="h-full w-1/3 animate-[loadbar_1.2s_ease-in-out_infinite] bg-bmw-blue" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Loading vehicle</p>
      </div>
    </div>
  );
}
