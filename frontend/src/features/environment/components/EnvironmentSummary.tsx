import { Panel } from '@/shared/ui/Panel';
import { useEnvironment } from '../hooks/useEnvironment';

export function EnvironmentSummary() {
  const { data, error, loading } = useEnvironment();

  return (
    <Panel title="Environment">
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">Backend unavailable: {error.message}</p>}
      {data && (
        <p>
          Sol {data.sol} · Ls {data.ls_deg}° · LTST {data.local_solar_time}
          <br />
          <span className="muted">
            {data.pressure_pa} Pa · {data.temp_min_c}…{data.temp_max_c} °C
          </span>
        </p>
      )}
    </Panel>
  );
}
