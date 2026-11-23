import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/models/dashboard_stats_model.dart';
import '../../core/models/job_model.dart';
import '../../core/models/user_model.dart';
import '../../core/storage/auth_storage.dart';
import '../../core/theme/app_theme.dart';

class DashboardScreen extends StatefulWidget {
  final Function(int) onNavigateTab;
  const DashboardScreen({super.key, required this.onNavigateTab});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardStatsModel _stats = DashboardStatsModel.empty();
  List<JobModel> _recentJobs = [];
  UserModel? _user;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final user = await AuthStorage.getUser();
      final stats = await ApiClient().getDashboardStats();
      final jobs = await ApiClient().getJobs();
      if (mounted) {
        setState(() {
          _user = user;
          _stats = stats;
          _recentJobs = jobs.take(5).toList();
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        children: [
          // ── Welcome Section ──────────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back, 👋',
                      style: TextStyle(fontSize: 13, color: AppColors.textMuted, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _user?.fullName ?? _user?.email.split('@').first ?? 'User',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text, letterSpacing: -0.5),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'AI Prospecting Engine is ready.',
                      style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.bolt_rounded, color: Colors.white, size: 26),
              ),
            ],
          ),
          const SizedBox(height: 28),

          // ── Quick Actions ────────────────────────────────
          const Text(
            'QUICK ACTIONS',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3, color: AppColors.textDim),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildActionCard(Icons.map_rounded, 'Map Leads', 'Google Places', () => widget.onNavigateTab(2))),
              const SizedBox(width: 10),
              Expanded(child: _buildActionCard(Icons.language_rounded, 'Analyze Site', 'AI Scraper', () => widget.onNavigateTab(1))),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _buildActionCard(Icons.upload_file_rounded, 'Bulk CSV', 'Batch Process', () => widget.onNavigateTab(3))),
              const SizedBox(width: 10),
              Expanded(child: _buildActionCard(Icons.flash_on_rounded, 'Instagram', 'Automated DMs', () => widget.onNavigateTab(4))),
            ],
          ),
          const SizedBox(height: 28),

          // ── Stats Grid ───────────────────────────────────
          const Text(
            'METRICS & PIPELINE',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3, color: AppColors.textDim),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.5,
            children: [
              _buildStatCard('Websites Analyzed', '${_stats.totalWebsites}', Icons.public_rounded, false),
              _buildStatCard('Leads Captured', '${_stats.totalEmails}', Icons.email_rounded, false),
              _buildStatCard('Extracted Phones', '${_stats.extractedPhones}', Icons.phone_android_rounded, false),
              _buildStatCard('High Score Leads', '${_stats.highQualityLeads}', Icons.star_rounded, true),
            ],
          ),
          const SizedBox(height: 28),

          // ── Recent Jobs ──────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'RECENT JOBS',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3, color: AppColors.textDim),
              ),
              GestureDetector(
                onTap: () => widget.onNavigateTab(5),
                child: const Text('View All', style: TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (_recentJobs.isEmpty)
            Container(
              padding: const EdgeInsets.all(28),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 16, offset: const Offset(0, 4))],
              ),
              child: const Center(
                child: Column(
                  children: [
                    Icon(Icons.inbox_rounded, color: AppColors.textDim, size: 40),
                    SizedBox(height: 10),
                    Text('No jobs yet', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                    SizedBox(height: 4),
                    Text('Start a scrape or lead search', style: TextStyle(color: AppColors.textDim, fontSize: 12)),
                  ],
                ),
              ),
            )
          else
            ..._recentJobs.map((j) => _buildJobTile(j)),
        ],
      ),
    );
  }

  Widget _buildActionCard(IconData icon, String title, String subtitle, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 16, offset: const Offset(0, 4))],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.text)),
                  Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.textDim)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, bool highlight) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: highlight ? AppColors.primary : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 16, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: highlight ? Colors.white.withAlpha(200) : AppColors.textMuted),
                ),
              ),
              Icon(icon, size: 18, color: highlight ? Colors.white : AppColors.textDim),
            ],
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: highlight ? Colors.white : AppColors.text,
              letterSpacing: -1,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJobTile(JobModel job) {
    Color statusColor;
    if (job.status == 'completed') statusColor = AppColors.success;
    else if (job.status == 'failed') statusColor = AppColors.danger;
    else statusColor = AppColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 12, offset: const Offset(0, 3))],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: statusColor.withAlpha(26),
              shape: BoxShape.circle,
            ),
            child: Icon(
              job.status == 'completed' ? Icons.check_rounded : (job.status == 'failed' ? Icons.close_rounded : Icons.sync_rounded),
              color: statusColor, size: 18,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  job.url ?? job.query ?? 'Job #${job.id.substring(0, 8)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.text),
                ),
                const SizedBox(height: 2),
                Text('${job.mode.toUpperCase()} • ${job.status}', style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Text('${job.progress}%', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textMuted, fontSize: 12)),
        ],
      ),
    );
  }
}
