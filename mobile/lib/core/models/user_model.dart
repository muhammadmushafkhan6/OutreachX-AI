class UserModel {
  final String id;
  final String email;
  final String? fullName;
  final String role;
  final bool isActive;

  UserModel({
    required this.id,
    required this.email,
    this.fullName,
    required this.role,
    required this.isActive,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      email: json['email'] ?? '',
      fullName: json['full_name'],
      role: json['role'] ?? 'user',
      isActive: json['is_active'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'full_name': fullName,
      'role': role,
      'is_active': isActive,
    };
  }
}

