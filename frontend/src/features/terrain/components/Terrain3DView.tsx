import { useEffect, useRef, useState } from 'react';
import type { Parking } from '@/features/route-planning';
import type { Target } from '@/features/targets';
import type { GeoPoint } from '@/shared/types/geo';
import { sampleTerrain } from '../lib/sample';
import type { TerrainGrid } from '../types';

export type CamMode3D = 'ORBIT' | 'CHASE' | 'POV' | 'DRONE' | 'FLYOVER';

interface Terrain3DViewProps {
  grid: TerrainGrid;
  base: GeoPoint | null;
  targets: Target[];
  roverRoute: { points: (GeoPoint & { elevation_m?: number })[] } | null;
  evaRoutes: { points: (GeoPoint & { elevation_m?: number })[] }[];
  parkings: Parking[];
  vehicleLabel: string;
  livePosition?: { lon: number; lat: number; heading: number; mode: 'rover' | 'eva' } | null;
}

/** Interactive 3D DEM viewport rendering Mount Sharp terrain, 2-phase Rover/EVA routes, Hub beacons, Scout Drone LiDAR, and 5 camera modes. */
export function Terrain3DView({
  grid,
  base,
  targets,
  roverRoute,
  evaRoutes,
  parkings,
  vehicleLabel,
  livePosition = null,
}: Terrain3DViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [yaw, setYaw] = useState(-0.68);
  const [pitch, setPitch] = useState(0.56);
  const [zoom, setZoom] = useState(1.15);
  const [vertExag, setVertExag] = useState(3.0);
  const [autoSpin, setAutoSpin] = useState(false);
  const [camMode, setCamMode] = useState<CamMode3D>('ORBIT');
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const tickRef = useRef(0);

  useEffect(() => {
    if (!autoSpin && camMode !== 'FLYOVER') return;
    const id = window.setInterval(() => setYaw((y) => y + (camMode === 'FLYOVER' ? 0.02 : 0.015)), 50);
    return () => window.clearInterval(id);
  }, [autoSpin, camMode]);

  useEffect(() => {
    let rafId = 0;
    const render = () => {
      tickRef.current = (tickRef.current + 1) % 10000;
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(300, Math.floor(rect.width));
        const h = Math.max(260, Math.floor(rect.height));
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          drawScene(ctx, w, h);
          ctx.restore();
        }
      }
      rafId = window.requestAnimationFrame(render);
    };

    const { min_lon: lonMin, min_lat: latMin, max_lon: lonMax, max_lat: latMax } = grid.bbox;
    const lonMid = (lonMin + lonMax) * 0.5;
    const latMid = (latMin + latMax) * 0.5;
    const minElev = Math.min(...grid.elevation_m);
    const maxElev = Math.max(...grid.elevation_m);
    const midElev = (minElev + maxElev) * 0.5;
    const elevSpan = Math.max(1, maxElev - minElev);

    const focusPoint = livePosition ?? base ?? { lon: lonMid, lat: latMid };
    const effectiveYaw =
      camMode === 'CHASE' && livePosition
        ? -((livePosition.heading * Math.PI) / 180)
        : camMode === 'DRONE'
          ? (tickRef.current * 0.008)
          : yaw;
    const effectivePitch = camMode === 'DRONE' ? 1.18 : camMode === 'CHASE' ? 0.36 : pitch;
    const effectiveZoom = camMode === 'CHASE' ? Math.max(zoom, 1.55) : camMode === 'DRONE' ? Math.max(zoom, 1.25) : zoom;
    const centerLon = camMode === 'CHASE' ? focusPoint.lon : lonMid;
    const centerLat = camMode === 'CHASE' ? focusPoint.lat : latMid;

    const project = (lon: number, lat: number, elevM: number, W: number, H: number): [number, number] => {
      const nx = ((lon - centerLon) / Math.max(1e-6, lonMax - lonMin)) * 2.0;
      const ny = ((lat - centerLat) / Math.max(1e-6, latMax - latMin)) * 2.0;
      const nz = ((elevM - midElev) / elevSpan) * 0.35 * vertExag;
      const cy = Math.cos(effectiveYaw);
      const sy = Math.sin(effectiveYaw);
      const rx = nx * cy - ny * sy;
      const ry = nx * sy + ny * cy;
      const cp = Math.cos(effectivePitch);
      const sp = Math.sin(effectivePitch);
      const py3 = ry * cp - nz * sp;
      const pz3 = ry * sp + nz * cp;
      const scale = Math.min(W, H) * 0.38 * effectiveZoom;
      return [W * 0.5 + rx * scale, H * 0.54 - pz3 * scale * 0.92 + py3 * scale * 0.14];
    };

    const drawHelmetPOV = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1A0E0A');
      sky.addColorStop(0.45, '#593325');
      sky.addColorStop(0.55, '#8A4F35');
      sky.addColorStop(1, '#2B1710');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const hdgDeg = livePosition?.heading ?? 42;
      const pos = livePosition ?? base ?? { lon: lonMid, lat: latMid };
      const posElev = sampleTerrain(grid, pos)?.elevation ?? midElev;

      // Horizon ridge profile sampled ahead
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i <= 48; i++) {
        const frac = i / 48;
        const rayAngle = ((hdgDeg - 45 + frac * 90) * Math.PI) / 180;
        const dLon = pos.lon + Math.sin(rayAngle) * (lonMax - lonMin) * 0.25;
        const dLat = pos.lat + Math.cos(rayAngle) * (latMax - latMin) * 0.25;
        const e = sampleTerrain(grid, { lon: dLon, lat: dLat })?.elevation ?? posElev;
        const y = H * 0.52 - ((e - posElev) / elevSpan) * H * 0.28 * vertExag;
        ctx.lineTo(frac * W, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = '#4B281B';
      ctx.fill();

      // Helmet visor vignette + HUD reticle
      ctx.strokeStyle = 'rgba(124, 217, 146, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(20, 20, W - 40, H - 40);
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.5, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '700 11px monospace';
      ctx.fillStyle = '#7CD992';
      ctx.fillText(`xEMU HELMET POV · HDG ${Math.round(hdgDeg)}° · ELEV ${Math.round(posElev)} m`, 34, 42);
      ctx.fillStyle = '#F6C177';
      ctx.fillText(`MODE: ${livePosition?.mode === 'eva' ? 'EVA FOOT TRAVERSE' : vehicleLabel}`, 34, 60);
    };

    const drawScene = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      if (camMode === 'POV') {
        drawHelmetPOV(ctx, W, H);
        return;
      }
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#090D14');
      sky.addColorStop(0.55, '#16202C');
      sky.addColorStop(1, '#1E1A18');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Sample coarse mesh (28x28) from real TerrainGrid
      const steps = 28;
      const mesh: { x: number; y: number; elev: number; slope: number }[][] = [];
      for (let r = 0; r <= steps; r++) {
        const row: { x: number; y: number; elev: number; slope: number }[] = [];
        const lat = latMin + (r / steps) * (latMax - latMin);
        for (let c = 0; c <= steps; c++) {
          const lon = lonMin + (c / steps) * (lonMax - lonMin);
          const s = sampleTerrain(grid, { lon, lat });
          const elev = s?.elevation ?? midElev;
          const slope = s?.slope ?? 4;
          const [px, py] = project(lon, lat, elev, W, H);
          row.push({ x: px, y: py, elev, slope });
        }
        mesh.push(row);
      }

      // Painter's quads
      for (let r = 0; r < steps; r++) {
        for (let c = 0; c < steps; c++) {
          const p00 = mesh[r][c];
          const p10 = mesh[r][c + 1];
          const p11 = mesh[r + 1][c + 1];
          const p01 = mesh[r + 1][c];
          const avgSlope = (p00.slope + p10.slope + p11.slope + p01.slope) * 0.25;
          const normE = Math.max(0, Math.min(1, (p00.elev - minElev) / elevSpan));
          const red = Math.round(92 + normE * 88 + (avgSlope > 15 ? 40 : 0));
          const green = Math.round(58 + normE * 56 - (avgSlope > 15 ? 12 : 0));
          const blue = Math.round(44 + normE * 36);
          ctx.beginPath();
          ctx.moveTo(p00.x, p00.y);
          ctx.lineTo(p10.x, p10.y);
          ctx.lineTo(p11.x, p11.y);
          ctx.lineTo(p01.x, p01.y);
          ctx.closePath();
          ctx.fillStyle = `rgb(${red},${green},${blue})`;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // Rover Route (NASA Blue)
      if (roverRoute && roverRoute.points.length > 1) {
        ctx.save();
        ctx.beginPath();
        roverRoute.points.forEach((pt, idx) => {
          const elev = pt.elevation_m ?? sampleTerrain(grid, pt)?.elevation ?? midElev;
          const [px, py] = project(pt.lon, pt.lat, elev + 3.5, W, H);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.shadowColor = '#0077CC';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#0077CC';
        ctx.lineWidth = 4.2;
        ctx.stroke();
        ctx.restore();
      }

      // EVA Routes (Green dashed)
      evaRoutes.forEach((eva) => {
        if (eva.points.length < 2) return;
        ctx.save();
        ctx.beginPath();
        eva.points.forEach((pt, idx) => {
          const elev = pt.elevation_m ?? sampleTerrain(grid, pt)?.elevation ?? midElev;
          const [px, py] = project(pt.lon, pt.lat, elev + 3.5, W, H);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.shadowColor = '#7CD992';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#7CD992';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.restore();
      });

      // Staging Hubs / Parkings 3D Beacons
      parkings.forEach((pk) => {
        const gz = sampleTerrain(grid, pk)?.elevation ?? midElev;
        const [gx, gy] = project(pk.lon, pk.lat, gz, W, H);
        const [tx, ty] = project(pk.lon, pk.lat, gz + 18, W, H);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = '#4FC3F7';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tx, ty, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#0077CC';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = '700 9.5px monospace';
        ctx.fillStyle = '#4FC3F7';
        ctx.fillText(`HUB ${pk.id}`, tx + 8, ty + 3);
        ctx.restore();
      });

      // Science Targets + Base
      targets.forEach((t) => {
        const gz = sampleTerrain(grid, t)?.elevation ?? midElev;
        const [gx, gy] = project(t.lon, t.lat, gz, W, H);
        const [tx, ty] = project(t.lon, t.lat, gz + (t.is_base ? 20 : 12), W, H);
        const col = t.is_base ? '#4FC3F7' : '#E8B04B';
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(tx, ty, t.is_base ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.font = '700 9.5px monospace';
        ctx.fillStyle = '#E6EDF3';
        ctx.fillText(t.id, tx + 7, ty + 3);
        ctx.restore();
      });

      // Base marker if moved
      if (base) {
        const bz = sampleTerrain(grid, base)?.elevation ?? midElev;
        const [bx, by] = project(base.lon, base.lat, bz + 16, W, H);
        ctx.save();
        ctx.fillStyle = '#4FC3F7';
        ctx.font = '700 10px monospace';
        ctx.fillText(`BASE (${vehicleLabel})`, bx + 8, by - 4);
        ctx.restore();
      }

      // Autonomous Scout Drone CHOPPER-1 with Green LiDAR Cone
      const angle = tickRef.current * 0.025;
      const dLon = lonMid + Math.cos(angle) * (lonMax - lonMin) * 0.22;
      const dLat = latMid + Math.sin(angle) * (latMax - latMin) * 0.22;
      const dz = sampleTerrain(grid, { lon: dLon, lat: dLat })?.elevation ?? midElev;
      const [dgx, dgy] = project(dLon, dLat, dz, W, H);
      const [dhx, dhy] = project(dLon, dLat, dz + 28, W, H);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(dhx, dhy);
      ctx.lineTo(dgx - 18, dgy + 4);
      ctx.lineTo(dgx + 18, dgy + 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(124, 217, 146, 0.18)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dhx, dhy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#7CD992';
      ctx.fill();
      ctx.font = '700 9px monospace';
      ctx.fillStyle = '#7CD992';
      ctx.fillText('CHOPPER-1 LiDAR', dhx + 7, dhy + 3);
      ctx.restore();

      // Live crew/rover marker during Simulation
      if (livePosition) {
        const lz = sampleTerrain(grid, livePosition)?.elevation ?? midElev;
        const [lx, ly] = project(livePosition.lon, livePosition.lat, lz + 10, W, H);
        ctx.save();
        ctx.beginPath();
        ctx.arc(lx, ly, 9, 0, Math.PI * 2);
        ctx.fillStyle = livePosition.mode === 'eva' ? 'rgba(124, 217, 146, 0.25)' : 'rgba(91, 163, 217, 0.25)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fillStyle = livePosition.mode === 'eva' ? '#7CD992' : '#5BA3D9';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = '700 10px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(livePosition.mode === 'eva' ? 'EVA CREW' : vehicleLabel, lx + 8, ly - 4);
        ctx.restore();
      }
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [grid, base, targets, roverRoute, evaRoutes, parkings, vehicleLabel, livePosition, camMode, yaw, pitch, zoom, vertExag]);

  return (
    <div className="relative h-full w-full select-none bg-surface">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          dragRef.current = { active: true, x: e.clientX, y: e.clientY };
        }}
        onMouseMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          dragRef.current = { active: true, x: e.clientX, y: e.clientY };
          setYaw((v) => v + dx * 0.008);
          setPitch((v) => Math.max(0.2, Math.min(1.25, v + dy * 0.006)));
        }}
        onMouseUp={() => {
          dragRef.current.active = false;
        }}
        onMouseLeave={() => {
          dragRef.current.active = false;
        }}
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z) => Math.max(0.65, Math.min(2.4, z * (e.deltaY < 0 ? 1.08 : 0.92))));
        }}
      />

      {/* Camera mode selector (top-left) */}
      <div className="absolute left-md top-md z-20 flex flex-wrap gap-1 rounded-md border border-outline bg-surface-container/90 p-1 font-mono text-[10px] backdrop-blur-sm">
        {(['ORBIT', 'CHASE', 'POV', 'DRONE', 'FLYOVER'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setCamMode(mode)}
            className={`rounded px-sm py-1 font-semibold transition ${
              camMode === mode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* 3D DEM Controls HUD */}
      <div className="absolute bottom-md left-md z-20 flex flex-wrap items-center gap-sm rounded-md border border-outline bg-surface-container/90 px-md py-xs font-mono text-mono-sm backdrop-blur-sm">
        <span className="text-on-surface-variant">Z-EXAG {vertExag.toFixed(1)}×</span>
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          value={vertExag}
          onChange={(e) => setVertExag(parseFloat(e.target.value))}
          className="w-24 accent-primary"
        />
        <button
          type="button"
          onClick={() => setAutoSpin((s) => !s)}
          className={`rounded border px-sm py-0.5 ${
            autoSpin ? 'border-accent bg-primary/20 text-accent' : 'border-outline text-on-surface-variant'
          }`}
        >
          {autoSpin ? '⟳ SPIN ON' : '⟳ SPIN'}
        </button>
        <span className="text-[10px] text-on-surface-variant">Drag to orbit · Scroll to zoom</span>
      </div>
    </div>
  );
}
