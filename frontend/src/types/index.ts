export type JobStatus =
  | "queued"
  | "processing"
  | "scraping"
  | "ai_analyzing"
  | "completed"
  | "failed";

export interface User {
  id: string;
  email: string;
  full_name: string;
  instagram_username?: string;
  created_at: string;
}

export interface Job {
  id: string;
  type: "single" | "bulk";
  mode: "website" | "maps" | "social" | "peaky" | "linkedin";
  status: JobStatus;
  progress: number;
  url?: string;
  query?: string;
  total_urls?: number;
  processed_urls?: number;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface PeakyLead {
  id: string;
  job_id: string;
  first_name?: string;
  last_name?: string;
  person_title?: string;
  seniority?: string;
  functional?: string;
  person_country?: string;
  person_state?: string;
  company_name?: string;
  company_domain?: string;
  company_employee_size?: string;
  company_country?: string;
  company_state?: string;
  industry?: string;
  revenue?: string;
  business_model?: string;
  work_email?: string;
  personal_email?: string;
  phone?: string;
  linkedin_url?: string;
  company_linkedin_url?: string;
  lead_score: string;
  recommended_service?: string;
  ai_summary?: string;
  created_at: string;
}

export interface LinkedInLead {
  id: string;
  job_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  job_title?: string;
  seniority?: string;
  company_name?: string;
  company_website?: string;
  company_size?: string;
  industry?: string;
  country?: string;
  city?: string;
  location?: string;
  work_email?: string;
  personal_email?: string;
  phone?: string;
  linkedin_url?: string;
  company_linkedin_url?: string;
  lead_score: string;
  recommended_service?: string;
  ai_summary?: string;
  created_at: string;
}

export interface SocialMediaLead {
  id: string;
  job_id: string;
  platform: string;
  username: string;
  full_name?: string;
  bio?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  website?: string;
  email?: string;
  phone?: string;
  profile_url?: string;
  profile_pic_url?: string;
  lead_score: string;
  recommended_service?: string;
  ai_summary?: string;
  created_at: string;
}

export interface ExtractedData {
  id: string;
  job_id: string;
  url: string;
  company_name?: string;
  title?: string;
  meta_description?: string;
  emails: string[];
  phones: string[];
  social_links: Record<string, string>;
  services: string[];
  pricing?: string;
  contact_pages: string[];
  business_text?: string;
  tech_stack: string[];
}

export interface AIAnalysis {
  id: string;
  job_id: string;
  company_name: string;
  industry: string;
  business_type: string;
  niche: string;
  summary: string;
  lead_score: "Low" | "Medium" | "High";
  target_audience: string;
  services: string[];
}

export interface MapLead {
  id: string;
  job_id: string;
  business_name: string;
  category?: string;
  phone?: string;
  address?: string;
  website?: string;
  email?: string;
  rating?: number;
  reviews?: number;
  opening_hours?: string;
  maps_url?: string;
  place_id?: string;
  lat?: number;
  lng?: number;
  emails?: string[];
  extra_phones?: string[];
  whatsapp?: string;
  social_links?: Record<string, any>;
  lead_score: string;
  recommended_service?: string;
  ai_summary?: string;
  created_at: string;
}

export interface DashboardStats {
  total_websites: number;
  active_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  total_emails: number;
  no_website_businesses: number;
  extracted_phones: number;
  high_quality_leads: number;
  ai_opportunities: number;
}

export interface InstagramAccount {
  id: string;
  username: string;
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

// AI Lead Finder Types
export interface AILeadFinderFilters {
  job_titles?: string[];
  country?: string;
  state_region?: string;
  city?: string;
  industry?: string;
  company_size?: string;
  company_revenue?: string;
  funding?: string;
  company_website?: "has" | "no" | "any";
  email_status?: "verified" | "any";
  keywords?: string;
  number_of_leads?: number;
}

export interface AILeadFinderLead {
  id: string;
  job_id: string;
  company_name?: string;
  company_website?: string;
  industry?: string;
  company_size?: string;
  revenue?: string;
  funding?: string;
  contact_name?: string;
  job_title?: string;
  business_email?: string;
  personal_email?: string;
  phone_number?: string;
  linkedin_url?: string;
  location?: string;
  country?: string;
  lead_score?: number;
  ai_business_summary?: string;
  ai_cold_email?: string;
  ai_whatsapp_message?: string;
  ai_voice_script?: string;
  created_at: string;
}

export interface AILeadFinderJob {
  id: string;
  user_id: string;
  status: "queued" | "processing" | "scraping" | "analyzing" | "completed" | "failed";
  progress: number;
  apify_run_id?: string;
  filters?: AILeadFinderFilters;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedAILeadFinderLeads {
  leads: AILeadFinderLead[];
  total: number;
  page: number;
  page_size: number;
}

export interface StartAILeadFinderRequest {
  filters: AILeadFinderFilters;
}

export interface StartAILeadFinderResponse {
  job_id: string;
  message: string;
}

// Email Outreach Types
export interface EmailGenerateRequest {
  business_name: string;
  category?: string;
  location?: string;
  website?: string;
  recipient_name?: string;
  tone?: string;
  purpose?: string;
  services_offered?: string;
}

export interface EmailGenerateResponse {
  subject: string;
  html_body: string;
  text_body: string;
  status: string;
}

export interface EmailSendRequest {
  to_email: string;
  to_name?: string;
  subject: string;
  html_body: string;
  text_body?: string;
  reply_to?: string;
  cc?: string[];
  bcc?: string[];
  lead_id?: string;
  lead_type?: string;
}

export interface EmailSendResponse {
  success: boolean;
  to: string;
  subject: string;
  from_email?: string;
  error?: string;
  sent_email_id?: string;
}

export interface EmailTestResponse {
  configured: boolean;
  success: boolean;
  message: string;
  from_email?: string;
}

export interface EmailBulkRecipient {
  email: string;
  name?: string;
  business_name?: string;
  category?: string;
  location?: string;
  phone?: string;
  lead_id?: string;
  lead_type?: string;
}

export interface EmailBulkSendRequest {
  recipients: EmailBulkRecipient[];
  subject_template: string;
  html_template: string;
  text_template?: string;
  reply_to?: string;
  delay_seconds?: number;
  campaign_name?: string;
}

export interface EmailBulkSendResponse {
  total: number;
  success_count: number;
  failed_count: number;
  results: Record<string, unknown>[];
  campaign_id?: string;
}

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  variables?: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateCreate {
  name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  variables?: Record<string, unknown>;
  is_default?: boolean;
}

export interface EmailTemplateUpdate {
  name?: string;
  subject?: string;
  html_body?: string;
  text_body?: string;
  variables?: Record<string, unknown>;
  is_default?: boolean;
}

export interface SentEmail {
  id: string;
  user_id: string;
  campaign_id?: string;
  lead_id?: string;
  lead_type?: string;
  to_email: string;
  to_name?: string;
  from_email: string;
  subject: string;
  status: string;
  error_message?: string;
  sent_at?: string;
  opened_at?: string;
  clicked_at?: string;
  created_at: string;
}

export interface EmailCampaign {
  id: string;
  user_id: string;
  template_id?: string;
  name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  from_name?: string;
  reply_to?: string;
  delay_seconds: number;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaignCreate {
  name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  from_name?: string;
  reply_to?: string;
  delay_seconds?: number;
  template_id?: string;
}

export interface EmailCampaignStartRequest {
  recipients: EmailBulkRecipient[];
}

export interface EmailStats {
  total_sent_emails: number;
  successful: number;
  failed: number;
  campaigns_total: number;
}

// Voice Calling Agent Types
export interface VoiceLeadItem {
  id?: string;
  business_name: string;
  phone_number?: string;
  contact_name?: string;
  website?: string;
  category?: string;
  location?: string;
  rating?: number;
  reviews?: number;
  lead_score?: "Low" | "Medium" | "High";
  recommended_angle?: string;
}

export interface SheetAnalysisResponse {
  total_leads: number;
  leads_with_phone: number;
  leads_with_website: number;
  top_categories: string[];
  ai_recommendation_summary: string;
  suggested_first_lead?: VoiceLeadItem;
  leads: VoiceLeadItem[];
}

export interface AnalyzeTargetBusinessRequest {
  business_name: string;
  phone_number?: string;
  contact_name?: string;
  website?: string;
  category?: string;
  location?: string;
  voice_gender: "male" | "female";
  voice_name?: string;
  language: "roman_urdu" | "urdu" | "english_us" | "english_uk";
  call_objective?: string;
}

export interface BusinessDeepAnalysis {
  company_name: string;
  detected_strengths: string[];
  pain_points: string[];
  value_proposition: string;
  opening_hook: string;
  meeting_booking_pitch: string;
  objection_responses: Record<string, string>;
  recommended_call_strategy: string;
}

export interface TargetAnalysisResponse {
  session_id: string;
  business_name: string;
  phone_number: string;
  analysis: BusinessDeepAnalysis;
  opening_script: string;
  voice_gender: string;
  voice_name: string;
  language: string;
}

export interface DialogueTurnRequest {
  session_id: string;
  prospect_speech: string;
  turn_number?: number;
}

export interface DialogueTurnResponse {
  session_id: string;
  agent_reply: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  is_meeting_agreed: boolean;
  meeting_intent?: {
    agreed?: boolean;
    suggested_time?: string;
    notes?: string;
  };
  audio_hint?: {
    voice?: string;
    gender?: string;
  };
}

export interface BookMeetingRequest {
  session_id: string;
  meeting_date: string;
  meeting_time: string;
  attendee_name?: string;
  attendee_email?: string;
  attendee_phone?: string;
  notes?: string;
}

export interface VoiceCallSession {
  id: string;
  business_name: string;
  phone_number: string;
  contact_name?: string;
  website?: string;
  category?: string;
  location?: string;
  voice_gender: "male" | "female";
  voice_name: string;
  language: string;
  call_status: "pending" | "calling" | "in_progress" | "completed" | "failed" | "meeting_booked";
  call_duration_seconds: number;
  sentiment: "Positive" | "Neutral" | "Negative";
  meeting_booked: boolean;
  meeting_details?: {
    meeting_date: string;
    meeting_time: string;
    attendee_name?: string;
    attendee_email?: string;
    attendee_phone?: string;
    notes?: string;
    booked_at?: string;
  };
  transcript: Array<{
    speaker: "agent" | "prospect";
    text: string;
    timestamp: string;
  }>;
  created_at: string;
  updated_at: string;
}

