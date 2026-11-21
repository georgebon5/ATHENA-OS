import { useState, useEffect } from "react";
import { fetchAreaFootfall, type VisitorRecord } from "./athensCkanClient";

export interface FootfallState {
  records: VisitorRecord[];
  total: number;
  loading: boolean;
  source: "live" | "fixture" | "unknown";
}

export function useFootfall(): FootfallState {
  const [records, setRecords] = useState<VisitorRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAreaFootfall().then((r) => {
      setRecords(r);
      setLoading(false);
    });
  }, []);

  const total = records.reduce((sum, r) => sum + r.visitors, 0);
  const anyLive = records.some((r) => r.source === "live");
  const source = loading ? "unknown" : anyLive ? "live" : "fixture";

  return { records, total, loading, source };
}
