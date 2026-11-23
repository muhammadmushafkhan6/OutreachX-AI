import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Search,
  Filter,
  X,
  Check,
  ExternalLink,
  Linkedin,
  Copy,
  FileText,
  MessageSquare,
  Phone,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { aiLeadFinderApi, getApiErrorMessage } from "@/lib/api";
import type { AILeadFinderLead, AILeadFinderJob, AILeadFinderFilters } from "@/types";
import { cn } from "@/lib/utils";

const DEFAULT_JOB_TITLES = [
  "Founder",
  "CEO",
  "Owner",
  "Marketing Manager",
  "Sales Manager",
  "CTO",
  "HR Manager",
];

const COMPANY_SIZE_OPTIONS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
];

type FormData = {
  keywords: string;
  job_titles: string[];
  country: string;
  state_region: string;
  city: string;
  industry: string;
  company_size: string;
  company_revenue: string;
  funding: string;
  company_website: "has" | "no" | "any";
  email_status: "verified" | "any";
  number_of_leads: number;
};

export function AILeadFinder() {
  const [activeJob, setActiveJob] = useState<AILeadFinderJob | null>(null);
  const [leads, setLeads] = useState<AILeadFinderLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLead, setSelectedLead] = useState<AILeadFinderLead | null>(null);

  const { register, handleSubmit, reset, control, watch, setValue } = useForm<FormData>({
    defaultValues: {
      keywords: "",
      job_titles: [],
      country: "",
      state_region: "",
      city: "",
      industry: "",
      company_size: "",
      company_revenue: "",
      funding: "",
      company_website: "any",
      email_status: "any",
      number_of_leads: 20,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "job_titles",
  });

  const watchJobTitles = watch("job_titles");

  // Poll for active job status
  useEffect(() => {
    if (!activeJob || activeJob.status === "completed" || activeJob.status === "failed") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const job = await aiLeadFinderApi.getJob(activeJob.id);
        setActiveJob(job);
        if (job.status === "completed") {
          await fetchLeads(job.id);
        }
      } catch (err) {
        console.error("Failed to poll job status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob]);

  const fetchLeads = async (jobId: string) => {
    try {
      setLeadsLoading(true);
      const data = await aiLeadFinderApi.getJobLeads(jobId, currentPage, pageSize);
      setLeads(data.leads);
      setTotalLeads(data.total);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to fetch leads"));
    } finally {
      setLeadsLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const filters: AILeadFinderFilters = {
        ...data,
        company_website: data.company_website === "has" ? "has" : data.company_website === "no" ? "no" : "any",
        email_status: data.email_status === "verified" ? "verified" : "any",
      };
      const response = await aiLeadFinderApi.startJob({ filters });
      const job = await aiLeadFinderApi.getJob(response.job_id);
      setActiveJob(job);
      toast.success("Lead Finder job started successfully!");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to start Lead Finder job"));
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    reset();
  };

  const handleCopyEmail = (email?: string) => {
    if (email) {
      navigator.clipboard.writeText(email);
      toast.success("Email copied to clipboard!");
    }
  };

  const handleExportCSV = () => {
    if (leads.length === 0) return;
    const headers = [
      "Company Name",
      "Company Website",
      "Industry",
      "Company Size",
      "Revenue",
      "Contact Name",
      "Job Title",
      "Business Email",
      "Personal Email",
      "Phone Number",
      "LinkedIn URL",
      "Location",
      "Country",
      "Lead Score",
    ];
    const csvContent = [
      headers.join(","),
      ...leads.map((lead) =>
        [
          lead.company_name,
          lead.company_website,
          lead.industry,
          lead.company_size,
          lead.revenue,
          lead.contact_name,
          lead.job_title,
          lead.business_email,
          lead.personal_email,
          lead.phone_number,
          lead.linkedin_url,
          lead.location,
          lead.country,
          lead.lead_score,
        ]
          .map((field) => `"${field || ""}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ai_lead_finder_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLeadScoreColor = (score?: number) => {
    if (!score) return "bg-gray-100 text-gray-800";
    if (score >= 80) return "bg-green-100 text-green-800";
    if (score >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-black tracking-tighter uppercase">AI Lead Finder</h1>
        <p className="text-muted-foreground font-medium mt-1">
          Find and enrich B2B leads with AI-powered insights and outreach content
        </p>
      </div>

      <Card className="rounded-[2rem] border border-border bg-card shadow-lg overflow-hidden">
        <CardHeader className="p-8 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">
                  Lead Filters
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-1 font-medium">
                  Define your target audience with advanced filters
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8 pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2 lg:col-span-3">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Keywords
                </label>
                <Input
                  placeholder="e.g. software, marketing, e-commerce"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("keywords")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Job Titles
                </label>
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <Input
                        placeholder="e.g. CEO"
                        className="rounded-2xl h-12 px-4 bg-muted/50 border-border/50 font-bold"
                        {...register(`job_titles.${index}`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="rounded-2xl"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_JOB_TITLES.filter(
                      (title) => !watchJobTitles.includes(title)
                    ).map((title) => (
                      <Badge
                        key={title}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 hover:border-primary"
                        onClick={() => append(title)}
                      >
                        + {title}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Country
                </label>
                <Input
                  placeholder="e.g. United States, UK"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("country")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  State/Region
                </label>
                <Input
                  placeholder="e.g. California, London"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("state_region")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  City
                </label>
                <Input
                  placeholder="e.g. New York, Paris"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("city")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Industry
                </label>
                <Input
                  placeholder="e.g. Technology, Healthcare"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("industry")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Company Size
                </label>
                <Select
                  value={watch("company_size")}
                  onValueChange={(value) => setValue("company_size", value)}
                >
                  <SelectTrigger className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Company Revenue
                </label>
                <Input
                  placeholder="e.g. $1M-$10M"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("company_revenue")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Funding
                </label>
                <Input
                  placeholder="e.g. Series A, Seed"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("funding")}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Company Website
                </label>
                <Select
                  value={watch("company_website")}
                  onValueChange={(value) => setValue("company_website", value as any)}
                >
                  <SelectTrigger className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="has">Has Website</SelectItem>
                    <SelectItem value="no">No Website</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Email Status
                </label>
                <Select
                  value={watch("email_status")}
                  onValueChange={(value) => setValue("email_status", value as any)}
                >
                  <SelectTrigger className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest ml-1 text-muted-foreground">
                  Number of Leads
                </label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  className="rounded-2xl h-14 px-6 bg-muted/50 border-border/50 font-bold"
                  {...register("number_of_leads", { valueAsNumber: true })}
                />
              </div>
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full md:w-auto rounded-full px-10 py-7 font-black uppercase tracking-tighter text-lg bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Find Leads
            </Button>
          </form>
        </CardContent>
      </Card>

      {activeJob && (
        <Card className="rounded-[2rem] border border-border bg-card shadow-lg overflow-hidden">
          <CardHeader className="p-8 pb-0">
            <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                {activeJob.status === "completed" ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : activeJob.status === "failed" ? (
                  <X className="h-5 w-5 text-red-600" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                )}
              </div>
              Job Status
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2 font-medium">
              {activeJob.status === "queued" && "Job is queued and will start shortly..."}
              {activeJob.status === "processing" && "Initializing lead finder..."}
              {activeJob.status === "scraping" && "Finding and scraping leads..."}
              {activeJob.status === "analyzing" && "Analyzing leads with AI..."}
              {activeJob.status === "completed" && "Lead finding complete!"}
              {activeJob.status === "failed" && "Job failed - please try again"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-6">
            <div className="space-y-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${activeJob.progress}%` }}
                />
              </div>
              <p className="text-sm font-bold text-muted-foreground">{activeJob.progress}% complete</p>
            </div>
          </CardContent>
        </Card>
      )}

      {leads.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tighter uppercase">
              Leads ({totalLeads})
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV} className="rounded-full">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>

          <Card className="rounded-[2rem] border border-border bg-card shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-black uppercase tracking-wider">Company</TableHead>
                    <TableHead className="font-black uppercase tracking-wider">Contact</TableHead>
                    <TableHead className="font-black uppercase tracking-wider">Email</TableHead>
                    <TableHead className="font-black uppercase tracking-wider">Phone</TableHead>
                    <TableHead className="font-black uppercase tracking-wider">Score</TableHead>
                    <TableHead className="font-black uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            {lead.company_name && (
                              <p className="font-bold">{lead.company_name}</p>
                            )}
                            {lead.industry && (
                              <p className="text-sm text-muted-foreground">{lead.industry}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {lead.contact_name && (
                              <p className="font-medium">{lead.contact_name}</p>
                            )}
                            {lead.job_title && (
                              <p className="text-sm text-muted-foreground">{lead.job_title}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.business_email ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{lead.business_email}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => handleCopyEmail(lead.business_email)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.phone_number ? (
                            <span className="text-sm">{lead.phone_number}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.lead_score !== undefined && (
                            <Badge className={cn("font-bold", getLeadScoreColor(lead.lead_score))}>
                              {lead.lead_score}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {lead.company_website && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => window.open(lead.company_website, "_blank")}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {lead.linkedin_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => window.open(lead.linkedin_url, "_blank")}
                              >
                                <Linkedin className="h-4 w-4" />
                              </Button>
                            )}
                            <Sheet>
                              <SheetTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full"
                                  onClick={() => setSelectedLead(lead)}
                                >
                                  <Filter className="h-4 w-4" />
                                </Button>
                              </SheetTrigger>
                              <SheetContent className="w-full md:max-w-2xl">
                                {selectedLead && (
                                  <>
                                    <SheetHeader>
                                      <SheetTitle className="text-xl font-black uppercase tracking-tight">
                                        Lead Details
                                      </SheetTitle>
                                      <SheetDescription className="font-medium">
                                        Complete lead information and AI-generated outreach content
                                      </SheetDescription>
                                    </SheetHeader>
                                    <div className="mt-8 space-y-8">
                                      <div className="space-y-6">
                                        <h3 className="text-lg font-bold uppercase tracking-wider">
                                          Company Info
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                                              Company Name
                                            </p>
                                            <p className="font-medium">{selectedLead.company_name || "—"}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                                              Website
                                            </p>
                                            {selectedLead.company_website ? (
                                              <a
                                                href={selectedLead.company_website}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-primary hover:underline font-medium"
                                              >
                                                {selectedLead.company_website}
                                              </a>
                                            ) : (
                                              <p className="font-medium">—</p>
                                            )}
                                          </div>
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                                              Industry
                                            </p>
                                            <p className="font-medium">{selectedLead.industry || "—"}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                                              Company Size
                                            </p>
                                            <p className="font-medium">{selectedLead.company_size || "—"}</p>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="space-y-6">
                                        <h3 className="text-lg font-bold uppercase tracking-wider">
                                          Contact Info
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                                              Name
                                            </p>
                                            <p className="font-medium">{selectedLead.contact_name || "—"}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                                              Job Title
                                            </p>
                                            <p className="font-medium">{selectedLead.job_title || "—"}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                                              Business Email
                                            </p>
                                            {selectedLead.business_email ? (
                                              <div className="flex items-center gap-2">
                                                <p className="font-medium">{selectedLead.business_email}</p>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7 rounded-full"
                                                  onClick={() => handleCopyEmail(selectedLead.business_email)}
                                                >
                                                  <Copy className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <p className="font-medium">—</p>
                                            )}
                                          </div>
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">
                                              Phone Number
                                            </p>
                                            <p className="font-medium">{selectedLead.phone_number || "—"}</p>
                                          </div>
                                        </div>
                                      </div>

                                      {selectedLead.ai_business_summary && (
                                        <div className="space-y-3">
                                          <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-primary" /> AI Business Summary
                                          </h3>
                                          <div className="p-4 bg-muted/50 rounded-2xl">
                                            <p className="text-sm">{selectedLead.ai_business_summary}</p>
                                          </div>
                                        </div>
                                      )}

                                      {selectedLead.ai_cold_email && (
                                        <div className="space-y-3">
                                          <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
                                            <MessageSquare className="h-5 w-5 text-primary" /> Cold Email
                                          </h3>
                                          <div className="p-4 bg-muted/50 rounded-2xl">
                                            <p className="text-sm whitespace-pre-wrap">{selectedLead.ai_cold_email}</p>
                                          </div>
                                        </div>
                                      )}

                                      {selectedLead.ai_whatsapp_message && (
                                        <div className="space-y-3">
                                          <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
                                            <MessageSquare className="h-5 w-5 text-primary" /> WhatsApp Message
                                          </h3>
                                          <div className="p-4 bg-muted/50 rounded-2xl">
                                            <p className="text-sm whitespace-pre-wrap">{selectedLead.ai_whatsapp_message}</p>
                                          </div>
                                        </div>
                                      )}

                                      {selectedLead.ai_voice_script && (
                                        <div className="space-y-3">
                                          <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
                                            <Phone className="h-5 w-5 text-primary" /> Voice Call Script
                                          </h3>
                                          <div className="p-4 bg-muted/50 rounded-2xl">
                                            <p className="text-sm whitespace-pre-wrap">{selectedLead.ai_voice_script}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </SheetContent>
                            </Sheet>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalLeads > pageSize && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" /> Previous
              </Button>
              <span className="text-sm font-bold text-muted-foreground">
                Page {currentPage} of {Math.ceil(totalLeads / pageSize)}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) =>
                  Math.min(Math.ceil(totalLeads / pageSize), prev + 1)
                )}
                disabled={currentPage >= Math.ceil(totalLeads / pageSize)}
              >
                Next <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
