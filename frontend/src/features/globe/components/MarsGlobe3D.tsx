import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadMarsTexture } from '../lib/marsTexture';
import type { Site } from '../sites';
import { MarsGlobe } from './MarsGlobe';

const SIZE = 520;
const CAMERA_DISTANCE = 4.4;
const FLY_MS = 900;
const RESUME_SPIN_MS = 8000;

/** Punto de la esfera unidad para (lat, lon), coherente con las UV de THREE.SphereGeometry. */
function surfacePoint(lat: number, lon: number): THREE.Vector3 {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

/**
 * Halo fino de atmósfera alrededor del limbo. Es una esfera algo mayor vista por dentro (BackSide):
 * solo se pinta fuera del disco del planeta, así no tiñe la superficie.
 */
function atmosphere(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: { glow: { value: new THREE.Color('#E9A07A') } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 glow;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float k = clamp(-dot(vNormal, vView) * 2.6, 0.0, 1.0);
        gl_FragColor = vec4(glow, pow(k, 2.2) * 0.45);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), material);
}

interface MarsGlobe3DProps {
  sites: Site[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * Marte en 3D con la imagen real de NASA: se arrastra para girar, la rueda acerca y cada sitio es un
 * marcador que sigue al planeta. Al elegir un sitio el globo gira hasta dejarlo de frente.
 */
export function MarsGlobe3D({ sites, selectedId, onSelect }: MarsGlobe3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const flyToRef = useRef<(site: Site) => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [textureReady, setTextureReady] = useState(false);

  // Escena: se crea una vez y se libera al desmontar
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(SIZE, SIZE);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(camera);
    scene.add(new THREE.AmbientLight('#ffffff', 0.3));
    const sun = new THREE.DirectionalLight('#fff6ee', 3.2);
    // Luz lateral que viaja con la cámara: cara visible iluminada y una sombra suave en un borde (da volumen)
    sun.position.set(-3, 1.4, 2.2);
    camera.add(sun);

    const material = new THREE.MeshStandardMaterial({ color: '#B5532B', roughness: 1, metalness: 0 });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), material);
    scene.add(planet);
    const air = atmosphere();
    scene.add(air);

    // Subtle NASA telemetry grid + MRO/Odyssey/MAVEN orbital rings
    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#38BDF8', wireframe: true, transparent: true, opacity: 0.08 }),
    );
    scene.add(wire);

    const orbitSpecs: [number, number, number, number][] = [
      [1.18, 0.45, 0.3, 0.28],
      [1.24, -0.62, 0.55, 0.22],
      [1.31, 0.95, -0.35, 0.16],
    ];
    for (const [radius, rx, rz, opacity] of orbitSpecs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.0025, 8, 128),
        new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity }),
      );
      ring.rotation.set(rx, 0, rz);
      scene.add(ring);
    }

    let texture: THREE.Texture | null = null;
    let disposed = false;
    loadMarsTexture(2)
      .then((canvas) => {
        if (disposed) return;
        texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        material.map = texture;
        material.color.set('#ffffff');
        material.needsUpdate = true;
        setTextureReady(true);
      })
      .catch(() => setTextureReady(true)); // sin conexión: queda el color liso, el globo sigue funcionando

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 2.4;
    controls.maxDistance = 6;
    controls.autoRotateSpeed = 0.5;
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const spinWanted = controls.autoRotate;

    let resumeTimer = 0;
    const pauseSpin = () => {
      controls.autoRotate = false;
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => (controls.autoRotate = spinWanted), RESUME_SPIN_MS);
    };
    controls.addEventListener('start', pauseSpin);

    // Vuelo de cámara hasta dejar el sitio de frente (interpolación esférica de la dirección)
    let flight: { from: THREE.Vector3; to: THREE.Vector3; start: number } | null = null;
    flyToRef.current = (site) => {
      pauseSpin();
      const to = surfacePoint(site.lat, site.lon).normalize();
      flight = { from: camera.position.clone().normalize(), to, start: performance.now() };
    };
    const active = sites.find((s) => s.id === selectedId) ?? sites[0];
    camera.position.copy(surfacePoint(active.lat + 12, active.lon).multiplyScalar(CAMERA_DISTANCE));
    controls.update();

    const points = sites.map((s) => ({ id: s.id, p: surfacePoint(s.lat, s.lon).multiplyScalar(1.005) }));
    const projected = new THREE.Vector3();
    const toCamera = new THREE.Vector3();

    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (flight) {
        const k = Math.min((performance.now() - flight.start) / FLY_MS, 1);
        const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const dist = camera.position.length();
        const dir = flight.from.clone().lerp(flight.to, ease).normalize();
        camera.position.copy(dir.multiplyScalar(dist));
        if (k === 1) flight = null;
      }
      controls.update();
      renderer.render(scene, camera);

      // Marcadores HTML: se colocan sobre su punto y se ocultan cuando quedan detrás del planeta
      toCamera.copy(camera.position).normalize();
      for (const { id, p } of points) {
        const el = markerRefs.current.get(id);
        if (!el) continue;
        const facing = p.clone().normalize().dot(toCamera);
        projected.copy(p).project(camera);
        const x = ((projected.x + 1) / 2) * SIZE;
        const y = ((1 - projected.y) / 2) * SIZE;
        el.style.transform = `translate(${x}px, ${y}px)`;
        const visible = facing > 0.12;
        el.style.opacity = visible ? String(Math.min(1, (facing - 0.12) * 4)) : '0';
        el.style.pointerEvents = visible ? 'auto' : 'none';
        el.tabIndex = visible ? 0 : -1;
      }
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(resumeTimer);
      controls.dispose();
      planet.geometry.dispose();
      material.dispose();
      air.geometry.dispose();
      (air.material as THREE.Material).dispose();
      texture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // La escena se monta una sola vez; los cambios de selección se aplican con flyToRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar de sitio (por el marcador o por la lista), el globo gira hasta él
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const site = sites.find((s) => s.id === selectedId);
    if (site) flyToRef.current(site);
  }, [selectedId, sites]);

  if (failed) return <MarsGlobe />;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      {/* El canvas de three.js vive en su propio contenedor, fuera de los nodos que maneja React */}
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {sites.map((site) => {
          const selected = site.id === selectedId;
          return (
            <button
              key={site.id}
              ref={(el) => {
                if (el) markerRefs.current.set(site.id, el);
                else markerRefs.current.delete(site.id);
              }}
              type="button"
              onClick={() => onSelect(site.id)}
              aria-label={site.name}
              aria-pressed={selected}
              style={{ opacity: 0 }}
              className="group absolute left-0 top-0 z-10 transition-opacity duration-fast focus:outline-none"
            >
              <span className="relative -ml-2 -mt-2 flex h-4 w-4">
                {site.active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />}
                <span
                  className={`relative h-4 w-4 rounded-full border-2 ${
                    site.active ? 'border-on-surface bg-primary shadow-[0_0_14px_#3B82F6]' : 'border-on-surface/80 bg-surface-container-high'
                  } ${selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-transparent' : ''}`}
                />
              </span>
              <span
                className={`absolute bottom-[14px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-surface-container/95 px-sm py-[2px] font-label text-label-sm uppercase text-on-surface shadow-lg transition-opacity duration-fast ${
                  selected ? 'border-primary opacity-100' : 'border-outline opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                }`}
              >
                {site.name}
              </span>
            </button>
          );
        })}
      </div>
      {!textureReady && (
        <span className="pointer-events-none absolute inset-x-0 bottom-md text-center font-label text-label-sm uppercase text-on-surface-variant">
          Loading NASA imagery…
        </span>
      )}
    </div>
  );
}
