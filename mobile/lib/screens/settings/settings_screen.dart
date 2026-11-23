import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/storage/auth_storage.dart';
import '../../core/models/user_model.dart';
import '../auth/login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  UserModel? _user;
  String _baseUrl = '';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final user = await AuthStorage.getUser();
    final url = await AuthStorage.getBaseUrl();
    if (mounted) setState(() { _user = user; _baseUrl = url; });
  }

  void _editServerUrl() {
    final controller = TextEditingController(text: _baseUrl);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(left: 24, right: 24, top: 24, bottom: MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 44, height: 4, decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(4)))),
            const SizedBox(height: 20),
            const Text('Backend API Endpoint', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text)),
            const SizedBox(height: 6),
            const Text('Switch between Render cloud or local dev', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
            const SizedBox(height: 20),
            TextField(controller: controller, decoration: const InputDecoration(hintText: 'https://...onrender.com/api/v1')),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () async {
                final url = controller.text.trim();
                if (url.isNotEmpty) {
                  await AuthStorage.saveBaseUrl(url);
                  setState(() => _baseUrl = url);
                  Navigator.pop(ctx);
                }
              },
              style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
              child: const Text('Save URL'),
            ),
          ],
        ),
      ),
    );
  }

  void _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.text)),
        content: const Text('Are you sure you want to end your active session?', style: TextStyle(color: AppColors.textMuted)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await AuthStorage.clearAuth();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (r) => false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final initials = (_user?.fullName?.isNotEmpty == true
        ? _user!.fullName![0]
        : (_user?.email.isNotEmpty == true ? _user!.email[0] : 'U')).toUpperCase();

    return Scaffold(
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        children: [
          // Profile Card
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: Colors.white.withAlpha(50),
                  child: Text(initials, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900)),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _user?.fullName ?? 'User',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white),
                      ),
                      const SizedBox(height: 4),
                      Text(_user?.email ?? '', style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(200))),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(color: Colors.white.withAlpha(50), borderRadius: BorderRadius.circular(20)),
                        child: Text((_user?.role ?? 'PRO').toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),

          _buildSectionLabel('CONFIGURATION'),
          _buildTile(icon: Icons.cloud_outlined, title: 'Backend API Endpoint', subtitle: _baseUrl.isEmpty ? 'Not configured' : _baseUrl, onTap: _editServerUrl),

          const SizedBox(height: 20),
          _buildSectionLabel('APP INFO'),
          _buildTile(icon: Icons.shield_outlined, title: 'Security', subtitle: 'JWT Bearer Authorization'),
          _buildTile(icon: Icons.palette_outlined, title: 'Theme', subtitle: 'Clean Minimal — Light Mode'),
          _buildTile(icon: Icons.info_outline, title: 'Version', subtitle: 'v1.0.0 — DataFlow Mobile'),

          const SizedBox(height: 28),
          GestureDetector(
            onTap: _handleLogout,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: AppColors.danger.withAlpha(13),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.danger.withAlpha(50)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.logout_rounded, color: AppColors.danger, size: 20),
                  SizedBox(width: 10),
                  Text('Sign Out', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700, fontSize: 15)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, left: 4),
      child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.3, color: AppColors.textDim)),
    );
  }

  Widget _buildTile({required IconData icon, required String title, required String subtitle, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [BoxShadow(color: AppColors.shadowColor, blurRadius: 12, offset: const Offset(0, 3))],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, color: AppColors.primary, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.text)),
                  const SizedBox(height: 2),
                  Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ),
            if (onTap != null) const Icon(Icons.chevron_right_rounded, color: AppColors.textDim, size: 20),
          ],
        ),
      ),
    );
  }
}
