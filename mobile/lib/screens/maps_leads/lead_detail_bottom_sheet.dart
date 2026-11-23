import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/models/map_lead_model.dart';
import '../../core/theme/app_theme.dart';

class LeadDetailBottomSheet extends StatelessWidget {
  final MapLeadModel lead;
  const LeadDetailBottomSheet({super.key, required this.lead});

  static void show(BuildContext context, MapLeadModel lead) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => LeadDetailBottomSheet(lead: lead),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 14, bottom: 10),
            width: 44, height: 4,
            decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(4)),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
            child: Row(
              children: [
                Container(
                  width: 52, height: 52,
                  decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
                  child: const Icon(Icons.business_rounded, color: AppColors.primary, size: 26),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(lead.businessName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.text, letterSpacing: -0.3)),
                      if (lead.category != null)
                        Text(lead.category!, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(lead.leadScore, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11)),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // Content
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
              children: [
                if (lead.rating != null) ...[
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, color: AppColors.warning, size: 20),
                      const SizedBox(width: 6),
                      Text('${lead.rating}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.text)),
                      if (lead.reviews != null) Text(' (${lead.reviews} reviews)', style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 20),
                ],

                _infoCard('Contact Information', [
                  if (lead.phone != null && lead.phone!.isNotEmpty) _row(context, Icons.phone_outlined, 'Phone', lead.phone!),
                  if (lead.email != null && lead.email!.isNotEmpty) _row(context, Icons.email_outlined, 'Email', lead.email!),
                  if (lead.whatsapp != null && lead.whatsapp!.isNotEmpty) _row(context, Icons.chat_outlined, 'WhatsApp', lead.whatsapp!),
                  ...lead.emails.map((e) => _row(context, Icons.alternate_email_rounded, 'Email', e)),
                ]),
                const SizedBox(height: 14),

                _infoCard('Online & Location', [
                  if (lead.website != null && lead.website!.isNotEmpty) _row(context, Icons.language_rounded, 'Website', lead.website!),
                  if (lead.address != null && lead.address!.isNotEmpty) _row(context, Icons.location_on_outlined, 'Address', lead.address!),
                ]),

                if (lead.aiSummary != null && lead.aiSummary!.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  _infoCard('AI Intelligence', [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text(lead.aiSummary!, style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.4)),
                    ),
                    if (lead.recommendedService != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(14)),
                        child: Row(
                          children: [
                            const Icon(Icons.lightbulb_outline, color: AppColors.primary, size: 18),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text('Pitch: ${lead.recommendedService}', style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ]),
                ],
              ],
            ),
          ),

          // Footer
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
            child: OutlinedButton(
              onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
              child: const Text('Close Dossier', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 12, offset: const Offset(0, 3))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3, color: AppColors.textDim)),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _row(BuildContext context, IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: AppColors.primary, size: 16),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textDim, fontWeight: FontWeight.w600)),
                Text(value, style: const TextStyle(fontSize: 13, color: AppColors.text, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          GestureDetector(
            onTap: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Copied!'),
                  backgroundColor: AppColors.success,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  margin: const EdgeInsets.all(16),
                  duration: const Duration(seconds: 1),
                ),
              );
            },
            child: const Icon(Icons.copy_rounded, color: AppColors.textDim, size: 16),
          ),
        ],
      ),
    );
  }
}
