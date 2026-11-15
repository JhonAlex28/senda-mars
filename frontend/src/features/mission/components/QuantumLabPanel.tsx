import { useEffect, useState } from 'react';
import {
  optimizeRouteWithIbmQuantum,
  type IbmQpuName,
  type QuantumBackendMode,
  type QuantumNoiseProfile,
  type QuantumRouteResult,
} from '@/features/route-planning';
import { useMission } from '../state/MissionContext';

interface QuantumLabPanelProps {
  onApplied?: () => void;
}

const DEFAULT_BASE = { lon: 137.42009295, lat: -4.59310427 };

export function QuantumLabPanel({ onApplied }: QuantumLabPanelProps) {
  const { state, dispatch, targets } = useMission();
  const [mode, setMode] = useState<QuantumBackendMode>('browser-statevector');
  const [qpuBackend, setQpuBackend] = useState<IbmQpuName>('ibm_brisbane');
  const [ibmToken, setIbmToken] = useState('');
  const [layers, setLayers] = useState<1 | 2>(2);
  const [shots, setShots] = useState<512 | 1024 | 2048>(1024);
  const [noiseProfile, setNoiseProfile] = useState<QuantumNoiseProfile>('ideal');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QuantumRouteResult | null>(null);

  const runOptimization = async () => {
    setRunning(true);
    try {
      const res = await optimizeRouteWithIbmQuantum({
        base: state.base ?? DEFAULT_BASE,
        targets,
        selectedGoalIds: state.goals,
        speedKmh: state.vehicleSpeedKmh,
        mode,
        qpuBackend,
        ibmToken,
        layers,
        shots,
        noiseProfile,
      });
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (targets.length > 0 && !result) {
      void runOptimization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.length]);

  const applyQuantumRoute = () => {
    if (!result || result.recommendedTargetIds.length === 0) return;
    dispatch({
      type: 'applyQuantumGoals',
      goals: result.recommendedTargetIds,
      summary: {
        backendName: result.backendName,
        jobId: result.jobId,
        nQubits: result.nQubits,
        layers: result.layers,
        shots: result.shots,
        bestBitstring: result.bestBitstring,
        expectationValue: result.expectationValue,
        recommendedTargetIds: result.recommendedTargetIds,
      },
    });
    onApplied?.();
  };

  const maxCounts = result ? Math.max(1, ...result.samples.map((s) => s.counts)) : 1;

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center justify-between gap-xs rounded border border-outline-variant bg-surface px-sm py-xs font-mono text-[10px]">
        <span className="font-bold text-[#D2B4FF]">OPTIONAL QUANTUM CO-PROCESSOR (RESEARCH ACCELERATOR)</span>
        <span className="text-on-surface-variant">
          NASA Classical A* Core remains primary &amp; runs 100% standalone without Qiskit.
        </span>
      </div>

      {/* Control Bar */}
      <div className="grid gap-sm rounded-lg border border-outline bg-surface p-sm md:grid-cols-5">
        <label className="flex flex-col gap-xxs font-mono text-[11px]">
          <span className="text-on-surface-variant">EXECUTION ENGINE</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as QuantumBackendMode)}
            className="rounded border border-outline bg-[#0D131D] px-xs py-1 text-on-surface"
          >
            <option value="browser-statevector">Browser Statevector QAOA</option>
            <option value="ibm-quantum-runtime">IBM Quantum Runtime (Qiskit API)</option>
          </select>
        </label>

        <label className="flex flex-col gap-xxs font-mono text-[11px]">
          <span className="text-on-surface-variant">QPU / SIMULATOR</span>
          <select
            value={qpuBackend}
            onChange={(e) => setQpuBackend(e.target.value as IbmQpuName)}
            disabled={mode === 'browser-statevector'}
            className="rounded border border-outline bg-[#0D131D] px-xs py-1 text-on-surface disabled:opacity-50"
          >
            <option value="ibm_brisbane">ibm_brisbane (127q Eagle)</option>
            <option value="ibm_torino">ibm_torino (133q Heron)</option>
            <option value="ibm_fez">ibm_fez (156q Heron r2)</option>
            <option value="aer_simulator">qiskit_aer_simulator</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-xs font-mono text-[11px]">
          <label className="flex flex-col gap-xxs">
            <span className="text-on-surface-variant">QAOA p</span>
            <select
              value={layers}
              onChange={(e) => setLayers(Number(e.target.value) as 1 | 2)}
              className="rounded border border-outline bg-[#0D131D] px-xs py-1 text-on-surface"
            >
              <option value={1}>p = 1</option>
              <option value={2}>p = 2</option>
            </select>
          </label>
          <label className="flex flex-col gap-xxs">
            <span className="text-on-surface-variant">SHOTS</span>
            <select
              value={shots}
              onChange={(e) => setShots(Number(e.target.value) as 512 | 1024 | 2048)}
              className="rounded border border-outline bg-[#0D131D] px-xs py-1 text-on-surface"
            >
              <option value={512}>512</option>
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-xxs font-mono text-[11px]">
          <span className="text-on-surface-variant">QPU NOISE MODEL</span>
          <select
            value={noiseProfile}
            onChange={(e) => setNoiseProfile(e.target.value as QuantumNoiseProfile)}
            className="rounded border border-outline bg-[#0D131D] px-xs py-1 text-on-surface"
          >
            <option value="ideal">Ideal (Noiseless)</option>
            <option value="noisy-qpu">Noisy QPU (T1/T2 + Readout)</option>
            <option value="mitigated">Error-Mitigated (ZNE)</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void runOptimization()}
            disabled={running}
            className="w-full rounded-md border border-[#A371F7] bg-[#1F1733] px-sm py-1.5 font-mono text-mono-sm font-bold text-[#D2B4FF] hover:bg-[#2C1F4A] disabled:opacity-60"
          >
            {running ? '⚛ RUNNING QAOA...' : '⚛ EXECUTE QAOA'}
          </button>
        </div>
      </div>

      {mode === 'ibm-quantum-runtime' && (
        <div className="flex flex-col gap-xxs rounded border border-outline-variant bg-surface p-sm font-mono text-[11px]">
          <span className="text-on-surface-variant">
            IBM QUANTUM API TOKEN (OPTIONAL — LEAVE BLANK FOR LOCAL QISKIT AER / BROWSER FALLBACK)
          </span>
          <input
            type="password"
            value={ibmToken}
            onChange={(e) => setIbmToken(e.target.value)}
            placeholder="Paste IBM Quantum Platform token (never stored)"
            className="rounded border border-outline bg-[#0D131D] px-sm py-1 text-on-surface"
          />
        </div>
      )}

      {result && (
        <>
          {/* KPI Row */}
          <div className="grid gap-sm sm:grid-cols-4 font-mono">
            <div className="rounded border border-outline bg-surface p-sm">
              <div className="text-[10px] text-on-surface-variant">OPTIMAL BITSTRING</div>
              <div className="text-lg font-bold text-[#D2B4FF]">{result.bestBitstring}</div>
              <div className="text-[10px] text-on-surface-variant">
                {result.nQubits}q · p={result.layers} · Fidelity {result.fidelityPct}%
              </div>
            </div>
            <div className="rounded border border-outline bg-surface p-sm">
              <div className="text-[10px] text-on-surface-variant">HAMILTONIAN ⟨H_C⟩</div>
              <div className="text-lg font-bold text-accent">{result.expectationValue}</div>
              <div className="text-[10px] text-on-surface-variant">Best E = {result.bestEnergy}</div>
            </div>
            <div className="rounded border border-outline bg-surface p-sm">
              <div className="text-[10px] text-on-surface-variant">QAOA ROUTE (SEV)</div>
              <div className="text-lg font-bold text-emerald-400">
                {result.quantumMetrics.distanceKm} km · {result.quantumMetrics.energyKwh} kWh
              </div>
              <div className="text-[10px] text-on-surface-variant">
                Science: {result.quantumMetrics.scienceScore}/15 · {result.quantumMetrics.solveMs} ms
              </div>
            </div>
            <div className="rounded border border-outline bg-surface p-sm">
              <div className="text-[10px] text-on-surface-variant">CLASSICAL BASELINE</div>
              <div className="text-lg font-bold text-on-surface">
                {result.classicalBaseline.distanceKm} km · {result.classicalBaseline.energyKwh} kWh
              </div>
              <div className="text-[10px] text-on-surface-variant">
                Science: {result.classicalBaseline.scienceScore}/15 · {result.shots} shots
              </div>
            </div>
          </div>

          <div className="grid gap-md md:grid-cols-2">
            {/* QAOA Circuit Diagram SVG */}
            <div className="rounded border border-outline bg-surface p-sm">
              <div className="mb-xs flex items-center justify-between font-mono text-[11px]">
                <span className="font-bold text-[#D2B4FF]">QAOA ANSATZ CIRCUIT ({result.backendName})</span>
                <span className="text-on-surface-variant">Depth {result.gateSummary.totalDepth}</span>
              </div>
              <svg viewBox="0 0 420 155" className="h-40 w-full rounded border border-outline-variant bg-[#070B10]">
                {Array.from({ length: result.nQubits }).map((_, q) => {
                  const y = 20 + q * 22;
                  return (
                    <g key={q}>
                      <text x="8" y={y + 4} fill="#9AA4B2" fontSize="9" fontFamily="monospace">
                        q{q}
                      </text>
                      <line x1="28" y1={y} x2="405" y2={y} stroke="#2B3442" strokeWidth="1.2" />
                      {/* Hadamard */}
                      <rect x="38" y={y - 8} width="18" height="16" rx="2" fill="#1F6FEB" />
                      <text x="47" y={y + 3} textAnchor="middle" fill="#FFFFFF" fontSize="9" fontFamily="monospace">
                        H
                      </text>
                      {/* RZ Cost */}
                      <rect x="82" y={y - 8} width="46" height="16" rx="2" fill="#A371F7" fillOpacity="0.85" />
                      <text x="105" y={y + 3} textAnchor="middle" fill="#FFFFFF" fontSize="8" fontFamily="monospace">
                        RZ(γ{result.gamma[0]})
                      </text>
                      {/* RZZ Entangler */}
                      {q < result.nQubits - 1 && (
                        <>
                          <line x1={155 + q * 18} y1={y} x2={155 + q * 18} y2={y + 22} stroke="#4FC3F7" strokeWidth="1.5" />
                          <circle cx={155 + q * 18} cy={y} r="3.2" fill="#4FC3F7" />
                          <circle cx={155 + q * 18} cy={y + 22} r="3.2" fill="#4FC3F7" />
                        </>
                      )}
                      {/* RX Mixer */}
                      <rect x="275" y={y - 8} width="54" height="16" rx="2" fill="#D29922" fillOpacity="0.9" />
                      <text x="302" y={y + 3} textAnchor="middle" fill="#0B0F14" fontSize="8" fontWeight="bold" fontFamily="monospace">
                        RX(2β{result.beta[0]})
                      </text>
                      {/* Measure */}
                      <rect x="358" y={y - 8} width="26" height="16" rx="2" fill="#1E2633" stroke="#7CD992" strokeWidth="1" />
                      <text x="371" y={y + 3} textAnchor="middle" fill="#7CD992" fontSize="8" fontFamily="monospace">
                        M
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-xs flex flex-wrap gap-sm font-mono text-[10px] text-on-surface-variant">
                <span>H: {result.gateSummary.hadamardGates}</span>
                <span>RZ: {result.gateSummary.rzGates}</span>
                <span>RZZ: {result.gateSummary.rzzGates}</span>
                <span>RX: {result.gateSummary.rxGates}</span>
                <span>Job: {result.jobId}</span>
              </div>
            </div>

            {/* Bitstring Measurement Histogram */}
            <div className="rounded border border-outline bg-surface p-sm">
              <div className="mb-xs flex items-center justify-between font-mono text-[11px]">
                <span className="font-bold text-accent">MEASURED BITSTRING DISTRIBUTION</span>
                <span className="text-on-surface-variant">{result.shots} shots</span>
              </div>
              <div className="flex flex-col gap-xs">
                {result.samples.map((s) => (
                  <div key={s.bitstring} className="flex flex-col gap-0.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className={s.isOptimal ? 'font-bold text-emerald-400' : 'text-on-surface'}>
                        {s.bitstring} {s.isOptimal ? '★ OPTIMAL' : ''}
                      </span>
                      <span className="text-on-surface-variant">
                        {s.probability}% ({s.counts}) · E={s.energy}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#0D131D]">
                      <div
                        className={`h-full ${s.isOptimal ? 'bg-emerald-400' : 'bg-[#A371F7]'}`}
                        style={{ width: `${Math.max(4, (s.counts / maxCounts) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommended Sequence + Apply */}
          <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-emerald-500/40 bg-surface p-sm font-mono">
            <div className="flex flex-col gap-xxs">
              <span className="text-[10px] text-emerald-400 font-bold">
                QUANTUM-OPTIMIZED WAYPOINT SEQUENCE ({result.recommendedTargetIds.length} TARGETS)
              </span>
              <span className="text-xs text-on-surface">
                Base Alpha → {result.recommendedTargetNames.join(' → ')} → Base Alpha
              </span>
              <span className="text-[10px] text-on-surface-variant">{result.note}</span>
            </div>
            <button
              type="button"
              onClick={applyQuantumRoute}
              className="rounded-md border border-emerald-400 bg-emerald-500/20 px-md py-xs font-mono text-mono-sm font-bold text-emerald-300 hover:bg-emerald-500/30"
            >
              ✓ APPLY QUANTUM SEQUENCE
            </button>
          </div>
        </>
      )}
    </div>
  );
}
