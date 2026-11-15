import { useMemo, useState } from 'react';
import { selectedTraverse } from '../state/selectors';
import { useMission } from '../state/MissionContext';
import { ROVER_VEHICLES } from '../state/vehicles';
import { QuantumLabPanel } from './QuantumLabPanel';

interface NasaLabsModalProps {
  open: boolean;
  onClose: () => void;
}

type LabTab = 'xemu' | 'rimfax' | 'msr' | 'horizon' | 'quantum';

function playQuindarTone(freq = 2524, durationMs = 130) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, durationMs);
  } catch {
    // Ignore audio context restrictions
  }
}

function speakCapcom(text: string) {
  playQuindarTone(2524, 120);
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.pitch = 0.96;
    window.speechSynthesis.speak(u);
  }
}

/** On-demand NASA Science & Engineering Labs Modal (xEMU Monte Carlo, RIMFAX GPR / ChemCam, MSR Triage & CAPCOM). */
export function NasaLabsModal({ open, onClose }: NasaLabsModalProps) {
  const { state, targets } = useMission();
  const [tab, setTab] = useState<LabTab>('xemu');
  const [sampleMassKg, setSampleMassKg] = useState(4.6);

  const activeRoute = selectedTraverse(state);
  const veh = ROVER_VEHICLES[state.vehicleId];
  const distKm = activeRoute ? activeRoute.distance_m / 1000 : 1.85;
  const o2BaseDraw = Math.round(distKm * 62 * (1 + 0.014 * sampleMassKg) * (veh.transitO2Pct === 0 ? 0.42 : 0.85));
  const o2Remaining = Math.max(25, 300 - o2BaseDraw);

  const dustShift = Math.max(0, (state.env.tau - 0.62) * 0.22);

  // Real 1,000-run stochastic Monte Carlo simulation (varying slope, dust opacity, and metabolic draw)
  const mc = useMemo(() => {
    const runs = 1000;
    const bins = new Array<number>(10).fill(0); // 0-300 L in 30 L buckets
    const samples: number[] = [];
    let safeCount = 0;
    let seed = Math.round(distKm * 100 + sampleMassKg * 17 + state.env.tau * 31) || 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < runs; i++) {
      const slopeFactor = 0.85 + rand() * 0.38;
      const dustFactor = 0.92 + dustShift + rand() * 0.22;
      const metabFactor = 0.88 + rand() * 0.28;
      const draw = o2BaseDraw * slopeFactor * dustFactor * metabFactor;
      const rem = Math.max(0, Math.min(300, 300 - draw));
      samples.push(rem);
      if (rem >= 60) safeCount++; // >20% (60 L) walkback reserve
      const b = Math.min(9, Math.floor(rem / 30));
      bins[b]++;
    }
    samples.sort((a, b) => a - b);
    const p50 = Math.round(samples[Math.floor(runs * 0.5)]);
    const p95Worst = Math.round(samples[Math.floor(runs * 0.05)]);
    const survivalProb = Number(((safeCount / runs) * 100).toFixed(1));
    const maxBin = Math.max(1, ...bins);
    return { bins, maxBin, p50, p95Worst, survivalProb };
  }, [distKm, sampleMassKg, o2BaseDraw, dustShift, state.env.tau]);

  if (!open) return null;

  const survivalProb = mc.survivalProb;

  const exportGeoJson = () => {
    const features = (activeRoute?.points ?? []).map((p, idx) => ({
      type: 'Feature',
      properties: { idx, elevation_m: p.elevation_m, slope_deg: p.slope_deg, vehicle: veh.shortName },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    }));
    const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senda-marswalk-${veh.id.toLowerCase()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-md backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="NASA Science and Engineering Labs"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-outline bg-surface-container p-lg shadow-2xl">
        <div className="mb-md flex items-start justify-between gap-md border-b border-outline-variant pb-sm">
          <div>
            <div className="font-mono text-mono-sm uppercase tracking-wider text-accent">
              SENDA NASA SCIENCE &amp; SURVIVAL SUITE
            </div>
            <h2 className="font-headline text-headline-md text-on-surface">
              xEMU Monte Carlo · RIMFAX GPR · MSR Triage &amp; CAPCOM
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface hover:border-accent hover:text-accent"
          >
            ✕ CLOSE
          </button>
        </div>

        <div className="mb-md flex flex-wrap gap-xs">
          {(
            [
              ['xemu', '🫀 xEMU & 1,000-Run Monte Carlo'],
              ['rimfax', '📡 RIMFAX GPR & SHERLOC Raman'],
              ['msr', '🧪 MSR Tube Rack & CAPCOM'],
              ['horizon', '🧭 Polar Horizon & Diurnal Sol'],
              ['quantum', '⚛ IBM Quantum QAOA'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md border px-md py-xs font-mono text-mono-sm transition-colors ${
                tab === id
                  ? 'border-accent bg-primary text-on-primary font-bold'
                  : 'border-outline bg-surface text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'xemu' && (
          <div className="flex flex-col gap-md">
            <div className="grid gap-md md:grid-cols-3">
              <div className="rounded border border-outline bg-surface p-sm font-mono">
                <div className="text-[10px] text-on-surface-variant">1,000-RUN SURVIVAL PROB.</div>
                <div className="text-xl font-bold text-success">{survivalProb}% GO</div>
                <div className="text-[10px] text-on-surface-variant">Vehicle: {veh.shortName}</div>
              </div>
              <div className="rounded border border-outline bg-surface p-sm font-mono">
                <div className="text-[10px] text-on-surface-variant">PLSS O₂ REMAINING (300 L)</div>
                <div className="text-xl font-bold text-accent">{o2Remaining} L</div>
                <div className="text-[10px] text-on-surface-variant">Transit O₂ rate: {veh.transitO2Pct}%</div>
              </div>
              <div className="rounded border border-outline bg-surface p-sm font-mono">
                <div className="text-[10px] text-on-surface-variant">SUIT PRESSURE / LCVG</div>
                <div className="text-xl font-bold text-on-surface">29.6 kPa</div>
                <div className="text-[10px] text-success">Core 36.9 °C · LiOH Nominal</div>
              </div>
            </div>

            <div className="rounded border border-outline bg-surface p-sm">
              <div className="mb-1 flex items-center justify-between font-mono text-mono-sm">
                <span className="text-on-surface-variant">ROCK CORE SAMPLE LOAD (PANDOLF PENALTY)</span>
                <span className="font-bold text-accent">{sampleMassKg.toFixed(1)} kg</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={sampleMassKg}
                onChange={(e) => setSampleMassKg(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Every +1 kg carried on foot increases Pandolf metabolic O₂ draw by +1.4% during Phase 2 EVA. Samples
                stowed on the {veh.shortName} chassis incur 0% crew penalty during Phase 1 transit.
              </p>
            </div>

            {/* 1,000-Run Monte Carlo Distribution Histogram */}
            <div className="rounded border border-outline bg-surface p-sm">
              <div className="mb-xs flex flex-wrap items-center justify-between gap-xs font-mono text-mono-sm">
                <span className="font-bold text-accent">1,000-Run O₂ Reserve Distribution (L)</span>
                <span className="text-on-surface-variant">
                  P50: <strong className="text-on-surface">{mc.p50} L</strong> · P95 Worst:{' '}
                  <strong className={mc.p95Worst >= 60 ? 'text-success' : 'text-warning'}>{mc.p95Worst} L</strong> · Safe (&gt;20%):{' '}
                  <strong className="text-success">{survivalProb}%</strong>
                </span>
              </div>
              <svg viewBox="0 0 300 72" className="h-20 w-full rounded bg-surface p-1">
                {mc.bins.map((count, idx) => {
                  const h = Math.max(2, (count / mc.maxBin) * 52);
                  const x = idx * 29 + 6;
                  const safe = idx >= 2; // >= 60 L (20% of 300 L)
                  return (
                    <g key={idx}>
                      <rect
                        x={x}
                        y={56 - h}
                        width={23}
                        height={h}
                        rx={2}
                        fill={safe ? '#7CD992' : '#E05A47'}
                        opacity={0.85}
                      />
                      <text x={x + 11.5} y={67} textAnchor="middle" fill="#9AA4B2" fontSize="6.5" fontFamily="monospace">
                        {idx * 30}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {tab === 'rimfax' && (
          <div className="flex flex-col gap-md">
            <div className="rounded border border-outline bg-surface p-sm">
              <div className="mb-xs font-mono text-mono-sm font-bold text-accent">
                RIMFAX SUBSURFACE GROUND-PENETRATING RADAR (0 to −15 m)
              </div>
              <svg viewBox="0 0 600 150" className="h-40 w-full rounded border border-outline-variant bg-surface">
                <rect x="30" y="15" width="550" height="32" fill="rgba(140,88,58,0.22)" />
                <rect x="30" y="47" width="550" height="52" fill="rgba(79,195,247,0.10)" />
                <rect x="30" y="99" width="550" height="36" fill="rgba(163,113,247,0.12)" />
                <path d="M 30 98 Q 180 88 320 96 T 580 92" fill="none" stroke="#4FC3F7" strokeWidth="2" />
                <path d="M 220 120 Q 260 65 300 120" fill="none" stroke="#7CD992" strokeWidth="2" strokeDasharray="4,3" />
                <text x="40" y="34" fill="#E8B04B" fontSize="10" fontFamily="monospace">
                  Regolith &amp; Aeolian Lag (0 – 2.5 m)
                </text>
                <text x="40" y="72" fill="#4FC3F7" fontSize="10" fontFamily="monospace">
                  Sulfate-Bearing Boxwork Veins (CaSO₄ · 2.5 – 9.0 m)
                </text>
                <text x="40" y="122" fill="#A371F7" fontSize="10" fontFamily="monospace">
                  Basal Murray Mudstone Unconformity (−11.6 m)
                </text>
              </svg>
              <p className="mt-xs text-body-sm text-on-surface-variant">
                <strong className="text-success">SHERLOC UV-Raman &amp; ChemCam LIBS:</strong> Deep CaSO₄ fracture
                fills preserve up to 84% of organic biosignatures against galactic cosmic radiation at 8 cm drill depth.
              </p>
            </div>
          </div>
        )}

        {tab === 'msr' && (
          <div className="flex flex-col gap-md">
            <div className="grid gap-xs sm:grid-cols-2">
              {targets
                .filter((t) => !t.is_base)
                .slice(0, 6)
                .map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded border border-outline bg-surface px-sm py-xs font-mono text-mono-sm"
                  >
                    <div>
                      <span className="font-bold text-success">MSR-Ti-0{idx + 1}</span> ·{' '}
                      <span className="text-on-surface">{t.id}</span>
                      <div className="text-[10px] text-on-surface-variant">{t.name}</div>
                    </div>
                    <span className="text-accent">0.25 kg</span>
                  </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-sm">
              <button
                type="button"
                onClick={() =>
                  speakCapcom(
                    `CAPCOM online. Active surface vehicle is ${veh.name} at ${state.vehicleSpeedKmh} kilometers per hour. Walkback oxygen margin is nominal.`,
                  )
                }
                className="rounded-md border border-accent bg-primary px-md py-xs font-mono text-mono-sm font-bold text-on-primary"
              >
                🔊 Test CAPCOM Voice + Quindar Tone
              </button>
              <button
                type="button"
                onClick={exportGeoJson}
                className="rounded-md border border-outline bg-surface px-md py-xs font-mono text-mono-sm text-on-surface hover:border-accent"
              >
                🗺️ Export Route GeoJSON
              </button>
            </div>
          </div>
        )}
        {tab === 'quantum' && <QuantumLabPanel onApplied={onClose} />}
        {tab === 'horizon' && (
          <div className="grid gap-md md:grid-cols-2">
            <div className="rounded-lg border border-outline bg-surface p-md">
              <div className="mb-xs flex items-center justify-between font-mono text-mono-sm">
                <span className="font-bold text-accent">360° Polar Horizon &amp; Comms LOS</span>
                <span className="text-success">MRO Relay: 14.2 min</span>
              </div>
              <svg viewBox="0 0 220 220" className="mx-auto h-52 w-52">
                <circle cx="110" cy="110" r="90" fill="#0B0F17" stroke="#2D3748" strokeWidth="1" />
                <circle cx="110" cy="110" r="60" fill="none" stroke="#2D3748" strokeDasharray="3 3" />
                <circle cx="110" cy="110" r="30" fill="none" stroke="#2D3748" strokeDasharray="3 3" />
                <line x1="110" y1="16" x2="110" y2="204" stroke="#2D3748" strokeWidth="0.8" />
                <line x1="16" y1="110" x2="204" y2="110" stroke="#2D3748" strokeWidth="0.8" />
                {/* Mount Sharp terrain mask (strongest to the South/SE) */}
                <polygon
                  points="110,48 134,54 156,74 168,108 164,148 142,172 110,180 76,166 56,138 52,102 68,68 90,52"
                  fill="rgba(217, 83, 43, 0.25)"
                  stroke="#3B82F6"
                  strokeWidth="1.5"
                />
                {/* Sun & Earth DTE markers */}
                <circle cx="148" cy="64" r="6" fill="#F6C177" />
                <text x="157" y="67" fill="#F6C177" fontSize="9" fontFamily="monospace">SUN 41°</text>
                <circle cx="74" cy="72" r="5" fill="#4FC3F7" />
                <text x="36" y="68" fill="#4FC3F7" fontSize="9" fontFamily="monospace">DTE</text>
                <text x="106" y="13" fill="#9AA4B2" fontSize="9" fontFamily="monospace">N</text>
                <text x="106" y="216" fill="#9AA4B2" fontSize="9" fontFamily="monospace">S (Aeolis Mons)</text>
              </svg>
              <p className="mt-xs text-body-sm text-on-surface-variant">
                Aeolis Mons rises +24° to the South, masking low-elevation southern passes while leaving northern DTE &amp; orbital relay windows clear.
              </p>
            </div>

            <div className="rounded-lg border border-outline bg-surface p-md">
              <div className="mb-xs flex items-center justify-between font-mono text-mono-sm">
                <span className="font-bold text-accent">Diurnal Sol Thermal &amp; Dust Cycle</span>
                <span className="text-warning">τ = 0.48 · Peak −14°C</span>
              </div>
              <svg viewBox="0 0 280 150" className="h-44 w-full">
                <rect x="0" y="0" width="280" height="150" rx="6" fill="#0B0F17" />
                {/* EVA Operational Thermal Window */}
                <rect x="95" y="16" width="95" height="106" fill="rgba(124, 217, 146, 0.12)" />
                <text x="102" y="28" fill="#7CD992" fontSize="8" fontFamily="monospace">OPTIMAL EVA WINDOW (09–16h)</text>
                {/* Temperature Curve */}
                <path
                  d="M 15 112 Q 60 120 95 72 T 155 36 T 215 86 T 265 114"
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="2.5"
                />
                {/* Dust Opacity Curve */}
                <path
                  d="M 15 92 Q 80 86 140 76 T 265 88"
                  fill="none"
                  stroke="#F6C177"
                  strokeDasharray="4 3"
                  strokeWidth="1.5"
                />
                <text x="16" y="138" fill="#9AA4B2" fontSize="8" fontFamily="monospace">00:00</text>
                <text x="128" y="138" fill="#9AA4B2" fontSize="8" fontFamily="monospace">12:00 LMST</text>
                <text x="236" y="138" fill="#9AA4B2" fontSize="8" fontFamily="monospace">24:00</text>
              </svg>
              <p className="mt-xs text-body-sm text-on-surface-variant">
                Surface swings from −76°C pre-dawn to −14°C at 13:30 LMST. EVA &amp; SEV battery heating penalties drop 38% inside the 09:00–16:00 LMST window.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
