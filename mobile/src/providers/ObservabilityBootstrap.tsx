import { useEffect } from 'react';

import { startAppObservability } from '@/src/platform/telemetry/observability';

export function ObservabilityBootstrap() {
  useEffect(() => startAppObservability(), []);
  return null;
}
