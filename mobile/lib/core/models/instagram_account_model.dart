class InstagramAccountModel {
  final String id;
  final String username;
  final bool isActive;
  final String? lastUsedAt;

  InstagramAccountModel({
    required this.id,
    required this.username,
    required this.isActive,
    this.lastUsedAt,
  });

  factory InstagramAccountModel.fromJson(Map<String, dynamic> json) {
    return InstagramAccountModel(
      id: json['id']?.toString() ?? '',
      username: json['username'] ?? '',
      isActive: json['is_active'] ?? true,
      lastUsedAt: json['last_used_at'],
    );
  }
}

