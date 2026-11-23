import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';
import '../core/storage/auth_storage.dart';
import 'dashboard/dashboard_screen.dart';
import 'website_analysis/single_analysis_screen.dart';
import 'maps_leads/google_map_leads_screen.dart';
import 'bulk_upload/bulk_upload_screen.dart';
import 'results/results_screen.dart';
import 'instagram/instagram_screen.dart';
import 'settings/settings_screen.dart';
import 'billing/billing_screen.dart';
import 'auth/login_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  final List<String> _titles = [
    'Dashboard',
    'Website Analysis',
    'Google Map Leads',
    'Bulk CSV Scraper',
    'Instagram Outreach',
    'Pipeline Results',
    'Billing & Tiers',
    'Settings',
  ];

  void _onSelectTab(int index) {
    setState(() => _currentIndex = index);
  }

  Widget _getCurrentScreen() {
    switch (_currentIndex) {
      case 0:
        return DashboardScreen(onNavigateTab: _onSelectTab);
      case 1:
        return const SingleAnalysisScreen();
      case 2:
        return const GoogleMapLeadsScreen();
      case 3:
        return const BulkUploadScreen();
      case 4:
        return const InstagramScreen();
      case 5:
        return const ResultsScreen();
      case 6:
        return const BillingScreen();
      case 7:
        return const SettingsScreen();
      default:
        return DashboardScreen(onNavigateTab: _onSelectTab);
    }
  }

  // Maps bottom navigation bar index (0..4) to screen index
  int _bottomNavIndex() {
    if (_currentIndex == 0) return 0; // Dashboard
    if (_currentIndex == 2) return 1; // Map Leads
    if (_currentIndex == 1) return 2; // Analyze
    if (_currentIndex == 5) return 3; // Results
    if (_currentIndex == 7) return 4; // Settings
    return 0; // Fallback
  }

  void _onBottomNavTapped(int navIndex) {
    switch (navIndex) {
      case 0:
        _onSelectTab(0); // Dashboard
        break;
      case 1:
        _onSelectTab(2); // Map Leads
        break;
      case 2:
        _onSelectTab(1); // Analyze
        break;
      case 3:
        _onSelectTab(5); // Results
        break;
      case 4:
        _onSelectTab(7); // Settings
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // Leading hamburger menu opens drawer
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu_rounded, color: AppColors.text),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.flash_on_rounded, color: AppColors.primary, size: 18),
            ),
            const SizedBox(width: 10),
            Text(_titles[_currentIndex]),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: IconButton(
              icon: const Icon(Icons.tune_rounded, color: AppColors.textMuted),
              tooltip: 'Settings',
              onPressed: () => _onSelectTab(7),
            ),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: AppColors.border),
        ),
      ),
      drawer: Drawer(
        backgroundColor: AppColors.surface,
        child: Column(
          children: [
            // Drawer Header — clean white with purple accent
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 56, 20, 20),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(bottom: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: const [
                        BoxShadow(color: AppColors.neonGlow, blurRadius: 16, offset: Offset(0, 4)),
                      ],
                    ),
                    child: const Icon(Icons.flash_on_rounded, color: Colors.white, size: 26),
                  ),
                  const SizedBox(width: 14),
                  const Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'DataFlow AI',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: AppColors.text,
                          letterSpacing: -0.5,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'B2B Growth Engine',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Navigation Items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                children: [
                  _buildDrawerItem(Icons.dashboard_rounded, 'Dashboard', 0),
                  _buildDrawerItem(Icons.language_rounded, 'Website Analysis', 1),
                  _buildDrawerItem(Icons.map_rounded, 'Google Map Leads', 2),
                  _buildDrawerItem(Icons.upload_file_rounded, 'Bulk CSV', 3),
                  _buildDrawerItem(Icons.bolt_rounded, 'Instagram', 4),
                  _buildDrawerItem(Icons.description_rounded, 'Results', 5),
                  const SizedBox(height: 8),
                  const Divider(color: AppColors.border),
                  const SizedBox(height: 8),
                  _buildDrawerItem(Icons.credit_card_rounded, 'Billing', 6),
                  _buildDrawerItem(Icons.settings_rounded, 'Settings', 7),
                ],
              ),
            ),

            // Sign Out
            const Divider(color: AppColors.border, height: 1),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              child: ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                leading: const Icon(Icons.logout_rounded, color: AppColors.danger, size: 20),
                title: const Text(
                  'Sign Out',
                  style: TextStyle(
                    color: AppColors.danger,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                onTap: () async {
                  await AuthStorage.clearAuth();
                  if (mounted) {
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                      (route) => false,
                    );
                  }
                },
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
      body: _getCurrentScreen(),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: BottomNavigationBar(
          currentIndex: _bottomNavIndex(),
          onTap: _onBottomNavTapped,
          elevation: 0,
          backgroundColor: Colors.transparent,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_rounded),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.map_rounded),
              label: 'Map Leads',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.language_rounded),
              label: 'Analyze',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.description_rounded),
              label: 'Results',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.settings_rounded),
              label: 'Settings',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerItem(IconData icon, String title, int index) {
    final isSelected = _currentIndex == index;
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.primaryLight : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListTile(
        dense: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        leading: Icon(
          icon,
          color: isSelected ? AppColors.primary : AppColors.textMuted,
          size: 20,
        ),
        title: Text(
          title,
          style: TextStyle(
            color: isSelected ? AppColors.primary : AppColors.text,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
            fontSize: 14,
          ),
        ),
        trailing: isSelected
            ? Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              )
            : null,
        onTap: () {
          Navigator.pop(context); // close drawer
          _onSelectTab(index);
        },
      ),
    );
  }
}
