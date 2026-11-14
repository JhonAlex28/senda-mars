import { useAsync } from '@/shared/hooks/useAsync';
import { targetsApi } from '../api/targetsApi';

export const useTargets = () => useAsync(targetsApi.list);
