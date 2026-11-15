"""Adaptador del puerto QuantumOptimizer: selección de objetivos con un circuito tipo QAOA.

Ejecuta el circuito en IBM Quantum (si hay token y Qiskit Runtime), en el simulador local
Qiskit Aer (si Qiskit está instalado) o, si no hay Qiskit, con un respaldo clásico.
La respuesta dice siempre con honestidad qué se ejecutó (`mode`):
  "ibm-qpu"            circuito ejecutado en hardware de IBM
  "qiskit-aer"         circuito ejecutado en el simulador local de Qiskit
  "classical-fallback" no se ejecutó ningún circuito

Límite conocido: los ángulos del circuito son fijos y no codifican el problema; las
combinaciones medidas se puntúan con la función de costo clásica. Con pocos qubits y
muchos disparos se miden casi todas, así que el resultado equivale a una búsqueda
exhaustiva. Se informa en `limitations` para no presentarlo como ventaja cuántica.
"""
from __future__ import annotations

import math
import time
import uuid
from collections.abc import Sequence
from typing import Any

from senda.domain.models.geo import GeoPoint
from senda.domain.models.target import ScienceTarget

MAX_QUBITS = 6
LIMITATIONS = ("Fixed-angle circuit: it does not encode the cost function. Measured "
               "bitstrings are scored classically, so with few qubits this matches an "
               "exhaustive classical search. Distances are straight lines, not terrain paths.")


def _haversine_m(a: GeoPoint, b: GeoPoint) -> float:
    r = 3_389_500.0   # radio de Marte
    d_lat = math.radians(b.lat - a.lat)
    d_lon = math.radians(b.lon - a.lon)
    h = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(a.lat)) * math.cos(math.radians(b.lat)) * math.sin(d_lon / 2) ** 2)
    return 2.0 * r * math.asin(min(1.0, math.sqrt(h)))


def _science(t: ScienceTarget) -> float:
    return round(min(15.0, max(1.0, float(t.rubric.total))), 1)


def _order_nearest(base: GeoPoint, chosen: Sequence[ScienceTarget]) -> list[ScienceTarget]:
    remaining, ordered, here = list(chosen), [], base
    while remaining:
        nxt = min(remaining, key=lambda t: _haversine_m(here, t.location))
        remaining.remove(nxt)
        ordered.append(nxt)
        here = nxt.location
    return ordered


def _route_stats(base: GeoPoint, ordered: Sequence[ScienceTarget], speed_kmh: float) -> dict[str, float]:
    if not ordered:
        return {"distanceKm": 0.0, "energyKwh": 0.0, "scienceScore": 0.0}
    dist_m, here = 0.0, base
    for t in ordered:
        dist_m += _haversine_m(here, t.location)
        here = t.location
    dist_m += _haversine_m(here, base)
    dist_km = round(dist_m / 1000.0, 2)
    sci = sum(_science(t) for t in ordered)
    return {"distanceKm": dist_km,
            "energyKwh": round(dist_km * (1.65 + 0.035 * speed_kmh), 2),
            "scienceScore": round(min(15.0, sci / max(1.0, len(ordered) * 0.72)), 1)}


def _bits(k: int, n: int) -> str:
    return "|" + "".join("1" if (k >> q) & 1 else "0" for q in range(n)) + "⟩"


class QiskitQaoaOptimizer:
    def __init__(self, token: str = "", channel: str = "ibm_quantum_platform",
                 instance: str = "") -> None:
        # El token solo llega por configuración del servidor, nunca desde el navegador
        self._token = token
        self._channel = channel
        self._instance = instance

    def optimize(self, base: GeoPoint, targets: Sequence[ScienceTarget],
                 selected_goal_ids: Sequence[str], speed_kmh: float, qpu_backend: str,
                 layers: int, shots: int, noise_profile: str) -> dict[str, Any]:
        t0 = time.perf_counter()
        if len(selected_goal_ids) >= 2:
            prioritized = ([t for t in targets if t.id in selected_goal_ids]
                           + [t for t in targets if t.id not in selected_goal_ids])
        else:
            prioritized = list(targets)
        candidates = prioritized[:MAX_QUBITS]
        n = max(2, len(candidates))
        goal_count = min(n, max(2, len(selected_goal_ids) or 3))
        energies = [self._energy(base, candidates, state, n, goal_count, speed_kmh)
                    for state in range(1 << n)]

        gamma = [0.45, 0.34][:layers]
        beta = [0.35, 0.23][:layers]
        try:
            counts, mode, backend_name, job_id, note = self._run_circuit(
                n, layers, gamma, beta, shots, qpu_backend, noise_profile)
        except ImportError:
            counts, mode, backend_name, job_id, note = self._classical(energies, shots)
        except Exception as e:   # p. ej. token inválido o backend de IBM no disponible
            counts, mode, backend_name, job_id, note = self._classical(energies, shots)
            note += f" IBM Quantum run failed ({type(e).__name__})."
        if not counts:
            counts = {1: shots}

        best_k = min((k for k in counts if k > 0), key=lambda k: energies[k], default=1)
        ordered_q = _order_nearest(base, [candidates[q] for q in range(n) if (best_k >> q) & 1])
        solve_ms = round((time.perf_counter() - t0) * 1000.0, 2)

        c0 = time.perf_counter()   # referencia clásica: los primeros objetivos por prioridad
        c_stats = _route_stats(base, candidates[:goal_count], speed_kmh)
        classical_ms = round((time.perf_counter() - c0) * 1000.0, 3)

        return {
            "mode": mode,
            "backendName": backend_name,
            "noiseProfile": noise_profile if mode == "qiskit-aer" else "n/a",
            "fidelityPct": None,   # no se mide; antes era un número fijo
            "jobId": job_id,
            "nQubits": n,
            "layers": layers,
            "shots": shots,
            "gamma": gamma,
            "beta": beta,
            "expectationValue": round(sum(c / shots * energies[k] for k, c in counts.items()), 3),
            "bestBitstring": _bits(best_k, n),
            "bestEnergy": round(energies[best_k], 2),
            "recommendedTargetIds": [t.id for t in ordered_q],
            "recommendedTargetNames": [t.name for t in ordered_q],
            "candidateTargets": [{"id": c.id, "name": c.name, "scienceScore": _science(c),
                                  "distFromBaseKm": round(_haversine_m(base, c.location) / 1000, 2)}
                                 for c in candidates],
            "samples": self._samples(counts, energies, candidates, n, shots, best_k),
            "gateSummary": {"nQubits": n, "layers": layers, "hadamardGates": n,
                            "rzGates": n * layers, "rzzGates": (n - 1) * layers,
                            "rxGates": n * layers, "totalDepth": 1 + layers * (2 + max(1, n - 1))},
            "quantumMetrics": {**_route_stats(base, ordered_q, speed_kmh), "solveMs": solve_ms},
            "classicalBaseline": {**c_stats, "solveMs": classical_ms},
            "note": note,
            "limitations": LIMITATIONS,
        }

    # ---------- partes ----------

    @staticmethod
    def _energy(base: GeoPoint, candidates: Sequence[ScienceTarget], state: int, n: int,
                goal_count: int, speed_kmh: float) -> float:
        chosen = [candidates[q] for q in range(n) if (state >> q) & 1]
        stats = _route_stats(base, _order_nearest(base, chosen), speed_kmh)
        science = sum(_science(c) for c in chosen)
        radius = sum(_haversine_m(base, c.location) / 1000.0 * 0.35 for c in chosen)
        cardinality = 4.2 * (len(chosen) - goal_count) ** 2
        battery = (stats["energyKwh"] - 42.0) * 3.5 if stats["energyKwh"] > 42.0 else 0.0
        empty = 50.0 if not chosen else 0.0
        return -1.15 * science + 0.45 * stats["energyKwh"] + radius + cardinality + battery + empty

    def _run_circuit(self, n: int, layers: int, gamma: list[float], beta: list[float],
                     shots: int, qpu_backend: str, noise_profile: str
                     ) -> tuple[dict[int, int], str, str, str, str]:
        from qiskit import QuantumCircuit   # ImportError → respaldo clásico

        qc = QuantumCircuit(n)
        qc.h(range(n))
        for g, b in zip(gamma, beta):
            for q in range(n):
                qc.rz(g, q)
            for q in range(n - 1):
                qc.rzz(0.5 * g, q, q + 1)
            for q in range(n):
                qc.rx(2.0 * b, q)
        qc.measure_all()

        if self._token and qpu_backend != "aer_simulator":
            from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
            from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

            kwargs: dict[str, Any] = {"channel": self._channel, "token": self._token}
            if self._instance:
                kwargs["instance"] = self._instance
            backend = QiskitRuntimeService(**kwargs).backend(qpu_backend)
            isa = generate_preset_pass_manager(backend=backend, optimization_level=1).run(qc)
            job = SamplerV2(mode=backend).run([isa], shots=shots)
            raw = job.result()[0].data.meas.get_counts()
            return ({int(b, 2): int(c) for b, c in raw.items()}, "ibm-qpu", qpu_backend,
                    job.job_id(), f"Executed on IBM Quantum QPU ({qpu_backend}) via SamplerV2.")

        from qiskit_aer import AerSimulator

        noise = _noise_model(noise_profile)
        raw = AerSimulator(noise_model=noise).run(qc, shots=shots).result().get_counts()
        label = f"{noise_profile} noise model" if noise is not None else "ideal"
        return ({int(b, 2): int(c) for b, c in raw.items()}, "qiskit-aer",
                "qiskit_aer_simulator", f"aer-{uuid.uuid4().hex[:8]}",
                f"Executed on the local Qiskit Aer simulator ({label}).")

    @staticmethod
    def _classical(energies: list[float], shots: int
                   ) -> tuple[dict[int, int], str, str, str, str]:
        """Sin Qiskit: muestreo clásico ponderado por la energía (no es un circuito)."""
        weights = [math.exp(-0.35 * e) for e in energies]
        total = sum(weights) or 1.0
        counts = {s: c for s in range(1, len(energies))
                  if (c := int(round(weights[s] / total * shots))) > 0}
        return (counts, "classical-fallback", "classical (no quantum circuit)",
                f"classical-{uuid.uuid4().hex[:8]}",
                "Qiskit is not installed: no quantum circuit was run. Classical exhaustive "
                "search with Boltzmann-weighted sampling. Install with pip install -e .[quantum].")

    @staticmethod
    def _samples(counts: dict[int, int], energies: list[float],
                 candidates: Sequence[ScienceTarget], n: int, shots: int,
                 best_k: int) -> list[dict[str, Any]]:
        out = []
        for k, c in sorted(counts.items(), key=lambda kc: (-kc[1], energies[kc[0]]))[:6]:
            if k == 0:
                continue
            out.append({"bitstring": _bits(k, n), "probability": round(c / shots * 100.0, 2),
                        "counts": c, "energy": round(energies[k], 2),
                        "selectedIds": [candidates[q].id for q in range(n) if (k >> q) & 1],
                        "isOptimal": k == best_k})
        return out


def _noise_model(profile: str) -> Any:
    if profile not in ("noisy-qpu", "mitigated"):
        return None
    try:
        from qiskit_aer.noise import NoiseModel, ReadoutError, thermal_relaxation_error
    except ImportError:
        return None
    scale = 0.25 if profile == "mitigated" else 1.0
    model = NoiseModel()
    err_1q = thermal_relaxation_error(180e3, 120e3, 50 * scale)
    err_2q = thermal_relaxation_error(180e3, 120e3, 300 * scale).tensor(
        thermal_relaxation_error(180e3, 120e3, 300 * scale))
    model.add_all_qubit_quantum_error(err_1q, ["h", "rz", "rx"])
    model.add_all_qubit_quantum_error(err_2q, ["rzz", "cx"])
    p_ro = 0.008 if profile == "mitigated" else 0.025
    model.add_all_qubit_readout_error(ReadoutError([[1 - p_ro, p_ro], [p_ro, 1 - p_ro]]))
    return model
