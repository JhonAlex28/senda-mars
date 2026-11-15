// API pública de la feature: datos del motor de seguridad (campo de retorno)
export {
  safetyApi,
  type EngineAlert,
  type Leg,
  type ReturnFieldMeta,
  type ScenarioInfo,
  type SimRoute,
  type SimRow,
  type SimulateResult,
} from './api/safetyApi';
export { useSafeReturn, type SafeReturnLayer } from './hooks/useSafeReturn';
