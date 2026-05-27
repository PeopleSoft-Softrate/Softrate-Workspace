import 'dart:convert';
import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/success_dialog.dart';

class FormOne extends StatefulWidget {
  final String? companyCode;
  final String? companyName;
  const FormOne({super.key, this.companyCode, this.companyName});

  @override
  State<FormOne> createState() => _FormOneState();
}

class _FormOneState extends State<FormOne> {
  final _formKey = GlobalKey<FormState>();
  static const Color colorRGB = Color(0xFF00657F);

  bool isVerifying = false;
  bool isVerified = false;
  String? verifiedCompanyName;

  final TextEditingController companyCodeController = TextEditingController();
  final TextEditingController fullNameController = TextEditingController();
  final TextEditingController collegeController = TextEditingController();
  final TextEditingController departmentController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController contactController = TextEditingController();
  final TextEditingController emergencyController = TextEditingController();
  final TextEditingController linkedinController = TextEditingController();
  final TextEditingController otherRoleController = TextEditingController();
  bool isOtherRoleSelected = false;
  String selectedApplicationType = "Internship";

  PlatformFile? resumeFile;

  String? selectedYear;
  String? selectedRole;
  final String baseUrl = getBaseUrl();

  bool _submitted = false; // for showing validators after submit

  final List<String> years = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
    '5th Year',
    'Passed Out',
  ];

  List<String> roles = ['Other'];

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
      // We must call _verifyCompany to fetch the dynamic roles from the backend
      // rather than just setting isVerified = true.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _verifyCompany();
      });
    }
    _startAnimation();
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

  Future<void> _pickResume() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        withData:
            true, // Needed for web/iOS/Android to get bytes directly as base64
      );

      if (result != null) {
        final file = result.files.first;

        // 2MB = 2 * 1024 * 1024 bytes
        if (file.size > 2 * 1024 * 1024) {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("PDF size must be less than 2MB"),
              backgroundColor: Colors.red,
            ),
          );
          return;
        }

        setState(() {
          resumeFile = file;
        });
      }
    } catch (e) {
      debugPrint("File picking error: $e");
    }
  }

  Future<void> _verifyCompany() async {
    final code = companyCodeController.text.trim();
    if (code.isEmpty) return;

    setState(() {
      isVerifying = true;
      isVerified = false;
      verifiedCompanyName = null;
    });

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/onboarding/verify/$code'),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        debugPrint("Verify Response: $data");
        setState(() {
          isVerified = true;
          verifiedCompanyName = data['company']['name'];
          
          // Update roles dynamically from backend
          try {
            if (data['company'] != null && 
                data['company']['settings'] != null && 
                data['company']['settings']['internRoles'] != null) {
              final List<dynamic> fetchedRoles = data['company']['settings']['internRoles'];
              if (fetchedRoles.isNotEmpty) {
                roles = fetchedRoles.map((e) => e.toString()).toList();
                selectedRole = null; // Clear previous selection to avoid errors
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

  void _showDeclarationPopup() {
    showDialog(
      context: context,
      builder: (context) {
        bool isChecked = false; // local dialog state

        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
              title: Row(
                children: [
                  Icon(Icons.info_outline_rounded, color: colorRGB, size: 24),
                  const SizedBox(width: 8),
                  Text(
                    "Declaration",
                    style: TextStyle(
                      color: colorRGB,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    "Please read the instructions carefully before submitting your application.",
                    style: TextStyle(fontSize: 14),
                  ),
                  SizedBox(height: 12),
                  Text(
                    "Important:",
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  SizedBox(height: 4),
                  Text(
                    "• Further communication will be sent to your official email.\n"
                    "• After approval you will receive your Intern ID.\n"
                    "• Use that ID to log in and set your password on first login.",
                    style: TextStyle(fontSize: 13, height: 1.4),
                  ),
                  SizedBox(height: 12),
                ],
              ),
              actions: [
                Row(
                  children: [
                    Checkbox(
                      value: isChecked,
                      fillColor: WidgetStateProperty.resolveWith(
                        (states) => states.contains(WidgetState.selected)
                            ? colorRGB
                            : Colors.grey.shade300,
                      ),
                      onChanged: (value) {
                        setStateDialog(() {
                          isChecked = value ?? false;
                        });
                      },
                    ),
                    const Expanded(
                      child: Text(
                        "I have read and understood the instructions above.",
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: isChecked
                      ? () {
                          Navigator.pop(context); // close dialog
                          submitForm(); // Call API with loading
                        }
                      : null,
                  child: Text(
                    "Submit",
                    style: TextStyle(
                      color: isChecked ? colorRGB : Colors.grey,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> submitForm() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final submittedName = fullNameController.text.trim();
    final String finalRole = selectedRole == 'Other'
        ? otherRoleController.text.trim()
        : selectedRole!;
    final submittedRole = finalRole;

    String? resumeBase64;
    if (resumeFile != null && resumeFile!.bytes != null) {
      resumeBase64 = base64Encode(resumeFile!.bytes!);
    }

    final body = {
      "companyCode": companyCodeController.text.trim().toUpperCase(),
      "fullName": fullNameController.text.trim(),
      "college": collegeController.text.trim(),
      "year": selectedYear,
      "department": departmentController.text.trim(),
      "role": finalRole,
      "email": emailController.text.trim(),
      "contact": contactController.text.trim(),
      "emergencyContact": emergencyController.text.trim(),
      "linkedin": linkedinController.text.trim(),
      "applicationType": selectedApplicationType,
      "resume": resumeBase64,
    };

    final url = Uri.parse('$baseUrl/api/intern/add');

    // Show loading dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) =>
          const Center(child: CircularProgressIndicator(color: Colors.white)),
    );

    try {
      final response = await http.post(
        url,
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(body),
      );

      Navigator.pop(context); // Close loading dialog

      if (response.statusCode == 200) {
        fullNameController.clear();
        collegeController.clear();
        departmentController.clear();
        otherRoleController.clear();
        emailController.clear();
        contactController.clear();
        emergencyController.clear();
        linkedinController.clear();
        setState(() {
          selectedYear = null;
          selectedRole = null;
          isOtherRoleSelected = false;
          resumeFile = null;
          _submitted = false;
        });

        // Capitalize each word of the name for the success message
        final capitalizedName = submittedName
            .split(' ')
            .map(
              (word) => word.isNotEmpty
                  ? word[0].toUpperCase() + word.substring(1).toLowerCase()
                  : '',
            )
            .join(' ');

        // Show success popup
        showSuccessPopup(
          context,
          "Your application is submitted and thank you for applying!",
        );
      } else {
        final data = jsonDecode(response.body);
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            title: Row(
              children: const [
                Icon(Icons.error_outline, color: Colors.red),
                SizedBox(width: 8),
                Text(
                  "Error",
                  style: TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            content: Text(
              data['message'] ?? 'An error occurred. Please try again.',
              style: const TextStyle(fontSize: 14),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text("Close"),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // Close loading dialog if it's still showing
      }
      debugPrint("Request error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final w = size.width;
    final h = size.height;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        width: w,
        height: h,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFFFA726), // orange
              Color(0xFF8ED1DC), // light teal
              Color(0xFF00657F), // dark teal
            ],
          ),
        ),
        child: Stack(
          children: [
            // Animated Orbs
            _buildBackgroundOrb(
              w * 0.8,
              h * 0.1,
              300,
              Color(0xFF8ED1DC).withOpacity(0.3),
            ),
            _buildBackgroundOrb(
              _orb1Left,
              _orb1Top,
              250,
              Color(0xFFFFA726).withOpacity(0.2),
            ),
            _buildBackgroundOrb(
              _orb2Left,
              _orb2Top,
              350,
              Color(0xFF00657F).withOpacity(0.15),
            ),

            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  // BACK BUTTON
                  // Align(
                  //   alignment: Alignment.centerLeft,
                  //   child: Padding(
                  //     padding: const EdgeInsets.only(left: 10, top: 4),
                  //     child: IconButton(
                  //       icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
                  //       onPressed: () => Navigator.pop(context),
                  //     ),
                  //   ),
                  // ),
                  const SizedBox(height: 12),
                  // HEADER
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 12,
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
                              const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "Welcome to",
                                    style: TextStyle(
                                      color: Color(0xFF8ED1DC),
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                                  Text(
                                    "PeopleSoft",
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
                          const SizedBox(height: 14),
                          Container(
                            height: 3,
                            width: 45,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFA726),
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            "Apply For An Internship / Job And Get Your Profile Reviewed By Our HR Team.",
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                              height: 1.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 8),

                  // FORM CARD
                  Expanded(
                    child: TweenAnimationBuilder<double>(
                      duration: const Duration(milliseconds: 800),
                      curve: Curves.easeOutCubic,
                      tween: Tween<double>(begin: 100, end: 0),
                      builder: (context, value, child) {
                        return Transform.translate(
                          offset: Offset(0, value),
                          child: Opacity(
                            opacity: (1 - value / 100).clamp(0.0, 1.0),
                            child: child,
                          ),
                        );
                      },
                      child: Container(
                        width: double.infinity,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(32),
                            topRight: Radius.circular(32),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black12,
                              blurRadius: 20,
                              offset: Offset(0, -5),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                          child: SingleChildScrollView(
                            padding: EdgeInsets.only(
                              bottom:
                                  MediaQuery.of(context).padding.bottom + 20,
                            ),
                            child: Form(
                              key: _formKey,
                              autovalidateMode: _submitted
                                  ? AutovalidateMode.onUserInteraction
                                  : AutovalidateMode.disabled,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    "Fill your details",
                                    style: TextStyle(
                                      color: Color(0xFF003648),
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 12),

                                  if (!isVerified)
                                    Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: inputField(
                                            label: "Company Code *",
                                            controller: companyCodeController,
                                            submitted: _submitted,
                                            hint: "e.g. SOFTRATE",
                                            enabled: !isVerified,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            top: 26,
                                          ),
                                          child: SizedBox(
                                            height: 48,
                                            child: ElevatedButton(
                                              onPressed:
                                                  (isVerifying || isVerified)
                                                  ? null
                                                  : _verifyCompany,
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: isVerified
                                                    ? Colors.green
                                                    : const Color(0xFF00657F),
                                                foregroundColor: Colors.white,
                                                shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(14),
                                                ),
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      horizontal: 16,
                                                    ),
                                              ),
                                              child: isVerifying
                                                  ? const SizedBox(
                                                      width: 18,
                                                      height: 18,
                                                      child: CircularProgressIndicator(
                                                        strokeWidth: 2,
                                                        valueColor:
                                                            AlwaysStoppedAnimation<
                                                              Color
                                                            >(Colors.white),
                                                      ),
                                                    )
                                                  : Icon(
                                                      isVerified
                                                          ? Icons.check
                                                          : Icons
                                                                .search_rounded,
                                                    ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),

                                  if (isVerified && verifiedCompanyName != null)
                                    Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 16,
                                      ),
                                      child: Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: Colors.green.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                          border: Border.all(
                                            color: Colors.green.withOpacity(
                                              0.3,
                                            ),
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            const Icon(
                                              Icons.business_rounded,
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
                                                onPressed: () => setState(
                                                  () => isVerified = false,
                                                ),
                                                child: const Text(
                                                  "Change",
                                                  style: TextStyle(
                                                    color: Colors.grey,
                                                    fontSize: 12,
                                                  ),
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
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [


                                          // Application Type Selection (Radio buttons)
                                          inputField(
                                            label:
                                                "Full Name (with initials) in CAPITAL LETTERS *",
                                            controller: fullNameController,
                                            submitted: _submitted,
                                          ),
                                          inputField(
                                            label:
                                                "College / University (full name) *",
                                            controller: collegeController,
                                            submitted: _submitted,
                                          ),

                                          const Text(
                                            "Year of Studying *",
                                            style: TextStyle(
                                              color: Color(0xFF003648),
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          DropdownButtonFormField2<String>(
                                            isExpanded: true,
                                            value: selectedYear,
                                            decoration: dropdownDecoration(),

                                            dropdownStyleData: DropdownStyleData(
                                              width:
                                                  MediaQuery.of(
                                                    context,
                                                  ).size.width *
                                                  0.9,
                                              offset: const Offset(0, 8),
                                              decoration: BoxDecoration(
                                                color: Colors
                                                    .white, // 👈 clean white background
                                                borderRadius:
                                                    BorderRadius.circular(16),
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: Colors.black
                                                        .withOpacity(0.12),
                                                    blurRadius: 16,
                                                    offset: const Offset(0, 6),
                                                  ),
                                                ],
                                              ),
                                            ),

                                            menuItemStyleData:
                                                const MenuItemStyleData(
                                                  padding: EdgeInsets.symmetric(
                                                    horizontal: 16,
                                                    vertical: 12,
                                                  ),
                                                ),

                                            items: years
                                                .map(
                                                  (
                                                    year,
                                                  ) => DropdownMenuItem<String>(
                                                    value: year,
                                                    child: Text(
                                                      year,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: const TextStyle(
                                                        color: Color(
                                                          0xFF003648,
                                                        ),
                                                        fontSize: 14,
                                                        fontWeight:
                                                            FontWeight.w500,
                                                      ),
                                                    ),
                                                  ),
                                                )
                                                .toList(),

                                            onChanged: (value) {
                                              setState(
                                                () => selectedYear = value,
                                              );
                                            },

                                            validator: (value) => value == null
                                                ? "This field is required"
                                                : null,
                                          ),
                                          const SizedBox(height: 18),

                                          inputField(
                                            label: "Department (full form) *",
                                            controller: departmentController,
                                            submitted: _submitted,
                                          ),

                                          const Text(
                                            "Internship role applied for *",
                                            style: TextStyle(
                                              color: Color(0xFF003648),
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          DropdownButtonFormField2<String>(
                                            key: Key(roles.join(',')), // Force rebuild when list changes
                                            isExpanded: true,
                                            value: selectedRole,
                                            decoration: dropdownDecoration(),

                                            dropdownStyleData: DropdownStyleData(
                                              maxHeight:
                                                  300, // 👈 prevents overflow
                                              width:
                                                  MediaQuery.of(
                                                    context,
                                                  ).size.width *
                                                  0.9,
                                              offset: const Offset(0, 8),
                                              decoration: BoxDecoration(
                                                color: Colors.white,
                                                borderRadius:
                                                    BorderRadius.circular(16),
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: Colors.black
                                                        .withOpacity(0.12),
                                                    blurRadius: 16,
                                                    offset: const Offset(0, 6),
                                                  ),
                                                ],
                                              ),
                                            ),

                                            menuItemStyleData:
                                                const MenuItemStyleData(
                                                  padding: EdgeInsets.symmetric(
                                                    horizontal: 16,
                                                    vertical: 12,
                                                  ),
                                                ),

                                            items: roles.map((role) {
                                              return DropdownMenuItem<String>(
                                                value: role,
                                                child: Text(
                                                  role,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                    color: Color(
                                                      0xFF003648,
                                                    ),
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.w500,
                                                  ),
                                                ),
                                              );
                                            }).toList(),

                                            onChanged: (value) {
                                              setState(() {
                                                selectedRole = value;
                                                isOtherRoleSelected =
                                                    value == 'Other';

                                                if (!isOtherRoleSelected) {
                                                  otherRoleController.clear();
                                                }
                                              });
                                            },

                                            validator: (value) => value == null
                                                ? "This field is required"
                                                : null,
                                          ),
                                          const SizedBox(height: 18),
                                          if (isOtherRoleSelected)
                                            inputField(
                                              label:
                                                  "Specify Internship Role *",
                                              controller: otherRoleController,
                                              submitted: _submitted,
                                              validator: (value) {
                                                if (value == null ||
                                                    value.trim().isEmpty) {
                                                  return "Please specify the internship role";
                                                }
                                                return null;
                                              },
                                            ),

                                          inputField(
                                            label: "Mail ID (official) *",
                                            controller: emailController,
                                            type: TextInputType.emailAddress,
                                            submitted: _submitted,
                                            validator: (value) {
                                              if (value == null ||
                                                  value.trim().isEmpty) {
                                                return "Email is required";
                                              }
                                              final emailRegex = RegExp(
                                                r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$',
                                              );
                                              if (!emailRegex.hasMatch(
                                                value.trim(),
                                              )) {
                                                return "Enter a valid email address";
                                              }
                                              return null;
                                            },
                                          ),

                                          inputField(
                                            label:
                                                "Contact Number (WhatsApp) *",
                                            controller: contactController,
                                            type: TextInputType.phone,
                                            submitted: _submitted,
                                            validator: (value) {
                                              if (value == null ||
                                                  value.trim().isEmpty) {
                                                return "Contact number is required";
                                              }
                                              if (!RegExp(
                                                r'^\d{10}$',
                                              ).hasMatch(value.trim())) {
                                                return "Enter a valid 10-digit number";
                                              }
                                              return null;
                                            },
                                          ),

                                          inputField(
                                            label:
                                                "Emergency Contact (Parent / Guardian) *",
                                            controller: emergencyController,
                                            type: TextInputType.phone,
                                            submitted: _submitted,
                                            validator: (value) {
                                              if (value == null ||
                                                  value.trim().isEmpty) {
                                                return "Emergency contact is required";
                                              }
                                              if (!RegExp(
                                                r'^\d{10}$',
                                              ).hasMatch(value.trim())) {
                                                return "Enter a valid 10-digit number";
                                              }
                                              return null;
                                            },
                                          ),

                                          inputField(
                                            label: "LinkedIn Profile (URL) *",
                                            controller: linkedinController,
                                            type: TextInputType.url,
                                            submitted: _submitted,
                                            validator: (value) {
                                              if (value == null ||
                                                  value.trim().isEmpty) {
                                                return "LinkedIn profile is required";
                                              }
                                              if (!value.trim().contains(
                                                "linkedin.com",
                                              )) {
                                                return "Enter a valid LinkedIn profile URL";
                                              }
                                              return null;
                                            },
                                          ),

                                          // RESUME UPLOAD SECTION
                                          const SizedBox(height: 4),
                                          const Text(
                                            "Resume / CV (PDF, Max 2MB) *",
                                            style: TextStyle(
                                              color: Color(0xFF003648),
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          InkWell(
                                            onTap: _pickResume,
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                            child: Container(
                                              height:
                                                  52, // Fixed height to prevent expansion
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 16,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: resumeFile != null
                                                    ? const Color(
                                                        0xFF00657F,
                                                      ).withOpacity(0.05)
                                                    : Colors.grey.shade50,
                                                borderRadius:
                                                    BorderRadius.circular(14),
                                                border: Border.all(
                                                  color: resumeFile != null
                                                      ? const Color(
                                                          0xFF00657F,
                                                        ).withOpacity(0.5)
                                                      : Colors.grey.shade200,
                                                  width: 1.5,
                                                ),
                                              ),
                                              child: Row(
                                                children: [
                                                  Icon(
                                                    resumeFile != null
                                                        ? Icons
                                                              .check_circle_rounded
                                                        : Icons
                                                              .upload_file_rounded,
                                                    color: resumeFile != null
                                                        ? const Color(
                                                            0xFF00657F,
                                                          )
                                                        : Colors.grey.shade400,
                                                    size: 22,
                                                  ),
                                                  const SizedBox(width: 12),
                                                  Expanded(
                                                    child: Column(
                                                      mainAxisAlignment:
                                                          MainAxisAlignment
                                                              .center,
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .start,
                                                      children: [
                                                        Text(
                                                          resumeFile != null
                                                              ? resumeFile!.name
                                                              : "Click to upload / drag & drop",
                                                          style: TextStyle(
                                                            color:
                                                                resumeFile !=
                                                                    null
                                                                ? const Color(
                                                                    0xFF003648,
                                                                  )
                                                                : Colors
                                                                      .grey
                                                                      .shade600,
                                                            fontSize: 14,
                                                            fontWeight:
                                                                resumeFile !=
                                                                    null
                                                                ? FontWeight
                                                                      .w700
                                                                : FontWeight
                                                                      .normal,
                                                          ),
                                                          overflow: TextOverflow
                                                              .ellipsis,
                                                        ),
                                                        if (resumeFile == null)
                                                          Text(
                                                            "Maximum size 2MB",
                                                            style: TextStyle(
                                                              color: Colors
                                                                  .grey
                                                                  .shade400,
                                                              fontSize: 10,
                                                            ),
                                                          ),
                                                      ],
                                                    ),
                                                  ),
                                                  if (resumeFile != null)
                                                    GestureDetector(
                                                      onTap: () => setState(
                                                        () => resumeFile = null,
                                                      ),
                                                      child: const Icon(
                                                        Icons.close_rounded,
                                                        color: Colors.redAccent,
                                                        size: 18,
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ),
                                          ),
                                          SizedBox(height: 24),

                                          if (_submitted && resumeFile == null)
                                            const Padding(
                                              padding: EdgeInsets.only(
                                                top: 6,
                                                left: 4,
                                              ),
                                              child: Text(
                                                "Resume is required",
                                                style: TextStyle(
                                                  color: Color(0xFFFF6F00),
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ),

                                          const SizedBox(height: 22),
                                          const Text(
                                            "By submitting this form you agree to be contacted by our HR team for internship related communication.",
                                            style: TextStyle(
                                              color: Color(0xFF555555),
                                              fontSize: 11,
                                              height: 1.4,
                                            ),
                                          ),
                                          const SizedBox(height: 20),

                                          SizedBox(
                                            width: double.infinity,
                                            child: ElevatedButton(
                                              onPressed: () {
                                                setState(
                                                  () => _submitted = true,
                                                );
                                                if (_formKey.currentState!
                                                    .validate()) {
                                                  if (resumeFile == null) {
                                                    ScaffoldMessenger.of(
                                                      context,
                                                    ).showSnackBar(
                                                      const SnackBar(
                                                        content: Text(
                                                          "Please upload your Resume (PDF)",
                                                        ),
                                                        backgroundColor: Color(
                                                          0xFF00657F,
                                                        ),
                                                      ),
                                                    );
                                                    return;
                                                  }
                                                  _showDeclarationPopup();
                                                }
                                              },
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: const Color(
                                                  0xFF00657F,
                                                ),
                                                foregroundColor: Colors.white,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                      vertical: 14,
                                                    ),
                                                shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(14),
                                                ),
                                                elevation: 4,
                                                shadowColor: Colors.black
                                                    .withOpacity(0.25),
                                              ),
                                              child: const Text(
                                                "Submit Application",
                                                style: TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w700,
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
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}


InputDecoration dropdownDecoration() => InputDecoration(
  filled: true,
  fillColor: Colors.white,
  isDense: true,
  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
  enabledBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: BorderSide(color: Colors.grey.shade200, width: 1.5),
  ),
  focusedBorder: OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(14)),
    borderSide: BorderSide(
      color: const Color(0xFF00657F).withOpacity(0.8),
      width: 1.8,
    ),
  ),
  errorBorder: OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(14)),
    borderSide: BorderSide(color: Colors.orange.shade300, width: 1.5),
  ),
  focusedErrorBorder: OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(14)),
    borderSide: BorderSide(color: Colors.orange.shade300, width: 1.8),
  ),
  errorStyle: const TextStyle(color: Color(0xFFFF6F00), fontSize: 11),
);

Widget inputField({
  required String label,
  required TextEditingController controller,
  required bool submitted,
  TextInputType type = TextInputType.text,
  String? hint,
  bool enabled = true,
  String? Function(String?)? validator,
}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          color: Color(0xFF003648),
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      const SizedBox(height: 6),
      TextFormField(
        controller: controller,
        keyboardType: type,
        enabled: enabled,
        autovalidateMode: submitted
            ? AutovalidateMode.onUserInteraction
            : AutovalidateMode.disabled,
        validator:
            validator ??
            (value) => value == null || value.trim().isEmpty
                ? "This field is required"
                : null,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
          filled: true,
          fillColor: Colors.white,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 10,
            vertical: 10,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: Colors.grey.shade200, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: const BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(
              color: const Color(0xFF00657F).withOpacity(0.8),
              width: 1.8,
            ),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: const BorderRadius.all(Radius.circular(14)),
            borderSide: BorderSide(color: Colors.orange.shade300, width: 1.5),
          ),
          errorStyle: const TextStyle(color: Color(0xFFFF6F00), fontSize: 11),
        ),
      ),
      const SizedBox(height: 16),
    ],
  );
}
