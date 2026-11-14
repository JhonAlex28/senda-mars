import { useAsync } from '@/shared/hooks/useAsync';
import { environmentApi } from '../api/environmentApi';

export const useEnvironment = () => useAsync(environmentApi.current);
