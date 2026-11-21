import { useEffect, useState } from "react";
import { fetchNearestEnvReading } from "./athensEnvClient";
import type { EnvReading } from "./athensEnvClient";

export interface EnvSensorState {
  reading: EnvReading | null;
  loading: boolean;
}

export function useEnvSensors(): EnvSensorState {
  const [reading, setReading] = useState<EnvReading | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await fetchNearestEnvReading();
      if (!cancelled) {
        setReading(result);
        setLoading(false);
      }
    }

    load();
    const interval = window.setInterval(load, 600_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return { reading, loading };
}
