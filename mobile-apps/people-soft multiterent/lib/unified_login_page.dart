import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/Employee/EmployeeDashboard.dart';
import 'package:hrmappfrontend/intern/userdashboard.dart';
import 'package:hrmappfrontend/hr_pages/hrdash_board.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/homeScreen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:hrmappfrontend/utils/device_info_helper.dart';
import 'package:hrmappfrontend/device_mismatch_page.dart';
import 'package:hrmappfrontend/device_mismatch_page.dart';
import 'package:hrmappfrontend/force_password_reset_page.dart';
import 'package:hrmappfrontend/Employee/employee_complete_details.dart';
import 'package:hrmappfrontend/manager/manager_dashboard.dart';

class UnifiedLoginPage extends StatefulWidget {
  const UnifiedLoginPage({super.key});

  @override
  State<UnifiedLoginPage> createState() => _UnifiedLoginPageState();
}

class _UnifiedLoginPageState extends State<UnifiedLoginPage>
    with SingleTickerProviderStateMixin {
  final TextEditingController _companyCtrl = TextEditingController();
  final TextEditingController _idCtrl = TextEditingController();
  final TextEditingController _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _loading = false;
  bool _obscure = true;
  String _errorMsg = '';

  final String _baseUrl = getBaseUrl();

  // ── Login ──────────────────────────────────────────────────────────────────
  Future<void> _login() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _errorMsg = '';
    });

    final String enteredId = _idCtrl.text.trim().toLowerCase();
    final String enteredPass = _passCtrl.text.trim();

    // ── Test/Review Accounts Bypass ──────────────────────────────────────────
    if ((enteredId == 'testintern@softrate.com' && enteredPass == 'Test@1234') ||
        (enteredId == 'test@peoplesoft' && enteredPass == '123456')) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', 'mock_token_123');
      await prefs.setString('user_role', 'intern');
      await prefs.setString('internId', 'test_intern_id');
      await prefs.setString('internMongoId', 'mock_mongo_id_intern');
      setState(() => _loading = false);
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const AttendancePage()),
      );
      return;
    }

    if (enteredId == 'testemployee@softrate.com' && enteredPass == 'Test@1234') {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', 'mock_token_123');
      await prefs.setString('user_role', 'employee');
      await prefs.setString('employeeId', 'test_employee_id');
      await prefs.setString('employeeMongoId', 'mock_mongo_id_employee');
      await prefs.setBool('employeeLoggedIn', true);
      setState(() => _loading = false);
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => const Employeedashboard(employeeId: 'test_employee_id'),
        ),
      );
      return;
    }

    try {
      final url = Uri.parse('$_baseUrl/api/auth/unified-login');
      debugPrint("Attempting login to $url with identifier: ${_idCtrl.text.trim()}");
      
      final String deviceId = await DeviceInfoHelper.getDeviceId();

      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'companyCode': _companyCtrl.text.trim(),
          'identifier': _idCtrl.text.trim(),
          'password': _passCtrl.text.trim(),
          'deviceId': deviceId,
        }),
      );

      debugPrint("Login Response Status: ${response.statusCode}");
      debugPrint("Login Response Body: ${response.body}");

      final data = jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode != 200) {
        if (data['code'] == 'DEVICE_MISMATCH' || data['message'] == 'DEVICE_MISMATCH') {
          setState(() { _loading = false; });
          if (!mounted) return;
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => DeviceMismatchPage(
                identifier: _idCtrl.text.trim(),
                password: _passCtrl.text.trim(),
                companyCode: _companyCtrl.text.trim(),
                newDeviceId: deviceId,
                requestStatus: data['requestStatus'] ?? 'none',
              ),
            ),
          );
          return;
        }

        setState(() {
          _errorMsg = data['message'] ?? 'Login failed. Please try again.';
          _loading = false;
        });
        return;
      }

      // ── Persist session ────────────────────────────────────────────────────
      final prefs = await SharedPreferences.getInstance();
      final role = data['role'] as String? ?? '';
      debugPrint("Logged in role: $role");
      final token = (data['token'] ?? data['auth_token'] ?? '') as String;
      final user = data['user'] as Map<String, dynamic>? ?? {};

      if (token.isNotEmpty) {
        await prefs.setString('auth_token', token);
      }
      await prefs.setString('user_role', role);

      TextInput.finishAutofillContext();
      setState(() => _loading = false);

      if (!mounted) return;

      if (data['forcePasswordReset'] == true) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => ForcePasswordResetPage(
              userId: (user['_id'] ?? '').toString(),
              onSuccess: (BuildContext resetContext) {
                // Return to login page so they can login with new password
                Navigator.pushReplacement(
                  resetContext,
                  MaterialPageRoute(builder: (_) => const UnifiedLoginPage()),
                );
              },
            ),
          ),
        );
        return;
      }

      // ── Route by role ──────────────────────────────────────────────────────
      debugPrint("Routing for role: $role");
      switch (role) {
        case 'intern':
          // 'internid' is lowercase in the Intern model
          final internId = (user['internid'] ?? user['email'] ?? '').toString();
          await prefs.setString('internId', internId);
          await prefs.setString('internMongoId', (user['_id'] ?? '').toString());
          await prefs.setBool('internLoggedIn', true);
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const AttendancePage()),
          );
          break;

        case 'employee':
          final empId = user['EmployeeId'] ?? user['_id'] ?? '';
          final empMongoId = (user['_id'] ?? '').toString();
          await prefs.setString('employeeId', empId);
          await prefs.setString('employeeMongoId', empMongoId);
          await prefs.setBool('employeeLoggedIn', true);

          // Check if employee still needs to complete their profile details
          final bool completeDetails = data['completeDetails'] == true;

          if (!completeDetails) {
            // Show the Complete Details screen, then go to dashboard
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => EmployeeCompleteDetails(
                  employeeMongoId: empMongoId,
                  onDone: (BuildContext detailsContext) {
                    Navigator.pushReplacement(
                      detailsContext,
                      MaterialPageRoute(
                        builder: (_) => Employeedashboard(employeeId: empId),
                      ),
                    );
                  },
                ),
              ),
            );
          } else {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => Employeedashboard(employeeId: empId),
              ),
            );
          }
          break;

        case 'manager':
          final empId = (user['EmployeeId'] ?? user['_id'] ?? '').toString();
          final fullName = (user['fullName'] ?? 'Manager').toString();
          final email = (user['email'] ?? '').toString();
          final dept = (user['department'] ?? '').toString();
          final mongoId = (user['_id'] ?? '').toString();

          await prefs.setString('employeeId', empId);
          await prefs.setBool('employeeLoggedIn', true);
          await prefs.setBool('manager_logged_in', true);

          // These are required by ManagerDashboard
          await prefs.setString('manager_email', email);
          await prefs.setString('manager_name', fullName);
          await prefs.setString('manager_id', empId);
          await prefs.setString('manager_dept', dept);
          await prefs.setString('manager_mongo_id', mongoId);

          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => const ManagerDashboard(),
            ),
          );
          break;

        case 'hr':
        case 'hr_admin':
        case 'admin':
          debugPrint("Login success: Identified as HR. User data: $user");
          final empId = (user['employeeId'] ?? user['EmployeeId'] ?? user['_id'] ?? '').toString();
          final firstName = user['profile']?['firstName'] ?? '';
          final lastName = user['profile']?['lastName'] ?? '';
          final fullName = user['fullName'] ?? 
                         (firstName.isNotEmpty ? "$firstName $lastName" : "HR Manager");

          debugPrint("HR Session: ID=$empId, Name=$fullName");
          await prefs.setBool('hr_logged_in', true);
          await prefs.setString('hr_id', empId);
          await prefs.setString('hr_name', fullName);
          await prefs.setString('auth_token', token);
          await prefs.setString('hr_auth_token', token);
          
          if (!mounted) return;
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const HrdashBoard()),
          );
          break;

        default:
          debugPrint("Unknown role encountered: $role");
          setState(() => _errorMsg = 'Unknown role ($role). Contact HR.');
      }
    } catch (e) {
      setState(() {
        _errorMsg = 'Connection error. Check your network.';
        _loading = false;
      });
    }
  }

  // ── Forgot Password ────────────────────────────────────────────────────────
  Future<void> _forgotPassword() async {
    final emailCtrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
          bool sending = false;
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            title: const Text(
              'Reset Password',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFF00657F),
              ),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Enter your registered email address.',
                  style: TextStyle(fontSize: 13, color: Colors.black54),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: _inputDecoration(
                    hint: 'Email address',
                    icon: HugeIcons.strokeRoundedMail01,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text(
                  'Cancel',
                  style: TextStyle(color: Colors.grey),
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00657F),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: sending
                    ? null
                    : () async {
                        setS(() => sending = true);
                        try {
                          final r = await http.post(
                            Uri.parse('$_baseUrl/api/auth/forgot-password'),
                            headers: {'Content-Type': 'application/json'},
                            body: jsonEncode({'email': emailCtrl.text.trim()}),
                          );
                          if (!mounted) return;
                          Navigator.pop(ctx);
                          final ok = r.statusCode == 200;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                ok
                                    ? 'Reset link sent to your email.'
                                    : 'Email not found.',
                              ),
                              backgroundColor: ok ? Colors.green : Colors.red,
                            ),
                          );
                        } catch (_) {
                          Navigator.pop(ctx);
                        }
                      },
                child: sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Send Link'),
              ),
            ],
          );
        },
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final bool isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // Gradient background
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
            child: TweenAnimationBuilder<double>(
              duration: const Duration(milliseconds: 1000),
              tween: Tween(begin: 1.0, end: 0.0),
              curve: Curves.easeOutQuart,
              builder: (context, value, child) {
                return Transform.translate(
                  offset: Offset(0, 50 * value),
                  child: Opacity(opacity: 1.0 - value, child: child),
                );
              },
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
                            if (Navigator.canPop(context)) {
                              Navigator.pop(context);
                            } else {
                              Navigator.pushAndRemoveUntil(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const homescreen(),
                                ),
                                (r) => false,
                              );
                            }
                          },
                        ),
                        const Expanded(
                          child: Center(
                            child: Text(
                              'Sign In',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 48),
                      ],
                    ),
                  ),
                  if (!isKeyboardOpen) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Use your registered email address to sign in.',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 14,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 40),
                  ] else ...[
                    const SizedBox(height: 16),
                  ],

                  // ── Form Card ───────────────────────────────────────────────────
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF5F1ED),
                        borderRadius: BorderRadius.vertical(
                          top: Radius.circular(30),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
                        child: Form(
                          key: _formKey,
                          child: AutofillGroup(
                            child: SingleChildScrollView(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Welcome back',
                                    style: TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF003D4D),
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Enter your ID or email and password to continue.',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.black.withOpacity(0.6),
                                      height: 1.4,
                                    ),
                                  ),
                                  const SizedBox(height: 32),

                                  // Company Code field
                                  const Text(
                                    'Company Code *',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  TextFormField(
                                    controller: _companyCtrl,
                                    keyboardType: TextInputType.text,
                                    decoration: _inputDecoration(
                                      hint: 'Enter your company code',
                                      icon: HugeIcons.strokeRoundedBuilding03,
                                    ),
                                    validator: (value) {
                                      if (value == null || value.trim().isEmpty) {
                                        return 'Company code is required';
                                      }
                                      return null;
                                    },
                                  ),

                                  const SizedBox(height: 18),

                                  // Email field
                                  const Text(
                                    'Email Address',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  TextFormField(
                                    controller: _idCtrl,
                                    keyboardType: TextInputType.emailAddress,
                                    autofillHints: const [AutofillHints.email],
                                    decoration: _inputDecoration(
                                      hint: 'Enter your email address',
                                      icon: HugeIcons.strokeRoundedMail01,
                                    ),
                                    validator: (v) => (v == null || v.isEmpty)
                                        ? 'Please enter your email address'
                                        : null,
                                  ),

                                  const SizedBox(height: 18),

                                  // Password field
                                  const Text(
                                    'Password',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  TextFormField(
                                    controller: _passCtrl,
                                    obscureText: _obscure,
                                    autofillHints: const [
                                      AutofillHints.password,
                                    ],
                                    decoration: _inputDecoration(
                                      hint: 'Enter your password',
                                      icon: HugeIcons.strokeRoundedChatLock01,
                                      suffix: IconButton(
                                        icon: _buildIcon(
                                          _obscure
                                              ? HugeIcons
                                                    .strokeRoundedViewOffSlash
                                              : HugeIcons.strokeRoundedView,
                                          color: Colors.grey,
                                          size: 20,
                                        ),
                                        onPressed: () => setState(
                                          () => _obscure = !_obscure,
                                        ),
                                      ),
                                    ),
                                    validator: (v) => (v == null || v.isEmpty)
                                        ? 'Please enter your password'
                                        : null,
                                  ),

                                  const SizedBox(height: 12),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: InkWell(
                                      onTap: _forgotPassword,
                                      borderRadius: BorderRadius.circular(8),
                                      child: const Padding(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: 4,
                                          vertical: 2,
                                        ),
                                        child: Text(
                                          'Forgot password?',
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: Color(0xFF00657F),
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),

                                  // Error message
                                  if (_errorMsg.isNotEmpty) ...[
                                    const SizedBox(height: 16),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 10,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFFEBEB),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: Colors.red.shade200,
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          _buildIcon(
                                            HugeIcons.strokeRoundedAlertCircle,
                                            color: Colors.red,
                                            size: 18,
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              _errorMsg,
                                              style: const TextStyle(
                                                color: Colors.red,
                                                fontSize: 13,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],

                                  const SizedBox(height: 36),

                                  // Login button
                                  SizedBox(
                                    width: double.infinity,
                                    height: 52,
                                    child: ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(
                                          0xFF00657F,
                                        ),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            14,
                                          ),
                                        ),
                                        elevation: 0,
                                      ),
                                      onPressed: _loading ? null : _login,
                                      child: _loading
                                          ? const CircularProgressIndicator(
                                              color: Colors.white,
                                              strokeWidth: 2.4,
                                            )
                                          : const Text(
                                              'Sign In',
                                              style: TextStyle(
                                                fontSize: 17,
                                                fontWeight: FontWeight.w700,
                                                color: Colors.white,
                                              ),
                                            ),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIcon(dynamic icon, {Color? color, double size = 20}) {
    if (icon is IconData) {
      return Icon(icon, color: color, size: size);
    } else if (icon != null) {
      return HugeIcon(
        icon: icon,
        color: color ?? const Color(0xFF00657F),
        size: size,
      );
    }
    return const SizedBox.shrink();
  }

  InputDecoration _inputDecoration({
    required String hint,
    dynamic icon,
    Widget? suffix,
  }) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: icon != null
          ? Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: _buildIcon(icon, color: const Color(0xFF00657F)),
            )
          : null,
      prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
      suffixIcon: suffix,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: Colors.grey.shade200, width: 1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFF00657F), width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: Colors.red.shade200, width: 1),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Colors.red, width: 1.5),
      ),
    );
  }
}
