import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../core/models/job_model.dart';

class ResultsScreen extends StatefulWidget {
  const ResultsScreen({super.key});

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  List<JobModel> _jobs = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchJobs();
  }

  Future<void> _fetchJobs() async {
    setState(() => _isLoading = true);
    try {
      final jobs = await ApiClient().getJobs();
      if (mounted) setState(() => _jobs = jobs);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _fetchJobs,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Pipeline Jobs', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: AppColors.text, letterSpacing: -0.5)),
                  Text('${_jobs.length} total', style: const TextStyle(fontSize: 13, color: AppColors.textMuted)),
                ],
              ),
              GestureDetector(
                onTap: _fetchJobs,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: AppColors.surface, shape: BoxShape.circle, boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 10)]),
                  child: const Icon(Icons.refresh_rounded, color: AppColors.primary, size: 20),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          if (_isLoading)
            const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(color: AppColors.primary)))
          else if (_jobs.isEmpty)
            Container(
              padding: const EdgeInsets.all(40),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 16, offset: const Offset(0, 4))],
              ),
              child: const Column(
                children: [
                  Icon(Icons.inbox_rounded, color: AppColors.textDim, size: 52),
                  SizedBox(height: 14),
                  Text('No jobs found', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.text, fontSize: 16)),
                  SizedBox(height: 6),
                  Text('Start a website scrape or lead search first.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                ],
              ),
            )
          else
            ..._jobs.map((j) => _buildJobCard(j)),
        ],
      ),
    );
  }

  Widget _buildJobCard(JobModel job) {
    Color statusColor;
    if (job.status == 'completed') statusColor = AppColors.success;
    else if (job.status == 'failed') statusColor = AppColors.danger;
    else statusColor = AppColors.warning;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 12, offset: const Offset(0, 3))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppColors.surfaceElevated, borderRadius: BorderRadius.circular(8)),
                child: Text(job.mode.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.5)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: statusColor.withAlpha(20), borderRadius: BorderRadius.circular(8)),
                child: Text(job.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            job.url ?? job.query ?? 'Job #${job.id.substring(0, 8)}',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: job.progress / 100.0,
              backgroundColor: AppColors.surfaceElevated,
              valueColor: AlwaysStoppedAnimation<Color>(statusColor),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('ID: ${job.id.substring(0, 8)}...', style: const TextStyle(color: AppColors.textDim, fontSize: 11)),
              Text('${job.progress}%', style: const TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}
