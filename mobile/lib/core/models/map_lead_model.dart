class MapLeadModel {
  final String id;
  final String jobId;
  final String businessName;
  final String? category;
  final String? phone;
  final String? address;
  final String? website;
  final String? email;
  final double? rating;
  final int? reviews;
  final String? mapsUrl;
  final List<String> emails;
  final List<String> extraPhones;
  final String? whatsapp;
  final String leadScore;
  final String? recommendedService;
  final String? aiSummary;
  final String createdAt;

  MapLeadModel({
    required this.id,
    required this.jobId,
    required this.businessName,
    this.category,
    this.phone,
    this.address,
    this.website,
    this.email,
    this.rating,
    this.reviews,
    this.mapsUrl,
    this.emails = const [],
    this.extraPhones = const [],
    this.whatsapp,
    this.leadScore = 'Medium',
    this.recommendedService,
    this.aiSummary,
    required this.createdAt,
  });

  factory MapLeadModel.fromJson(Map<String, dynamic> json) {
    List<String> parseList(dynamic val) {
      if (val is List) {
        return val.map((e) => e.toString()).toList();
      }
      return [];
    }

    return MapLeadModel(
      id: json['id']?.toString() ?? '',
      jobId: json['job_id']?.toString() ?? '',
      businessName: json['business_name'] ?? 'Unknown Business',
      category: json['category'],
      phone: json['phone'],
      address: json['address'],
      website: json['website'],
      email: json['email'],
      rating: (json['rating'] as num?)?.toDouble(),
      reviews: (json['reviews'] as num?)?.toInt(),
      mapsUrl: json['maps_url'],
      emails: parseList(json['emails']),
      extraPhones: parseList(json['extra_phones']),
      whatsapp: json['whatsapp'],
      leadScore: json['lead_score'] ?? 'Medium',
      recommendedService: json['recommended_service'],
      aiSummary: json['ai_summary'],
      createdAt: json['created_at'] ?? '',
    );
  }
}

