import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:hrmappfrontend/hr_pages/hrdash_board.dart';
import 'package:hrmappfrontend/unified_login_page.dart';

class HrAuthCheck extends StatefulWidget {
  const HrAuthCheck({super.key});

  @override
  State<HrAuthCheck> createState() => _HrAuthCheckState();
}

class _HrAuthCheckState extends State<HrAuthCheck> {
  @override
  void initState() {
    super.initState();
    _checkHrLogin();
  }

  Future<void> _checkHrLogin() async {
    final prefs = await SharedPreferences.getInstance();
    final isLoggedIn = prefs.getBool("hr_logged_in") ?? false;

    if (!mounted) return;

    if (isLoggedIn) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const HrdashBoard()),
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
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
