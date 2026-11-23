import { useSearchParams, Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { Download, FileJson, FileSpreadsheet, Mail, Link2, Loader2, ArrowLeft, Sparkles, Target, Layout, MapPin, Phone, Star, ExternalLink, Filter, MessageSquare, Send, X, RefreshCw, LayoutGrid, List, Instagram, Users, Bot, MessageCircle, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage, instagramApi } from "@/lib/api";
import { fetchJob } from "@/hooks/useDashboardData";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import type { ExtractedData, AIAnalysis, Job, MapLead, SocialMediaLead, InstagramAccount, PeakyLead } from "@/types";
import { toast } from "sonner";

function leadHasWebsite(website?: string | null): boolean {
  if (!website?.trim()) return false;
  const value = website.trim().toLowerCase();
  if (["none", "null", "n/a", "-", "undefined"].includes(value)) return false;
  const ignore = [
    "google.com",
    "goo.gl",
    "maps.app.goo.gl",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "youtube.com",
    "tiktok.com",
    "wa.me",
    "whatsapp.com",
  ];
  return !ignore.some((host) => value.includes(host));
}

function buildFallbackOutreachMessage(
  lead: MapLead | SocialMediaLead
): string {
  let name = "your business";
  let category = "business";

  if ("business_name" in lead) {
    name = lead.business_name;
    category = (lead.category || "business").toLowerCase();
  } else if ("username" in lead) {
    name = lead.username;
    category = "social profile";
  }

  const phone = lead.phone || "";
  const isPakistan =
    phone.startsWith("+92") ||
    phone.startsWith("92") ||
    phone.startsWith("03");

  if (isPakistan) {
    if (category.includes("school") || category.includes("academy")) {
      return `Assalam o Alaikum! Maine aapka school '${name}' online dekha. Kaam toh aapka bohat acha hai, par aapki koi professional website nahi mili. Aaj kal parents sabse pehle online check karte hain. Agar ek achi website ban jaye toh parents ka trust bhi barhega. Kya hum is baare mein baat kar sakte hain?`;
    }
    return `Assalam o Alaikum! Maine aapka business '${name}' online dekha. Kaam aapka acha hai par website na hone ki wajah se online reach kam hai. Main aapke liye ek fast aur sasti website bana sakta hoon. Agar aap interested hain toh bataye ga. Shukriya!`;
  }

  return `Hi! I came across ${name} online and noticed you don't have a professional website yet. A modern website can help you attract more customers and build trust. I'd be happy to help if you're interested.`;
}

export function Results() {
  const [params] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const jobId = params.get("job");
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [ai, setAi] = useState<AIAnalysis | null>(null);
  const [leads, setLeads] = useState<MapLead[]>([]);
  const [socialLeads, setSocialLeads] = useState<SocialMediaLead[]>([]);
  const [peakyLeads, setPeakyLeads] = useState<PeakyLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filterMode, setFilterMode] = useState<"all" | "no_website" | "high_lead">("all");

  // Instagram state
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [selectedInstagramAccount, setSelectedInstagramAccount] = useState<string | null>(null);
  const [showInstagramDM, setShowInstagramDM] = useState(false);
  
  // Outreach state
  const [selectedLead, setSelectedLead] = useState<MapLead | SocialMediaLead | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showOutreach, setShowOutreach] = useState(false);

  const loadResults = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const jobData = await fetchJob(jobId);
      setJob(jobData);
      if (jobData.query?.toLowerCase().includes("without website")) {
        setFilterMode("no_website");
      }

      if (jobData.status !== "completed") {
        setExtracted(null);
        setAi(null);
        setLeads([]);
        setSocialLeads([]);
        setPeakyLeads([]);
        setLoading(false);
        return;
      }

      if (jobData.mode === "maps") {
        const { data } = await api.get<MapLead[]>(`/jobs/${jobId}/leads`);
        setLeads(data);
      } else if (jobData.mode === "social") {
        const { data } = await api.get<SocialMediaLead[]>(`/jobs/${jobId}/leads`);
        setSocialLeads(data);
      } else if (jobData.mode === "peaky") {
        const { data } = await api.get<PeakyLead[]>(`/jobs/${jobId}/leads`);
        setPeakyLeads(data);
      } else {
        const [ext, analysis] = await Promise.all([
          api.get<ExtractedData>(`/jobs/${jobId}/extracted`),
          api.get<AIAnalysis>(`/jobs/${jobId}/ai-analysis`),
        ]);
        setExtracted(ext.data);
        setAi(analysis.data);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load results"));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    setLoading(true);
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    const loadInstagramAccounts = async () => {
      try {
        const accounts = await instagramApi.list();
        setInstagramAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedInstagramAccount(accounts[0].id);
        }
      } catch (err) {
        console.error("Failed to load Instagram accounts:", err);
      }
    };
    loadInstagramAccounts();
  }, []);

  useEffect(() => {
    if (!jobId || !job || job.status === "completed" || job.status === "failed") return;

    const timer = setInterval(async () => {
      try {
        const updated = await fetchJob(jobId);
        setJob(updated);
        if (updated.status === "completed") {
          setLoading(true);
          await loadResults();
        }
      } catch {
        /* retry */
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [jobId, job?.status, loadResults]);

  const exportData = async (format: "csv" | "xlsx" | "json") => {
    if (!jobId) {
      toast.error("Select a job first");
      return;
    }
    try {
      const { data } = await api.get(`/exports/${jobId}`, {
        params: { format },
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-${jobId}.${format === "xlsx" ? "xlsx" : format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Export failed"));
    }
  };

  const startOutreach = async (lead: MapLead | SocialMediaLead) => {
    setSelectedLead(lead);
    setShowOutreach(true);
    setGeneratedMessage("");
    setIsGenerating(true);
    
    try {
      let bizName = "";
      let category = "Business";
      let location = "Unknown";

      if ('business_name' in lead) {
        bizName = lead.business_name;
        category = lead.category || "Local Business";
        location = lead.address || "Unknown";
      } else {
        bizName = (lead as SocialMediaLead).username;
        category = "Social Profile";
        location = (lead as SocialMediaLead).platform || "Instagram";
      }

      const res = await api.post("/outreach/generate", {
        business_name: bizName,
        category: category || "Business",
        location: location || "Unknown",
        phone: lead.phone
      }, { timeout: 60000 });
      setGeneratedMessage(res.data.message);
    } catch (err) {
      console.error("Outreach generation failed", err);
      setGeneratedMessage(buildFallbackOutreachMessage(lead));
      toast.error(getApiErrorMessage(err, "Using default message — you can edit before sending"));
    } finally {
      setIsGenerating(false);
    }
  };

  const startInstagramDM = async (lead: SocialMediaLead) => {
    if (instagramAccounts.length === 0) {
      toast.error("Please connect an Instagram account first!", {
        action: {
          label: "Connect Account",
          onClick: () => window.location.href = "/instagram"
        }
      });
      return;
    }

    setSelectedLead(lead);
    setShowInstagramDM(true);
    setGeneratedMessage("");
    setIsGenerating(true);
    
    try {
      const res = await instagramApi.generateDM({
        username: lead.username,
        full_name: lead.full_name,
        bio: lead.bio,
        followers_count: lead.followers_count,
        website: lead.website
      });
      setGeneratedMessage(res.message);
    } catch (err) {
      console.error("Instagram DM generation failed", err);
      setGeneratedMessage(`Hi @${lead.username}! I came across your profile and was impressed by your work.`);
      toast.error(getApiErrorMessage(err, "Using default message — you can edit before sending"));
    } finally {
      setIsGenerating(false);
    }
  };

  const sendInstagramDM = async () => {
    if (!selectedLead || !generatedMessage || !selectedInstagramAccount) return;
    setIsSending(true);
    try {
      await instagramApi.sendDM({
        target_username: selectedLead.username,
        message: generatedMessage,
        instagram_account_id: selectedInstagramAccount
      });
      toast.success("Instagram DM sent successfully!");
      setShowInstagramDM(false);
    } catch (err) {
      console.error("Instagram DM sending failed", err);
      toast.error(getApiErrorMessage(err, "Failed to send Instagram DM"));
    } finally {
      setIsSending(false);
    }
  };

  const sendOutreach = async () => {
    if (!selectedLead || !generatedMessage) return;
    setIsSending(true);
    try {
      await api.post("/outreach/send", {
        message: generatedMessage,
        phone: selectedLead.phone,
        status: "sending"
      });
      toast.success("WhatsApp outreach initiated!");
      setShowOutreach(false);
    } catch (err: any) {
      console.error("Outreach sending failed", err);
      const msg = err.response?.data?.detail || "Failed to send WhatsApp message";
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  if (!jobId) {
    return (
      <Card className="max-w-lg mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-4">
          <p className="text-muted-foreground">No job selected. Open results from the dashboard jobs table.</p>
          <Link to="/dashboard">
            <Button><ArrowLeft className="h-4 w-4" /> Back to dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (loading && !job) return <TableSkeleton rows={8} />;

  if (job && job.status !== "completed") {
    return (
      <Card className="max-w-lg mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-4">
          {job.status !== "failed" && (
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          )}
          <p className="font-medium capitalize">Job is {job.status.replace("_", " ")}</p>
          <p className="text-sm text-muted-foreground">Progress: {job.progress}%</p>
          {job.status === "failed" && job.error_message && (
            <p className="text-sm text-destructive">{job.error_message}</p>
          )}
          <Link to="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const hasNoData = !extracted && leads.length === 0 && socialLeads.length === 0 && peakyLeads.length === 0;
  
  if (error || hasNoData) {
    // Determine appropriate message based on job mode
    let noDataMessage = "No extracted data for this job";
    if (job?.mode === "maps") {
      noDataMessage = "No maps leads found for this job";
    } else if (job?.mode === "social") {
      noDataMessage = "No social media leads found for this job";
    } else if (job?.mode === "peaky") {
      noDataMessage = "No Peaky Dev leads found for this job";
    }
    
    return (
      <Card className="max-w-lg mx-auto mt-12 border-destructive/50">
        <CardContent className="p-8 text-center space-y-4">
          <p className="text-destructive">{error || noDataMessage}</p>
          <Button variant="outline" onClick={() => { setLoading(true); loadResults(); }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const filteredLeads = leads.filter(l => {
    if (filterMode === "no_website") return !leadHasWebsite(l.website);
    if (filterMode === "high_lead") return l.lead_score === "High";
    return true;
  });

  const filteredSocialLeads = socialLeads.filter(l => {
    if (filterMode === "no_website") return !leadHasWebsite(l.website);
    if (filterMode === "high_lead") return l.lead_score === "High";
    return true;
  });

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/dashboard" className="h-8 w-8 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-black transition-all">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
               {job?.mode === "maps" ? "Google Maps Leads" : job?.mode === "social" ? "Social Media Leads" : job?.mode === "peaky" ? "Peaky Dev Leads" : "Analysis Results"}
            </h1>
          </div>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            {job?.mode === "maps" ? (
              <MapPin className="h-4 w-4 text-primary" />
            ) : job?.mode === "social" ? (
              socialLeads.length > 0 ? (
                socialLeads[0].platform === "TikTok" ? (
                  <Music2 className="h-4 w-4 text-primary" />
                ) : (
                  <Instagram className="h-4 w-4 text-primary" />
                )
              ) : (
                <Instagram className="h-4 w-4 text-primary" />
              )
            ) : job?.mode === "peaky" ? (
              <Users className="h-4 w-4 text-primary" />
            ) : (
              <Link2 className="h-4 w-4 text-primary" />
            )}
            {job?.mode === "maps" || job?.mode === "social" ? job.query : job?.mode === "peaky" ? "Verified leads from Peaky Dev" : extracted?.url}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-full font-bold border-primary/20 hover:bg-primary hover:text-black" onClick={() => exportData("csv")}>
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" className="rounded-full font-bold border-primary/20 hover:bg-primary hover:text-black" onClick={() => exportData("xlsx")}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" className="rounded-full font-bold border-primary/20 hover:bg-primary hover:text-black" onClick={() => exportData("json")}>
            <FileJson className="h-4 w-4" /> JSON
          </Button>
        </div>
      </div>

      {(job?.mode === "maps" || job?.mode === "social" || job?.mode === "peaky") && (
        <div className="space-y-8">
          {(job?.mode === "maps" || job?.mode === "social") && (
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-3xl border border-border">
               <Filter className="h-4 w-4 text-muted-foreground ml-2" />
               <div className="flex gap-2">
                 {(["all", "no_website", "high_lead"] as const).map((m) => (
                   <button
                     key={m}
                     onClick={() => setFilterMode(m)}
                     className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-tight transition-all ${
                       filterMode === m ? "bg-primary text-black" : "bg-background text-muted-foreground hover:bg-muted"
                     }`}
                   >
                     {m.replace("_", " ")}
                   </button>
                 ))}
               </div>
            </div>
          )}

          <Card className="rounded-[2.5rem] border border-border bg-card shadow-lg overflow-hidden">
             <CardContent className="p-0">
                <div className="overflow-x-auto">
                   {job?.mode === "peaky" ? (
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="border-b border-border bg-muted/20">
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                Person
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                Company
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                Contact
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                LinkedIn
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                Lead Score
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                Opportunity
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right">
                                Outreach
                              </th>
                           </tr>
                        </thead>
                        <tbody>
                           {peakyLeads.map((lead) => (
                             <tr key={lead.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                                <td className="p-6">
                                   <p className="font-bold text-sm">
                                     {lead.first_name} {lead.last_name}
                                   </p>
                                   <p className="text-[10px] text-muted-foreground">
                                     {lead.person_title} • {lead.seniority}
                                   </p>
                                   <p className="text-[10px] text-muted-foreground">
                                     {lead.person_state}, {lead.person_country}
                                   </p>
                                </td>
                                <td className="p-6">
                                   <p className="font-bold text-sm">{lead.company_name}</p>
                                   <p className="text-[10px] text-muted-foreground">
                                     {lead.industry} • {lead.company_employee_size} • {lead.revenue}
                                   </p>
                                   {lead.company_domain && (
                                     <a href={`https://${lead.company_domain}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary hover:underline">
                                       {lead.company_domain}
                                     </a>
                                   )}
                                </td>
                                <td className="p-6 space-y-1">
                                   {lead.work_email && (
                                     <p className="text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                                       <Mail className="h-3 w-3" /> {lead.work_email}
                                     </p>
                                   )}
                                   {lead.personal_email && (
                                     <p className="text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                                       <Mail className="h-3 w-3" /> {lead.personal_email} (Personal)
                                     </p>
                                   )}
                                   {lead.phone && (
                                     <p className="text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                                       <Phone className="h-3 w-3" /> {lead.phone}
                                     </p>
                                   )}
                                </td>
                                <td className="p-6 space-y-1">
                                   {lead.linkedin_url && (
                                     <a
                                       href={lead.linkedin_url}
                                       target="_blank"
                                       rel="noreferrer"
                                       className="text-xs font-bold text-primary flex items-center gap-1 hover:underline whitespace-nowrap"
                                     >
                                       <Link2 className="h-3 w-3" /> Profile
                                     </a>
                                   )}
                                   {lead.company_linkedin_url && (
                                     <a
                                       href={lead.company_linkedin_url}
                                       target="_blank"
                                       rel="noreferrer"
                                       className="text-xs font-bold text-muted-foreground flex items-center gap-1 hover:underline whitespace-nowrap"
                                     >
                                       <Link2 className="h-3 w-3" /> Company
                                     </a>
                                   )}
                                </td>
                                <td className="p-6">
                                  <Badge className={`rounded-full px-4 py-1 font-black uppercase tracking-widest text-[9px] ${
                                     lead.lead_score === "High" ? "bg-primary text-black" : "bg-muted text-muted-foreground"
                                  }`}>
                                     {lead.lead_score}
                                  </Badge>
                                </td>
                                <td className="p-6">
                                  <p className="text-xs font-bold text-primary uppercase tracking-tight">{lead.recommended_service || "Lead Outreach"}</p>
                                  <p className="text-[10px] text-muted-foreground line-clamp-1">{lead.ai_summary}</p>
                                </td>
                                <td className="p-6 text-right">
                                  <Button 
                                    size="sm" 
                                    className="rounded-full font-black uppercase text-[9px] tracking-widest h-8 px-4"
                                    disabled={!lead.phone}
                                    onClick={() => startOutreach(lead as any)}
                                  >
                                    <MessageSquare className="h-3 w-3 mr-2" /> WhatsApp
                                  </Button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                   ) : (
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="border-b border-border bg-muted/20">
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                {job.mode === "maps" ? "Business Name" : "Profile / Username"}
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                {job.mode === "maps" ? "Category" : "Stats"}
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Contact</th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">
                                {job.mode === "maps" ? "Rating" : "Platform"}
                              </th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Lead Score</th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Opportunity</th>
                              <th className="p-6 font-black uppercase tracking-widest text-[10px] text-muted-foreground text-right">Outreach</th>
                           </tr>
                        </thead>
                        <tbody>
                           {job.mode === "maps" ? filteredLeads.map((lead) => (
                              <tr key={lead.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                                 <td className="p-6">
                                    <p className="font-bold text-sm">{lead.business_name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate max-w-xs">{lead.address}</p>
                                 </td>
                                 <td className="p-6">
                                    <Badge variant="outline" className="rounded-full text-[10px] uppercase font-bold">{lead.category || "General"}</Badge>
                                 </td>
                                 <td className="p-6 space-y-1">
                                    {lead.phone && <p className="text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Phone className="h-3 w-3" /> {lead.phone}</p>}
                                    {lead.email && <p className="text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Mail className="h-3 w-3" /> {lead.email}</p>}
                                    {leadHasWebsite(lead.website) ? (
                                      <a href={lead.website} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary flex items-center gap-1 hover:underline whitespace-nowrap">
                                         <Link2 className="h-3 w-3" /> Website <ExternalLink className="h-2 w-2" />
                                      </a>
                                    ) : (
                                      <Badge variant="destructive" className="rounded-full text-[9px] px-2 py-0">No Website</Badge>
                                    )}
                                 </td>
                                 <td className="p-6">
                                    <div className="flex items-center gap-1">
                                       <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                       <span className="text-xs font-black">{lead.rating || "N/A"}</span>
                                       <span className="text-[10px] text-muted-foreground">({lead.reviews || 0})</span>
                                    </div>
                                 </td>
                                 <td className="p-6">
                                    <Badge className={`rounded-full px-4 py-1 font-black uppercase tracking-widest text-[9px] ${
                                       lead.lead_score === "High" ? "bg-primary text-black" : "bg-muted text-muted-foreground"
                                    }`}>
                                       {lead.lead_score}
                                    </Badge>
                                 </td>
                                 <td className="p-6">
                                    <p className="text-xs font-bold text-primary uppercase tracking-tight">{lead.recommended_service || "Optimization"}</p>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">{lead.ai_summary}</p>
                                 </td>
                                 <td className="p-6 text-right">
                                    <Button 
                                      size="sm" 
                                      className="rounded-full font-black uppercase text-[9px] tracking-widest h-8 px-4"
                                      onClick={() => startOutreach(lead)}
                                    >
                                      <MessageSquare className="h-3 w-3 mr-2" /> WhatsApp
                                    </Button>
                                 </td>
                              </tr>
                           )) : filteredSocialLeads.map((lead) => (
                              <tr key={lead.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                                 <td className="p-6">
                                    <div className="flex items-center gap-3">
                                      {lead.profile_pic_url ? (
                                        <img 
                                          src={`https://images.weserv.nl/?url=${encodeURIComponent(lead.profile_pic_url)}&w=100&h=100&fit=cover&mask=circle`} 
                                          className="h-10 w-10 rounded-full border border-border object-cover" 
                                          alt="" 
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            // Fallback to direct URL if proxy fails
                                            const target = e.target as HTMLImageElement;
                                            if (!target.src.includes("weserv")) return;
                                            target.src = lead.profile_pic_url || "";
                                          }}
                                        />
                                      ) : (
                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-border">
                                          {lead.platform === "TikTok" ? (
                                            <Music2 className="h-5 w-5 text-muted-foreground" />
                                          ) : (
                                            <Instagram className="h-5 w-5 text-muted-foreground" />
                                          )}
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-bold text-sm">@{lead.username}</p>
                                        <p className="text-[10px] text-muted-foreground truncate max-w-xs">{lead.full_name}</p>
                                      </div>
                                    </div>
                                 </td>
                                 <td className="p-6 space-y-1">
                                    <div className="flex items-center gap-2 text-[10px] font-bold">
                                      <Users className="h-3 w-3" /> {lead.followers_count?.toLocaleString()} Followers
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                      <LayoutGrid className="h-3 w-3" /> {lead.posts_count} Posts
                                    </div>
                                 </td>
                                 <td className="p-6 space-y-1">
                                    {lead.phone && <p className="text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Phone className="h-3 w-3" /> {lead.phone}</p>}
                                    {lead.email && <p className="text-xs font-bold flex items-center gap-1 whitespace-nowrap"><Mail className="h-3 w-3" /> {lead.email}</p>}
                                    {leadHasWebsite(lead.website) ? (
                                      <a href={lead.website} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary flex items-center gap-1 hover:underline whitespace-nowrap">
                                         <Link2 className="h-3 w-3" /> Website <ExternalLink className="h-2 w-2" />
                                      </a>
                                    ) : (
                                      <Badge variant="destructive" className="rounded-full text-[9px] px-2 py-0">No Website</Badge>
                                    )}
                                 </td>
                                 <td className="p-6">
                                    <div className="flex items-center gap-1">
                                       {lead.platform === "TikTok" ? (
                                         <><Music2 className="h-3 w-3 text-[#ff0050]" />
                                         <a href={lead.profile_url} target="_blank" rel="noreferrer" className="text-xs font-black hover:underline">TikTok</a></>
                                       ) : (
                                         <><Instagram className="h-3 w-3 text-pink-500" />
                                         <a href={lead.profile_url} target="_blank" rel="noreferrer" className="text-xs font-black hover:underline">Instagram</a></>
                                       )}
                                    </div>
                                 </td>
                                 <td className="p-6">
                                    <Badge className={`rounded-full px-4 py-1 font-black uppercase tracking-widest text-[9px] ${
                                       lead.lead_score === "High" ? "bg-primary text-black" : "bg-muted text-muted-foreground"
                                    }`}>
                                       {lead.lead_score}
                                    </Badge>
                                 </td>
                                 <td className="p-6">
                                    <p className="text-xs font-bold text-primary uppercase tracking-tight">{lead.recommended_service || "Optimization"}</p>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">{lead.ai_summary}</p>
                                 </td>
                                 <td className="p-6 text-right space-x-2">
                                    {lead.platform === "Instagram" && (
                                      <Button 
                                        size="sm" 
                                        variant="secondary"
                                        className="rounded-full font-black uppercase text-[9px] tracking-widest h-8 px-4 border border-border/50 transition-all hover:bg-primary hover:text-black"
                                        onClick={() => startInstagramDM(lead)}
                                      >
                                        <MessageCircle className="h-3 w-3 mr-2" /> DM
                                      </Button>
                                    )}
                                    <Button 
                                      size="sm" 
                                      className="rounded-full font-black uppercase text-[9px] tracking-widest h-8 px-4"
                                      disabled={!lead.phone}
                                      onClick={() => startOutreach(lead)}
                                    >
                                      <MessageSquare className="h-3 w-3 mr-2" /> WhatsApp
                                    </Button>
                                 </td>
                              </tr>
                           ))}
                      </tbody>
                   </table>
                   )}
                 </div>
             </CardContent>
          </Card>
        </div>
      )}

      {job?.mode === "website" && extracted && ai && (
        <Card className="rounded-[2.5rem] border-primary/20 bg-[#081208] text-white shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8">
             <Badge className={`rounded-full px-6 py-2 font-black uppercase tracking-widest text-[10px] ${
                ai.lead_score === "High" ? "bg-primary text-black" : "bg-white/10 text-white"
             }`}>
               Lead: {ai.lead_score}
             </Badge>
          </div>
          <CardHeader className="p-10 pb-0">
            <CardTitle className="text-primary uppercase tracking-widest text-xs font-black mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> AI Intelligence Analysis
            </CardTitle>
            <h2 className="text-4xl font-black tracking-tighter uppercase leading-tight max-w-2xl">
              {ai.company_name || "Business Identity"}
            </h2>
          </CardHeader>
          <CardContent className="p-10 pt-8 space-y-10">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Industry</p>
                <p className="text-lg font-bold uppercase tracking-tight">{ai.industry}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Business Type</p>
                <p className="text-lg font-bold uppercase tracking-tight">{ai.business_type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Niche</p>
                <p className="text-lg font-bold uppercase tracking-tight">{ai.niche}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Confidence</p>
                <p className="text-lg font-bold uppercase tracking-tight text-primary">High</p>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-white/5 border border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Executive Summary</p>
              <p className="text-lg font-medium leading-relaxed text-white/80 italic">
                "{ai.summary}"
              </p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Detected Capabilities</p>
              <div className="flex flex-wrap gap-3">
                {ai.services.map((s) => (
                  <Badge key={s} className="rounded-full bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 font-bold text-[10px] uppercase tracking-wider hover:bg-primary hover:text-black transition-all">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {job?.mode === "website" && extracted && (
          <>
            <Card className="rounded-[2.5rem] border border-border bg-card shadow-lg overflow-hidden">
              <CardHeader className="p-10 pb-0">
                <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  Contact Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-10 pt-8 space-y-8">
                <div className="grid sm:grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Verified Emails</p>
                    {extracted.emails.length ? (
                      <div className="space-y-2">
                        {extracted.emails.map((e) => (
                          <div key={e} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 font-bold text-sm border border-border/50">
                            <Mail className="h-3 w-3 text-primary" />
                            {e}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-muted-foreground/60 italic">No emails detected</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Phone Numbers</p>
                    {extracted.phones.length ? (
                      <div className="space-y-2">
                        {extracted.phones.map((p) => (
                          <div key={p} className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 font-bold text-sm border border-border/50">
                            <Target className="h-3 w-3 text-primary" />
                            {p}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-muted-foreground/60 italic">No phones detected</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Social Ecosystem</p>
                  {Object.keys(extracted.social_links).length ? (
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(extracted.social_links).map(([k, v]) => (
                        <a
                          key={k}
                          href={v as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-black transition-all"
                        >
                          <Link2 className="h-3 w-3" />
                          {k}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-muted-foreground/60 italic">No social profiles detected</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border border-border bg-card shadow-lg overflow-hidden">
              <CardHeader className="p-10 pb-0">
                <CardTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Layout className="h-5 w-5 text-primary" />
                  </div>
                  Page Architecture
                </CardTitle>
              </CardHeader>
              <CardContent className="p-10 pt-8 space-y-8">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Meta Title</p>
                  <div className="p-4 rounded-2xl bg-muted/50 border border-border/50 text-sm font-bold leading-tight">
                    {extracted.title}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Meta Description</p>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    {extracted.meta_description || "No meta description found on this page."}
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Technology Stack</p>
                    <div className="flex flex-wrap gap-2">
                      {extracted.tech_stack.map((tech) => (
                        <span key={tech} className="px-3 py-1 rounded-lg bg-foreground/5 border border-foreground/10 text-[10px] font-black uppercase tracking-tighter">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Content Depth</p>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary">
                          {extracted.services.length}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Topics Mapped</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Instagram DM Modal */}
      {showInstagramDM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg rounded-[2.5rem] border-primary/20 bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-pink-500/10 flex items-center justify-center shrink-0">
                  <Instagram className="h-7 w-7 text-pink-500" />
                </div>
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-pink-500 mb-1">Instagram DM</CardTitle>
                  <h3 className="text-xl font-black tracking-tight uppercase">
                    @{'username' in selectedLead! ? selectedLead.username : ''}
                  </h3>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowInstagramDM(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Instagram Account</label>
                <div className="space-y-2">
                  {instagramAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedInstagramAccount(account.id)}
                      className={cn(
                        "w-full p-3 rounded-xl border text-left transition-all",
                        selectedInstagramAccount === account.id
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted/30 border-border hover:bg-muted/50"
                      )}
                    >
                      <p className="font-bold text-sm">@{account.username}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Connected on {new Date(account.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Generated Message</label>
                <div className="relative">
                  {isGenerating ? (
                    <div className="h-40 w-full rounded-2xl bg-muted/50 flex flex-col items-center justify-center gap-3 border border-border border-dashed">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Drafting AI Message...</p>
                    </div>
                  ) : (
                    <textarea
                      value={generatedMessage}
                      onChange={(e) => setGeneratedMessage(e.target.value)}
                      className="w-full h-40 rounded-2xl bg-muted/30 border border-border p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      placeholder="Write your message here..."
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full rounded-full py-6 font-black uppercase tracking-widest bg-pink-500 text-white hover:bg-pink-600"
                  disabled={isGenerating || isSending || !generatedMessage || !selectedInstagramAccount}
                  onClick={sendInstagramDM}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> Send via Instagram
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WhatsApp Outreach Modal */}
      {showOutreach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg rounded-[2.5rem] border-primary/20 bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-primary mb-1">OutreachX AI Assistant</CardTitle>
                  <h3 className="text-xl font-black tracking-tight uppercase">
                    {'business_name' in selectedLead! 
                      ? selectedLead.business_name 
                      : 'company_name' in selectedLead!
                        ? selectedLead.company_name
                        : 'full_name' in selectedLead! && !('username' in selectedLead!)
                          ? selectedLead.full_name
                          : selectedLead?.username}
                  </h3>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowOutreach(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Generated Message</label>
                <div className="relative">
                  {isGenerating ? (
                    <div className="h-40 w-full rounded-2xl bg-muted/50 flex flex-col items-center justify-center gap-3 border border-border border-dashed">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Drafting AI Message...</p>
                    </div>
                  ) : (
                    <textarea
                      value={generatedMessage}
                      onChange={(e) => setGeneratedMessage(e.target.value)}
                      className="w-full h-40 rounded-2xl bg-muted/30 border border-border p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      placeholder="Write your message here..."
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full rounded-full py-6 font-black uppercase tracking-widest bg-primary text-black hover:bg-primary/90"
                  disabled={isGenerating || isSending || !generatedMessage}
                  onClick={sendOutreach}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> Send via WhatsApp
                    </>
                  )}
                </Button>
                <p className="text-[9px] text-center text-muted-foreground font-bold uppercase tracking-tight">
                  Target: {selectedLead?.phone} ({selectedLead?.phone?.startsWith('+92') ? 'Pakistan' : 'International'})
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
