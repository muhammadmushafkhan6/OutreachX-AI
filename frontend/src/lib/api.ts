import axios from "axios";
import { useAuthStore } from "@/stores/authStore";
import {
  InstagramAccount,
  AILeadFinderJob,
  PaginatedAILeadFinderLeads,
  StartAILeadFinderRequest,
  StartAILeadFinderResponse,
  EmailGenerateRequest,
  EmailGenerateResponse,
  EmailSendRequest,
  EmailSendResponse,
  EmailTestResponse,
  EmailBulkSendRequest,
  EmailBulkSendResponse,
  EmailTemplate,
  EmailTemplateCreate,
  EmailTemplateUpdate,
  SentEmail,
  EmailCampaign,
  EmailCampaignCreate,
  EmailCampaignStartRequest,
  EmailStats,
} from "@/types";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(", ") || fallback;
    }
    if (error.message === "Network Error") {
      return "Cannot reach backend. Start API on http://localhost:8000";
    }
    return error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// Instagram Account API
export const instagramApi = {
  connect: async (data: { username: string; instagram_cookie: string }) => {
    const response = await api.post<InstagramAccount>("/instagram/accounts", data);
    return response.data;
  },

  list: async () => {
    const response = await api.get<InstagramAccount[]>("/instagram/accounts");
    return response.data;
  },

  delete: async (accountId: string) => {
    await api.delete(`/instagram/accounts/${accountId}`);
  },

  sendDM: async (data: { target_username: string; message: string; instagram_account_id: string }) => {
    const response = await api.post("/outreach/instagram-dm", data);
    return response.data;
  },

  generateDM: async (data: {
    username: string;
    full_name?: string;
    bio?: string;
    followers_count?: number;
    website?: string;
  }) => {
    const response = await api.post<{ message: string }>("/outreach/instagram-dm/generate", data);
    return response.data;
  },
};

// AI Lead Finder API
export const aiLeadFinderApi = {
  startJob: async (data: StartAILeadFinderRequest) => {
    const response = await api.post<StartAILeadFinderResponse>("/ai-lead-finder/jobs", data);
    return response.data;
  },

  getJobs: async () => {
    const response = await api.get<AILeadFinderJob[]>("/ai-lead-finder/jobs");
    return response.data;
  },

  getJob: async (jobId: string) => {
    const response = await api.get<AILeadFinderJob>(`/ai-lead-finder/jobs/${jobId}`);
    return response.data;
  },

  getJobLeads: async (jobId: string, page: number = 1, pageSize: number = 20) => {
    const response = await api.get<PaginatedAILeadFinderLeads>(
      `/ai-lead-finder/jobs/${jobId}/leads?page=${page}&page_size=${pageSize}`
    );
    return response.data;
  },
};

// Email Outreach API
export const emailOutreachApi = {
  testSmtp: async () => {
    const response = await api.get<EmailTestResponse>("/outreach/email/test");
    return response.data;
  },

  generateTemplate: async (data: EmailGenerateRequest) => {
    const response = await api.post<EmailGenerateResponse>("/outreach/email/generate", data);
    return response.data;
  },

  sendSingle: async (data: EmailSendRequest) => {
    const response = await api.post<EmailSendResponse>("/outreach/email/send", data);
    return response.data;
  },

  bulkSend: async (data: EmailBulkSendRequest) => {
    const response = await api.post<EmailBulkSendResponse>("/outreach/email/bulk-send", data);
    return response.data;
  },

  listTemplates: async () => {
    const response = await api.get<EmailTemplate[]>("/outreach/email/templates");
    return response.data;
  },

  createTemplate: async (data: EmailTemplateCreate) => {
    const response = await api.post<EmailTemplate>("/outreach/email/templates", data);
    return response.data;
  },

  updateTemplate: async (templateId: string, data: EmailTemplateUpdate) => {
    const response = await api.patch<EmailTemplate>(`/outreach/email/templates/${templateId}`, data);
    return response.data;
  },

  deleteTemplate: async (templateId: string) => {
    await api.delete(`/outreach/email/templates/${templateId}`);
  },

  listCampaigns: async (limit: number = 50) => {
    const response = await api.get<EmailCampaign[]>(`/outreach/email/campaigns?limit=${limit}`);
    return response.data;
  },

  createCampaign: async (data: EmailCampaignCreate) => {
    const response = await api.post<EmailCampaign>("/outreach/email/campaigns", data);
    return response.data;
  },

  getCampaign: async (campaignId: string) => {
    const response = await api.get<EmailCampaign>(`/outreach/email/campaigns/${campaignId}`);
    return response.data;
  },

  startCampaign: async (campaignId: string, data: EmailCampaignStartRequest) => {
    const response = await api.post(`/outreach/email/campaigns/${campaignId}/start`, data);
    return response.data;
  },

  listSentEmails: async (campaignId?: string, limit: number = 100) => {
    const url = campaignId
      ? `/outreach/email/sent?campaign_id=${campaignId}&limit=${limit}`
      : `/outreach/email/sent?limit=${limit}`;
    const response = await api.get<SentEmail[]>(url);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get<EmailStats>("/outreach/email/stats");
    return response.data;
  },
};

// AI Voice Calling Agent API
export const voiceAgentApi = {
  uploadSheet: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/voice-agent/upload-sheet", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000,
    });
    return response.data;
  },

  analyzeTarget: async (data: any) => {
    const response = await api.post("/voice-agent/analyze-target", data);
    return response.data;
  },

  // ── Real Twilio Calling ────────────────────────────────────
  initiateCall: async (sessionId: string) => {
    const response = await api.post("/voice-agent/initiate-call", { session_id: sessionId });
    return response.data;
  },

  endCall: async (sessionId: string) => {
    const response = await api.post("/voice-agent/end-call", { session_id: sessionId });
    return response.data;
  },

  getLiveCallStatus: async (sessionId: string) => {
    const response = await api.get(`/voice-agent/call-status/${sessionId}`);
    return response.data;
  },

  // ── Simulation / Browser Mode ──────────────────────────────
  dialogueTurn: async (data: any) => {
    const response = await api.post("/voice-agent/dialogue-turn", data);
    return response.data;
  },

  bookMeeting: async (data: any) => {
    const response = await api.post("/voice-agent/book-meeting", data);
    return response.data;
  },

  updateStatus: async (data: any) => {
    const response = await api.post("/voice-agent/update-status", data);
    return response.data;
  },

  getHistory: async () => {
    const response = await api.get("/voice-agent/history");
    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await api.get(`/voice-agent/session/${sessionId}`);
    return response.data;
  },
};


