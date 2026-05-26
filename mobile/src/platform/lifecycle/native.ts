import { AppState, type AppStateStatus } from 'react-native';

export type AppLifecycleStatus = AppStateStatus;

export function getCurrentLifecycleStatus(): AppLifecycleStatus {
  return AppState.currentState;
}

export function subscribeLifecycle(listener: (status: AppLifecycleStatus) => void): () => void {
  const subscription = AppState.addEventListener('change', listener);
  return () => subscription.remove();
}
