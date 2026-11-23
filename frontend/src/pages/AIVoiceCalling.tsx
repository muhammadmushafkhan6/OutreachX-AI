import React, { useState, useEffect, useRef } from "react";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  Upload,
  Sparkles,
  Bot,
  User as UserIcon,
  Play,
  Pause,
  CheckCircle2,
  Calendar,
  Clock,
  Building2,
  Globe,
  Phone,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  RefreshCw,
  Search,
  Zap,
  ArrowRight,
  MessageSquare,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { voiceAgentApi, getApiErrorMessage } from "@/lib/api";
import {
  SheetAnalysisResponse,
  VoiceLeadItem,
  TargetAnalysisResponse,
  VoiceCallSession,
} from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Sample initial leads fallback
const SAMPLE_LEADS: VoiceLeadItem[] = [
  {
    id: "sample-1",
    business_name: "Apex Tech Solutions",
    phone_number: "+92 300 1234567",
    contact_name: "Taimoor Ali",
    website: "",
    category: "Software & IT Agency",
    location: "Lahore, Pakistan",
    rating: 4.8,
    reviews: 32,
    lead_score: "High",
    recommended_angle: "Missing website & booking funnel. Pitch modern custom web development.",
  },
  {
    id: "sample-2",
    business_name: "Crest Dental Care",
    phone_number: "+92 321 9876543",
    contact_name: "Dr. Hamza",
    website: "https://crestdental.example.com",
    category: "Healthcare Clinic",
    location: "Islamabad, Pakistan",
    rating: 4.6,
    reviews: 58,
    lead_score: "High",
    recommended_angle: "Active clinic with slow website. Pitch automated patient booking calendar.",
  },
  {
    id: "sample-3",
    business_name: "Urban Roast Cafe",
    phone_number: "+1 (555) 234-5678",
    contact_name: "Sarah Jenkins",
    website: "",
    category: "Restaurant & Cafe",
    location: "Austin, TX, USA",
    rating: 4.9,
    reviews: 120,
    lead_score: "High",
    recommended_angle: "High Google review score but no online ordering portal.",
  },
  {
    id: "sample-4",
    business_name: "Elite Real Estate Partners",
    phone_number: "+92 333 4567890",
    contact_name: "Bilal Khan",
    website: "https://eliterealestate.pk",
    category: "Real Estate Brokerage",
    location: "Karachi, Pakistan",
    rating: 4.5,
    reviews: 19,
    lead_score: "Medium",
    recommended_angle: "Pitch AI WhatsApp bot + Automated property viewing scheduler.",
  },
];

export function AIVoiceCalling() {
  const [activeTab, setActiveTab] = useState<"caller" | "history">("caller");

  // Step workflow
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Leads Data
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sheetData, setSheetData] = useState<SheetAnalysisResponse | null>(null);
  const [selectedLead, setSelectedLead] = useState<VoiceLeadItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Voice Persona Settings
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [voiceName, setVoiceName] = useState("Sarah (Warm & Professional)");
  const [language, setLanguage] = useState<"roman_urdu" | "urdu" | "english_us" | "english_uk">("roman_urdu");
  const [callObjective, setCallObjective] = useState("book_meeting");
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Deep Analysis & Strategy
  const [isAnalyzingTarget, setIsAnalyzingTarget] = useState(false);
  const [targetAnalysis, setTargetAnalysis] = useState<TargetAnalysisResponse | null>(null);

  // Live Call State (Twilio + simulation)
  const [isRealCall, setIsRealCall] = useState(false); // true = Twilio, false = browser sim
  const [callStatus, setCallStatus] = useState<"idle" | "dialing" | "ringing" | "connected" | "ended">("idle");
  const [callSeconds, setCallSeconds] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [transcript, setTranscript] = useState<Array<{ speaker: "agent" | "prospect"; text: string; timestamp: string }>>([]);
  const [prospectInput, setProspectInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [meetingAgreed, setMeetingAgreed] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isPlacingRealCall, setIsPlacingRealCall] = useState(false);

  // Meeting Form
  const [meetingDate, setMeetingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [meetingTime, setMeetingTime] = useState("15:00");
  const [attendeeName, setAttendeeName] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("15-Min Growth Strategy & Booking Demo");
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);

  // Call History
  const [historyList, setHistoryList] = useState<VoiceCallSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<VoiceCallSession | null>(null);

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const callTimerRef = useRef<any>(null);
  const pollTimerRef = useRef<any>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript, isAiThinking]);

  // Call duration counter
  useEffect(() => {
    if (callStatus === "connected") {
      callTimerRef.current = setInterval(() => {
        setCallSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callStatus]);

  // Load history on tab switch
  useEffect(() => {
    if (activeTab === "history") {
      fetchCallHistory();
    }
  }, [activeTab]);

  const fetchCallHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await voiceAgentApi.getHistory();
      setHistoryList(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load call history"));
    } finally {
      setLoadingHistory(false);
    }
  };

  // Web Speech synthesis helper
  const speakText = (text: string, gender: "female" | "male") => {
    if (!isAudioEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      if (gender === "female") {
        const femaleVoice = voices.find(
          (v) =>
            v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("zira") ||
            v.name.toLowerCase().includes("samantha") ||
            v.name.toLowerCase().includes("google us english")
        );
        if (femaleVoice) utterance.voice = femaleVoice;
        utterance.pitch = 1.1;
        utterance.rate = 1.0;
      } else {
        const maleVoice = voices.find(
          (v) =>
            v.name.toLowerCase().includes("male") ||
            v.name.toLowerCase().includes("david") ||
            v.name.toLowerCase().includes("george")
        );
        if (maleVoice) utterance.voice = maleVoice;
        utterance.pitch = 0.9;
        utterance.rate = 0.95;
      }
    }

    window.speechSynthesis.speak(utterance);
  };

  // Preview voice
  const handlePlayVoicePreview = (gender: "female" | "male") => {
    setPreviewPlaying(true);
    const previewText =
      gender === "female"
        ? language === "roman_urdu"
          ? "Assalam o Alaikum! Main aapki AI Voice Assistant Sarah baat kar rahi hoon. Kya hum 5 minute baat kar sakte hain?"
          : "Hello! This is Sarah, your AI Voice Calling Agent. I help businesses turn leads into booked meetings seamlessly."
        : language === "roman_urdu"
        ? "Assalam o Alaikum! Main aapka AI Voice Assistant Alex baat kar raha hoon. Aapke business ke liye ek special opportunity hai."
        : "Hello! This is Alex from OutreachX AI. I'm calling to share an exclusive growth strategy for your business.";

    speakText(previewText, gender);
    setTimeout(() => setPreviewPlaying(false), 4000);
  };

  // 1. File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsUploading(true);

    try {
      const data = await voiceAgentApi.uploadSheet(uploadedFile);
      setSheetData(data);
      if (data.suggested_first_lead) {
        setSelectedLead(data.suggested_first_lead);
      } else if (data.leads.length > 0) {
        setSelectedLead(data.leads[0]);
      }
      toast.success(`Parsed ${data.total_leads} leads from sheet!`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to analyze leads sheet"));
    } finally {
      setIsUploading(false);
    }
  };

  // Load sample leads
  const handleLoadSampleLeads = () => {
    const sampleData: SheetAnalysisResponse = {
      total_leads: SAMPLE_LEADS.length,
      leads_with_phone: SAMPLE_LEADS.filter((l) => l.phone_number).length,
      leads_with_website: SAMPLE_LEADS.filter((l) => l.website).length,
      top_categories: ["Software & IT Agency", "Healthcare Clinic", "Restaurant & Cafe", "Real Estate"],
      ai_recommendation_summary:
        "Parsed 4 high-priority demo leads. AI recommends Apex Tech Solutions as the top opportunity due to missing website and strong local rating.",
      suggested_first_lead: SAMPLE_LEADS[0],
      leads: SAMPLE_LEADS,
    };
    setSheetData(sampleData);
    setSelectedLead(SAMPLE_LEADS[0]);
    toast.success("Loaded sample leads for testing!");
  };

  // 2. Analyze Target Business & Generate Script
  const handleProceedToDeepAnalysis = async () => {
    if (!selectedLead) {
      toast.error("Please select a target business to call");
      return;
    }

    setIsAnalyzingTarget(true);
    setCurrentStep(3);

    try {
      const res = await voiceAgentApi.analyzeTarget({
        business_name: selectedLead.business_name,
        phone_number: selectedLead.phone_number,
        contact_name: selectedLead.contact_name,
        website: selectedLead.website,
        category: selectedLead.category,
        location: selectedLead.location,
        voice_gender: voiceGender,
        voice_name: voiceName,
        language: language,
        call_objective: callObjective,
      });
      setTargetAnalysis(res);
      setAttendeeName(selectedLead.contact_name || selectedLead.business_name);
      toast.success("AI Business Strategy & Voice Script Ready!");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to analyze target business"));
    } finally {
      setIsAnalyzingTarget(false);
    }
  };

  // 3a. Place REAL Twilio Phone Call
  const handlePlaceRealCall = async () => {
    if (!targetAnalysis) return;

    setIsPlacingRealCall(true);
    setCurrentStep(4);
    setCallStatus("dialing");
    setCallSeconds(0);
    setTranscript([]);
    setMeetingAgreed(false);
    setIsRealCall(true);

    try {
      const result = await voiceAgentApi.initiateCall(targetAnalysis.session_id);
      toast.success(`📞 ${result.message}`, { duration: 6000 });

      // Show initial AI script message in transcript
      setTranscript([
        {
          speaker: "agent" as const,
          text: targetAnalysis.opening_script,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);

      // Start polling for real Twilio call status every 3 seconds
      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await voiceAgentApi.getLiveCallStatus(targetAnalysis.session_id);
          const twilioStatus = statusRes.twilio_status;
          const sessionCallStatus = statusRes.call_status;

          // Map Twilio status -> UI call status
          if (twilioStatus === "ringing") setCallStatus("ringing");
          else if (twilioStatus === "in-progress") setCallStatus("connected");
          else if (["completed", "failed", "canceled", "busy", "no-answer"].includes(twilioStatus || "")) {
            setCallStatus("ended");
            clearInterval(pollTimerRef.current);
            toast.info(`📞 Call ended (${twilioStatus})`);
          }

          // Update real duration from Twilio
          if (statusRes.call_duration_seconds > 0) {
            setCallSeconds(statusRes.call_duration_seconds);
          }

          // Sync transcript from backend
          if (targetAnalysis.session_id) {
            const sessionData = await voiceAgentApi.getSession(targetAnalysis.session_id);
            if (sessionData.transcript && sessionData.transcript.length > transcript.length) {
              setTranscript(sessionData.transcript);
            }
            if (sessionData.meeting_booked && !meetingAgreed) {
              setMeetingAgreed(true);
              toast.success("🎯 AI detected meeting agreement on the call!", { duration: 5000 });
              setShowBookingModal(true);
            }
          }
        } catch {}
      }, 3000);
    } catch (err) {
      setCallStatus("idle");
      setIsRealCall(false);
      toast.error(getApiErrorMessage(err, "Failed to place real call"));
    } finally {
      setIsPlacingRealCall(false);
    }
  };

  // 3b. Browser Simulation Call
  const handleStartSimCall = () => {
    if (!targetAnalysis) return;

    setCurrentStep(4);
    setCallStatus("dialing");
    setCallSeconds(0);
    setTranscript([]);
    setMeetingAgreed(false);
    setIsRealCall(false);

    setTimeout(() => setCallStatus("ringing"), 1500);
    setTimeout(() => {
      setCallStatus("connected");
      const openingMsg = targetAnalysis.opening_script;
      setTranscript([
        {
          speaker: "agent" as const,
          text: openingMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);
      speakText(openingMsg, voiceGender);
    }, 3500);
  };

  // 4. Send Prospect Speech (simulation only)
  const handleSendProspectSpeech = async (speechText?: string) => {
    const textToSend = speechText || prospectInput;
    if (!textToSend.trim() || !targetAnalysis || isAiThinking) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const newTranscript = [
      ...transcript,
      { speaker: "prospect" as const, text: textToSend, timestamp: timeStr },
    ];
    setTranscript(newTranscript);
    setProspectInput("");
    setIsAiThinking(true);

    try {
      const res = await voiceAgentApi.dialogueTurn({
        session_id: targetAnalysis.session_id,
        prospect_speech: textToSend,
        turn_number: newTranscript.length,
      });

      const replyTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setTranscript((prev) => [
        ...prev,
        { speaker: "agent" as const, text: res.agent_reply, timestamp: replyTime },
      ]);

      speakText(res.agent_reply, voiceGender);

      if (res.is_meeting_agreed) {
        setMeetingAgreed(true);
        toast.success("🎯 Meeting Intent Detected!", { duration: 4000 });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Dialogue response error"));
    } finally {
      setIsAiThinking(false);
    }
  };

  // 5. End Call
  const handleEndCall = async () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    clearInterval(pollTimerRef.current);
    setCallStatus("ended");

    if (!targetAnalysis) return;

    try {
      if (isRealCall) {
        // End real Twilio call
        await voiceAgentApi.endCall(targetAnalysis.session_id);
        toast.info("📞 Twilio call terminated.");
      } else {
        await voiceAgentApi.updateStatus({
          session_id: targetAnalysis.session_id,
          call_status: meetingAgreed ? "meeting_booked" : "completed",
          duration_seconds: callSeconds,
          sentiment: meetingAgreed ? "Positive" : "Neutral",
          transcript: transcript,
        });
      }
    } catch (err) {
      console.error("Failed to end call", err);
    }
  };

  // 6. Save Booked Meeting
  const handleConfirmMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAnalysis) return;

    setIsSavingMeeting(true);
    try {
      await voiceAgentApi.bookMeeting({
        session_id: targetAnalysis.session_id,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail,
        attendee_phone: selectedLead?.phone_number,
        notes: meetingNotes,
      });
      setShowBookingModal(false);
      toast.success("🎉 Meeting Successfully Scheduled and Logged!");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to book meeting"));
    } finally {
      setIsSavingMeeting(false);
    }
  };

  // Filtered Leads
  const filteredLeads = sheetData?.leads.filter(
    (l) =>
      l.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.category && l.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.location && l.location.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
              <PhoneCall className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                AI Voice Calling Agent
              </h1>
              <p className="text-sm text-muted-foreground">
                Autonomous B2B Voice Agent that analyzes target businesses, places calls, and books high-ticket meetings.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 bg-card/80 p-1.5 rounded-xl border border-border/70 backdrop-blur-md">
          <button
            onClick={() => setActiveTab("caller")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all",
              activeTab === "caller"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Bot className="h-4 w-4" />
            AI Voice Caller
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all",
              activeTab === "history"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Calendar className="h-4 w-4" />
            Calls & Booked Meetings
          </button>
        </div>
      </div>

      {activeTab === "caller" && (
        <div className="space-y-6">
          {/* Workflow Stepper Indicator */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { num: 1, title: "1. Upload & Select Lead", desc: "Sheet Analysis" },
              { num: 2, title: "2. Voice Persona", desc: "Male / Female & Tone" },
              { num: 3, title: "3. Deep AI Strategy", desc: "Business Intelligence" },
              { num: 4, title: "4. Live Call & Booking", desc: "Real-time AI Calling" },
            ].map((step) => {
              const isActive = currentStep === step.num;
              const isDone = currentStep > step.num;
              return (
                <div
                  key={step.num}
                  onClick={() => {
                    if (isDone || (step.num <= 2 && sheetData)) setCurrentStep(step.num as any);
                  }}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer select-none",
                    isActive
                      ? "bg-gradient-to-b from-primary/15 to-primary/5 border-primary/50 ring-1 ring-primary/40 shadow-lg"
                      : isDone
                      ? "bg-muted/40 border-emerald-500/30 text-emerald-400"
                      : "bg-card/40 border-border/40 text-muted-foreground opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isDone ? "✓" : step.num}
                    </span>
                    <span className="font-semibold text-xs tracking-tight">{step.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-7">{step.desc}</p>
                </div>
              );
            })}
          </div>

          {/* ================= STEP 1: LEADS SHEET UPLOAD & SELECTION ================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Upload Card */}
              <div className="bg-card/70 border border-border/70 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
                      Upload Leads Sheet (.CSV / .Excel)
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload your scraped leads or customer database. AI will parse company names, numbers, and websites automatically.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadSampleLeads}
                    className="gap-2 text-xs border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Load Sample Verified Leads
                  </Button>
                </div>

                <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-xl p-8 text-center bg-muted/10 relative">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      {isUploading ? (
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      ) : (
                        <Upload className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {isUploading
                          ? "Analyzing Leads Sheet with AI..."
                          : file
                          ? file.name
                          : "Drop your leads CSV / Excel sheet here, or browse"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Supports CSV, XLSX, XLS (up to 500 leads per batch)</p>
                    </div>
                  </div>
                </div>

                {/* AI Sheet Breakdown Summary */}
                {sheetData && (
                  <div className="mt-6 space-y-4">
                    {/* AI Agent Message Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-background border border-indigo-500/30 flex items-start gap-3.5 shadow-md">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400 mt-0.5">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-indigo-300">AI Voice Assistant</span>
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                            Sheet Analysis Complete
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-gray-200">
                          {sheetData.ai_recommendation_summary}
                        </p>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-card border border-border/60">
                        <span className="text-[11px] text-muted-foreground font-medium">Total Leads</span>
                        <p className="text-xl font-bold mt-1 text-white">{sheetData.total_leads}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-card border border-border/60">
                        <span className="text-[11px] text-muted-foreground font-medium">With Phone Numbers</span>
                        <p className="text-xl font-bold mt-1 text-emerald-400">{sheetData.leads_with_phone}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-card border border-border/60">
                        <span className="text-[11px] text-muted-foreground font-medium">With Websites</span>
                        <p className="text-xl font-bold mt-1 text-indigo-400">{sheetData.leads_with_website}</p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-card border border-border/60">
                        <span className="text-[11px] text-muted-foreground font-medium">No Website (Prime Deals)</span>
                        <p className="text-xl font-bold mt-1 text-amber-400">
                          {sheetData.total_leads - sheetData.leads_with_website}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Leads Selection Table / Grid */}
              {sheetData && (
                <div className="bg-card/70 border border-border/70 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-400" />
                        Select Target Business to Contact
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Pick which company the AI Voice Agent should analyze and place a call to.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search businesses or categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Leads List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                    {filteredLeads.map((lead, idx) => {
                      const isSelected = selectedLead?.business_name === lead.business_name;
                      return (
                        <div
                          key={lead.id || idx}
                          onClick={() => setSelectedLead(lead)}
                          className={cn(
                            "p-4 rounded-xl border transition-all cursor-pointer relative",
                            isSelected
                              ? "bg-indigo-950/30 border-indigo-500 shadow-md ring-1 ring-indigo-500"
                              : "bg-muted/20 border-border/60 hover:bg-muted/40 hover:border-border"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-sm truncate text-white">
                                  {lead.business_name}
                                </h4>
                                {lead.lead_score === "High" && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    High Priority
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {lead.category || "Local Business"} {lead.location && `• ${lead.location}`}
                              </p>
                            </div>

                            <div
                              className={cn(
                                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                isSelected
                                  ? "bg-indigo-600 border-indigo-400 text-white"
                                  : "border-border/80"
                              )}
                            >
                              {isSelected && "✓"}
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-3 truncate">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-indigo-400" />
                                {lead.phone_number || "No Phone"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3 text-indigo-400" />
                                {lead.website ? "Website Found" : "No Website"}
                              </span>
                            </div>
                          </div>

                          {lead.recommended_angle && (
                            <p className="text-[11px] text-indigo-300/90 mt-2 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                              💡 {lead.recommended_angle}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Proceed CTA */}
                  <div className="flex justify-end pt-3">
                    <Button
                      onClick={() => setCurrentStep(2)}
                      disabled={!selectedLead}
                      className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                    >
                      Next: Configure AI Voice Persona
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: VOICE PERSONA & TONE ================= */}
          {currentStep === 2 && selectedLead && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-card/70 border border-border/70 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Bot className="h-5 w-5 text-indigo-400" />
                    Select AI Voice Persona & Language
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Target Business: <strong className="text-white">{selectedLead.business_name}</strong> ({selectedLead.phone_number || "Phone available on call"})
                  </p>
                </div>

                {/* Male vs Female Voice Card Selection */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-3">
                    Voice Gender & Tone
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Female Voice Option */}
                    <div
                      onClick={() => {
                        setVoiceGender("female");
                        setVoiceName("Sarah (Consultative & Warm)");
                      }}
                      className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                        voiceGender === "female"
                          ? "bg-gradient-to-b from-pink-950/30 to-card border-pink-500/60 ring-2 ring-pink-500/40 shadow-xl"
                          : "bg-card border-border/60 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                            <Bot className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-white">Female Voice (Sarah)</h3>
                            <p className="text-xs text-pink-300">Warm, empathetic, and consultative</p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold",
                            voiceGender === "female"
                              ? "bg-pink-500 border-pink-400 text-white"
                              : "border-border"
                          )}
                        >
                          {voiceGender === "female" && "✓"}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mt-3">
                        Best for relationship building, empathetic listening, and booking discovery meetings with local business owners.
                      </p>

                      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayVoicePreview("female");
                          }}
                          className="text-xs gap-1.5 text-pink-300 hover:text-pink-200 hover:bg-pink-500/10"
                        >
                          {previewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          Play Voice Sample
                        </Button>
                        <span className="text-[11px] text-muted-foreground">Neural HD Audio</span>
                      </div>
                    </div>

                    {/* Male Voice Option */}
                    <div
                      onClick={() => {
                        setVoiceGender("male");
                        setVoiceName("Alex (Confident & Executive)");
                      }}
                      className={cn(
                        "p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                        voiceGender === "male"
                          ? "bg-gradient-to-b from-blue-950/30 to-card border-blue-500/60 ring-2 ring-blue-500/40 shadow-xl"
                          : "bg-card border-border/60 hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                            <Bot className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-white">Male Voice (Alex)</h3>
                            <p className="text-xs text-blue-300">Deep, confident, and direct</p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold",
                            voiceGender === "male"
                              ? "bg-blue-500 border-blue-400 text-white"
                              : "border-border"
                          )}
                        >
                          {voiceGender === "male" && "✓"}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mt-3">
                        Best for B2B executive pitches, firm objection handling, and high-ticket service propositions.
                      </p>

                      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayVoicePreview("male");
                          }}
                          className="text-xs gap-1.5 text-blue-300 hover:text-blue-200 hover:bg-blue-500/10"
                        >
                          {previewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          Play Voice Sample
                        </Button>
                        <span className="text-[11px] text-muted-foreground">Neural HD Audio</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Language Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                      Spoken Language & Dialect
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="w-full bg-muted/40 border border-border/80 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="roman_urdu">🇵🇰 Conversational Roman Urdu (Best for Pakistan Businesses)</option>
                      <option value="english_us">🇺🇸 Conversational English - US Accent</option>
                      <option value="english_uk">🇬🇧 Professional English - UK Accent</option>
                      <option value="urdu">🇵🇰 Urdu Native Script</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                      Calling Objective
                    </label>
                    <select
                      value={callObjective}
                      onChange={(e) => setCallObjective(e.target.value)}
                      className="w-full bg-muted/40 border border-border/80 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="book_meeting">📅 Book 15-Minute Zoom / Google Meet Consultation</option>
                      <option value="pitch_website">💻 Pitch Modern Website & Online Booking System</option>
                      <option value="seo_growth">🚀 Offer Local SEO & Google Maps Optimization</option>
                      <option value="discovery">🎯 Cold Qualification & Need Discovery</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-border/60">
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>
                    Back to Leads
                  </Button>
                  <Button
                    onClick={handleProceedToDeepAnalysis}
                    disabled={isAnalyzingTarget}
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                  >
                    {isAnalyzingTarget ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analyzing Business Intelligence...
                      </>
                    ) : (
                      <>
                        Generate Deep AI Calling Strategy
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: DEEP AI STRATEGY & PITCH ================= */}
          {currentStep === 3 && targetAnalysis && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-card/70 border border-border/70 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
                  <div>
                    <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      Step 3: Deep AI Business Intelligence
                    </span>
                    <h2 className="text-xl font-bold mt-1 text-white">
                      Calling Blueprint for {targetAnalysis.business_name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Voice Persona:</span>
                    <span className="text-xs font-bold text-indigo-300 bg-muted px-2.5 py-1 rounded-lg">
                      {targetAnalysis.voice_gender.toUpperCase()} ({targetAnalysis.language})
                    </span>
                  </div>
                </div>

                {/* Analysis Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strengths & Opportunities */}
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Detected Strengths & Local Footprint
                    </h3>
                    <ul className="space-y-1.5 text-xs text-gray-300">
                      {targetAnalysis.analysis.detected_strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pain Points & Friction */}
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      Growth Pain Points & Conversion Gaps
                    </h3>
                    <ul className="space-y-1.5 text-xs text-gray-300">
                      {targetAnalysis.analysis.pain_points.map((p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">•</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Conversational Hook & Pitch Strategy */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-background border border-indigo-500/30">
                    <h4 className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                      <Volume2 className="h-4 w-4 text-indigo-400" />
                      Opening Hook (Spoken in First 5 Seconds)
                    </h4>
                    <p className="text-sm italic text-gray-200 font-medium leading-relaxed">
                      "{targetAnalysis.opening_script}"
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-pink-950/20 to-background border border-purple-500/30">
                    <h4 className="text-xs font-bold text-purple-300 mb-1 flex items-center gap-1.5">
                      <CalendarPlus className="h-4 w-4 text-purple-400" />
                      Meeting Booking Offer
                    </h4>
                    <p className="text-sm text-gray-200 leading-relaxed">
                      {targetAnalysis.analysis.meeting_booking_pitch}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-border/60">
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)}>
                    Back to Voice Persona
                  </Button>
                  <Button
                    onClick={handleStartCall}
                    className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-500/25 px-6 py-5 text-sm font-bold animate-pulse"
                  >
                    <PhoneCall className="h-5 w-5" />
                    Launch Live AI Voice Call Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: LIVE AI VOICE CALLING ROOM ================= */}
          {currentStep === 4 && targetAnalysis && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-card/70 border border-border/70 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
                {/* Live Call Control Terminal */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-black border border-indigo-500/30 p-6 shadow-2xl">
                  {/* Glowing background animation */}
                  <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    {/* Caller Info */}
                    <div className="flex items-center gap-4">
                      {/* Avatar with pulsing waves */}
                      <div className="relative">
                        <div
                          className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl transition-all",
                            callStatus === "connected"
                              ? "bg-gradient-to-tr from-emerald-500 to-teal-400 ring-4 ring-emerald-500/30"
                              : callStatus === "ringing" || callStatus === "dialing"
                              ? "bg-gradient-to-tr from-amber-500 to-orange-400 animate-pulse ring-4 ring-amber-500/30"
                              : "bg-slate-700"
                          )}
                        >
                          <Bot className="h-8 w-8" />
                        </div>
                        {callStatus === "connected" && (
                          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-slate-950 flex items-center justify-center text-[10px] text-white font-bold animate-ping" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white tracking-tight">
                            {targetAnalysis.business_name}
                          </h3>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider",
                              callStatus === "connected"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : callStatus === "ringing"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : callStatus === "dialing"
                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {callStatus}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Calling {targetAnalysis.phone_number || "Direct Line"} • {targetAnalysis.voice_gender.toUpperCase()} Voice ({targetAnalysis.language})
                        </p>
                      </div>
                    </div>

                    {/* Timer & Controls */}
                    <div className="flex items-center gap-3">
                      {callStatus === "connected" && (
                        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-xl text-white font-mono text-sm shadow-inner">
                          <Clock className="h-4 w-4 text-emerald-400 animate-pulse" />
                          <span>
                            {Math.floor(callSeconds / 60)
                              .toString()
                              .padStart(2, "0")}
                            :{(callSeconds % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                      )}

                      {/* Toggle Audio Output */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                        title={isAudioEnabled ? "Mute AI Voice Speech" : "Unmute AI Voice Speech"}
                        className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                      >
                        {isAudioEnabled ? <Volume2 className="h-4 w-4 text-indigo-400" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                      </Button>

                      {/* Book Meeting Direct CTA */}
                      <Button
                        size="sm"
                        onClick={() => setShowBookingModal(true)}
                        className="gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-md text-xs"
                      >
                        <CalendarPlus className="h-4 w-4" />
                        Book Meeting
                      </Button>

                      {/* End Call Button */}
                      {callStatus !== "ended" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleEndCall}
                          className="gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30"
                        >
                          <PhoneOff className="h-4 w-4" />
                          End Call
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentStep(1);
                            setCallStatus("idle");
                          }}
                          className="text-xs"
                        >
                          New Call
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Meeting Agreemenet Banner */}
                  {meetingAgreed && (
                    <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        🎯 Prospect expressed interest / agreed to a meeting!
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowBookingModal(true)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs h-7 px-3"
                      >
                        Lock in Calendar Date
                      </Button>
                    </div>
                  )}
                </div>

                {/* Live Conversation Transcript Stream */}
                <div className="bg-card border border-border/80 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-indigo-400" />
                      Live Call Transcript
                    </h3>
                    <span className="text-[11px] text-muted-foreground">
                      Real-time Bidirectional Speech Exchange
                    </span>
                  </div>

                  <div
                    ref={transcriptScrollRef}
                    className="h-80 overflow-y-auto space-y-3 pr-2 scroll-smooth"
                  >
                    {transcript.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
                        <span>Establishing line connection...</span>
                      </div>
                    ) : (
                      transcript.map((msg, index) => {
                        const isAgent = msg.speaker === "agent";
                        return (
                          <div
                            key={index}
                            className={cn(
                              "flex items-start gap-3 text-xs leading-relaxed animate-in fade-in duration-200",
                              isAgent ? "justify-start" : "justify-end"
                            )}
                          >
                            {isAgent && (
                              <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                                <Bot className="h-3.5 w-3.5" />
                              </div>
                            )}

                            <div
                              className={cn(
                                "max-w-[78%] p-3.5 rounded-2xl shadow-sm",
                                isAgent
                                  ? "bg-muted/70 border border-border/80 text-gray-100 rounded-tl-sm"
                                  : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-sm"
                              )}
                            >
                              <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                                <span className="font-semibold">
                                  {isAgent ? `AI Voice Agent (${targetAnalysis.voice_gender})` : "Prospect (Spoken Response)"}
                                </span>
                                <span>{msg.timestamp}</span>
                              </div>
                              <p className="text-xs">{msg.text}</p>
                            </div>

                            {!isAgent && (
                              <div className="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                                <UserIcon className="h-3.5 w-3.5" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {isAiThinking && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-muted/30 w-fit">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                        <span>AI Voice Agent is generating smart spoken reply...</span>
                      </div>
                    )}
                  </div>

                  {/* Interactive Response / Speech Simulator Controls */}
                  {callStatus === "connected" && (
                    <div className="space-y-3 pt-3 border-t border-border/60">
                      {/* One-Click Quick Response Simulation Chips */}
                      <div>
                        <span className="text-[11px] text-muted-foreground block mb-2 font-medium">
                          Quick Spoken Responses (Test objection handling & meeting booking):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "Theek hai kal shaam 4 baje meeting lock karein.",
                            "Sure, Thursday at 3 PM sounds good!",
                            "Main abhi bohot busy hoon, thodi der baad call karein.",
                            "Pehle mujhe email pe details bhej dein.",
                            "Is service ka kharcha kitna hoga?",
                            "Hum interested nahi hain filhal.",
                          ].map((chip, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSendProspectSpeech(chip)}
                              disabled={isAiThinking}
                              className="text-[11px] bg-muted/60 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-border/80 px-2.5 py-1 rounded-lg text-gray-300 transition-all text-left"
                            >
                              💬 "{chip}"
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Speech Input */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendProspectSpeech();
                        }}
                        className="flex items-center gap-2"
                      >
                        <Input
                          placeholder="Type or speak what the prospect responds on the phone..."
                          value={prospectInput}
                          onChange={(e) => setProspectInput(e.target.value)}
                          disabled={isAiThinking}
                          className="h-10 text-xs"
                        />
                        <Button
                          type="submit"
                          disabled={!prospectInput.trim() || isAiThinking}
                          className="gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
                        >
                          <Mic className="h-4 w-4" />
                          Speak / Send
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= CALL HISTORY & BOOKED MEETINGS TAB ================= */}
      {activeTab === "history" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-card/70 border border-border/70 rounded-2xl p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-400" />
                  Past Voice Calls & Booked Meetings
                </h2>
                <p className="text-xs text-muted-foreground">
                  Complete history of all outbound AI calls, dialogue transcripts, and scheduled meetings.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchCallHistory}
                disabled={loadingHistory}
                className="gap-2 text-xs"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loadingHistory && "animate-spin")} />
                Refresh
              </Button>
            </div>

            {loadingHistory ? (
              <div className="py-16 text-center text-muted-foreground text-xs">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
                Loading call history...
              </div>
            ) : historyList.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs space-y-3">
                <PhoneCall className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p>No call sessions logged yet. Launch your first AI Voice Call to see results here!</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setActiveTab("caller");
                    setCurrentStep(1);
                  }}
                  className="bg-primary text-primary-foreground text-xs"
                >
                  Start New Voice Call
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                    <tr>
                      <th className="p-3.5">Business Name</th>
                      <th className="p-3.5">Phone Number</th>
                      <th className="p-3.5">Voice / Persona</th>
                      <th className="p-3.5">Duration</th>
                      <th className="p-3.5">Call Status</th>
                      <th className="p-3.5">Meeting Booked</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {historyList.map((session) => (
                      <tr key={session.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3.5 font-semibold text-white">
                          {session.business_name}
                          {session.category && (
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              {session.category}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-gray-300">{session.phone_number || "—"}</td>
                        <td className="p-3.5">
                          <span className="capitalize">{session.voice_gender}</span> ({session.language})
                        </td>
                        <td className="p-3.5 font-mono text-gray-300">
                          {Math.floor(session.call_duration_seconds / 60)}:
                          {(session.call_duration_seconds % 60).toString().padStart(2, "0")}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              session.call_status === "meeting_booked"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : session.call_status === "completed"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {session.call_status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {session.meeting_booked ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                              <CheckCircle2 className="h-4 w-4" />
                              {session.meeting_details?.meeting_date
                                ? `${session.meeting_details.meeting_date} @ ${session.meeting_details.meeting_time}`
                                : "Confirmed"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedHistoryItem(session)}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            View Transcript
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MEETING BOOKING MODAL ================= */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CalendarPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Schedule Booked Meeting</h3>
                  <p className="text-xs text-muted-foreground">
                    For {targetAnalysis?.business_name || selectedLead?.business_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-muted-foreground hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmMeeting} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Meeting Date
                  </label>
                  <Input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Meeting Time
                  </label>
                  <Input
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Contact / Attendee Name
                </label>
                <Input
                  placeholder="Decision maker name..."
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Contact Email (Optional for invite)
                </label>
                <Input
                  type="email"
                  placeholder="prospect@company.com"
                  value={attendeeEmail}
                  onChange={(e) => setAttendeeEmail(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Meeting Agenda & Notes
                </label>
                <Input
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBookingModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingMeeting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5"
                >
                  {isSavingMeeting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirm & Save Meeting
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TRANSCRIPT DETAILS MODAL ================= */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">
                  Call Transcript: {selectedHistoryItem.business_name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Duration: {Math.floor(selectedHistoryItem.call_duration_seconds / 60)}m{" "}
                  {selectedHistoryItem.call_duration_seconds % 60}s • Voice:{" "}
                  {selectedHistoryItem.voice_gender.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="text-muted-foreground hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {selectedHistoryItem.transcript && selectedHistoryItem.transcript.length > 0 ? (
                selectedHistoryItem.transcript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-xl text-xs space-y-1",
                      msg.speaker === "agent"
                        ? "bg-muted/40 border border-border/60"
                        : "bg-indigo-950/40 border border-indigo-500/30 text-indigo-200"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                      <span>{msg.speaker === "agent" ? "AI Voice Agent" : "Prospect"}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="text-gray-200">{msg.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No transcript recorded for this call.</p>
              )}
            </div>

            <div className="pt-3 border-t border-border/50 flex justify-end">
              <Button size="sm" onClick={() => setSelectedHistoryItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AIVoiceCalling;
