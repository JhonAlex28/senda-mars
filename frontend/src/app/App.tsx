import { MissionProvider, useMission } from '@/features/mission';
import { GlobePage } from '@/pages/GlobePage';
import { MissionControlPage } from '@/pages/MissionControlPage';

function Screens() {
  const { state } = useMission();
  return state.phase === 'globe' ? <GlobePage /> : <MissionControlPage />;
}

export function App() {
  return (
    <MissionProvider>
      <Screens />
    </MissionProvider>
  );
}
