import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/unified_login_page.dart';
import 'package:hrmappfrontend/application_flow_page.dart';

class homescreen extends StatefulWidget {
  const homescreen({super.key});

  @override
  State<homescreen> createState() => _homescreenState();
}

class _homescreenState extends State<homescreen> {
  @override
  Widget build(BuildContext context) {
    // Get screen dimensions for adaptive sizing
    final size = MediaQuery.of(context).size;
    final h = size.height;
    final w = size.width;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Stack(
          children: [
            // Main Scrollable Content
            SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 10,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                        SizedBox(height: h * 0.105),
                        // Square Banner Image
                        Container(
                          height:
                              w - 48, // Perfectly square (width minus padding)
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),

                            image: const DecorationImage(
                              image: AssetImage(
                                'assets/images/profilebanner.jpg',
                              ),
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),

                        SizedBox(height: h * 0.035),

                        // Title Section
                        Text(
                          'Start Your Corporate \nJourney at Softrate',
                          style: TextStyle(
                            fontSize: w < 360 ? 30 : 32,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF1A1A1A),
                            height: 1.15,
                            letterSpacing: -0.5,
                          ),
                        ),

                        SizedBox(height: h * 0.025),

                        // Subtitle
                        Text(
                          'Build real-world experience and gain industry exposure in a people-first company that values growth and collaboration.',
                          style: TextStyle(
                            fontSize: w < 360 ? 14 : 16,
                            color: Colors.grey.shade600,
                            height: 1.4,
                          ),
                        ),

                        SizedBox(height: h * 0.03),

                        // Action Buttons section (Bottom-anchored via Spacer)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              ElevatedButton(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => const ApplicationFlowPage(),
                                    ),
                                  );
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF00657F),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 18,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  elevation: 0,
                                ),
                                child: const Text(
                                  'Apply Now',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 18),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Already applied? ',
                                    style: TextStyle(
                                      color: Colors.grey.shade600,
                                      fontSize: 15,
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) =>
                                              const UnifiedLoginPage(),
                                        ),
                                      );
                                    },
                                    child: const Text(
                                      'Sign In',
                                      style: TextStyle(
                                        color: Color(0xFF00657F),
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
            ),

            // Company Tagline (Top Right)
            Positioned(
              top: h * 0.08,
              right: 24,
              child: Container(
                height:
                    44, // Matches toggle tab height for perfect vertical alignment
                alignment: Alignment.centerRight,
                child: Text(
                  '#PeopleFirstCompany',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: Colors.grey.shade400,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleIcon({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Icon(icon, color: Colors.white, size: 22),
      ),
    );
  }
}
