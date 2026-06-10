import 'dart:convert';

import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/success_dialog.dart';

class EmployeeFormOne extends StatefulWidget {
  final String? companyCode;
  final String? companyName;
  const EmployeeFormOne({super.key, this.companyCode, this.companyName});

  @override
  State<EmployeeFormOne> createState() => _EmployeeFormOneState();
}

class _EmployeeFormOneState extends State<EmployeeFormOne> {
  final _formKey = GlobalKey<FormState>();
  bool isSubmitting = false;
  bool isVerifying = false;
  bool isVerified = false;
  String? verifiedCompanyName;

  final TextEditingController companyCodeController = TextEditingController();

  // SECTION 1 – Personal Details
  final TextEditingController fullNameController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController emergencyNameController = TextEditingController();
  final TextEditingController emergencyNumberController =
      TextEditingController();
  final TextEditingController dobController = TextEditingController();
  final TextEditingController addressController = TextEditingController();
  final TextEditingController linkedinController = TextEditingController();
  final TextEditingController otherRoleController = TextEditingController();
  bool isOtherRoleSelected = false;

  String? selectedGender;
  final List<String> genders = ['Male', 'Female', 'Other'];
  final TextEditingController nationalityController = TextEditingController();
  String? maritalStatus;
  final List<String> maritalOptions = ['Single', 'Married', 'Other'];

  String? selectedRole;
  List<String> roles = ['Other'];

  // SECTION 2 – Project Links (optional, max 5)
  final List<TextEditingController> projectLinkControllers = [
    TextEditingController(),
  ];

  // SECTION 3 – Declarations
  bool declareAccuracy = false;
  bool consentBackground = false;
  bool agreeCommunication = false;

  // For background animation
  double _orb1Top = 100;
  double _orb1Left = -50;
  double _orb2Top = 500;
  double _orb2Left = 200;

  @override
  void initState() {
    super.initState();
    if (widget.companyCode != null) {
      companyCodeController.text = widget.companyCode!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _verifyCompany();
      });
    }
    _startAnimation();
  }

  @override
  void dispose() {
    companyCodeController.dispose();
    fullNameController.dispose();
    emailController.dispose();
    phoneController.dispose();
    emergencyNameController.dispose();
    emergencyNumberController.dispose();
    dobController.dispose();
    addressController.dispose();
    linkedinController.dispose();
    otherRoleController.dispose();
    nationalityController.dispose();
    for (final c in projectLinkControllers) {
      c.dispose();
    }
    super.dispose();
  }

  void _startAnimation() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) {
        setState(() {
          _orb1Top = 50;
          _orb1Left = 20;
          _orb2Top = 400;
          _orb2Left = -30;
        });
      }
    });
  }

  Widget _buildBackgroundOrb(
    double left,
    double top,
    double size,
    Color color,
  ) {
    return AnimatedPositioned(
      duration: const Duration(seconds: 4),
      curve: Curves.easeInOutSine,
      top: top,
      left: left,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withOpacity(0)]),
        ),
      ),
    );
  }

  final String baseUrl = getBaseUrl();

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 20),
      firstDate: DateTime(1950),
      lastDate: now,
    );

    if (picked != null) {
      final formatted =
          '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      setState(() {
        dobController.text = formatted;
      });
    }
  }

  // ------------- SUBMIT -------------

  Future<void> _verifyCompany() async {
    final code = companyCodeController.text.trim();
    if (code.isEmpty) return;

    setState(() {
      isVerifying = true;
      isVerified = false;
      verifiedCompanyName = null;
    });

    try {
      final baseUrl = getBaseUrl();
      final response = await http.get(
        Uri.parse('$baseUrl/api/onboarding/verify/$code'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          isVerified = true;
          verifiedCompanyName = data['company']['name'];

          try {
            if (data['company'] != null &&
                data['company']['settings'] != null &&
                data['company']['settings']['employeeRoles'] != null) {
              final List<dynamic> fetchedRoles =
                  data['company']['settings']['employeeRoles'];
              if (fetchedRoles.isNotEmpty) {
                roles = fetchedRoles.map((e) {
                  return e.toString().split(' ').map((word) {
                    if (word.isEmpty) return word;
                    return word[0].toUpperCase() +
                        word.substring(1).toLowerCase();
                  }).join(' ');
                }).toList();
                if (!roles.contains('Other')) roles.add('Other');
                selectedRole = null;
              }
            }
          } catch (e) {
            debugPrint("Error parsing roles: $e");
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Company Verified: $verifiedCompanyName"),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        final data = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(data['msg'] ?? "Invalid Company Code"),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      debugPrint("Verify error: $e");
    } finally {
      setState(() => isVerifying = false);
    }
  }

  Future<void> submitForm() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (isSubmitting) return;

    if (!_formKey.currentState!.validate()) return;

    if (!declareAccuracy || !consentBackground || !agreeCommunication) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Please accept all declarations")),
      );
      return;
    }

    setState(() => isSubmitting = true);

    try {
      final uri = Uri.parse('$baseUrl/api/employee/add');
      final request = http.MultipartRequest('POST', uri);

      // Basic fields
      request.fields['companyCode'] =
          companyCodeController.text.trim().toUpperCase();
      request.fields['fullName'] = fullNameController.text.trim();
      request.fields['email'] = emailController.text.trim();
      request.fields['phone'] = phoneController.text.trim();
      request.fields['emergencyName'] = emergencyNameController.text.trim();
      request.fields['emergencyPhone'] = emergencyNumberController.text.trim();
      request.fields['dob'] = dobController.text.trim();
      request.fields['address'] = addressController.text.trim();
      final String finalRole = selectedRole == 'Other'
          ? otherRoleController.text.trim()
          : selectedRole ?? '';
      request.fields['role'] = finalRole;
      request.fields['linkedin'] = linkedinController.text.trim();
      request.fields['gender'] = selectedGender ?? '';
      request.fields['nationality'] = nationalityController.text.trim();
      request.fields['maritalStatus'] = maritalStatus ?? '';

      // Project links (JSON array)
      final validLinks = projectLinkControllers
          .map((c) => c.text.trim())
          .where((l) => l.isNotEmpty)
          .toList();
      request.fields['projectLinks'] = jsonEncode(validLinks);

      // Declarations
      request.fields['declaration'] = declareAccuracy.toString();
      request.fields['bgConsent'] = consentBackground.toString();
      request.fields['whatsappConsent'] = agreeCommunication.toString();

      final response = await http.send(request);

      if (!mounted) return;

      if (response.statusCode == 201 || response.statusCode == 200) {
        otherRoleController.clear();
        setState(() {
          selectedRole = null;
          isOtherRoleSelected = false;
        });

        showSuccessPopup(
          context,
          "Your application is submitted!\n\nAfter your first login, you'll be asked to complete your profile details (education, documents, etc.).",
        );
      } else {
        String errorMsg = "Submission failed";
        try {
          final responseData = jsonDecode(
            await response.stream.bytesToString(),
          );
          errorMsg = responseData['message'] ?? errorMsg;
        } catch (e) {
          debugPrint("Error decoding failure response: $e");
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorMsg), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      debugPrint('Submission error: $e');
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Something went wrong")));
    } finally {
      if (mounted) {
        setState(() => isSubmitting = false);
      }
    }
  }

  // ------------- UI -------------

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        width: size.width,
        height: size.height,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(0xFFFFA726),
              Color(0xFF8ED1DC),
              Color(0xFF00657F),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Stack(
          children: [
            _buildBackgroundOrb(
              size.width * 0.8,
              size.height * 0.1,
              300,
              const Color(0xFF8ED1DC).withOpacity(0.3),
            ),
            _buildBackgroundOrb(
              _orb1Left,
              _orb1Top,
              250,
              const Color(0xFFFFA726).withOpacity(0.2),
            ),
            _buildBackgroundOrb(
              _orb2Left,
              _orb2Top,
              350,
              const Color(0xFF00657F).withOpacity(0.15),
            ),

            TweenAnimationBuilder<double>(
              duration: const Duration(milliseconds: 1200),
              tween: Tween(begin: 1.0, end: 0.0),
              curve: Curves.easeOutQuart,
              builder: (context, value, child) {
                return Transform.translate(
                  offset: Offset(0, 60 * value),
                  child: Opacity(opacity: 1.0 - value, child: child),
                );
              },
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.fromLTRB(16, 60, 16, 20),
                      decoration: const BoxDecoration(
                        color: Colors.transparent,
                      ),
                      child: Container(
                        padding: const EdgeInsets.all(22),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF00657F), Color(0xFF003648)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.3),
                              blurRadius: 15,
                              offset: const Offset(0, 10),
                            ),
                            BoxShadow(
                              color: const Color(0xFF8ED1DC).withOpacity(0.1),
                              blurRadius: 1,
                              spreadRadius: 1,
                            ),
                          ],
                          border: Border.all(
                            color: const Color(0xFF8ED1DC).withOpacity(0.2),
                            width: 0.8,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      "Welcome to",
                                      style: TextStyle(
                                        color: Color(0xFF8ED1DC),
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: 1.5,
                                      ),
                                    ),
                                    const Text(
                                      "Softrate Global",
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 28,
                                        height: 1.1,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Container(
                              width: 45,
                              height: 4,
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFA726),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              "Apply For A Job And Get Your Profile Reviewed By Our HR Team.",
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.8),
                                fontSize: 13,
                                height: 1.5,
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      constraints: BoxConstraints(minHeight: size.height * 0.7),
                      padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.all(Radius.circular(28)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black12,
                            blurRadius: 10,
                            offset: Offset(0, -5),
                          ),
                        ],
                      ),
                      child: _buildForm(context),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ------------- FORM CONTENT -------------

  Widget _buildForm(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Fill your details",
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),

          // Info banner: remaining fields after login
          // const SizedBox(height: 10),
          // Container(
          //   padding: const EdgeInsets.all(12),
          //   decoration: BoxDecoration(
          //     color: const Color(0xFF00657F).withOpacity(0.06),
          //     borderRadius: BorderRadius.circular(12),
          //     border: Border.all(
          //       color: const Color(0xFF00657F).withOpacity(0.2),
          //     ),
          //   ),
          //   // child: Row(
          //   //   children: [
          //   //     const Icon(Icons.info_outline, color: Color(0xFF00657F), size: 18),
          //   //     const SizedBox(width: 8),
          //   //     Expanded(
          //   //     //   child: Text(
          //   //     //     "Education, experience & documents will be collected after your first login.",
          //   //     //     style: TextStyle(
          //   //     //       fontSize: 12,
          //   //     //       color: const Color(0xFF00657F).withOpacity(0.85),
          //   //     //       height: 1.4,
          //   //     //     ),
          //   //     //   ),
          //   //     // ),
          //   //   ],
          //   // ),
          // ),
          // const SizedBox(height: 12),

          if (!isVerified)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: inputField(
                    "Company Code *",
                    companyCodeController,
                    enabled: !isVerified,
                  ),
                ),
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: (isVerifying || isVerified)
                          ? null
                          : _verifyCompany,
                      style: ElevatedButton.styleFrom(
                        backgroundColor:
                            isVerified ? Colors.green : const Color(0xFF008C9E),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: isVerifying
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            )
                          : Icon(isVerified ? Icons.check : Icons.search),
                    ),
                  ),
                ),
              ],
            ),

          if (isVerified && verifiedCompanyName != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.green.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.verified_user_outlined,
                      color: Colors.green,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "Applying to: $verifiedCompanyName",
                        style: const TextStyle(
                          color: Colors.green,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    if (widget.companyCode == null)
                      TextButton(
                        onPressed: () => setState(() => isVerified = false),
                        child: const Text(
                          "Change",
                          style: TextStyle(color: Colors.grey, fontSize: 12),
                        ),
                      ),
                  ],
                ),
              ),
            ),

          Opacity(
            opacity: isVerified ? 1.0 : 0.5,
            child: IgnorePointer(
              ignoring: !isVerified,
              child: Column(
                children: [
                  // SECTION 1 – Personal Details
                  sectionHeader("Personal details", icon: Icons.person_outline),
                  inputField(
                    "Full Name (As per Aadhaar/PAN) *",
                    fullNameController,
                  ),
                  inputField(
                    "Email Address *",
                    emailController,
                    type: TextInputType.emailAddress,
                  ),
                  inputField(
                    "Phone Number (WhatsApp) *",
                    phoneController,
                    type: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'This field is required';
                      }
                      if (val.trim().length != 10) {
                        return 'Enter a valid 10-digit number';
                      }
                      return null;
                    },
                  ),
                  inputField(
                    "Emergency Contact Name *",
                    emergencyNameController,
                  ),
                  inputField(
                    "Emergency Contact Number *",
                    emergencyNumberController,
                    type: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'This field is required';
                      }
                      if (val.trim().length != 10) {
                        return 'Enter a valid 10-digit number';
                      }
                      if (val.trim() == phoneController.text.trim()) {
                        return 'Emergency contact cannot be same as contact number';
                      }
                      return null;
                    },
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: TextFormField(
                      controller: dobController,
                      readOnly: true,
                      onTap: _pickDob,
                      validator: (val) => val == null || val.trim().isEmpty
                          ? 'This field is required'
                          : null,
                      decoration: _fieldDecoration("Date of Birth *").copyWith(
                        suffixIcon: const Icon(
                          Icons.calendar_today_outlined,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
                  inputField(
                    "Residential Address *",
                    addressController,
                    maxLines: 3,
                  ),
                  dropdownField(
                    "Role applying for *",
                    selectedRole,
                    roles,
                    (val) {
                      setState(() {
                        selectedRole = val;
                        isOtherRoleSelected = val == 'Other';
                        if (!isOtherRoleSelected) {
                          otherRoleController.clear();
                        }
                      });
                    },
                    key: Key(roles.join(',')),
                  ),
                  if (isOtherRoleSelected)
                    inputField(
                      "Specify Role *",
                      otherRoleController,
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please specify the role';
                        }
                        return null;
                      },
                    ),
                  inputField(
                    "LinkedIn Profile URL *",
                    linkedinController,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return "LinkedIn profile is required";
                      }
                      if (!value.trim().contains("linkedin.com")) {
                        return "Enter a valid LinkedIn profile URL";
                      }
                      return null;
                    },
                  ),
                  dropdownField(
                    "Gender *",
                    selectedGender,
                    genders,
                    (val) => setState(() => selectedGender = val),
                  ),
                  inputField("Nationality *", nationalityController),
                  dropdownField(
                    "Marital Status *",
                    maritalStatus,
                    maritalOptions,
                    (val) => setState(() => maritalStatus = val),
                  ),

                  // SECTION 2 – Project Links
                  _buildProjectLinksSection(),

                  // SECTION 3 – Declarations
                  sectionHeader(
                    "Declarations",
                    icon: Icons.check_circle_outline,
                  ),
                  declarationsSection(),

                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: isSubmitting ? null : submitForm,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF008C9E),
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                      child: isSubmitting
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            )
                          : const Text(
                              "Submit Application",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),

                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ------------- PROJECT LINKS SECTION -------------

  Widget _buildProjectLinksSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        sectionHeader("Project Links", icon: Icons.link_rounded),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF7F9FC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE1E6F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Add up to 5 project links (GitHub, portfolio, etc.) — optional",
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
              const SizedBox(height: 8),
              ...List.generate(projectLinkControllers.length, (index) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: projectLinkControllers[index],
                          keyboardType: TextInputType.url,
                          decoration: _fieldDecoration(
                            "Project ${index + 1} URL",
                          ).copyWith(
                            prefixIcon: const Icon(
                              Icons.link,
                              size: 18,
                              color: Color(0xFF008C9E),
                            ),
                          ),
                          validator: (_) => null, // optional
                        ),
                      ),
                      if (index > 0)
                        Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: IconButton(
                            onPressed: () {
                              setState(() {
                                projectLinkControllers[index].dispose();
                                projectLinkControllers.removeAt(index);
                              });
                            },
                            icon: const Icon(
                              Icons.remove_circle_outline,
                              color: Colors.redAccent,
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              }),
              if (projectLinkControllers.length < 5)
                TextButton.icon(
                  onPressed: () {
                    setState(() {
                      projectLinkControllers.add(TextEditingController());
                    });
                  },
                  icon: const Icon(Icons.add_circle_outline,
                      color: Color(0xFF008C9E)),
                  label: const Text(
                    "Add another project",
                    style: TextStyle(color: Color(0xFF008C9E), fontSize: 13),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  // ------------- HELPER WIDGETS & DECORATION -------------

  Widget sectionHeader(String title, {IconData icon = Icons.info_outline}) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFFE0F4F7),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 18, color: const Color(0xFF008C9E)),
          ),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  InputDecoration _fieldDecoration(String label) {
    return InputDecoration(
      labelText: label,
      floatingLabelBehavior: FloatingLabelBehavior.auto,
      filled: true,
      fillColor: const Color(0xFFF7F9FC),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE1E6F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFF008C9E), width: 1.4),
      ),
    );
  }

  Widget inputField(
    String label,
    TextEditingController controller, {
    TextInputType type = TextInputType.text,
    String? Function(String?)? validator,
    int maxLines = 1,
    bool enabled = true,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: TextFormField(
        controller: controller,
        keyboardType: type,
        maxLines: maxLines,
        enabled: enabled,
        inputFormatters: inputFormatters,
        validator:
            validator ??
            (val) => val == null || val.trim().isEmpty
                ? 'This field is required'
                : null,
        decoration: _fieldDecoration(label),
      ),
    );
  }

  Widget dropdownField(
    String label,
    String? value,
    List<String> options,
    Function(String?) onChanged, {
    Key? key,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: DropdownButtonFormField2<String>(
        key: key,
        isExpanded: true,
        value: value,
        items: options
            .map((e) => DropdownMenuItem(value: e, child: Text(e)))
            .toList(),
        onChanged: onChanged,
        decoration: _fieldDecoration(label),
        validator: (val) => val == null ? 'This field is required' : null,
        selectedItemBuilder: (context) => options
            .map(
              (e) => Text(
                e,
                style: const TextStyle(
                  fontWeight: FontWeight.normal,
                  fontSize: 14,
                ),
              ),
            )
            .toList(),
        dropdownStyleData: DropdownStyleData(
          width: MediaQuery.of(context).size.width * 0.9,
          offset: const Offset(0, 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.12),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget declarationsSection() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F9FC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE1E6F0)),
      ),
      child: Column(
        children: [
          CheckboxListTile(
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text("I declare information is accurate"),
            value: declareAccuracy,
            onChanged: (val) =>
                setState(() => declareAccuracy = val ?? false),
          ),
          CheckboxListTile(
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text("I Consent for background verification"),
            value: consentBackground,
            onChanged: (val) =>
                setState(() => consentBackground = val ?? false),
          ),
          CheckboxListTile(
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text(
              "Agree to receive communication via WhatsApp and Mail",
            ),
            value: agreeCommunication,
            onChanged: (val) =>
                setState(() => agreeCommunication = val ?? false),
          ),
        ],
      ),
    );
  }
}
