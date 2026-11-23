import 'dart:convert';
import 'package:http/http.dart' as http;
import '../storage/auth_storage.dart';
import '../models/user_model.dart';
import '../models/dashboard_stats_model.dart';
import '../models/job_model.dart';
import '../models/map_lead_model.dart';
import '../models/instagram_account_model.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  Future<Map<String, String>> _headers() async {
    final token = await AuthStorage.getToken();
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<String> _url(String endpoint) async {
    final base = await AuthStorage.getBaseUrl();
    final cleanBase = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    return '$cleanBase$cleanEndpoint';
  }

  // ── Auth ──────────────────────────────────────────────
  Future<Map<String, dynamic>> login(String email, String password) async {
    final url = await _url('/auth/login');
    final response = await http.post(
      Uri.parse(url),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final token = data['access_token'];
      if (token != null) {
        await AuthStorage.saveToken(token);
        if (data['user'] != null) {
          await AuthStorage.saveUser(UserModel.fromJson(data['user']));
        }
      }
      return data;
    } else {
      throw Exception(data['detail'] ?? 'Login failed (${response.statusCode})');
    }
  }

  Future<Map<String, dynamic>> register(String email, String password, String fullName) async {
    final url = await _url('/auth/register');
    final response = await http.post(
      Uri.parse(url),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
        'full_name': fullName,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final token = data['access_token'];
      if (token != null) {
        await AuthStorage.saveToken(token);
        if (data['user'] != null) {
          await AuthStorage.saveUser(UserModel.fromJson(data['user']));
        }
      }
      return data;
    } else {
      throw Exception(data['detail'] ?? 'Registration failed');
    }
  }

  Future<UserModel> getMe() async {
    final url = await _url('/users/me');
    final response = await http.get(Uri.parse(url), headers: await _headers());
    if (response.statusCode == 200) {
      final user = UserModel.fromJson(jsonDecode(response.body));
      await AuthStorage.saveUser(user);
      return user;
    }
    throw Exception('Failed to load user profile');
  }

  // ── Dashboard ──────────────────────────────────────────
  Future<DashboardStatsModel> getDashboardStats() async {
    final url = await _url('/dashboard/stats');
    final response = await http.get(Uri.parse(url), headers: await _headers());
    if (response.statusCode == 200) {
      return DashboardStatsModel.fromJson(jsonDecode(response.body));
    }
    return DashboardStatsModel.empty();
  }

  // ── Jobs ───────────────────────────────────────────────
  Future<List<JobModel>> getJobs() async {
    final url = await _url('/jobs');
    final response = await http.get(Uri.parse(url), headers: await _headers());
    if (response.statusCode == 200) {
      final list = jsonDecode(response.body) as List;
      return list.map((e) => JobModel.fromJson(e)).toList();
    }
    return [];
  }

  Future<JobModel> createSingleJob(String targetUrl) async {
    final url = await _url('/jobs/single');
    final response = await http.post(
      Uri.parse(url),
      headers: await _headers(),
      body: jsonEncode({'url': targetUrl, 'mode': 'website'}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return JobModel.fromJson(data);
    }
    throw Exception(data['detail'] ?? 'Failed to start website analysis');
  }

  Future<JobModel> createBulkJob(List<String> urls) async {
    final url = await _url('/jobs/bulk');
    final response = await http.post(
      Uri.parse(url),
      headers: await _headers(),
      body: jsonEncode({'urls': urls, 'mode': 'website'}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return JobModel.fromJson(data);
    }
    throw Exception(data['detail'] ?? 'Failed to submit bulk analysis');
  }

  // ── Google Maps Leads ──────────────────────────────────
  Future<Map<String, dynamic>> startGoogleMapsJob({
    required String query,
    String? location,
    int maxResults = 50,
  }) async {
    final url = await _url('/ai-lead-finder/jobs');
    final response = await http.post(
      Uri.parse(url),
      headers: await _headers(),
      body: jsonEncode({
        'query': query,
        'location': location,
        'max_results': maxResults,
      }),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    }
    throw Exception(data['detail'] ?? 'Failed to search Google Maps leads');
  }

  Future<List<MapLeadModel>> getMapLeads({String? jobId, int page = 1, int pageSize = 50}) async {
    String endpoint;
    if (jobId != null && jobId.isNotEmpty) {
      endpoint = '/ai-lead-finder/jobs/$jobId/leads?page=$page&page_size=$pageSize';
    } else {
      endpoint = '/jobs/leads?page=$page&page_size=$pageSize';
    }
    try {
      final url = await _url(endpoint);
      final response = await http.get(Uri.parse(url), headers: await _headers());
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        final list = (decoded is Map && decoded['leads'] != null)
            ? decoded['leads'] as List
            : (decoded is List ? decoded : []);
        return list.map((e) => MapLeadModel.fromJson(e)).toList();
      }
    } catch (_) {}
    return [];
  }

  // ── Instagram Accounts & DMs ───────────────────────────
  Future<List<InstagramAccountModel>> getInstagramAccounts() async {
    final url = await _url('/instagram/accounts');
    final response = await http.get(Uri.parse(url), headers: await _headers());
    if (response.statusCode == 200) {
      final list = jsonDecode(response.body) as List;
      return list.map((e) => InstagramAccountModel.fromJson(e)).toList();
    }
    return [];
  }

  Future<InstagramAccountModel> connectInstagramAccount({
    required String username,
    required String cookie,
  }) async {
    final url = await _url('/instagram/accounts');
    final response = await http.post(
      Uri.parse(url),
      headers: await _headers(),
      body: jsonEncode({'username': username, 'instagram_cookie': cookie}),
    );
    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return InstagramAccountModel.fromJson(data);
    }
    throw Exception(data['detail'] ?? 'Failed to connect Instagram account');
  }

  Future<void> deleteInstagramAccount(String accountId) async {
    final url = await _url('/instagram/accounts/$accountId');
    final response = await http.delete(Uri.parse(url), headers: await _headers());
    if (response.statusCode >= 400) {
      throw Exception('Failed to delete Instagram account');
    }
  }

  Future<void> sendInstagramDM({
    required String targetUsername,
    required String message,
    required String accountId,
  }) async {
    final url = await _url('/outreach/instagram-dm');
    final response = await http.post(
      Uri.parse(url),
      headers: await _headers(),
      body: jsonEncode({
        'target_username': targetUsername,
        'message': message,
        'instagram_account_id': accountId,
      }),
    );
    if (response.statusCode >= 400) {
      final data = jsonDecode(response.body);
      throw Exception(data['detail'] ?? 'Failed to send DM');
    }
  }

  Future<String> generateInstagramDM({
    required String username,
    String? fullName,
    String? bio,
  }) async {
    final url = await _url('/outreach/instagram-dm/generate');
    final response = await http.post(
      Uri.parse(url),
      headers: await _headers(),
      body: jsonEncode({
        'username': username,
        'full_name': fullName,
        'bio': bio,
      }),
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['message'] ?? '';
    }
    throw Exception('Failed to generate AI DM');
  }
}

