import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/manager/manager_dashboard.dart';
import 'package:hrmappfrontend/unified_login_page.dart';

class ManagerAuthCheck extends StatefulWidget {
  const ManagerAuthCheck({super.key});

  @override
  State<ManagerAuthCheck> createState() => _ManagerAuthCheckState();
}

class _ManagerAuthCheckState extends State<ManagerAuthCheck> {
  @override
  void initState() {
    super.initState();
    _checkManagerLogin();
  }

  Future<void> _checkManagerLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final isLoggedIn = prefs.getBool("manager_logged_in") ?? false;

    if (!mounted) return;

    if (isLoggedIn) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const ManagerDashboard()),
        (route) => false,
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const UnifiedLoginPage()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator(color: Color(0xFF00657F))),
    );
  }
}
