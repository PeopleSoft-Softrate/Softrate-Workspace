import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/Employee/EmployeeDashboard.dart';
import 'package:hrmappfrontend/unified_login_page.dart';

class EmployeeAuthCheck extends StatefulWidget {
  const EmployeeAuthCheck({super.key});

  @override
  State<EmployeeAuthCheck> createState() => _EmployeeAuthCheckState();
}

class _EmployeeAuthCheckState extends State<EmployeeAuthCheck> {

  @override
  void initState() {
    super.initState();
    _checkEmployeeAuth();
  }

  Future<void> _checkEmployeeAuth() async {
    final prefs = await SharedPreferences.getInstance();

    final bool isLoggedIn =
        prefs.getBool('employeeLoggedIn') ?? false;
    final String? employeeId =
        prefs.getString('employeeId');

    if (isLoggedIn && employeeId != null) {
      // ✅ Auto redirect to dashboard
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => Employeedashboard(
            employeeId: employeeId,
          ),
        ),
      );
    } else {
      // ❌ Not logged in → Login page
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => const UnifiedLoginPage(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Simple loader while checking auth
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
