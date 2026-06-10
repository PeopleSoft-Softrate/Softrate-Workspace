import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:io' show Platform;
import 'package:in_app_update/in_app_update.dart';
import 'package:hrmappfrontend/homeScreen.dart';
import 'package:hrmappfrontend/hr_pages/hrdash_board.dart';
import 'package:hrmappfrontend/intern/userdashboard.dart';
import 'package:hrmappfrontend/Employee/EmployeeDashboard.dart';

class SplashScreen extends StatefulWidget {
  final bool hrLoggedIn;
  final String? initialInternId;
  final bool employeeLoggedIn;
  final String? employeeId;

  const SplashScreen({
    super.key,
    required this.hrLoggedIn,
    this.initialInternId,
    required this.employeeLoggedIn,
    this.employeeId,
  });

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800), // Fade out duration
    );

    _fadeAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _checkForUpdatesAndProceed();
  }

  Future<void> _checkForUpdatesAndProceed() async {
    // 1. Check for Play Store Updates
    if (Platform.isAndroid) {
      try {
        final info = await InAppUpdate.checkForUpdate();
        if (info.updateAvailability == UpdateAvailability.updateAvailable) {
          await InAppUpdate.performImmediateUpdate();
        }
      } catch (e) {
        debugPrint("Update Check Failed: $e");
      }
    }

    final bool isUserLoggedIn = widget.hrLoggedIn || widget.employeeLoggedIn || widget.initialInternId != null;

    // Wait 2 seconds, then proceed
    Timer(const Duration(seconds: 2), () {
      if (mounted) {
        if (isUserLoggedIn) {
          _navigate();
        } else {
          _controller.forward().then((_) => _navigate());
        }
      }
    });
  }

  void _navigate() {
    if (!mounted) return;

    try {
      Widget initialScreen;
      bool isDashboard = false;

      if (widget.hrLoggedIn) {
        initialScreen = const HrdashBoard();
        isDashboard = true;
      } else if (widget.employeeLoggedIn && widget.employeeId != null) {
        initialScreen = Employeedashboard(employeeId: widget.employeeId!);
        isDashboard = true;
      } else if (widget.initialInternId != null) {
        initialScreen = const AttendancePage();
        isDashboard = true;
      } else {
        initialScreen = const homescreen();
      }

      if (isDashboard) {
        Navigator.pushReplacement(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) => initialScreen,
            transitionDuration: Duration.zero,
            reverseTransitionDuration: Duration.zero,
          ),
        );
      } else {
        Navigator.pushReplacement(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) => initialScreen,
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return FadeTransition(
                opacity: animation,
                child: child,
              );
            },
            transitionDuration: const Duration(milliseconds: 1000),
          ),
        );
      }
    } catch (e) {
      debugPrint("Splash Navigation Error: $e");
      // Fallback to Home if everything fails
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const homescreen()),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SizedBox.expand(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Image.asset(
            'assets/images/app_launch.png',
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) {
              return const Center(child: Icon(Icons.error));
            },
          ),
        ),
      ),
    );
  }
}
