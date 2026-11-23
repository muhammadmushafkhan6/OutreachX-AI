import { create } from "zustand";
import type { Job, DashboardStats } from "@/types";

interface JobState {
  jobs: Job[];
  stats: DashboardStats;
  activeJobId: string | null;
  setJobs: (jobs: Job[]) => void;
  updateJob: (job: Job) => void;
  setStats: (stats: DashboardStats) => void;
  setActiveJobId: (id: string | null) => void;
}

const defaultStats: DashboardStats = {
  total_websites: 0,
  active_jobs: 0,
  completed_jobs: 0,
  failed_jobs: 0,
  total_emails: 0,
  no_website_businesses: 0,
  extracted_phones: 0,
  high_quality_leads: 0,
  ai_opportunities: 0,
};

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  stats: defaultStats,
  activeJobId: null,
  setJobs: (jobs) => set({ jobs }),
  updateJob: (job) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === job.id ? job : j)),
    })),
  setStats: (stats) => set({ stats }),
  setActiveJobId: (activeJobId) => set({ activeJobId }),
}));
