import { useState, useEffect } from "react";
import {
  Send,
  FileText,
  Target,
  History,
  Sparkles,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Copy,
  Download,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatCardSkeleton } from "@/components/ui/skeleton";
import { emailOutreachApi, getApiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { cn, formatNumber } from "@/lib/utils";
import type {
  EmailTemplate,
  SentEmail,
  EmailCampaign,
  EmailStats,
  EmailBulkRecipient,
} from "@/types";

type TabKey = "single" | "templates" | "campaigns" | "history";

const TABS: { key: TabKey; label: string; icon: typeof Send }[] = [
  { key: "single", label: "Single Send", icon: Send },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "campaigns", label: "Campaigns", icon: Target },
  { key: "history", label: "History", icon: History },
];

export function EmailOutreach() {
  const [activeTab, setActiveTab] = useState<TabKey>("single");
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; message: string; from_email?: string } | null>(null);
  const [testingSmtp, setTestingSmtp] = useState(false);

  const loadStats = async () => {
    try {
      const data = await emailOutreachApi.getStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const testSmtp = async () => {
    setTestingSmtp(true);
    try {
      const result = await emailOutreachApi.testSmtp();
      setSmtpStatus(result);
      toast[result.success ? "success" : "error"](result.message);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "SMTP test failed"));
    } finally {
      setTestingSmtp(false);
    }
  };

  useEffect(() => {
    loadStats();
    testSmtp();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">Email Outreach</h1>
          <p className="text-muted-foreground font-medium mt-1">
            Generate AI emails, manage templates, run campaigns, and track delivery
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            className="rounded-full font-bold border-primary/20"
            onClick={() => {
              setLoadingStats(true);
              loadStats();
            }}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            variant="outline"
            className="rounded-full font-bold border-primary/20"
            onClick={testSmtp}
            loading={testingSmtp}
          >
            <Mail className="h-4 w-4" /> Test SMTP
          </Button>
        </div>
      </div>

      {/* SMTP Banner */}
      {smtpStatus && !smtpStatus.configured && (
        <Card className="border-amber-500/50 bg-amber-500/5 rounded-2xl overflow-hidden">
          <CardContent className="p-4 text-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="font-bold text-amber-600 dark:text-amber-400">SMTP Not Configured</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL in your backend .env file to send emails.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {smtpStatus && smtpStatus.configured && (
        <Card className="border-emerald-500/50 bg-emerald-500/5 rounded-2xl overflow-hidden">
          <CardContent className="p-4 text-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">SMTP Connected</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Sending from: <code className="bg-background px-2 py-0.5 rounded">{smtpStatus.from_email ?? "(not set)"}</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {loadingStats ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Sent"
            value={formatNumber(stats?.total_sent_emails ?? 0)}
            icon={Mail}
          />
          <StatCard
            title="Successful"
            value={formatNumber(stats?.successful ?? 0)}
            icon={CheckCircle2}
          />
          <StatCard
            title="Failed"
            value={formatNumber(stats?.failed ?? 0)}
            icon={XCircle}
          />
          <StatCard
            title="Campaigns"
            value={formatNumber(stats?.campaigns_total ?? 0)}
            icon={Target}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-muted/50 rounded-2xl w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === key
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "single" && <SingleSendTab onSent={loadStats} />}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "campaigns" && <CampaignsTab onChanged={loadStats} />}
      {activeTab === "history" && <HistoryTab />}
    </div>
  );
}

// ======================================================================
// TAB 1 — SINGLE SEND
// ======================================================================

function SingleSendTab({ onSent }: { onSent: () => void }) {
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [replyTo, setReplyTo] = useState("");

  const [bizName, setBizName] = useState("");
  const [bizCategory, setBizCategory] = useState("");
  const [bizLocation, setBizLocation] = useState("");
  const [bizWebsite, setBizWebsite] = useState("");
  const [tone, setTone] = useState("professional");
  const [purpose, setPurpose] = useState("introduction");

  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generateEmail = async () => {
    if (!bizName.trim()) {
      toast.error("Please enter a business name for AI generation");
      return;
    }
    setGenerating(true);
    try {
      const result = await emailOutreachApi.generateTemplate({
        business_name: bizName,
        category: bizCategory || undefined,
        location: bizLocation || undefined,
        website: bizWebsite || undefined,
        recipient_name: toName || undefined,
        tone,
        purpose,
      });
      setSubject(result.subject);
      setHtmlBody(result.html_body);
      setTextBody(result.text_body);
      toast.success("Email template generated with AI");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to generate email"));
    } finally {
      setGenerating(false);
    }
  };

  const sendEmail = async () => {
    if (!toEmail.trim() || !subject.trim() || !htmlBody.trim()) {
      toast.error("Please fill To, Subject, and Email Body");
      return;
    }
    setSending(true);
    try {
      const result = await emailOutreachApi.sendSingle({
        to_email: toEmail,
        to_name: toName || undefined,
        subject,
        html_body: htmlBody,
        text_body: textBody || undefined,
        reply_to: replyTo || undefined,
      });
      if (result.success) {
        toast.success(`Email sent to ${result.to}`);
        setToEmail("");
        setHtmlBody("");
        setTextBody("");
        onSent();
      } else {
        toast.error(result.error ?? "Failed to send email");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to send email"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* AI Generator */}
      <Card className="rounded-[2rem] border border-border bg-card shadow-lg overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            AI Email Generator
          </CardTitle>
          <CardDescription className="mt-2">
            Describe the business and let AI craft a personalized cold email for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="ai_bizname"
              label="Business Name *"
              placeholder="Acme Inc."
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
            />
            <Input
              id="ai_category"
              label="Category / Industry"
              placeholder="Marketing Agency"
              value={bizCategory}
              onChange={(e) => setBizCategory(e.target.value)}
            />
            <Input
              id="ai_location"
              label="Location"
              placeholder="Karachi, Pakistan"
              value={bizLocation}
              onChange={(e) => setBizLocation(e.target.value)}
            />
            <Input
              id="ai_website"
              label="Website"
              placeholder="https://acme.com"
              value={bizWebsite}
              onChange={(e) => setBizWebsite(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="ai_tone"
              label="Tone"
              placeholder="professional, friendly, casual..."
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            />
            <Input
              id="ai_purpose"
              label="Purpose"
              placeholder="introduction, follow-up, sales..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <Button
            className="w-full rounded-xl font-bold bg-primary text-black hover:bg-primary/90"
            onClick={generateEmail}
            loading={generating}
          >
            <Sparkles className="h-4 w-4" /> Generate Email with AI
          </Button>
        </CardContent>
      </Card>

      {/* Send Form */}
      <Card className="rounded-[2rem] border border-border bg-card shadow-lg overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Send className="h-5 w-5 text-primary" />
            </div>
            Compose & Send
          </CardTitle>
          <CardDescription className="mt-2">
            Write or paste your email content and send it instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="to_email"
              label="To Email *"
              type="email"
              placeholder="lead@company.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
            />
            <Input
              id="to_name"
              label="To Name"
              placeholder="John Doe"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
            />
          </div>
          <Input
            id="reply_to"
            label="Reply-To (optional)"
            type="email"
            placeholder="replies@yourcompany.com"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />
          <Input
            id="subject"
            label="Subject *"
            placeholder="Quick question about your services..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Textarea
            id="html_body"
            label="Email Body (HTML) *"
            className="min-h-[180px] font-mono text-xs"
            placeholder="<p>Hi there...</p>"
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
          />
          <Textarea
            id="text_body"
            label="Plain Text Version (optional)"
            className="min-h-[100px]"
            placeholder="Hi there... (for non-HTML clients)"
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
          />
          <Button
            className="w-full rounded-xl font-bold"
            onClick={sendEmail}
            loading={sending}
          >
            <Send className="h-4 w-4" /> Send Email
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================================================================
// TAB 2 — TEMPLATES
// ======================================================================

function TemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplText, setTplText] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await emailOutreachApi.listTemplates();
      setTemplates(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load templates"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createTemplate = async () => {
    if (!name.trim() || !tplSubject.trim() || !tplHtml.trim()) {
      toast.error("Name, Subject and HTML Body are required");
      return;
    }
    setSaving(true);
    try {
      await emailOutreachApi.createTemplate({
        name,
        subject: tplSubject,
        html_body: tplHtml,
        text_body: tplText || undefined,
        is_default: isDefault,
      });
      toast.success("Template created");
      setName("");
      setTplSubject("");
      setTplHtml("");
      setTplText("");
      setIsDefault(false);
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create template"));
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await emailOutreachApi.deleteTemplate(id);
      toast.success("Template deleted");
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete template"));
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground font-medium">
          Save reusable email templates for campaigns and quick sends.
          Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{name}}'}</code> variables that auto-fill per recipient.
        </p>
        <Button
          className="rounded-full font-bold"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      {showCreate && (
        <Card className="rounded-[2rem] border-primary/20 shadow-lg overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-lg font-black uppercase">Create Template</CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="tpl_name"
                label="Template Name *"
                placeholder="Cold Outreach - Introduction"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                id="tpl_subject"
                label="Subject Line *"
                placeholder="Quick question about {{business_name}}"
                value={tplSubject}
                onChange={(e) => setTplSubject(e.target.value)}
              />
            </div>
            <Textarea
              id="tpl_html"
              label="HTML Body * (use {{name}}, {{business_name}}, etc.)"
              className="min-h-[200px] font-mono text-xs"
              value={tplHtml}
              onChange={(e) => setTplHtml(e.target.value)}
            />
            <Textarea
              id="tpl_text"
              label="Plain Text Version"
              className="min-h-[100px]"
              value={tplText}
              onChange={(e) => setTplText(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              Set as default template
            </label>
            <div className="flex gap-3">
              <Button onClick={createTemplate} loading={saving} className="rounded-xl font-bold">
                Save Template
              </Button>
              <Button variant="ghost" className="rounded-xl" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm p-8">Loading templates...</p>
      ) : templates.length === 0 ? (
        <Card className="rounded-[2rem] border-dashed">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-bold">No templates yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Create your first template above to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="rounded-[2rem] overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="p-6 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      {tpl.name}
                      {tpl.is_default && (
                        <Badge className="bg-muted text-muted-foreground text-[10px] uppercase">Default</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1 font-medium">
                      {tpl.subject}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteTemplate(tpl.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-3">
                <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                  <pre className="whitespace-pre-wrap break-words font-mono">
                    {tpl.html_body.replace(/<[^>]+>/g, "").slice(0, 400)}
                    {tpl.html_body.length > 400 ? "..." : ""}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => copyToClipboard(tpl.subject, "Subject")}
                  >
                    <Copy className="h-3 w-3" /> Subject
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => copyToClipboard(tpl.html_body, "HTML Body")}
                  >
                    <Copy className="h-3 w-3" /> HTML
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Created {new Date(tpl.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================================================================
// TAB 3 — CAMPAIGNS
// ======================================================================

function CampaignsTab({ onChanged }: { onChanged: () => void }) {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientsText, setRecipientsText] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignHtml, setCampaignHtml] = useState("");
  const [campaignDelay, setCampaignDelay] = useState("1");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await emailOutreachApi.listCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const parseRecipients = (): EmailBulkRecipient[] => {
    const lines = recipientsText.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        email: parts[0],
        name: parts[1],
        business_name: parts[2],
      };
    }).filter((r) => r.email && r.email.includes("@"));
  };

  const runBulkSend = async () => {
    const recipients = parseRecipients();
    if (recipients.length === 0) {
      toast.error("Enter at least one valid email (CSV format: email,name,business_name per line)");
      return;
    }
    if (!campaignSubject.trim() || !campaignHtml.trim()) {
      toast.error("Subject and HTML Template are required");
      return;
    }
    setSending(true);
    try {
      const result = await emailOutreachApi.bulkSend({
        recipients,
        subject_template: campaignSubject,
        html_template: campaignHtml,
        text_template: "",
        delay_seconds: Math.max(0, parseFloat(campaignDelay) || 0),
        campaign_name: campaignName || undefined,
      });
      toast.success(
        `Campaign finished: ${result.success_count} sent, ${result.failed_count} failed`
      );
      onChanged();
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Bulk send failed"));
    } finally {
      setSending(false);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "running":
        return "bg-primary/10 text-primary border-primary/20 animate-pulse";
      case "draft":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    }
  };

  return (
    <div className="space-y-8">
      {/* Quick Bulk Send */}
      <Card className="rounded-[2rem] border border-border bg-card shadow-lg overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            Quick Bulk Send
          </CardTitle>
          <CardDescription className="mt-2">
            Send a campaign to multiple recipients. Paste emails in CSV format — one per line: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">email,name,business_name</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="campaign_name"
              label="Campaign Name (optional)"
              placeholder="Q4 SaaS Outreach"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
            <Input
              id="campaign_delay"
              label="Delay between emails (seconds)"
              type="number"
              min="0"
              value={campaignDelay}
              onChange={(e) => setCampaignDelay(e.target.value)}
            />
          </div>
          <Input
            id="campaign_subject"
            label="Subject Template *"
            placeholder="Hello {{name}} — about {{business_name}}"
            value={campaignSubject}
            onChange={(e) => setCampaignSubject(e.target.value)}
          />
          <Textarea
            id="recipients"
            label="Recipients * (one per line: email,name,business_name)"
            className="min-h-[120px] font-mono text-xs"
            placeholder={
              "john@company.com,John Doe,Acme Inc.\njane@startup.io,Jane Smith,Startup Labs"
            }
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
          />
          <Textarea
            id="campaign_html"
            label="HTML Template * ({{name}}, {{business_name}} will be replaced)"
            className="min-h-[180px] font-mono text-xs"
            placeholder="<p>Hi {{name}}, Loved the work at {{business_name}}...</p>"
            value={campaignHtml}
            onChange={(e) => setCampaignHtml(e.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {parseRecipients().length} valid recipient(s) detected
            </p>
            <Button
              className="rounded-xl font-bold"
              onClick={runBulkSend}
              loading={sending}
            >
              <Play className="h-4 w-4" /> Launch Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns list */}
      <div>
        <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
          <History className="h-5 w-5" /> Recent Campaigns
        </h3>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <Card className="rounded-[2rem] border-dashed">
            <CardContent className="p-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-bold">No campaigns yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Launch your first bulk campaign above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => (
              <Card key={c.id} className="rounded-2xl overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="font-bold">{c.name}</h4>
                        <Badge className={cn("text-[10px] uppercase border", statusColor(c.status))}>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 max-w-2xl truncate">
                        {c.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-black text-lg">{c.total_recipients}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center text-emerald-500">
                        <p className="font-black text-lg">{c.sent_count}</p>
                        <p className="text-[10px] uppercase">Sent</p>
                      </div>
                      <div className="text-center text-destructive">
                        <p className="font-black text-lg">{c.failed_count}</p>
                        <p className="text-[10px] uppercase">Failed</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {c.started_at
                        ? `Started ${new Date(c.started_at).toLocaleString()}`
                        : `Created ${new Date(c.created_at).toLocaleString()}`}
                    </span>
                    {c.delay_seconds > 0 && (
                      <span>Delay: {c.delay_seconds}s</span>
                    )}
                    {c.reply_to && <span>Reply-To: {c.reply_to}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ======================================================================
// TAB 4 — HISTORY
// ======================================================================

function HistoryTab() {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await emailOutreachApi.listSentEmails(undefined, 200);
      setEmails(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load history"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const exportCsv = () => {
    const header = "Date,To,From,Subject,Status,Error";
    const rows = emails.map((e) =>
      [
        e.sent_at ?? e.created_at,
        e.to_email,
        e.from_email,
        `"${e.subject.replace(/"/g, '""')}"`,
        e.status,
        `"${(e.error_message ?? "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `email-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground font-medium">
          Track every email sent through the platform — with delivery status and error details.
        </p>
        {emails.length > 0 && (
          <Button variant="outline" className="rounded-full font-bold" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm p-8">Loading history...</p>
      ) : emails.length === 0 ? (
        <Card className="rounded-[2rem] border-dashed">
          <CardContent className="p-12 text-center">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-bold">No emails sent yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Send a single email or launch a campaign to see results here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[2rem] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 uppercase text-[11px] tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left p-4 font-bold">Status</th>
                  <th className="text-left p-4 font-bold">To</th>
                  <th className="text-left p-4 font-bold">Subject</th>
                  <th className="text-left p-4 font-bold">From</th>
                  <th className="text-left p-4 font-bold">Sent</th>
                  <th className="text-left p-4 font-bold">Error</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-4">
                      {e.status === "sent" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 border">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Sent
                        </Badge>
                      ) : e.status === "failed" ? (
                        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 border">
                          <XCircle className="h-3 w-3 mr-1" /> Failed
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border">
                          <Clock className="h-3 w-3 mr-1" /> {e.status}
                        </Badge>
                      )}
                    </td>
                    <td className="p-4 font-medium">
                      <div>{e.to_email}</div>
                      {e.to_name && (
                        <div className="text-xs text-muted-foreground">{e.to_name}</div>
                      )}
                    </td>
                    <td className="p-4 max-w-xs truncate" title={e.subject}>
                      {e.subject}
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{e.from_email}</td>
                    <td className="p-4 text-muted-foreground text-xs whitespace-nowrap">
                      {e.sent_at
                        ? new Date(e.sent_at).toLocaleString()
                        : new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="p-4 text-xs text-destructive max-w-[200px] truncate" title={e.error_message}>
                      {e.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
