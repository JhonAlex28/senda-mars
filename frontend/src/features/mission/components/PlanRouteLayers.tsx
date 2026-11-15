import { RouteLine } from '@/features/map';
import { PROFILE_META, PROFILE_ORDER, routeFor, type RoutePlan, type RouteProfile } from '@/features/route-planning';
import { selectedEva } from '../state/selectors';
import { useMission } from '../state/MissionContext';

interface AlternativesProps {
  routes: RoutePlan[];
  selected: RouteProfile;
  dotted?: boolean;
  faded?: boolean;
  onSelect?: (profile: RouteProfile) => void;
}

/** Las tres alternativas: las no elegidas finas y tenues, la elegida gruesa y encima. */
function RouteAlternatives({ routes, selected, dotted, faded, onSelect }: AlternativesProps) {
  const ordered = [...PROFILE_ORDER.filter((p) => p !== selected), selected];
  return (
    <>
      {ordered.map((profile) => {
        const route = routeFor(routes, profile);
        if (!route) return null;
        const meta = PROFILE_META[profile];
        const isSelected = profile === selected;
        return (
          <RouteLine
            key={profile}
            points={route.points}
            color={meta.color}
            dashed={!dotted && meta.dashed}
            dotted={dotted}
            width={isSelected ? 4 : 2}
            halo={isSelected}
            opacity={(isSelected ? 1 : 0.45) * (faded ? 0.35 : 1)}
            onClick={onSelect && !isSelected ? () => onSelect(profile) : undefined}
          />
        );
      })}
    </>
  );
}

/** Rutas del rover y de las caminatas según la fase (Plan o Walk). */
export function PlanRouteLayers() {
  const { state, dispatch } = useMission();
  if (!state.traverse) return null;
  const walking = state.phase === 'walk';

  return (
    <>
      <RouteAlternatives
        routes={state.traverse.routes}
        selected={state.traverseProfile}
        faded={walking}
        onSelect={walking ? undefined : (profile) => dispatch({ type: 'selectTraverseProfile', profile })}
      />
      {state.traverse.parkings.map((p) => {
        const plan = state.evaPlans[p.id];
        if (!plan) return null;
        if (walking && p.id === state.activeParkingId) {
          return (
            <RouteAlternatives
              key={p.id}
              routes={plan.routes}
              selected={plan.profile}
              dotted
              onSelect={(profile) => dispatch({ type: 'selectEvaProfile', parkingId: p.id, profile })}
            />
          );
        }
        const walk = selectedEva(state, p.id);
        return walk && <RouteLine key={p.id} points={walk.points} color="#38BDF8" dotted width={2} opacity={0.8} />;
      })}
    </>
  );
}
