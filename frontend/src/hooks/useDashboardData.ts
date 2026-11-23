import { useEffect, useState, useCallback } from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { useJobStore } from "@/stores/jobStore";
import type { Job, DashboardStats } from "@/types";
import { toast } from "sonner";

export async function fetchDashboardData() {
  const [jobsRes, statsRes] = await Promise.all([
    api.get<Job[]>("/jobs"),
    api.get<DashboardStats>("/dashboard/stats"),
  ]);
  useJobStore.getState().setJobs(jobsRes.data);
  useJobStore.getState().setStats(statsRes.data);
}

export async function fetchJob(jobId: string): Promise<Job> {
  const { data } = await api.get<Job>(`/jobs/${jobId}`);
  useJobStore.getState().updateJob(data);
  return data;
}

export async function createSingleJob(payload: { 
  url?: string; 
  query?: string; 
  location?: string;
  mode?: "website" | "maps" | "social" | "linkedin"
}): Promise<Job> {
  const { data } = await api.post<Job>("/jobs/single", payload);
  return data;
}

export async function createBulkJob(file: File): Promise<Job> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<Job>("/jobs/bulk", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchDashboardData();
    } catch (err) {
      const msg = getApiErrorMessage(err, "Failed to load dashboard");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { loading, error, refetch };
}
