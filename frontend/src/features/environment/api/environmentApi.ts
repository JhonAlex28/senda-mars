import { http } from '@/shared/api/httpClient';
import type { Environment } from '../types';

export const environmentApi = {
  current: () => http<Environment>('/environment'),
};
