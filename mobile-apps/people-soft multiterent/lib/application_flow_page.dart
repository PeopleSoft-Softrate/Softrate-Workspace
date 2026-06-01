import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:hrmappfrontend/intern/form_one.dart';
import 'package:hrmappfrontend/Employee/employee_formone.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;

class ApplicationFlowPage extends StatefulWidget {
  const ApplicationFlowPage({super.key});

  @override
  State<ApplicationFlowPage> createState() => _ApplicationFlowPageState();
}

class _ApplicationFlowPageState extends State<ApplicationFlowPage> {
  final PageController _pageController = PageController();
  int _currentStep = 0;

  // Step 1: Company Code
  final TextEditingController _codeController = TextEditingController();
  bool _isVerifying = false;
  bool _isVerified = false;
  String? _companyName;
  String? _errorText;

  // Step 2: Role Selection
  String? _selectedRole; // 'Intern' or 'Job'

  final Color _primaryColor = const Color(0xFF00657F);
  final String _baseUrl = getBaseUrl();

  Future<void> _verifyCompany() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      setState(() {
        _errorText = "Enter the company code and try again";
      });
      return;
    }

    setState(() {
      _isVerifying = true;
      _isVerified = false;
      _companyName = null;
      _errorText = null;
    });

    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/onboarding/verify/$code'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          HapticFeedback.lightImpact();
          setState(() {
            _isVerified = true;
            _companyName = data['company']['name'];
          });
        }
      } else {
        if (!mounted) return;
        setState(() {
          _errorText = "Invalid Company Code";
        });
      }
    } catch (e) {
      debugPrint("Verify error: $e");
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  void _nextPage() {
    if (_currentStep < 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
      setState(() => _currentStep++);
    } else {
      // Final Navigation
      if (_selectedRole == 'Intern') {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => FormOne(
              companyCode: _codeController.text.trim(),
              companyName: _companyName,
            ),
          ),
        );
      } else {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => EmployeeFormOne(
              companyCode: _codeController.text.trim(),
              companyName: _companyName,
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      floatingActionButton: (_currentStep > 0 && canProceed)
          ? FloatingActionButton(
              onPressed: _nextPage,
              backgroundColor: _primaryColor,
              foregroundColor: Colors.white,
              elevation: 4,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.arrow_forward_rounded, size: 28),
            )
          : null,
      body: Stack(
        children: [
          // Gradient background like sign-in page
          Container(
            width: size.width,
            height: size.height,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Color(0xFFFFA726), // orange
                  Color(0xFF8ED1DC), // light teal
                  Color(0xFF00657F), // dark teal
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),

          SafeArea(
            bottom: false,
            child: Column(
              children: [
                // ── Header ──────────────────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(10, 24, 10, 0),
                  child: Row(
                    children: [
                      IconButton(
                        icon: _buildIcon(
                          HugeIcons.strokeRoundedArrowLeft01,
                          color: Colors.white,
                          size: 24,
                        ),
                        onPressed: () {
                          if (_currentStep > 0) {
                            _pageController.previousPage(
                              duration: const Duration(milliseconds: 400),
                              curve: Curves.easeInOut,
                            );
                            setState(() => _currentStep--);
                          } else {
                            Navigator.pop(context);
                          }
                        },
                      ),
                      Expanded(
                        child: Center(
                          child: Text(
                            _currentStep == 0
                                ? "Company Code"
                                : "Application Type",
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _currentStep == 0
                      ? 'Verify your organization code to continue.'
                      : 'Choose your desired role to proceed.',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.9),
                    fontSize: 14,
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 40),

                // ── Form Card with curved borders ───────────────────────────────
                Expanded(
                  child: Container(
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF5F1ED),
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(30),
                      ),
                    ),
                    child: Column(
                      children: [
                        Expanded(
                          child: PageView(
                            controller: _pageController,
                            physics: const NeverScrollableScrollPhysics(),
                            children: [_buildStep1(), _buildStep2()],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep1() {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            // MNC Style Stepper - Step 1
            Row(
              children: [
                _buildMncStep(1, "Verification", !_isVerified, _isVerified),
                _buildMncDivider(_isVerified),
                _buildMncStep(2, "Role", _isVerified, false),
                _buildMncDivider(false),
                _buildMncStep(3, "Form", false, false),
              ],
            ),
            const SizedBox(height: 32),
            const Text(
              "Enter Company Code",
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1A1A1A),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              "Please provide your corporate access code to authenticate with your organization's portal.",
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            // Form Section
            Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  TextField(
                    controller: _codeController,
                    onChanged: (v) {
                      if (_errorText != null) {
                        setState(() => _errorText = null);
                      }
                    },
                    style: const TextStyle(fontWeight: FontWeight.w600),
                    decoration: InputDecoration(
                      hintText: "Enter Company Code",
                      hintStyle: TextStyle(
                        color: Colors.black.withOpacity(0.3),
                        fontSize: 15,
                        fontWeight: FontWeight.w400,
                      ),
                      prefixIcon: Padding(
                        padding: const EdgeInsets.only(left: 16, right: 12),
                        child: _buildIcon(
                          HugeIcons.strokeRoundedPasswordValidation,
                          color: _primaryColor,
                          size: 24, // Resetting to a more balanced 24px
                        ),
                      ),
                      prefixIconConstraints: const BoxConstraints(
                        minWidth: 0,
                        minHeight: 0,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        vertical: 18,
                        horizontal: 16,
                      ),
                    ),
                  ),
                  if (_errorText != null) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline_rounded,
                            color: Colors.red,
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorText!,
                              style: const TextStyle(
                                color: Colors.red,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (_isVerified) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.verified_user_rounded,
                            color: Color.fromARGB(255, 49, 110, 51),
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              "Connected to $_companyName",
                              style: const TextStyle(
                                color: Color.fromARGB(255, 49, 110, 51),
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const Divider(height: 1, color: Color(0xFFF0F0F0)),
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _isVerifying
                            ? null
                            : (_isVerified ? _nextPage : _verifyCompany),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isVerified
                              ? const Color.fromARGB(255, 49, 110, 51)
                              : _primaryColor,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: _isVerifying
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                _isVerified ? "Continue" : "Verify Code",
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildMncStep(int num, String label, bool isActive, bool isCompleted) {
    Color color = isCompleted
        ? Color.fromARGB(255, 49, 110, 51)
        : (isActive ? _primaryColor : Colors.grey.shade400);

    return SizedBox(
      width: 70, // Fixed width to ensure centering of the Row
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: isCompleted
                  ? Color.fromARGB(255, 49, 110, 51)
                  : (isActive ? _primaryColor : Colors.white),
              shape: BoxShape.circle,
              border: Border.all(
                color: isCompleted
                    ? Color.fromARGB(255, 49, 110, 51)
                    : (isActive ? _primaryColor : Colors.grey.shade300),
                width: 1.5,
              ),
            ),
            child: Center(
              child: isCompleted
                  ? const Icon(Icons.check, color: Colors.white, size: 16)
                  : Text(
                      num.toString(),
                      style: TextStyle(
                        color: isActive ? Colors.white : Colors.grey.shade400,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.visible,
            style: TextStyle(
              fontSize: 10,
              color: isCompleted
                  ? Color.fromARGB(255, 49, 110, 51)
                  : (isActive ? _primaryColor : Colors.grey.shade400),
              fontWeight: (isActive || isCompleted)
                  ? FontWeight.w700
                  : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMncDivider(bool isCompleted) {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.only(bottom: 20, left: 4, right: 4),
        decoration: BoxDecoration(
          color: isCompleted
              ? Color.fromARGB(255, 49, 110, 51)
              : Colors.grey.shade200,
          borderRadius: BorderRadius.circular(1),
        ),
      ),
    );
  }

  Widget _buildStep2() {
    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            // MNC Style Stepper - Step 2
            Row(
              children: [
                _buildMncStep(1, "Verification", false, true),
                _buildMncDivider(true),
                _buildMncStep(
                  2,
                  "Role",
                  _selectedRole == null,
                  _selectedRole != null,
                ),
                _buildMncDivider(_selectedRole != null),
                _buildMncStep(3, "Form", _selectedRole != null, false),
              ],
            ),
            const SizedBox(height: 32),
            const Text(
              "Select Role Type",
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: Color(0xFF003D4D),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              "Which application type best describes you?",
              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
            ),
            const SizedBox(height: 32),
            _buildRoleCard(
              title: "Internship",
              subtitle: "For students seeking learning opportunities.",
              role: "Intern",
              icon: Icons.school_rounded,
            ),
            const SizedBox(height: 16),
            _buildRoleCard(
              title: "Full-Time Job",
              subtitle: "For professionals seeking career growth.",
              role: "Job",
              icon: Icons.work_history_rounded,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleCard({
    required String title,
    required String subtitle,
    required String role,
    required dynamic icon,
  }) {
    bool isSelected = _selectedRole == role;
    return GestureDetector(
      onTap: () => setState(() => _selectedRole = role),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.white.withOpacity(0.5),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? _primaryColor : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: _primaryColor.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected ? _primaryColor : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(14),
              ),
              child: _buildIcon(
                icon,
                color: isSelected ? Colors.white : Colors.black54,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? _primaryColor : Colors.black,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            if (isSelected)
              Icon(Icons.check_circle_rounded, color: _primaryColor, size: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildIcon(dynamic icon, {Color? color, double size = 24}) {
    if (icon is IconData) {
      return Icon(icon, color: color, size: size);
    } else {
      // Use the helper logic similar to unified_login_page if needed,
      // but here we know standard icons work or HugeIcons widget handles it.
      return HugeIcon(icon: icon, color: color ?? Colors.black, size: size);
    }
  }

  bool get canProceed =>
      (_currentStep == 0 && _isVerified) ||
      (_currentStep == 1 && _selectedRole != null);
}
