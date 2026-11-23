import { Link } from "react-router-dom";
import { Globe, Upload, Activity, CheckCircle2, XCircle, Mail, Plus, RefreshCw, MapPin, Phone, Star, Sparkles } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useJobStore } from "@/stores/jobStore";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatNumber } from "@/lib/utils";

export function Dashboard() {
  const { stats, jobs } = useJobStore();
  const { loading, error, refetch } = useDashboardData();
  useWebSocket();

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">Market Dashboard</h1>
          <p className="text-muted-foreground font-medium mt-1">
            Real-time intelligence and lead research metrics
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" className="rounded-full font-bold border-primary/20" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link to="/bulk">
            <Button variant="outline" className="rounded-full font-bold border-primary/20">
              <Upload className="h-4 w-4" /> Bulk CSV
            </Button>
          </Link>
          <Link to="/analyze">
            <Button className="rounded-full font-bold bg-primary text-black hover:bg-primary/90 px-6 py-6">
              <Plus className="h-5 w-5" /> New Analysis
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5 rounded-2xl overflow-hidden">
          <CardContent className="p-6 text-sm text-destructive flex items-center justify-between gap-4 font-bold">
            <span className="uppercase tracking-tight">{error}</span>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard title="Websites Mapped" value={formatNumber(stats.total_websites)} icon={Globe} />
            <StatCard title="Active Flows" value={stats.active_jobs} icon={Activity} subtitle="Running Pipeline" />
            <StatCard title="Analysis Done" value={formatNumber(stats.completed_jobs)} icon={CheckCircle2} />
            <StatCard title="Failed Jobs" value={stats.failed_jobs} icon={XCircle} />
            <StatCard title="Leads Captured" value={formatNumber(stats.total_emails)} icon={Mail} />
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="No Website Leads" value={formatNumber(stats.no_website_businesses)} icon={MapPin} variant="secondary" />
            <StatCard title="Phone Numbers" value={formatNumber(stats.extracted_phones)} icon={Phone} variant="secondary" />
            <StatCard title="High Quality" value={formatNumber(stats.high_quality_leads)} icon={Star} variant="secondary" />
            <StatCard title="AI Opportunities" value={formatNumber(stats.ai_opportunities)} icon={Sparkles} variant="secondary" />
          </div>
        </div>
      )}

      <Card className="rounded-[2.5rem] border border-border bg-card shadow-lg overflow-hidden">
        <CardHeader className="p-10 pb-0">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
             <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
             </div>
             Recent Research Jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-10 pt-8">
          {loading ? <TableSkeleton /> : <JobsTable jobs={jobs} />}
        </CardContent>
      </Card>
    </div>
  );
}
