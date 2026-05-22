import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/splash_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final prefs = await SharedPreferences.getInstance();
  
  // Check saved HR / Intern login
  final hrLoggedIn = prefs.getBool("hr_logged_in") ?? false;
  final internId = prefs.getString('internId');
  final employeeLoggedIn = prefs.getBool("employeeLoggedIn") ?? false;
  final employeeId = prefs.getString("employeeId");

  runApp(MainApp(
    hrLoggedIn: hrLoggedIn,
    initialInternId: internId,
    employeeLoggedIn: employeeLoggedIn,
    employeeId: employeeId,
  ));
}

class MainApp extends StatelessWidget {
  final bool hrLoggedIn;
  final String? initialInternId;
  final bool employeeLoggedIn;
  final String? employeeId;

  const MainApp({
    super.key,
    required this.hrLoggedIn,
    this.initialInternId,
    required this.employeeLoggedIn,
    this.employeeId,
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
      ),
    );
  }
}
