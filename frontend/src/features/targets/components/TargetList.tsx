import { Panel } from '@/shared/ui/Panel';
import { useTargets } from '../hooks/useTargets';

export function TargetList() {
  const { data, error, loading } = useTargets();

  return (
    <Panel title="Science targets">
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">Backend unavailable: {error.message}</p>}
      {data && (
        <ul className="target-list">
          {data.map((t) => (
            <li key={t.id}>
              <span>
                {t.id} · {t.name}
              </span>
              <span className="score">{t.rubric.total}/15</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
