import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../core/models/job_model.dart';

class SingleAnalysisScreen extends StatefulWidget {
  const SingleAnalysisScreen({super.key});

  @override
  State<SingleAnalysisScreen> createState() => _SingleAnalysisScreenState();
}

class _SingleAnalysisScreenState extends State<SingleAnalysisScreen> {
  final _urlController = TextEditingController();
  bool _isLoading = false;
  JobModel? _createdJob;

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _startAnalysis() async {
    String url = _urlController.text.trim();
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please enter a website URL'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          margin: const EdgeInsets.all(16),
        ),
      );
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://$url';
    setState(() { _isLoading = true; _createdJob = null; });
    try {
      final job = await ApiClient().createSingleJob(url);
      setState(() => _createdJob = job);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            margin: const EdgeInsets.all(16),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
      children: [
        const Text(
          'Deep-analyze\nany website.',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.text, height: 1.15, letterSpacing: -0.8),
        ),
        const SizedBox(height: 8),
        const Text(
          'Extract emails, phone numbers, tech stack & AI-qualified lead score from any company site.',
          style: TextStyle(fontSize: 13, color: AppColors.textMuted, height: 1.4),
        ),
        const SizedBox(height: 28),

        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 16, offset: const Offset(0, 4))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Target URL', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
              const SizedBox(height: 10),
              TextField(
                controller: _urlController,
                keyboardType: TextInputType.url,
                style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w500),
                decoration: const InputDecoration(
                  hintText: 'stripe.com or https://example.com',
                  prefixIcon: Icon(Icons.link_rounded, color: AppColors.textMuted, size: 20),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _isLoading ? null : _startAnalysis,
                style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                child: _isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.search_rounded, size: 20),
                          SizedBox(width: 10),
                          Text('Start Deep Analysis', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        ],
                      ),
              ),
            ],
          ),
        ),

        // Feature chips
        const SizedBox(height: 20),
        Wrap(
          spacing: 10, runSpacing: 10,
          children: [
            _featureChip(Icons.email_outlined, 'Email Extraction'),
            _featureChip(Icons.phone_outlined, 'Phone Finder'),
            _featureChip(Icons.code_rounded, 'Tech Stack'),
            _featureChip(Icons.star_outline_rounded, 'AI Lead Score'),
          ],
        ),

        if (_createdJob != null) ...[
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.success.withAlpha(13),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.success.withAlpha(60)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(color: AppColors.success.withAlpha(26), shape: BoxShape.circle),
                      child: const Icon(Icons.check_rounded, color: AppColors.success, size: 20),
                    ),
                    const SizedBox(width: 10),
                    const Text('Job Queued!', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.text)),
                  ],
                ),
                const SizedBox(height: 12),
                Text(_createdJob!.url ?? '', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.text, fontSize: 13)),
                const SizedBox(height: 4),
                const Text('The scraper is now scanning in the background. Check Results tab to monitor progress.', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _featureChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.primary, size: 14),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
        ],
      ),
    );
  }
}
