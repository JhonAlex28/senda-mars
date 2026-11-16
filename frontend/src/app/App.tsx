import { AssistantPanel } from '@/features/assistant';
import { LayersProvider } from '@/features/layers';
import { MissionProvider, useMission } from '@/features/mission';
import { GlobePage } from '@/pages/GlobePage';
import { MissionControlPage } from '@/pages/MissionControlPage';
import { Toaster } from '@/shared/ui/Toast';

function Screens() {
  const { state } = useMission();
  return (
    <>
      {state.phase === 'globe' ? <GlobePage /> : <MissionControlPage />}
      {/* El copiloto está disponible al planificar; durante la simulación no se replanifica */}
      {state.phase !== 'go' && <AssistantPanel />}
    </>
  );
}

export function App() {
  return (
    <MissionProvider>
      <LayersProvider>
        <Screens />
        <Toaster />
      </LayersProvider>
    </MissionProvider>
  );
}
