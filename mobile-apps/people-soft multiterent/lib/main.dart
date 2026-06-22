import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/splash_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final prefs = await SharedPreferences.getInstance();
  
  // Check saved HR / Intern login — require BOTH the ID and the logged-in flag
  final hrLoggedIn = prefs.getBool("hr_logged_in") ?? false;
  final internLoggedIn = prefs.getBool("internLoggedIn") ?? false;
  final internId = prefs.getString('internId');
  final employeeLoggedIn = prefs.getBool("employeeLoggedIn") ?? false;
  final employeeId = prefs.getString("employeeId");
  final managerLoggedIn = prefs.getBool("manager_logged_in") ?? false;

  runApp(MainApp(
    hrLoggedIn: hrLoggedIn,
    // Only pass IDs if actually logged in (prevents device-mismatch redirect loop)
    initialInternId: internLoggedIn ? internId : null,
    employeeLoggedIn: employeeLoggedIn && !managerLoggedIn,
    employeeId: employeeId ?? prefs.getString('manager_id'),
    managerLoggedIn: managerLoggedIn,
  ));
}

class MainApp extends StatelessWidget {
  final bool hrLoggedIn;
  final String? initialInternId;
  final bool employeeLoggedIn;
  final String? employeeId;
  final bool managerLoggedIn;

  const MainApp({
    super.key,
    required this.hrLoggedIn,
    this.initialInternId,
    required this.employeeLoggedIn,
    this.employeeId,
    required this.managerLoggedIn,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      home: SplashScreen(
        hrLoggedIn: hrLoggedIn,
        initialInternId: initialInternId,
        employeeLoggedIn: employeeLoggedIn,
        employeeId: employeeId,
        managerLoggedIn: managerLoggedIn,
      ),
    );
  }
}
