import {
  X,
  Globe,
  Mail,
  Phone,
  MapPin,
  Star,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MapLead } from "@/types";

import { exportSingleLeadDossierPDF } from "@/lib/pdfExport";

interface LeadDetailSheetProps {
  lead: MapLead | null;
  onClose: () => void;
}

export function LeadDetailSheet({ lead, onClose }: LeadDetailSheetProps) {

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!lead) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${key} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const priorityColor =
    lead.lead_score === "High" || lead.lead_score === "HIGH"
      ? "bg-[#AAFF00] text-black"
      : lead.lead_score === "Medium" || lead.lead_score === "MEDIUM"
      ? "bg-amber-400 text-black"
      : "bg-slate-700 text-white";

  const opportunity =
    lead.recommended_service ||
    (!lead.website
      ? "High Priority: Complete Website Build + Local SEO + Online Booking"
      : "Website Modernization + Speed Optimization + Lead Capture Funnel");

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 border-b border-border flex items-start justify-between gap-4 bg-muted/30">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${priorityColor} font-black text-[10px] uppercase tracking-wider px-2 py-0.5 border-0`}>
              {lead.lead_score || "HIGH"} PRIORITY
            </Badge>
            {lead.category && (
              <Badge className="text-[10px] uppercase font-bold text-muted-foreground border border-border/80 bg-transparent">
                {lead.category}
              </Badge>
            )}
            {lead.rating && (
              <div className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Star className="h-3 w-3 fill-amber-400" />
                <span>{lead.rating.toFixed(1)}</span>
                {lead.reviews ? <span className="text-muted-foreground">({lead.reviews})</span> : null}
              </div>
            )}
          </div>
          <h2 className="text-xl font-black tracking-tight text-foreground truncate mt-1">
            {lead.business_name}
          </h2>
          {lead.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              {lead.address}
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Quick Opportunity Banner */}
        <Card className="border-2 border-primary/30 bg-primary/5 rounded-2xl overflow-hidden">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-primary font-black uppercase text-xs tracking-wider">
              <Sparkles className="h-4 w-4" /> AI Growth Opportunity
            </div>
            <p className="text-sm font-bold text-foreground leading-relaxed">
              {opportunity}
            </p>
            {lead.ai_summary && (
              <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-primary/10">
                {lead.ai_summary}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Contact Information */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Contact & Digital Channels
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            {/* Website */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Website</p>
                  {lead.website ? (
                    <a
                      href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-primary hover:underline truncate block max-w-[260px]"
                    >
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <p className="text-xs font-bold text-destructive">No Website Discovered (High Value Lead)</p>
                  )}
                </div>
              </div>
              {lead.website && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => copyToClipboard(lead.website!, "Website")}
                  >
                    {copiedKey === "Website" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <a
                    href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</p>
                  {lead.email || (lead.emails && lead.emails[0]) ? (
                    <p className="text-xs font-bold text-foreground truncate max-w-[260px]">
                      {lead.email || lead.emails![0]}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Pending contact scrape</p>
                  )}
                </div>
              </div>
              {(lead.email || (lead.emails && lead.emails[0])) && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-lg"
                  onClick={() => copyToClipboard(lead.email || lead.emails![0], "Email")}
                >
                  {copiedKey === "Email" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>

            {/* Phone & WhatsApp */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Phone / WhatsApp</p>
                  {lead.phone || lead.whatsapp ? (
                    <p className="text-xs font-bold text-foreground truncate">
                      {lead.phone || lead.whatsapp}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Not available</p>
                  )}
                </div>
              </div>
              {(lead.phone || lead.whatsapp) && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => copyToClipboard(lead.phone || lead.whatsapp!, "Phone")}
                  >
                    {copiedKey === "Phone" ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <a href={`tel:${lead.phone || lead.whatsapp}`}>
                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              )}
            </div>

            {/* Google Maps Location URL */}
            {lead.maps_url && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Google Maps Profile</p>
                    <a
                      href={lead.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-primary hover:underline truncate block max-w-[260px]"
                    >
                      View on Google Maps
                    </a>
                  </div>
                </div>
                <a href={lead.maps_url} target="_blank" rel="noopener noreferrer">
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Business Intelligence Specs */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Business Intelligence
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Reputation</p>
              <p className="font-bold text-foreground mt-0.5">
                {lead.rating ? `${lead.rating} / 5.0 Stars` : "Unrated"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Reviews Volume</p>
              <p className="font-bold text-foreground mt-0.5">
                {lead.reviews ? `${lead.reviews} verified reviews` : "0 reviews"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Web Presence</p>
              <p className="font-bold text-foreground mt-0.5">
                {lead.website ? "Custom Website Live" : "No Website (Prime Target)"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
              <p className="text-muted-foreground text-[10px] font-bold uppercase">Contact Status</p>
              <p className="font-bold text-foreground mt-0.5">
                {lead.email ? "Direct Email Ready" : lead.phone ? "Direct Phone Ready" : "Google Profile"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-5 border-t border-border bg-card flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <Button
          onClick={async () => {
            const tid = toast.loading("Preparing lead dossier...");
            try {
              await exportSingleLeadDossierPDF(lead);
              toast.dismiss(tid);
              toast.success(`Exported PDF dossier for ${lead.business_name}!`);
            } catch (err) {
              toast.dismiss(tid);
              toast.error("Failed to generate dossier PDF");
            }
          }}
          className="flex-1 rounded-full h-11 bg-primary text-black font-black uppercase tracking-tight hover:bg-primary/90 shadow-lg shadow-primary/20 gap-1.5"
        >
          <FileText className="h-4 w-4" /> Export PDF Dossier
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          className="rounded-full h-11 px-5 font-bold border-border"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
