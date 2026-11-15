import { GoalList, type Target } from '@/features/targets';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { useMission } from '../state/MissionContext';

/** "My goals": objetivos elegidos, ordenados por prioridad. */
export function GoalsCard() {
  const { state, dispatch, targetById } = useMission();
  const goals = state.goals.map((id) => targetById.get(id)).filter((t): t is Target => !!t);

  return (
    <Card title="My goals" action={<span title="Drag to set priority"><Icon name="drag_indicator" className="text-[18px] text-accent" /></span>}>
      <GoalList
        goals={goals}
        focusedId={state.focusedTargetId}
        onMove={(from, to) => dispatch({ type: 'moveGoal', from, to })}
        onRemove={(id) => dispatch({ type: 'toggleGoal', id })}
        onFocus={(id) => dispatch({ type: 'focusTarget', id })}
      />
    </Card>
  );
}
