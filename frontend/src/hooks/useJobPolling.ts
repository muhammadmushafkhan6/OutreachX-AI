import { useEffect, useRef } from "react";
import { fetchJob } from "@/hooks/useDashboardData";
import { useJobStore } from "@/stores/jobStore";
import type { Job } from "@/types";

const TERMINAL = new Set<Job["status"]>(["completed", "failed"]);

/** Poll job status when WebSocket is unavailable or as backup */
export function useJobPolling(jobId: string | null | undefined, enabled = true) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId || !enabled) return;

    const poll = async () => {
      try {
        const job = await fetchJob(jobId);
        if (TERMINAL.has(job.status) && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch {
        /* job may not exist yet */
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, enabled]);
}
