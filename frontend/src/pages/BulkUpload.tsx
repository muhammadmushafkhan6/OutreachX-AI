import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobProgress } from "@/components/dashboard/JobProgress";
import { createBulkJob, fetchDashboardData } from "@/hooks/useDashboardData";
import { useJobStore } from "@/stores/jobStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useJobPolling } from "@/hooks/useJobPolling";
import { getApiErrorMessage } from "@/lib/api";
import type { Job } from "@/types";
import { cn } from "@/lib/utils";

export function BulkUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const setJobs = useJobStore((s) => s.setJobs);
  const jobs = useJobStore((s) => s.jobs);

  useWebSocket(activeJob?.id);
  useJobPolling(activeJob?.id);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File | undefined) => {
    if (f?.name.endsWith(".csv")) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const job = await createBulkJob(file);
      setActiveJob(job);
      setJobs([job, ...jobs]);
      toast.success("Bulk job queued");
      await fetchDashboardData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Bulk upload failed"));
    } finally {
      setLoading(false);
    }
  };

  const storeJob = jobs.find((j) => j.id === activeJob?.id);
  const displayJob = storeJob || activeJob;

  const downloadTemplate = () => {
    const csv = "url\nhttps://example.com\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bulk_urls_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-8 max-w-3xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Bulk CSV upload</h1>
        <p className="text-muted-foreground mt-1">
          Upload a CSV with URLs — processed in the background
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Upload CSV
          </CardTitle>
          <CardDescription>
            One URL per row. Column header must be <code className="text-xs bg-muted px-1 rounded">url</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            {file ? (
              <p className="font-medium">{file.name}</p>
            ) : (
              <>
                <p className="font-medium">Drag & drop CSV here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleUpload} disabled={!file} loading={loading}>
              Process bulk job
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Download template
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Large files run as background jobs. Progress updates in realtime.</p>
          </div>
        </CardContent>
      </Card>

      {displayJob && (
        <JobProgress
          job={displayJob}
          onViewResults={
            displayJob.status === "completed"
              ? () => navigate(`/results?job=${displayJob.id}`)
              : undefined
          }
        />
      )}
    </div>
  );
}
