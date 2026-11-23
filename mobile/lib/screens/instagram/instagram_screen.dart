import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/models/instagram_account_model.dart';
import '../../core/theme/app_theme.dart';

class InstagramScreen extends StatefulWidget {
  const InstagramScreen({super.key});

  @override
  State<InstagramScreen> createState() => _InstagramScreenState();
}

class _InstagramScreenState extends State<InstagramScreen> {
  List<InstagramAccountModel> _accounts = [];
  bool _isLoading = true;

  // New Account Dialog Controllers
  final _usernameController = TextEditingController();
  final _cookieController = TextEditingController();

  // DM Dialog Controllers
  final _dmTargetController = TextEditingController();
  final _dmMessageController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchAccounts();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _cookieController.dispose();
    _dmTargetController.dispose();
    _dmMessageController.dispose();
    super.dispose();
  }

  Future<void> _fetchAccounts() async {
    setState(() => _isLoading = true);
    try {
      final accounts = await ApiClient().getInstagramAccounts();
      if (mounted) setState(() => _accounts = accounts);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showConnectSheet() {
    _usernameController.clear();
    _cookieController.clear();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Text(
                'Connect Instagram',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: AppColors.text,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Paste your Instagram session cookie to link the account.',
                style: TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _usernameController,
                decoration: const InputDecoration(
                  labelText: 'Instagram Username',
                  hintText: '@your_handle',
                  prefixIcon: Icon(Icons.alternate_email_rounded, color: AppColors.textMuted, size: 20),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _cookieController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Session Cookie (sessionid)',
                  hintText: 'Paste session cookie from browser',
                  prefixIcon: Padding(
                    padding: EdgeInsets.only(bottom: 48),
                    child: Icon(Icons.vpn_key_rounded, color: AppColors.textMuted, size: 20),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        final user = _usernameController.text.trim();
                        final cookie = _cookieController.text.trim();
                        if (user.isEmpty || cookie.isEmpty) return;

                        Navigator.pop(ctx);
                        try {
                          await ApiClient().connectInstagramAccount(username: user, cookie: cookie);
                          _fetchAccounts();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Account connected!'),
                                backgroundColor: AppColors.success,
                              ),
                            );
                          }
                        } catch (e) {
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger),
                            );
                          }
                        }
                      },
                      child: const Text('Connect'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSendDmSheet(InstagramAccountModel sender) {
    _dmTargetController.clear();
    _dmMessageController.clear();
    bool isGenerating = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: StatefulBuilder(
          builder: (context, setModalState) => Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Drag handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 24),
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.send_rounded, color: AppColors.primary, size: 18),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Send Direct Message',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: AppColors.text,
                              letterSpacing: -0.5,
                            ),
                          ),
                          Text(
                            'via @${sender.username}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: _dmTargetController,
                  decoration: const InputDecoration(
                    labelText: 'Target Instagram Handle',
                    hintText: 'target_business',
                    prefixIcon: Icon(Icons.alternate_email_rounded, color: AppColors.textMuted, size: 20),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _dmMessageController,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: 'Direct Message',
                    hintText: 'Hey! Loved your recent post...',
                  ),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    icon: const Icon(Icons.auto_awesome_rounded, color: AppColors.primary, size: 16),
                    label: isGenerating
                        ? const SizedBox(
                            height: 12,
                            width: 12,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                          )
                        : const Text('AI Draft Message',
                            style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.w700)),
                    onPressed: isGenerating
                        ? null
                        : () async {
                            final target = _dmTargetController.text.trim();
                            if (target.isEmpty) return;
                            setModalState(() => isGenerating = true);
                            try {
                              final aiMsg = await ApiClient().generateInstagramDM(username: target);
                              setModalState(() {
                                _dmMessageController.text = aiMsg;
                                isGenerating = false;
                              });
                            } catch (_) {
                              setModalState(() => isGenerating = false);
                            }
                          },
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () async {
                          final target = _dmTargetController.text.trim();
                          final msg = _dmMessageController.text.trim();
                          if (target.isEmpty || msg.isEmpty) return;

                          Navigator.pop(ctx);
                          try {
                            await ApiClient().sendInstagramDM(
                              targetUsername: target,
                              message: msg,
                              accountId: sender.id,
                            );
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('DM sent successfully!'),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            }
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger),
                              );
                            }
                          }
                        },
                        child: const Text('Send DM'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _fetchAccounts,
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          children: [
            // Header Card
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [
                  BoxShadow(color: AppColors.shadowColor, blurRadius: 16, offset: Offset(0, 4)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.bolt_rounded, color: AppColors.primary, size: 24),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Instagram Outreach',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: AppColors.text,
                                letterSpacing: -0.3,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Automated outreach & personalized DMs',
                              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _showConnectSheet,
                    style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_rounded, size: 20),
                        SizedBox(width: 8),
                        Text('Connect Instagram Account'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Section label
            Text(
              'Connected Accounts  •  ${_accounts.length}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.1,
                color: AppColors.textDim,
              ),
            ),
            const SizedBox(height: 12),

            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              )
            else if (_accounts.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: const [
                    BoxShadow(color: AppColors.shadowColor, blurRadius: 12, offset: Offset(0, 2)),
                  ],
                ),
                child: const Column(
                  children: [
                    Icon(Icons.person_add_alt_1_rounded, color: AppColors.textDim, size: 52),
                    SizedBox(height: 14),
                    Text(
                      'No accounts connected',
                      style: TextStyle(
                        color: AppColors.text,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Tap the button above to link an\nInstagram account for sending DMs.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.5),
                    ),
                  ],
                ),
              )
            else
              ..._accounts.map((acc) => _buildAccountCard(acc)),
          ],
        ),
      ),
    );
  }

  Widget _buildAccountCard(InstagramAccountModel acc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(color: AppColors.shadowColor, blurRadius: 12, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.alternate_email_rounded, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '@${acc.username}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.text),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: acc.isActive ? AppColors.success : AppColors.danger,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      acc.isActive ? 'Active & Ready' : 'Inactive',
                      style: TextStyle(
                        color: acc.isActive ? AppColors.success : AppColors.danger,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Send DM button
          Container(
            margin: const EdgeInsets.only(right: 4),
            decoration: BoxDecoration(
              color: AppColors.primaryLight,
              borderRadius: BorderRadius.circular(10),
            ),
            child: IconButton(
              icon: const Icon(Icons.send_rounded, color: AppColors.primary, size: 18),
              tooltip: 'Send DM',
              onPressed: () => _showSendDmSheet(acc),
            ),
          ),
          // Delete button
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFFEE2E2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: IconButton(
              icon: const Icon(Icons.delete_outline_rounded, color: AppColors.danger, size: 18),
              tooltip: 'Disconnect',
              onPressed: () async {
                try {
                  await ApiClient().deleteInstagramAccount(acc.id);
                  _fetchAccounts();
                } catch (_) {}
              },
            ),
          ),
        ],
      ),
    );
  }
}
