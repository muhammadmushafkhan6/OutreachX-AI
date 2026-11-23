import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MapPin,
  Globe,
  Mail,
  Phone,
  Download,
  Zap,
  Star,
  ChevronRight,
  Layers,
  Copy,
  Check,
  MessageSquare,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BusinessMap } from "@/components/maps/BusinessMap";
import { LeadDetailSheet } from "@/components/maps/LeadDetailSheet";
import { createSingleJob, fetchDashboardData } from "@/hooks/useDashboardData";
import { useJobStore } from "@/stores/jobStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useJobPolling } from "@/hooks/useJobPolling";
import { api, getApiErrorMessage } from "@/lib/api";
import type { Job, MapLead } from "@/types";
import { POPULAR_COUNTRIES, POPULAR_CATEGORIES, CITIES_BY_COUNTRY } from "@/lib/geo";
import { exportLeadsToPDF } from "@/lib/pdfExport";

export default function GoogleMapLeadsFinder() {
  const [params, setParams] = useSearchParams();

  // Search parameters / Form State
  const [country, setCountry] = useState(params.get("country") || "UK");
  const [city, setCity] = useState(params.get("city") || "Manchester");
  const [category, setCategory] = useState(params.get("category") || "Restaurants");
  const [leadTarget, setLeadTarget] = useState<number>(50);
  const [withoutWebsite, setWithoutWebsite] = useState(false);

  // Job and Lead State
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [leads, setLeads] = useState<MapLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<MapLead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<"all" | "high" | "website" | "email">("all");
  const [activeViewTab, setActiveViewTab] = useState<"all" | "emails" | "phones">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Job Store & WebSocket / Polling
  const { jobs: storeJobs, setJobs } = useJobStore();

  useWebSocket(activeJob?.id || null);
  useJobPolling(activeJob?.id || null);

  // Fetch initial dashboard jobs
  useEffect(() => {
    fetchDashboardData().catch((err) => console.error("Error loading past jobs:", err));
  }, []);

  // Load URL Param Job
  const paramJobId = params.get("job");
  useEffect(() => {
    if (paramJobId && storeJobs.length > 0) {
      const match = storeJobs.find((j) => j.id === paramJobId);
      if (match) {
        setActiveJob(match);
      }
    }
  }, [paramJobId, storeJobs]);

  // Filter Google Maps Jobs
  const mapsJobs = useMemo(() => {
    return storeJobs.filter(
      (j) =>
        j.job_type === "maps_search" ||
        (j.url && j.url.includes("google.com/maps")) ||
        (j.query && !j.url)
    );
  }, [storeJobs]);

  // Fetch Leads for Active Job
  useEffect(() => {
    if (!activeJob?.id) return;

    let isMounted = true;
    const fetchLeads = async () => {
      try {
        const res = await api.get(`/jobs/${activeJob.id}/leads`);
        if (isMounted && res.data && Array.isArray(res.data)) {
          setLeads(res.data);
        }
      } catch (err) {
        console.error("Failed to load map leads:", err);
      }
    };

    fetchLeads();

    let interval: any = null;
    if (activeJob.status === "processing" || activeJob.status === "scraping" || activeJob.status === "queued") {
      interval = setInterval(fetchLeads, 2000);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [activeJob?.id, activeJob?.status]);

  // Submit Lead Generation Job
  const handleStartGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !category.trim()) {
      toast.error("Please enter both City and Category");
      return;
    }

    setIsSubmitting(true);
    try {
      const queryStr = `${category.trim()} in ${city.trim()}, ${country.trim()}`;
      const payload = {
        mode: "maps" as const,
        job_type: "maps_search",
        query: queryStr,
        location: `${city.trim()}, ${country.trim()}`,
        city: city.trim(),
        country: country.trim(),
        category: category.trim(),
        max_results: Number(leadTarget) || 50,
        filters: {
          without_website: withoutWebsite,
        },
      };

      const newJob = await createSingleJob(payload);
      setActiveJob(newJob);
      setLeads([]);
      setJobs([newJob, ...storeJobs]);
      setParams({
        job: newJob.id,
        city: city.trim(),
        country: country.trim(),
        category: category.trim(),
      });

      toast.success("Radar Activated! Scanning Google Maps in real-time...");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to start Lead Generation"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dedicated Lists
  const emailLeads = useMemo(() => {
    return leads.filter((l) => Boolean(l.email || (l.emails && l.emails.length > 0)));
  }, [leads]);

  const phoneLeads = useMemo(() => {
    return leads.filter((l) => Boolean(l.phone || l.whatsapp));
  }, [leads]);

  // Copy Helpers
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllEmails = () => {
    const list = Array.from(
      new Set(
        emailLeads
          .map((l) => l.email || (l.emails && l.emails[0]))
          .filter(Boolean)
      )
    );
    if (list.length === 0) {
      toast.error("No verified emails found to copy");
      return;
    }
    navigator.clipboard.writeText(list.join("\n"));
    toast.success(`Copied ${list.length} verified emails to clipboard!`);
  };

  const handleCopyAllPhones = () => {
    const list = Array.from(
      new Set(
        phoneLeads
          .map((l) => l.phone || l.whatsapp)
          .filter(Boolean)
      )
    );
    if (list.length === 0) {
      toast.error("No phone numbers found to copy");
      return;
    }
    navigator.clipboard.writeText(list.join("\n"));
    toast.success(`Copied ${list.length} phone numbers to clipboard!`);
  };

  // CSV Export Handlers
  const handleExportCSV = () => {
    if (leads.length === 0) {
      toast.error("No leads available to export");
      return;
    }

    const headers = [
      "Business Name",
      "Category",
      "Lead Score",
      "Phone",
      "Email",
      "Website Status",
      "Website URL",
      "Rating",
      "Reviews",
      "Address",
      "AI Opportunity",
      "Google Maps URL",
    ];

    const rows = leads.map((l) => [
      `"${(l.business_name || "").replace(/"/g, '""')}"`,
      `"${(l.category || "").replace(/"/g, '""')}"`,
      `"${l.lead_score || "HIGH"}"`,
      `"${l.phone || l.whatsapp || ""}"`,
      `"${l.email || (l.emails ? l.emails.join("; ") : "")}"`,
      `"${l.website ? "Has Website" : "No Website"}"`,
      `"${l.website || ""}"`,
      l.rating || "",
      l.reviews || "",
      `"${(l.address || "").replace(/"/g, '""')}"`,
      `"${(l.recommended_service || "").replace(/"/g, '""')}"`,
      `"${l.maps_url || ""}"`,
    ]);

    downloadCSV(headers, rows, `Google_Maps_Leads_${city}_${category}`);
  };

  const handleExportEmailsCSV = () => {
    if (emailLeads.length === 0) {
      toast.error("No verified email leads available");
      return;
    }

    const headers = [
      "Business Name",
      "Verified Email",
      "Website Status",
      "Website URL",
      "Phone",
      "Category",
      "Rating",
      "Address",
    ];

    const rows = emailLeads.map((l) => [
      `"${(l.business_name || "").replace(/"/g, '""')}"`,
      `"${l.email || (l.emails ? l.emails.join("; ") : "")}"`,
      `"${l.website ? "Has Website" : "No Website"}"`,
      `"${l.website || ""}"`,
      `"${l.phone || l.whatsapp || ""}"`,
      `"${(l.category || "").replace(/"/g, '""')}"`,
      l.rating || "",
      `"${(l.address || "").replace(/"/g, '""')}"`,
    ]);

    downloadCSV(headers, rows, `Verified_Emails_${city}_${category}`);
  };

  const handleExportPhonesCSV = () => {
    if (phoneLeads.length === 0) {
      toast.error("No phone number leads available");
      return;
    }

    const headers = [
      "Business Name",
      "Phone Number",
      "Website Status",
      "Website URL",
      "Email",
      "Category",
      "Rating",
      "Address",
    ];

    const rows = phoneLeads.map((l) => [
      `"${(l.business_name || "").replace(/"/g, '""')}"`,
      `"${l.phone || l.whatsapp || ""}"`,
      `"${l.website ? "Has Website" : "No Website"}"`,
      `"${l.website || ""}"`,
      `"${l.email || (l.emails ? l.emails.join("; ") : "")}"`,
      `"${(l.category || "").replace(/"/g, '""')}"`,
      l.rating || "",
      `"${(l.address || "").replace(/"/g, '""')}"`,
    ]);

    downloadCSV(headers, rows, `Phone_Directory_${city}_${category}`);
  };

  const downloadCSV = (headers: string[], rows: (string | number)[][], filenamePrefix: string) => {
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${rows.length} rows to CSV`);
  };

  // PDF Export Handlers (Executive Sales Sheets)
  const handleExportPDF = async () => {
    if (leads.length === 0) {
      toast.error("No leads available to export");
      return;
    }
    const tid = toast.loading("Preparing sales leads PDF...");
    try {
      await exportLeadsToPDF({
        leads,
        category,
        city,
        country,
        type: "all",
      });
      toast.dismiss(tid);
      toast.success(`Generated Sales Leads PDF for ${leads.length} leads!`);
    } catch (err) {
      console.error(err);
      toast.dismiss(tid);
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  const handleExportEmailsPDF = async () => {
    if (emailLeads.length === 0) {
      toast.error("No verified email leads available");
      return;
    }
    const tid = toast.loading("Preparing Email Leads PDF...");
    try {
      await exportLeadsToPDF({
        leads: emailLeads,
        category,
        city,
        country,
        type: "emails",
      });
      toast.dismiss(tid);
      toast.success(`Generated Email Leads PDF for ${emailLeads.length} leads!`);
    } catch (err) {
      console.error(err);
      toast.dismiss(tid);
      toast.error("Failed to generate PDF");
    }
  };

  const handleExportPhonesPDF = async () => {
    if (phoneLeads.length === 0) {
      toast.error("No phone number leads available");
      return;
    }
    const tid = toast.loading("Preparing Calling Sheet PDF...");
    try {
      await exportLeadsToPDF({
        leads: phoneLeads,
        category,
        city,
        country,
        type: "phones",
      });
      toast.dismiss(tid);
      toast.success(`Generated Calling Sheet PDF for ${phoneLeads.length} leads!`);
    } catch (err) {
      console.error(err);
      toast.dismiss(tid);
      toast.error("Failed to generate PDF");
    }
  };

  // Filter leads for Table
  const tableFilteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matches =
          (l.business_name || "").toLowerCase().includes(q) ||
          (l.category || "").toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.phone || "").toLowerCase().includes(q) ||
          (l.address || "").toLowerCase().includes(q) ||
          (l.website || "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (tableFilter === "high") {
        return (l.lead_score || "").toUpperCase() === "HIGH";
      }
      if (tableFilter === "website") {
        return Boolean(l.website && l.website.trim() !== "");
      }
      if (tableFilter === "email") {
        return Boolean(l.email || (l.emails && l.emails.length > 0));
      }

      return true;
    });
  }, [leads, tableSearch, tableFilter]);

  const isJobRunning =
    activeJob &&
    (activeJob.status === "processing" || activeJob.status === "scraping" || activeJob.status === "queued");
  const progressPercent =
    activeJob?.progress ||
    (leads.length > 0 ? Math.min(100, Math.round((leads.length / leadTarget) * 100)) : 0);

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in pb-20 mx-auto w-full px-2">
      {/* ── 1. HEADER (CLEAN & OPEN) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-white/5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase text-foreground whitespace-nowrap">
              Google Maps Leads Finder
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
              Live Radar
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">
            Real-time geospatial business intelligence with automated website & email discovery
          </p>
        </div>

        {/* History Switcher */}
        {mapsJobs.length > 1 && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full shadow-sm shrink-0 self-start sm:self-auto">
            <span className="text-[11px] font-bold text-muted-foreground uppercase whitespace-nowrap">Past Scans:</span>
            <select
              value={activeJob?.id || ""}
              onChange={(e) => {
                const found = mapsJobs.find((j) => j.id === e.target.value);
                if (found) {
                  setActiveJob(found);
                  setParams({ job: found.id });
                }
              }}
              className="bg-transparent border-0 text-xs font-semibold text-foreground focus:ring-0 cursor-pointer outline-none max-w-[200px] truncate"
            >
              {mapsJobs.map((j) => (
                <option key={j.id} value={j.id} className="bg-[#0f141f] text-foreground">
                  {j.query || `Scan #${j.id.slice(0, 8)}`} ({new Date(j.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── 2. SEAMLESS OPEN FORM (NO HEAVY CARDS) ── */}
      <form onSubmit={handleStartGeneration} className="space-y-4 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start">
          {/* Country Select */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
              Country
            </label>
            <select
              value={country}
              onChange={(e) => {
                const c = e.target.value;
                setCountry(c);
                const matched = POPULAR_COUNTRIES.find((p) => p.code === c);
                const countryCities = CITIES_BY_COUNTRY[c] || [];
                if (countryCities.length > 0) {
                  setCity(countryCities[0]);
                } else if (matched) {
                  setCity(matched.defaultCity);
                }
              }}
              className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-xs font-semibold focus:border-primary/50 outline-none cursor-pointer"
            >
              {POPULAR_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-[#0f141f] text-foreground">
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* City Input & Country Cities Dropdown */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
              Target City
            </label>
            <div className="relative">
              <Input
                list="country-cities-list"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Click or type city..."
                className="w-full h-11 px-3.5 rounded-xl bg-white/5 border-white/10 text-xs font-semibold focus:border-primary/50 cursor-pointer"
                required
              />
              <datalist id="country-cities-list">
                {(CITIES_BY_COUNTRY[country] || CITIES_BY_COUNTRY["UK"] || []).map((cityName) => (
                  <option key={cityName} value={cityName}>
                    {cityName} ({country})
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          {/* Business Category Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
              Business Category
            </label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Dentists, Restaurants..."
              className="w-full h-11 px-3.5 rounded-xl bg-white/5 border-white/10 text-xs font-semibold focus:border-primary/50"
              required
            />
          </div>

          {/* Target Limit */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
              Lead Target
            </label>
            <select
              value={leadTarget}
              onChange={(e) => setLeadTarget(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-xs font-semibold focus:border-primary/50 outline-none cursor-pointer"
            >
              <option value={20} className="bg-[#0f141f]">20 Leads (Fastest)</option>
              <option value={50} className="bg-[#0f141f]">50 Leads (Recommended)</option>
              <option value={100} className="bg-[#0f141f]">100 Leads (Deep Scan)</option>
              <option value={200} className="bg-[#0f141f]">200 Leads (Power Scan)</option>
            </select>
          </div>
        </div>

        {/* Preset Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] font-bold text-muted-foreground/70 uppercase mr-1">Popular:</span>
          {POPULAR_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors border ${
                category === cat
                  ? "bg-white/10 text-foreground border-white/20 font-semibold"
                  : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-white/5"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Action & Toggle Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withoutWebsite}
              onChange={(e) => setWithoutWebsite(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-primary focus:ring-0 bg-white/5 border-white/20 cursor-pointer"
            />
            <span className="text-xs text-muted-foreground font-medium">Target businesses without website only</span>
          </label>

          <Button
            type="submit"
            disabled={isSubmitting || isJobRunning}
            className="h-10 px-6 rounded-xl bg-primary text-black hover:bg-primary/90 font-bold text-xs uppercase tracking-wider transition-all"
          >
            {isSubmitting || isJobRunning ? (
              <>
                <Zap className="h-3.5 w-3.5 mr-1.5 animate-spin text-black" /> Scanning Google Maps...
              </>
            ) : (
              <>
                <MapPin className="h-3.5 w-3.5 mr-1.5 text-black" /> Generate Leads
              </>
            )}
          </Button>
        </div>
      </form>

      {/* ── 3. SCAN PROGRESS (IF ACTIVE) ── */}
      {isJobRunning && (
        <div className="rounded-2xl border border-primary/30 bg-black/40 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-xs font-bold text-foreground">
                Scanning {category} in {city}, {country}...
              </span>
            </div>
            <span className="text-xs font-bold text-primary">{leads.length} Leads ({progressPercent}%)</span>
          </div>
          <Progress value={progressPercent} className="h-2 rounded-full bg-white/10" />
        </div>
      )}

      {/* ── 4. INTERACTIVE GEOSPATIAL MAP ── */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Geospatial Business Map
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Location: <strong className="text-foreground font-semibold">{city}, {country}</strong>
          </span>
        </div>

        <BusinessMap
          leads={leads}
          selectedLead={selectedLead}
          onSelectLead={(lead) => setSelectedLead(lead)}
          city={city}
          country={country}
          isLoading={isJobRunning}
        />
      </div>

      {/* ── 5. DIRECTORY & SHEET VIEWS (SEAMLESS CLEAN TABLE) ── */}
      <div className="space-y-3 pt-2">
        {/* Navigation Tabs Bar & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveViewTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeViewTab === "all"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Leads ({leads.length})
            </button>

            <button
              onClick={() => setActiveViewTab("emails")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeViewTab === "emails"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-3 w-3 text-primary" />
              Verified Emails ({emailLeads.length})
            </button>

            <button
              onClick={() => setActiveViewTab("phones")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeViewTab === "phones"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Phone className="h-3 w-3 text-primary" />
              Phone Numbers ({phoneLeads.length})
            </button>
          </div>

          {/* Quick Actions (Copy All & Export) */}
          <div className="flex items-center gap-2 flex-wrap">
            {activeViewTab === "emails" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyAllEmails}
                  className="h-8 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground border border-white/10 rounded-lg"
                >
                  <Copy className="h-3 w-3 mr-1.5" /> Copy All Emails
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleExportEmailsCSV}
                  className="h-8 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground border border-white/10 rounded-lg"
                >
                  <Download className="h-3 w-3 mr-1.5" /> Export CSV
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportEmailsPDF}
                  className="h-8 px-3 text-xs font-bold bg-primary text-black hover:bg-primary/90 rounded-lg shadow-sm flex items-center gap-1.5 transition-all hover:scale-[1.02]"
                >
                  <FileText className="h-3.5 w-3.5" /> Export Email PDF
                </Button>
              </>
            )}

            {activeViewTab === "phones" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyAllPhones}
                  className="h-8 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground border border-white/10 rounded-lg"
                >
                  <Copy className="h-3 w-3 mr-1.5" /> Copy All Numbers
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleExportPhonesCSV}
                  className="h-8 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground border border-white/10 rounded-lg"
                >
                  <Download className="h-3 w-3 mr-1.5" /> Export CSV
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportPhonesPDF}
                  className="h-8 px-3 text-xs font-bold bg-primary text-black hover:bg-primary/90 rounded-lg shadow-sm flex items-center gap-1.5 transition-all hover:scale-[1.02]"
                >
                  <FileText className="h-3.5 w-3.5" /> Export Calling PDF
                </Button>
              </>
            )}

            {activeViewTab === "all" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleExportCSV}
                  className="h-8 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground border border-white/10 rounded-lg"
                >
                  <Download className="h-3 w-3 mr-1.5" /> Export CSV
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportPDF}
                  className="h-8 px-3 text-xs font-bold bg-primary text-black hover:bg-primary/90 rounded-lg shadow-sm flex items-center gap-1.5 transition-all hover:scale-[1.02]"
                >
                  <FileText className="h-3.5 w-3.5" /> Export Sales PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── TAB 1: ALL LEADS TABLE ── */}
        {activeViewTab === "all" && (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-5">Business</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Website</th>
                  <th className="py-3 px-4">Lead Score</th>
                  <th className="py-3 px-4">Opportunity</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-medium">
                {tableFilteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <MapPin className="h-6 w-6 text-muted-foreground/40" />
                        <p className="font-semibold text-xs">No leads discovered yet</p>
                        <p className="text-[11px] text-muted-foreground/60">Click "Generate Leads" to start scanning</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tableFilteredLeads.map((lead) => {
                    const isSelected = selectedLead?.id === lead.id;
                    const score = (lead.lead_score || "HIGH").toUpperCase();

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`cursor-pointer transition-colors group ${
                          isSelected
                            ? "bg-primary/5 border-l-2 border-l-primary"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="py-3 px-5">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm">
                            {lead.business_name}
                          </div>
                          {lead.address && (
                            <div className="text-[11px] text-muted-foreground/60 truncate max-w-[220px]">
                              {lead.address}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {lead.rating ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Star className="h-3 w-3 text-muted-foreground/50 fill-muted-foreground/20" />
                              <span className="font-semibold text-foreground">{lead.rating.toFixed(1)}</span>
                              {lead.reviews ? (
                                <span className="text-muted-foreground/60 text-[10px]">({lead.reviews})</span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-0.5 text-xs">
                            {lead.email || (lead.emails && lead.emails[0]) ? (
                              <div className="flex items-center gap-1.5 text-foreground truncate max-w-[170px]">
                                <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                <span className="truncate">{lead.email || lead.emails![0]}</span>
                              </div>
                            ) : null}
                            {lead.phone || lead.whatsapp ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap font-mono">
                                <Phone className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                <span className="whitespace-nowrap">{lead.phone || lead.whatsapp}</span>
                              </div>
                            ) : null}
                            {!lead.email && !lead.phone && !lead.whatsapp && (
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {lead.website ? (
                            <a
                              href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-foreground/80 hover:text-primary transition-colors max-w-[160px] truncate"
                            >
                              <Globe className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                              <span className="truncate">{lead.website.replace(/^https?:\/\//, "")}</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-muted-foreground border border-white/10">
                              No Website
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {score === "HIGH" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/25">
                              HIGH
                            </span>
                          ) : score === "MEDIUM" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-muted-foreground border border-white/10">
                              MEDIUM
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-muted-foreground/50 border border-white/5">
                              LOW
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                            {lead.recommended_service || (!lead.website ? "Website Build + SEO" : "Modern Redesign")}
                          </span>
                        </td>

                        <td className="py-3 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLead(lead)}
                            className="rounded-lg h-7 px-2.5 font-medium text-xs text-muted-foreground hover:text-foreground hover:bg-white/5"
                          >
                            View Lead <ChevronRight className="h-3 w-3 ml-1 text-muted-foreground/60" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TAB 2: VERIFIED EMAILS DIRECTORY ── */}
        {activeViewTab === "emails" && (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-5">#</th>
                  <th className="py-3 px-5">Business Name</th>
                  <th className="py-3 px-5">Verified Email</th>
                  <th className="py-3 px-4">Website Status</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-medium">
                {emailLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <Mail className="h-6 w-6 text-muted-foreground/40" />
                        <p className="font-semibold text-xs">No verified emails found yet</p>
                        <p className="text-[11px] text-muted-foreground/60">Run a search to discover business emails</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  emailLeads.map((lead, idx) => {
                    const email = lead.email || (lead.emails && lead.emails[0]) || "";
                    const hasWebsite = Boolean(lead.website && lead.website.trim() !== "");

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-5 text-xs text-muted-foreground/50 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-5">
                          <div className="font-semibold text-foreground text-xs sm:text-sm">
                            {lead.business_name}
                          </div>
                          {lead.address && (
                            <div className="text-[11px] text-muted-foreground/60 truncate max-w-[200px]">
                              {lead.address}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-xs">{email}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(email, `email-${lead.id}`);
                              }}
                              className="h-5 w-5 rounded hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy Email"
                            >
                              {copiedId === `email-${lead.id}` ? (
                                <Check className="h-3 w-3 text-primary" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {hasWebsite ? (
                            <a
                              href={lead.website!.startsWith("http") ? lead.website! : `https://${lead.website!}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-foreground/80 hover:text-primary transition-colors max-w-[150px] truncate"
                            >
                              <Globe className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                              <span className="truncate">{lead.website!.replace(/^https?:\/\//, "")}</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-muted-foreground border border-white/10">
                              No Website
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap font-mono">
                          {lead.phone || lead.whatsapp || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {lead.category || category}
                        </td>
                        <td className="py-3 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`mailto:${email}?subject=Collaboration%20with%20${encodeURIComponent(lead.business_name)}`}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/15 border border-white/10 transition-colors"
                          >
                            <Mail className="h-3 w-3" /> Send
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TAB 3: PHONE DIRECTORY ── */}
        {activeViewTab === "phones" && (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-5">#</th>
                  <th className="py-3 px-5">Business Name</th>
                  <th className="py-3 px-5">Phone Number</th>
                  <th className="py-3 px-4">Website Status</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm font-medium">
                {phoneLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <Phone className="h-6 w-6 text-muted-foreground/40" />
                        <p className="font-semibold text-xs">No phone numbers found yet</p>
                        <p className="text-[11px] text-muted-foreground/60">Run a search to discover business phone numbers</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  phoneLeads.map((lead, idx) => {
                    const phone = lead.phone || lead.whatsapp || "";
                    const cleanPhone = phone.replace(/[^\d+]/g, "");
                    const hasWebsite = Boolean(lead.website && lead.website.trim() !== "");

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-5 text-xs text-muted-foreground/50 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-5">
                          <div className="font-semibold text-foreground text-xs sm:text-sm">
                            {lead.business_name}
                          </div>
                          {lead.address && (
                            <div className="text-[11px] text-muted-foreground/60 truncate max-w-[200px]">
                              {lead.address}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5 whitespace-nowrap">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="font-medium text-foreground text-xs whitespace-nowrap font-mono">{phone}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(phone, `phone-${lead.id}`);
                              }}
                              className="h-5 w-5 rounded hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy Phone Number"
                            >
                              {copiedId === `phone-${lead.id}` ? (
                                <Check className="h-3 w-3 text-primary" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {hasWebsite ? (
                            <a
                              href={lead.website!.startsWith("http") ? lead.website! : `https://${lead.website!}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-foreground/80 hover:text-primary transition-colors max-w-[150px] truncate"
                            >
                              <Globe className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                              <span className="truncate">{lead.website!.replace(/^https?:\/\//, "")}</span>
                            </a>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-muted-foreground border border-white/10">
                              No Website
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {lead.email || (lead.emails && lead.emails[0]) || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {lead.category || category}
                        </td>
                        <td className="py-3 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/15 border border-white/10 transition-colors"
                                title="Open WhatsApp"
                              >
                                <MessageSquare className="h-3 w-3" /> WhatsApp
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 6. LEAD DETAIL SLIDE-OVER PANEL ── */}
      <LeadDetailSheet
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
