class JobModel {
  final String id;
  final String type;
  final String mode;
  final String status;
  final int progress;
  final String? url;
  final String? query;
  final int? totalUrls;
  final int? processedUrls;
  final String createdAt;
  final String? errorMessage;

  JobModel({
    required this.id,
    required this.type,
    required this.mode,
    required this.status,
    required this.progress,
    this.url,
    this.query,
    this.totalUrls,
    this.processedUrls,
    required this.createdAt,
    this.errorMessage,
  });

  factory JobModel.fromJson(Map<String, dynamic> json) {
    return JobModel(
      id: json['id']?.toString() ?? '',
      type: json['type'] ?? 'single',
      mode: json['mode'] ?? 'website',
      status: json['status'] ?? 'queued',
      progress: (json['progress'] as num?)?.toInt() ?? 0,
      url: json['url'],
      query: json['query'],
      totalUrls: json['total_urls'],
      processedUrls: json['processed_urls'],
      createdAt: json['created_at'] ?? '',
      errorMessage: json['error_message'],
    );
  }
}

