import { http } from '@/shared/api/httpClient';
import type { Target } from '../types';

export const targetsApi = {
  list: () => http.get<Target[]>('/targets'),
  get: (id: string) => http.get<Target>(`/targets/${encodeURIComponent(id)}`),
};
