interface HelmetStatusCardProps {
  astronautName: string;
  suitId: string;
  tempC: number;
  o2Pct: number;
  co2Pct: number;
  pressureKpa: number;
  heartRateBpm: number;
  valPct: number;
  statusLabel?: string;
}

/** NASA/The-Martian style Helmet & Suit Telemetry HUD card (radial temperature gauge + 4 vital/suit sensors). */
export function HelmetStatusCard({
  astronautName,
  suitId,
  tempC,
  o2Pct,
  co2Pct,
  pressureKpa,
  heartRateBpm,
  valPct,
  statusLabel = 'STABLE',
}: HelmetStatusCardProps) {
  const normTemp = Math.max(0.1, Math.min(1, (tempC - 5) / 25));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const arcLen = circumference * normTemp * 0.78;
  const healthy = o2Pct >= 25 && co2Pct < 1.2 && pressureKpa >= 26;

  return (
    <div className="rounded-lg border border-outline bg-[#050A12] p-sm font-mono shadow-inner">
      <div className="mb-xs flex items-start justify-between border-b border-outline-variant pb-1">
        <div>
          <div className="text-[9px] tracking-widest text-warning">DATA</div>
          <div className="font-headline text-title-md tracking-wider text-on-surface">HELMET STATUS</div>
        </div>
        <div className="text-right">
          <div className="font-headline text-title-md uppercase tracking-widest text-accent">{astronautName}</div>
          <div className="text-[9px] text-on-surface-variant">{suitId}</div>
        </div>
      </div>

      <div className="grid grid-cols-[108px_1fr] items-center gap-sm">
        {/* Radial LCVG / Helmet Temperature Sensor */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 92 92" className="h-24 w-24">
            <circle cx="46" cy="46" r={radius} fill="none" stroke="#1F3352" strokeWidth="5" />
            <circle
              cx="46"
              cy="46"
              r={radius}
              fill="none"
              stroke={healthy ? '#F59E0B' : '#EF4444'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${arcLen} ${circumference}`}
              transform="rotate(-90 46 46)"
            />
            <line x1="6" y1="46" x2="18" y2="46" stroke="#8BA3C7" strokeWidth="1.2" />
            <line x1="74" y1="46" x2="86" y2="46" stroke="#8BA3C7" strokeWidth="1.2" />
            <text x="46" y="50" textAnchor="middle" fill="#F0F6FC" fontSize="14" fontWeight="700" fontFamily="monospace">
              {tempC.toFixed(1)}
            </text>
          </svg>
          <span className="text-[8px] tracking-wider text-warning">TEMP SENSOR (°C)</span>
        </div>

        {/* 4 Suit & Bio Telemetry Cells */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="rounded border border-outline-variant bg-surface px-1.5 py-1">
            <div className="text-[8px] text-warning">VAL / HR</div>
            <div className="text-body-sm font-bold text-on-surface">
              {valPct}% <span className="text-[9px] text-accent">({heartRateBpm})</span>
            </div>
            <div className="text-[8px] text-emerald-400">{statusLabel}</div>
          </div>
          <div className="rounded border border-outline-variant bg-surface px-1.5 py-1">
            <div className="text-[8px] text-warning">CO₂ LEVELS</div>
            <div className="text-body-sm font-bold text-on-surface">{co2Pct.toFixed(2)} %</div>
            <div className="text-[8px] text-emerald-400">{co2Pct < 1.0 ? 'STABLE' : 'SCRUB'}</div>
          </div>
          <div className="rounded border border-outline-variant bg-surface px-1.5 py-1">
            <div className="text-[8px] text-warning">O₂ TRUNK</div>
            <div className="text-body-sm font-bold text-on-surface">{Math.round(o2Pct)} %</div>
            <div className={`text-[8px] ${o2Pct >= 25 ? 'text-emerald-400' : 'text-error'}`}>
              {o2Pct >= 25 ? 'STABLE' : 'LOW O₂'}
            </div>
          </div>
          <div className="rounded border border-outline-variant bg-surface px-1.5 py-1">
            <div className="text-[8px] text-warning">O₂ PRESSURE</div>
            <div className="text-body-sm font-bold text-on-surface">{pressureKpa.toFixed(1)} kPa</div>
            <div className="text-[8px] text-emerald-400">STABLE</div>
          </div>
        </div>
      </div>
    </div>
  );
}
