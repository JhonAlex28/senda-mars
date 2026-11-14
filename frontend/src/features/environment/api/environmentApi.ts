import { http } from '@/shared/api/httpClient';
import type { Environment, Readiness } from '../types';

export const environmentApi = {
  current: () => http.get<Environment>('/environment'),
  readiness: () => http.get<Readiness>('/environment/readiness'),
};
