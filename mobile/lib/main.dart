import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/theme/app_theme.dart';
import 'core/storage/auth_storage.dart';
import 'screens/auth/login_screen.dart';
import 'screens/main_navigation_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: AppColors.surface,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  final isAuth = await AuthStorage.isAuthenticated();
  runApp(DataFlowMobileApp(isAuthenticated: isAuth));
}

class DataFlowMobileApp extends StatelessWidget {
  final bool isAuthenticated;
  const DataFlowMobileApp({super.key, required this.isAuthenticated});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DataFlow AI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: isAuthenticated ? const MainNavigationScreen() : const LoginScreen(),
    );
  }
}
