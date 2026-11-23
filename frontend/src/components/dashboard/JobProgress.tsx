import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { Job, JobStatus } from "@/types";
import { Bot, Globe, Loader2, CheckCircle2, XCircle, Clock, MapPin, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps: { status: string; label: string; icon: typeof Globe }[] = [
  { status: "queued", label: "Queued", icon: Clock },
  { status: "processing", label: "Processing", icon: Loader2 },
  { status: "scraping", label: "Extracting", icon: Globe },
  { status: "ai_analyzing", label: "AI Analyzing", icon: Bot },
  { status: "completed", label: "Completed", icon: CheckCircle2 },
];

const getLabel = (status: string, mode: string) => {
  if (mode === "maps") {
    if (status === "scraping") return "Maps Search";
    if (status === "processing") return "Searching";
  }
  if (mode === "social") {
    if (status === "scraping") return "Analyzing Profiles";
    if (status === "processing") return "Social Sync";
  }
  return steps.find(s => s.status === status)?.label || status;
};

const statusOrder: string[] = [
  "queued",
  "processing",
  "scraping",
  "ai_analyzing",
  "completed",
];

const getNormalizedStatus = (status: string): string => {
  const s = status.toLowerCase();
  if (s.includes("queued")) return "queued";
  if (s.includes("initializing") || s.includes("prepared") || s.includes("processing")) return "processing";
  if (s.includes("searching") || s.includes("scraping") || s.includes("extracting") || s.includes("analyzing profiles")) return "scraping";
  if (s.includes("ai_analyzing") || s.includes("analysis")) return "ai_analyzing";
  if (s.includes("completed") || s.includes("success")) return "completed";
  if (s.includes("failed")) return "failed";
  return status;
};

interface JobProgressProps {
  job: Job;
  onViewResults?: () => void;
}

export function JobProgress({ job, onViewResults }: JobProgressProps) {
  const normalizedStatus = getNormalizedStatus(job.status);
  const currentIndex = statusOrder.indexOf(
    normalizedStatus === "failed" ? "processing" : normalizedStatus
  );

  if (job.status === "failed") {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6 flex items-center gap-4">
          <XCircle className="h-10 w-10 text-destructive shrink-0" />
          <div>
            <p className="font-semibold text-destructive">Job failed</p>
            <p className="text-sm text-muted-foreground mt-1">
              {job.error_message || "An error occurred during processing."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[2.5rem] border border-border shadow-xl overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              {job.mode === "maps" ? <MapPin className="h-4 w-4 text-primary" /> : job.mode === "social" ? <Instagram className="h-4 w-4 text-primary" /> : <Globe className="h-4 w-4 text-primary" />}
              {job.mode === "maps" ? "Maps Search" : job.mode === "social" ? "Social Sync" : "Website Analysis"}
            </CardTitle>
            <CardDescription className="font-bold flex items-center gap-2 mt-1">
              <span className="truncate max-w-[200px]">{job.query || job.url}</span>
              {job.location && (
                <span className="flex items-center gap-1 text-primary bg-primary/10 px-2 py-0.5 rounded-full text-[10px] uppercase">
                  <MapPin className="h-2.5 w-2.5" /> {job.location}
                </span>
              )}
            </CardDescription>
          </div>
          <Badge status={job.status} className="font-black uppercase tracking-widest text-[10px]" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <Progress value={job.progress} showLabel />

        <div className="flex justify-between gap-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const done = i <= currentIndex;
            const active = i === currentIndex && job.status !== "completed";
            return (
              <div
                key={step.status}
                className={cn(
                  "flex flex-col items-center gap-2 flex-1 text-center",
                  !done && "opacity-40"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    done && "border-primary bg-primary/10 text-primary",
                    active && "animate-pulse"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "animate-spin")} />
                </div>
                <span className="text-xs font-medium hidden sm:block">
                  {getLabel(step.status, job.mode)}
                </span>
              </div>
            );
          })}
        </div>

        {job.status === "completed" && onViewResults && (
          <Button onClick={onViewResults}>View results</Button>
        )}
      </CardContent>
    </Card>
  );
}
