import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../core/models/map_lead_model.dart';
import 'lead_detail_bottom_sheet.dart';

class GoogleMapLeadsScreen extends StatefulWidget {
  const GoogleMapLeadsScreen({super.key});

  @override
  State<GoogleMapLeadsScreen> createState() => _GoogleMapLeadsScreenState();
}

class _GoogleMapLeadsScreenState extends State<GoogleMapLeadsScreen> {
  final _queryController = TextEditingController();
  final _locationController = TextEditingController();
  bool _isSearching = false;
  bool _isLoadingLeads = true;
  List<MapLeadModel> _leads = [];

  @override
  void initState() {
    super.initState();
    _fetchLeads();
  }

  @override
  void dispose() {
    _queryController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  Future<void> _fetchLeads() async {
    setState(() => _isLoadingLeads = true);
    try {
      final leads = await ApiClient().getMapLeads();
      if (mounted) setState(() => _leads = leads);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoadingLeads = false);
    }
  }

  Future<void> _startSearch() async {
    final query = _queryController.text.trim();
    if (query.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Enter a business category or keyword'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          margin: const EdgeInsets.all(16),
        ),
      );
      return;
    }
    setState(() => _isSearching = true);
    try {
      final location = _locationController.text.trim();
      await ApiClient().startGoogleMapsJob(query: query, location: location.isNotEmpty ? location : null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Lead search started — results loading soon!'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            margin: const EdgeInsets.all(16),
          ),
        );
        _fetchLeads();
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
      if (mounted) setState(() => _isSearching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _fetchLeads,
      color: AppColors.primary,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        children: [
          // ── Header ───────────────────────────────────────
          const Text(
            'Find local businesses\nwith precision.',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: AppColors.text, height: 1.2, letterSpacing: -0.5),
          ),
          const SizedBox(height: 6),
          const Text(
            'Extract verified contacts & AI-qualified leads from Google Maps.',
            style: TextStyle(fontSize: 13, color: AppColors.textMuted),
          ),
          const SizedBox(height: 24),

          // ── Search Inputs ────────────────────────────────
          TextField(
            controller: _queryController,
            style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w500),
            decoration: const InputDecoration(
              hintText: 'Business type (e.g. Dentists, Roofers...)',
              prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _locationController,
            style: const TextStyle(color: AppColors.text, fontWeight: FontWeight.w500),
            decoration: const InputDecoration(
              hintText: 'City or area (e.g. New York, Dubai...)',
              prefixIcon: Icon(Icons.location_on_outlined, color: AppColors.textMuted, size: 20),
            ),
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: _isSearching ? null : _startSearch,
            style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            child: _isSearching
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.radar_rounded, size: 20),
                      SizedBox(width: 10),
                      Text('Discover Leads', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    ],
                  ),
          ),
          const SizedBox(height: 28),

          // ── Leads List ───────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'DISCOVERED (${_leads.length})',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3, color: AppColors.textDim),
              ),
              GestureDetector(
                onTap: _fetchLeads,
                child: const Icon(Icons.refresh_rounded, color: AppColors.textMuted, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (_isLoadingLeads)
            const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(color: AppColors.primary)))
          else if (_leads.isEmpty)
            _buildEmptyState()
          else
            ..._leads.map((l) => _buildLeadCard(l)),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(36),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 16, offset: const Offset(0, 4))],
      ),
      child: const Column(
        children: [
          Icon(Icons.travel_explore_rounded, color: AppColors.textDim, size: 52),
          SizedBox(height: 14),
          Text('No leads yet', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.text, fontSize: 16)),
          SizedBox(height: 6),
          Text(
            'Enter a business type and location above to discover leads.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildLeadCard(MapLeadModel lead) {
    return GestureDetector(
      onTap: () => LeadDetailBottomSheet.show(context, lead),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(lead.businessName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.text)),
                      if (lead.category != null) ...[
                        const SizedBox(height: 2),
                        Text(lead.category!, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ],
                  ),
                ),
                if (lead.rating != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: AppColors.warning.withAlpha(20), borderRadius: BorderRadius.circular(10)),
                    child: Row(
                      children: [
                        const Icon(Icons.star_rounded, color: AppColors.warning, size: 14),
                        const SizedBox(width: 3),
                        Text('${lead.rating}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.text)),
                      ],
                    ),
                  ),
              ],
            ),
            if (lead.phone != null || lead.email != null || lead.emails.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  if (lead.phone != null && lead.phone!.isNotEmpty) _chip(Icons.phone_rounded, lead.phone!, AppColors.success),
                  if (lead.email != null && lead.email!.isNotEmpty) _chip(Icons.email_rounded, lead.email!, AppColors.info)
                  else if (lead.emails.isNotEmpty) _chip(Icons.email_rounded, '${lead.emails.length} emails', AppColors.info),
                  if (lead.website != null && lead.website!.isNotEmpty) _chip(Icons.language_rounded, 'Website', AppColors.primary),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _chip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withAlpha(20), borderRadius: BorderRadius.circular(10)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 12),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
