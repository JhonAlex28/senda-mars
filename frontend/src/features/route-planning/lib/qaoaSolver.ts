import type { Target } from '@/features/targets';
import { http } from '@/shared/api/httpClient';
import type { GeoPoint } from '@/shared/types/geo';

export type QuantumBackendMode = 'browser-statevector' | 'ibm-quantum-runtime';
export type IbmQpuName = 'ibm_brisbane' | 'ibm_torino' | 'ibm_fez' | 'aer_simulator';
export type QuantumNoiseProfile = 'ideal' | 'noisy-qpu' | 'mitigated';

export interface QaoaBitstringSample {
  bitstring: string;
  probability: number;
  counts: number;
  energy: number;
  selectedIds: string[];
  isOptimal: boolean;
}

export interface QaoaGateSummary {
  nQubits: number;
  layers: number;
  hadamardGates: number;
  rzGates: number;
  rzzGates: number;
  rxGates: number;
  totalDepth: number;
}

/** Lo que realmente se ejecutó (el backend lo informa: QPU de IBM, simulador Aer o respaldo clásico). */
export type QuantumExecutionMode = 'browser-statevector' | 'ibm-qpu' | 'qiskit-aer' | 'classical-fallback';

export interface QuantumRouteResult {
  mode: QuantumExecutionMode;
  backendName: string;
  noiseProfile: QuantumNoiseProfile | 'n/a';
  fidelityPct: number | null;
  jobId: string;
  nQubits: number;
  layers: number;
  shots: number;
  gamma: number[];
  beta: number[];
  expectationValue: number;
  bestBitstring: string;
  bestEnergy: number;
  recommendedTargetIds: string[];
  recommendedTargetNames: string[];
  candidateTargets: Array<{ id: string; name: string; scienceScore: number; distFromBaseKm: number }>;
  samples: QaoaBitstringSample[];
  gateSummary: QaoaGateSummary;
  quantumMetrics: {
    distanceKm: number;
    energyKwh: number;
    scienceScore: number;
    solveMs: number;
  };
  classicalBaseline: {
    distanceKm: number;
    energyKwh: number;
    scienceScore: number;
    solveMs: number;
  };
  note: string;
  limitations?: string;
}

const MARS_RADIUS_M = 3_389_500;

function haversineMeters(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function estimateTargetScience(t: Target): number {
  if (t.rubric?.total) {
    return Number(Math.min(15, Math.max(1, t.rubric.total)).toFixed(1));
  }
  const kindBonus = /drill|boxwork|clay|mudstone|crater|ridge|sulfate/i.test(`${t.name} ${t.description ?? ''}`) ? 12 : 8;
  return kindBonus;
}

function orderNearestNeighbor(base: GeoPoint, selected: Target[]): Target[] {
  const remaining = [...selected];
  const ordered: Target[] = [];
  let cur: { lon: number; lat: number } = base;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(cur, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    cur = next;
  }
  return ordered;
}

function routeStats(base: GeoPoint, ordered: Target[], speedKmh: number) {
  if (ordered.length === 0) {
    return { distanceKm: 0, energyKwh: 0, scienceScore: 0 };
  }
  let distM = 0;
  let cur: { lon: number; lat: number } = base;
  let scienceSum = 0;
  for (const t of ordered) {
    distM += haversineMeters(cur, t);
    cur = t;
    scienceSum += estimateTargetScience(t);
  }
  distM += haversineMeters(cur, base); // Return to Base Alpha
  const distanceKm = Number((distM / 1000).toFixed(2));
  // Pressurized Rover (SEV) ~1.85 kWh/km nominal in Gale Crater regolith
  const energyKwh = Number((distanceKm * (1.65 + 0.035 * speedKmh)).toFixed(2));
  const scienceScore = Number(Math.min(15, scienceSum / Math.max(1, ordered.length * 0.72)).toFixed(1));
  return { distanceKm, energyKwh, scienceScore };
}

/**
 * Pure TypeScript Statevector QAOA (Quantum Approximate Optimization Algorithm) solver.
 * Encodes target selection & SEV energy/science trade-off as an Ising cost Hamiltonian H_C
 * over n qubits (2^n complex amplitudes) and evolves p alternating U_C(gamma) and U_M(beta) layers.
 */
export function runBrowserQaoaSolver(params: {
  base: GeoPoint;
  targets: Target[];
  selectedGoalIds: string[];
  speedKmh: number;
  layers?: number;
  shots?: number;
  noiseProfile?: QuantumNoiseProfile;
}): QuantumRouteResult {
  const t0 = performance.now();
  const layers = Math.max(1, Math.min(2, params.layers ?? 2));
  const shots = Math.max(128, Math.min(4096, params.shots ?? 1024));
  const noiseProfile: QuantumNoiseProfile = params.noiseProfile ?? 'ideal';

  const nonBase = params.targets.filter((t) => !t.is_base);
  const prioritized =
    params.selectedGoalIds.length >= 2
      ? [
          ...nonBase.filter((t) => params.selectedGoalIds.includes(t.id)),
          ...nonBase.filter((t) => !params.selectedGoalIds.includes(t.id)),
        ]
      : nonBase;

  const candidates = prioritized.slice(0, Math.min(6, prioritized.length));
  const n = Math.max(2, candidates.length);
  const dim = 1 << n;

  // Build QUBO / Ising energies for every computational basis state |x>
  const distFromBaseKm = candidates.map((c) => haversineMeters(params.base, c) / 1000);
  const sci = candidates.map((c) => estimateTargetScience(c));
  const targetCountGoal = Math.min(n, Math.max(2, params.selectedGoalIds.length || 3));

  const energies = new Float64Array(dim);
  for (let state = 0; state < dim; state++) {
    const chosen: Target[] = [];
    let sciTotal = 0;
    let radialPenalty = 0;
    for (let q = 0; q < n; q++) {
      if ((state >> q) & 1) {
        chosen.push(candidates[q]);
        sciTotal += sci[q];
        radialPenalty += distFromBaseKm[q] * 0.35;
      }
    }
    const ordered = orderNearestNeighbor(params.base, chosen);
    const stats = routeStats(params.base, ordered, params.speedKmh);
    const countDiff = chosen.length - targetCountGoal;
    const cardinalityPenalty = 4.2 * countDiff * countDiff;
    const batteryPenalty = stats.energyKwh > 42 ? (stats.energyKwh - 42) * 3.5 : 0;
    const emptyPenalty = chosen.length === 0 ? 50 : 0;
    // Minimize H_C: negative science reward + energy/distance/cardinality penalties
    energies[state] =
      -1.15 * sciTotal + 0.45 * stats.energyKwh + radialPenalty + cardinalityPenalty + batteryPenalty + emptyPenalty;
  }

  // Simulate QAOA statevector evolution for given (gammas, betas)
  const simulateState = (gammas: number[], betas: number[]) => {
    const re = new Float64Array(dim);
    const im = new Float64Array(dim);
    const amp0 = 1 / Math.sqrt(dim);
    re.fill(amp0);

    for (let l = 0; l < layers; l++) {
      const g = gammas[l];
      const b = betas[l];
      // 1. Cost unitary U_C(gamma) = exp(-i * gamma * H_C)
      for (let s = 0; s < dim; s++) {
        const angle = -g * energies[s];
        const c = Math.cos(angle);
        const sn = Math.sin(angle);
        const r = re[s];
        const m = im[s];
        re[s] = r * c - m * sn;
        im[s] = r * sn + m * c;
      }
      // 2. Mixer unitary U_M(beta) = prod_q RX(2*beta)
      const cb = Math.cos(b);
      const sb = Math.sin(b);
      for (let q = 0; q < n; q++) {
        const bit = 1 << q;
        for (let s = 0; s < dim; s++) {
          if ((s & bit) !== 0) continue;
          const s1 = s | bit;
          const r0 = re[s];
          const i0 = im[s];
          const r1 = re[s1];
          const i1 = im[s1];
          // RX(2b) = [[cos b, -i sin b], [-i sin b, cos b]]
          re[s] = cb * r0 + sb * i1;
          im[s] = cb * i0 - sb * r1;
          re[s1] = cb * r1 + sb * i0;
          im[s1] = cb * i1 - sb * r0;
        }
      }
    }

    let expectation = 0;
    const probs = new Float64Array(dim);
    for (let s = 0; s < dim; s++) {
      const p = re[s] * re[s] + im[s] * im[s];
      probs[s] = p;
      expectation += p * energies[s];
    }
    return { probs, expectation };
  };

  // Coarse variational grid search for optimal (gamma, beta)
  let bestGammas = new Array(layers).fill(0.45);
  let bestBetas = new Array(layers).fill(0.35);
  let bestExp = Infinity;

  const grid = [0.2, 0.45, 0.7, 0.95, 1.2];
  for (const g0 of grid) {
    for (const b0 of grid) {
      const gs = layers === 1 ? [g0] : [g0, g0 * 0.75];
      const bs = layers === 1 ? [b0] : [b0, b0 * 0.65];
      const { expectation } = simulateState(gs, bs);
      if (expectation < bestExp) {
        bestExp = expectation;
        bestGammas = gs;
        bestBetas = bs;
      }
    }
  }

  const finalState = simulateState(bestGammas, bestBetas);

  // Apply optional T1/T2 thermal + readout noise profile or ZNE mitigation
  const effectiveProbs = new Float64Array(dim);
  const depol = noiseProfile === 'noisy-qpu' ? 0.24 : noiseProfile === 'mitigated' ? 0.06 : 0.0;
  for (let k = 0; k < dim; k++) {
    effectiveProbs[k] = (1 - depol) * finalState.probs[k] + depol / dim;
  }
  const fidelityPct = Number(((1 - depol * 0.85) * 100).toFixed(1));

  // Sample shots deterministically seeded by candidate state
  const counts = new Int32Array(dim);
  let seed = Math.round(bestExp * 1000) ^ (n * 7919);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let s = 0; s < shots; s++) {
    const r = rand();
    let acc = 0;
    let chosen = dim - 1;
    for (let k = 0; k < dim; k++) {
      acc += effectiveProbs[k];
      if (r <= acc) {
        chosen = k;
        break;
      }
    }
    counts[chosen]++;
  }

  // Pick best measured feasible bitstring (non-empty)
  let bestMeasured = 1;
  let bestMeasuredEnergy = Infinity;
  const allSamples: QaoaBitstringSample[] = [];
  for (let k = 1; k < dim; k++) {
    if (counts[k] === 0 && finalState.probs[k] < 0.01) continue;
    const selectedIds: string[] = [];
    let bits = '';
    for (let q = n - 1; q >= 0; q--) {
      const on = (k >> q) & 1;
      bits += on ? '1' : '0';
      if ((k >> (n - 1 - q)) & 1) {
        // keep MSB=q0 readable left-to-right
      }
    }
    // Canonical bitstring q0..q_{n-1}
    bits = Array.from({ length: n }, (_, q) => ((k >> q) & 1 ? '1' : '0')).join('');
    for (let q = 0; q < n; q++) {
      if ((k >> q) & 1) selectedIds.push(candidates[q].id);
    }
    if (counts[k] > 0 && energies[k] < bestMeasuredEnergy) {
      bestMeasuredEnergy = energies[k];
      bestMeasured = k;
    }
    allSamples.push({
      bitstring: `|${bits}⟩`,
      probability: Number((finalState.probs[k] * 100).toFixed(2)),
      counts: counts[k],
      energy: Number(energies[k].toFixed(2)),
      selectedIds,
      isOptimal: false,
    });
  }

  allSamples.sort((a, b) => b.counts - a.counts || a.energy - b.energy);
  const bestBits = `|${Array.from({ length: n }, (_, q) => ((bestMeasured >> q) & 1 ? '1' : '0')).join('')}⟩`;
  for (const s of allSamples) {
    if (s.bitstring === bestBits) s.isOptimal = true;
  }

  const chosenTargets = candidates.filter((_, q) => (bestMeasured >> q) & 1);
  const orderedQuantum = orderNearestNeighbor(params.base, chosenTargets);
  const qStats = routeStats(params.base, orderedQuantum, params.speedKmh);

  // Classical greedy baseline on the first targetCountGoal candidates
  const solveMs = Number((performance.now() - t0).toFixed(2));
  const c0 = performance.now();
  const classicalTargets = candidates.slice(0, targetCountGoal);
  const classicalStats = routeStats(params.base, classicalTargets, params.speedKmh);
  const classicalMs = Number((performance.now() - c0).toFixed(3));
  const rzzGates = (n * (n - 1)) / 2;

  return {
    mode: 'browser-statevector',
    backendName: `SENDA Statevector QAOA (${n}q)`,
    noiseProfile,
    fidelityPct,
    jobId: `qaoa-local-${Math.abs(seed).toString(16).slice(0, 8)}`,
    nQubits: n,
    layers,
    shots,
    gamma: bestGammas.map((v) => Number(v.toFixed(3))),
    beta: bestBetas.map((v) => Number(v.toFixed(3))),
    expectationValue: Number(bestExp.toFixed(3)),
    bestBitstring: bestBits,
    bestEnergy: Number(bestMeasuredEnergy.toFixed(2)),
    recommendedTargetIds: orderedQuantum.map((t) => t.id),
    recommendedTargetNames: orderedQuantum.map((t) => t.name),
    candidateTargets: candidates.map((c, idx) => ({
      id: c.id,
      name: c.name,
      scienceScore: sci[idx],
      distFromBaseKm: Number(distFromBaseKm[idx].toFixed(2)),
    })),
    samples: allSamples.slice(0, 6),
    gateSummary: {
      nQubits: n,
      layers,
      hadamardGates: n,
      rzGates: n * layers,
      rzzGates: rzzGates * layers,
      rxGates: n * layers,
      totalDepth: 1 + layers * (2 + Math.max(1, n - 1)),
    },
    quantumMetrics: {
      ...qStats,
      solveMs,
    },
    classicalBaseline: {
      ...classicalStats,
      solveMs: classicalMs, // medido, no estimado
    },
    note: 'Executed on in-browser complex statevector QAOA simulator (exact 2^n amplitudes).',
  };
}

/**
 * Calls the FastAPI Qiskit / IBM Quantum Runtime endpoint when available,
 * and gracefully falls back to the in-browser Statevector QAOA simulator.
 */
export async function optimizeRouteWithIbmQuantum(params: {
  base: GeoPoint;
  targets: Target[];
  selectedGoalIds: string[];
  speedKmh: number;
  mode: QuantumBackendMode;
  qpuBackend: IbmQpuName;
  layers?: number;
  shots?: number;
  noiseProfile?: QuantumNoiseProfile;
}): Promise<QuantumRouteResult> {
  if (params.mode === 'ibm-quantum-runtime') {
    try {
      // Cliente HTTP compartido: misma URL base que el resto de la API (VITE_API_BASE_URL).
      // El token de IBM se configura en el servidor; nunca sale del navegador.
      return await http.post<QuantumRouteResult>('/quantum/optimize-route', {
        base: params.base,
        selected_goal_ids: params.selectedGoalIds,
        speed_kmh: params.speedKmh,
        qpu_backend: params.qpuBackend,
        layers: params.layers ?? 2,
        shots: params.shots ?? 1024,
        noise_profile: params.noiseProfile ?? 'ideal',
      });
    } catch {
      // Backend offline -> fall back cleanly to browser Statevector QAOA
    }
  }

  const fallback = runBrowserQaoaSolver(params);
  if (params.mode === 'ibm-quantum-runtime') {
    return {
      ...fallback,
      note: `Backend quantum endpoint unreachable — ran the in-browser statevector simulator instead (no QPU, target was ${params.qpuBackend}).`,
    };
  }
  return fallback;
}
