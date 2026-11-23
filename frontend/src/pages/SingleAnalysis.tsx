import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Globe, Lock, Cookie, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobProgress } from "@/components/dashboard/JobProgress";
import { createSingleJob, fetchDashboardData } from "@/hooks/useDashboardData";
import { useJobStore } from "@/stores/jobStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useJobPolling } from "@/hooks/useJobPolling";
import { getApiErrorMessage } from "@/lib/api";
import type { Job } from "@/types";

const schema = z.object({
  url: z.string().min(3, "Enter at least 3 characters"),
});

type FormData = z.infer<typeof schema>;

export function SingleAnalysis() {
  const navigate = useNavigate();
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const setJobs = useJobStore((s) => s.setJobs);
  const jobs = useJobStore((s) => s.jobs);

  useWebSocket(activeJob?.id);
  useJobPolling(activeJob?.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ 
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        url: data.url,
        mode: "website" as const,
      };
      
      const job = await createSingleJob(payload);
      setActiveJob(job);
      setJobs([job, ...jobs]);
      toast.success("Website analysis started");
      void fetchDashboardData();
      reset();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to start analysis"));
    }
  };

  const storeJob = jobs.find((j) => j.id === activeJob?.id);
  const displayJob = storeJob || activeJob;

  return (
    <div className="space-y-10 max-w-5xl animate-fade-in pb-20 mx-auto w-full px-0">
      <div>
        <h1 className="text-3xl font-black tracking-tighter uppercase">Website Analysis</h1>
        <p className="text-muted-foreground font-medium mt-1">
          Autonomous AI will crawl, render, and extract structured intelligence from your target website
        </p>
      </div>

      <Card className="rounded-[2.5rem] border border-border bg-card shadow-lg overflow-hidden">
        <CardHeader className="p-10 pb-0">
          <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            Target Configuration
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-2 font-medium">
            Our autonomous browser will navigate, render, and extract structured data
          </CardDescription>
        </CardHeader>
        <CardContent className="p-10 pt-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Target URL
                </label>
                <Input
                  id="url"
                  placeholder="https://business-website.com"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("url")}
                />
                {errors.url?.message && (
                  <p className="text-xs font-bold text-destructive uppercase tracking-tight">
                    {errors.url.message}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full md:w-auto rounded-full px-10 py-7 font-black uppercase tracking-tighter text-lg bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Execute Intelligence Flow <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8 opacity-60">
        <Card className="rounded-3xl border-dashed bg-muted/30 border-border">
          <CardHeader className="p-8">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Secure Access
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-tight">
              Login flows & session handling
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="rounded-3xl border-dashed bg-muted/30 border-border">
          <CardHeader className="p-8">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Cookie className="h-4 w-4 text-primary" /> Cookie Sync
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-tight">
              Bypass bot detection & restrictions
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {displayJob && (
        <div className="animate-slide-up">
          <JobProgress
            job={displayJob}
            onViewResults={
              displayJob.status === "completed"
                ? () => navigate(`/results?job=${displayJob.id}`)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
