class DashboardStatsModel {
  final int totalWebsites;
  final int activeJobs;
  final int completedJobs;
  final int failedJobs;
  final int totalEmails;
  final int noWebsiteBusinesses;
  final int extractedPhones;
  final int highQualityLeads;
  final int aiOpportunities;

  DashboardStatsModel({
    required this.totalWebsites,
    required this.activeJobs,
    required this.completedJobs,
    required this.failedJobs,
    required this.totalEmails,
    required this.noWebsiteBusinesses,
    required this.extractedPhones,
    required this.highQualityLeads,
    required this.aiOpportunities,
  });

  factory DashboardStatsModel.fromJson(Map<String, dynamic> json) {
    return DashboardStatsModel(
      totalWebsites: json['total_websites'] ?? 0,
      activeJobs: json['active_jobs'] ?? 0,
      completedJobs: json['completed_jobs'] ?? 0,
      failedJobs: json['failed_jobs'] ?? 0,
      totalEmails: json['total_emails'] ?? 0,
      noWebsiteBusinesses: json['no_website_businesses'] ?? 0,
      extractedPhones: json['extracted_phones'] ?? 0,
      highQualityLeads: json['high_quality_leads'] ?? 0,
      aiOpportunities: json['ai_opportunities'] ?? 0,
    );
  }

  factory DashboardStatsModel.empty() {
    return DashboardStatsModel(
      totalWebsites: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalEmails: 0,
      noWebsiteBusinesses: 0,
      extractedPhones: 0,
      highQualityLeads: 0,
      aiOpportunities: 0,
    );
  }
}

