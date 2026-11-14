import { useAsync } from '@/shared/hooks/useAsync';
import { environmentApi } from '../api/environmentApi';

export const useReadiness = () => useAsync(environmentApi.readiness);
