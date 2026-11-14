import { http } from '@/shared/api/httpClient';
import type { Target } from '../types';

export const targetsApi = {
  list: () => http<Target[]>('/targets'),
  get: (id: string) => http<Target>(`/targets/${encodeURIComponent(id)}`),
};
