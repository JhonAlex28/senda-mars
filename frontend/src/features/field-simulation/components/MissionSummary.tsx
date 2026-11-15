import type { CrewConfig } from '@/features/mission';
import { formatDistance, formatMinutes } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Meter } from '@/shared/ui/Meter';
import type { SimState } from '../state/simulationReducer';

interface MissionSummaryProps {
  state: SimState;
  roverCapacity: number;
  targetName: (id: string) => string | undefined;
  crew?: CrewConfig;
  onReplan: () => void;
  onExit: () => void;
}

interface Row {
  icon: string;
  label: string;
  actual: string;
  planned: string;
  ratio?: number; // real / planificado, para la barra
}

/** Resumen final: lo realizado frente a lo planificado + nota unificada NASA. */
export function MissionSummary({ state, roverCapacity, targetName, crew, onReplan, onExit }: MissionSummaryProps) {
  const { planned } = state;
  const parkings = new Set(state.legs.map((l) => l.parkingId).filter(Boolean)).size;

  // Unified Mission Evaluation Score (0–100): Safety 40% + Science 35% + Efficiency 25%
  const batteryLeftRatio = Math.max(0, 1 - state.battery / Math.max(1, roverCapacity));
  const safetyScore = Math.round(Math.min(100, batteryLeftRatio * 125));
  const scienceScore = Math.round((state.completed.length / Math.max(1, planned.targets)) * 100);
  const efficiencyScore = Math.round(Math.min(100, (planned.battery / Math.max(0.1, state.battery)) * 90));
  const overallScore = Math.round(safetyScore * 0.4 + scienceScore * 0.35 + efficiencyScore * 0.25);
  const grade =
    overallScore >= 92 ? 'A+' : overallScore >= 85 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : 'D';

  const rows: Row[] = [
    { icon: 'airport_shuttle', label: 'Drive', actual: formatDistance(state.roverDistance), planned: formatDistance(planned.roverDistance), ratio: state.roverDistance / planned.roverDistance },
    { icon: 'local_parking', label: 'Stops', actual: `${state.visited.length}`, planned: `${parkings}` },
    { icon: 'directions_walk', label: 'EVA', actual: `${state.walksDone} · ${formatDistance(state.walkDistance)}`, planned: formatDistance(planned.walkDistance) },
    { icon: 'diamond', label: 'Goals done', actual: `${state.completed.length}`, planned: `${planned.targets}`, ratio: state.completed.length / Math.max(planned.targets, 1) },
    { icon: 'schedule', label: 'Time', actual: formatMinutes(state.clock), planned: formatMinutes(planned.minutes), ratio: state.clock / planned.minutes },
    { icon: 'battery_charging_full', label: 'Battery used', actual: `${state.battery.toFixed(1)} kWh (${Math.round((state.battery / roverCapacity) * 100)}%)`, planned: `${planned.battery.toFixed(1)} kWh`, ratio: state.battery / planned.battery },
    { icon: 'air', label: 'O₂ used', actual: `${Math.round(state.oxygen)} L`, planned: `${Math.round(planned.oxygen)} L`, ratio: state.oxygen / Math.max(planned.oxygen, 1) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 p-md backdrop-blur-sm">
      <section className="flex max-h-full w-full max-w-2xl animate-fade-up flex-col gap-md overflow-y-auto rounded-lg border-2 border-success/60 bg-surface-container p-lg shadow-2xl" aria-label="Mission summary">
        <header className="flex flex-wrap items-center justify-between gap-md">
          <div className="flex items-center gap-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-on-success">
              <Icon name="flag" className="text-[28px]" />
            </div>
            <div>
              <h2 className="font-headline text-headline-lg uppercase">Trip complete</h2>
              <p className="font-body text-body-sm text-on-surface-variant">
                {crew ? `${crew.teamName} · ${crew.members.map((m) => `${m.name} (${m.suitId})`).join(' & ')}` : 'Here is what you did, next to what you planned.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-sm rounded-lg border border-accent/60 bg-surface px-md py-xs font-mono">
            <div className="text-right">
              <div className="text-[10px] text-on-surface-variant">MISSION SCORE</div>
              <div className="text-title-md font-bold text-on-surface">{overallScore}/100</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary font-headline text-headline-sm font-bold text-on-primary">
              {grade}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-xs rounded-md border border-outline-variant bg-surface p-xs font-mono text-[10px]">
          <div className="text-center">
            <span className="text-on-surface-variant">SAFETY (40%)</span>
            <div className="font-bold text-success">{safetyScore}/100</div>
          </div>
          <div className="text-center">
            <span className="text-on-surface-variant">SCIENCE (35%)</span>
            <div className="font-bold text-accent">{scienceScore}/100</div>
          </div>
          <div className="text-center">
            <span className="text-on-surface-variant">EFFICIENCY (25%)</span>
            <div className="font-bold text-on-surface">{efficiencyScore}/100</div>
          </div>
        </div>

        <table className="w-full border-separate border-spacing-y-xs">
          <thead>
            <tr className="font-label text-label-sm uppercase text-on-surface-variant">
              <th className="text-left font-semibold">What</th>
              <th className="text-right font-semibold">Done</th>
              <th className="text-right font-semibold">Planned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="bg-surface">
                <td className="rounded-l-md px-sm py-xs">
                  <span className="flex items-center gap-sm font-body text-body-md">
                    <Icon name={r.icon} className="text-[18px] text-accent" />
                    {r.label}
                  </span>
                  {r.ratio !== undefined && (
                    <Meter value={Math.min(r.ratio, 1) * 100} tone={r.ratio > 1.05 ? 'warning' : 'success'} label={r.label} className="mt-xs h-1" />
                  )}
                </td>
                <td className="px-sm py-xs text-right font-mono text-mono-md text-on-surface">{r.actual}</td>
                <td className="rounded-r-md px-sm py-xs text-right font-mono text-mono-md text-on-surface-variant">{r.planned}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {(state.completed.length > 0 || state.skipped.length > 0) && (
          <div className="flex flex-wrap gap-xs">
            {state.completed.map((id) => (
              <span key={id} className="inline-flex items-center gap-xs rounded-full bg-success/15 px-sm py-xs font-body text-body-sm text-success">
                <Icon name="task_alt" className="text-[14px]" /> {targetName(id) ?? id}
              </span>
            ))}
            {state.skipped.map((id) => (
              <span key={id} className="inline-flex items-center gap-xs rounded-full bg-surface-container-high px-sm py-xs font-body text-body-sm text-on-surface-variant line-through">
                {targetName(id) ?? id}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-sm">
          <Button
            variant="ghost"
            icon="download"
            onClick={() => {
              const payload = {
                mission: 'SENDA Mars v2 — Mount Sharp Exploration',
                crew: crew ?? null,
                completedAt: new Date().toISOString(),
                evaluation: {
                  overallScore,
                  grade,
                  safetyScore,
                  scienceScore,
                  efficiencyScore,
                },
                metrics: {
                  roverDistanceM: Math.round(state.roverDistance),
                  walkDistanceM: Math.round(state.walkDistance),
                  elapsedMin: Math.round(state.clock),
                  batteryUsedKwh: Number(state.battery.toFixed(2)),
                  oxygenUsedL: Math.round(state.oxygen),
                },
                completedTargets: state.completed,
                sampleCache: state.completed.map((id, idx) => ({
                  tubeId: `MSR-Ti-0${idx + 1}`,
                  targetId: id,
                  targetName: targetName(id) ?? id,
                  massKg: 0.25,
                })),
                skippedTargets: state.skipped,
                events: state.events,
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'senda_mission_summary.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </Button>
          <Button
            variant="ghost"
            icon="table_chart"
            onClick={() => {
              const csvRows = [
                ['Category', 'Metric', 'Actual', 'Planned'],
                ['Crew', 'Team', crew?.teamName ?? 'SENDA-ARES CREW', '-'],
                ['Crew', 'EVA-1', crew?.members[0]?.name ?? 'WATNEY', crew?.members[0]?.suitId ?? 'xEMU-01'],
                ['Crew', 'EVA-2', crew?.members[1]?.name ?? 'LEWIS', crew?.members[1]?.suitId ?? 'xEMU-02'],
                ['Evaluation', 'Mission Score', `${overallScore}/100 (${grade})`, '100/100'],
                ...rows.map((r) => ['Mission', r.label, r.actual, r.planned]),
              ];
              const csv = csvRows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'senda_mission_telemetry.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="ghost"
            icon="map"
            onClick={() => {
              const geojson = {
                type: 'FeatureCollection',
                features: state.legs.map((l, idx) => ({
                  type: 'Feature',
                  properties: { leg: idx + 1, mode: l.mode, title: l.title },
                  geometry: {
                    type: 'LineString',
                    coordinates: l.points.map((p) => [p.lon, p.lat]),
                  },
                })),
              };
              const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'senda_mission_routes.geojson';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export GeoJSON
          </Button>
          <Button
            variant="ghost"
            icon="print"
            onClick={() => {
              const win = window.open('', '_blank', 'width=900,height=700');
              if (!win) return;
              const crewLine = crew
                ? `${crew.teamName} — ${crew.members.map((m) => `${m.name} (${m.role}, ${m.suitId})`).join(' | ')}`
                : 'SENDA-ARES CREW';
              const rowsHtml = rows
                .map((r) => `<tr><td>${r.label}</td><td style="text-align:right">${r.actual}</td><td style="text-align:right">${r.planned}</td></tr>`)
                .join('');
              win.document.write(`<!doctype html><html><head><title>SENDA NASA Mission Dossier</title><style>
                body{font-family:Arial,sans-serif;color:#111;margin:32px;line-height:1.4}
                h1{margin:0 0 4px;font-size:22px;letter-spacing:0.5px}
                .sub{color:#555;font-size:12px;margin-bottom:16px}
                .score{display:inline-block;padding:8px 14px;border:2px solid #0B3D91;border-radius:6px;font-weight:bold;margin-bottom:16px}
                table{width:100%;border-collapse:collapse;margin:12px 0}
                th,td{border-bottom:1px solid #ddd;padding:8px;font-size:13px;text-align:left}
                .box{background:#f5f7fa;border:1px solid #d0d7de;border-radius:6px;padding:10px 14px;margin-top:14px;font-size:12px}
              </style></head><body>
                <h1>SENDA MARS — NASA MISSION EVALUATION DOSSIER</h1>
                <div class="sub">Gale Crater Exploration Zone (137.4201°E, 4.5931°S) · ${new Date().toISOString()}</div>
                <div class="sub"><b>Crew:</b> ${crewLine}</div>
                <div class="score">UNIFIED MISSION SCORE: ${overallScore}/100 (GRADE ${grade}) — Safety ${safetyScore} · Science ${scienceScore} · Efficiency ${efficiencyScore}</div>
                <table><thead><tr><th>Metric</th><th style="text-align:right">Done</th><th style="text-align:right">Planned</th></tr></thead><tbody>${rowsHtml}</tbody></table>
                <div class="box"><b>Completed Targets (${state.completed.length}) &amp; MSR Sample Cache (${(state.completed.length * 0.25).toFixed(2)} kg):</b> ${state.completed.map((id, idx) => `MSR-Ti-0${idx + 1} (${targetName(id) ?? id})`).join(', ') || 'None'}<br/><b>Skipped Targets (${state.skipped.length}):</b> ${state.skipped.map((id) => targetName(id) ?? id).join(', ') || 'None'}</div>
              </body></html>`);
              win.document.close();
              win.focus();
              win.print();
            }}
          >
            PDF
          </Button>
          <Button variant="ghost" icon="public" onClick={onExit}>
            Mars
          </Button>
          <Button icon="add_circle" onClick={onReplan}>
            New mission
          </Button>
        </div>
      </section>
    </div>
  );
}
