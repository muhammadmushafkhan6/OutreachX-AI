import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../core/models/job_model.dart';

class BulkUploadScreen extends StatefulWidget {
  const BulkUploadScreen({super.key});

  @override
  State<BulkUploadScreen> createState() => _BulkUploadScreenState();
}

class _BulkUploadScreenState extends State<BulkUploadScreen> {
  final _urlsController = TextEditingController();
  bool _isLoading = false;
  JobModel? _createdJob;

  @override
  void dispose() {
    _urlsController.dispose();
    super.dispose();
  }

  Future<void> _startBulkJob() async {
    final text = _urlsController.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please enter at least one URL'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          margin: const EdgeInsets.all(16),
        ),
      );
      return;
    }
    final urls = text.split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .map((l) => (l.startsWith('http://') || l.startsWith('https://')) ? l : 'https://$l')
        .toList();

    setState(() { _isLoading = true; _createdJob = null; });
    try {
      final job = await ApiClient().createBulkJob(urls);
      setState(() => _createdJob = job);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${urls.length} websites queued for scraping!'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            margin: const EdgeInsets.all(16),
          ),
        );
      }
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
          'Batch scrape\nhundreds of sites.',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: AppColors.text, height: 1.15, letterSpacing: -0.8),
        ),
        const SizedBox(height: 8),
        const Text(
          'Paste a list of website URLs — the AI engine extracts all data in parallel.',
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
              const Text('Website URLs — one per line', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textMuted)),
              const SizedBox(height: 10),
              TextField(
                controller: _urlsController,
                maxLines: 7,
                style: const TextStyle(color: AppColors.text, fontFamily: 'monospace', fontSize: 13, fontWeight: FontWeight.w500),
                decoration: const InputDecoration(
                  hintText: 'stripe.com\nshopify.com\nuber.com\nairbnb.com',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _isLoading ? null : _startBulkJob,
                style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                child: _isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.bolt_rounded, size: 20),
                          SizedBox(width: 10),
                          Text('Queue Bulk Scrape', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        ],
                      ),
              ),
            ],
          ),
        ),

        if (_createdJob != null) ...[
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.success.withAlpha(13),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.success.withAlpha(60)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: AppColors.success.withAlpha(26), shape: BoxShape.circle),
                  child: const Icon(Icons.check_rounded, color: AppColors.success, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Batch Queued!', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
                      Text('Targets: ${_createdJob!.totalUrls ?? "Multiple"} · Status: ${_createdJob!.status}',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
