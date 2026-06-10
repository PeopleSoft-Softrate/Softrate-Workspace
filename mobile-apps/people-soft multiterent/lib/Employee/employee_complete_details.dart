import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;

/// Post-login screen shown to employees whose completeDetails == false.
/// The user can Skip or fill in and submit the deferred fields.
class EmployeeCompleteDetails extends StatefulWidget {
  /// MongoDB _id of the employee record
  final String employeeMongoId;
  /// Called when the user successfully submits OR taps "Skip for now"
  final void Function(BuildContext) onDone;

  const EmployeeCompleteDetails({
    super.key,
    required this.employeeMongoId,
    required this.onDone,
  });

  @override
  State<EmployeeCompleteDetails> createState() =>
      _EmployeeCompleteDetailsState();
}

class _EmployeeCompleteDetailsState extends State<EmployeeCompleteDetails> {
  final _formKey = GlobalKey<FormState>();
  bool isSubmitting = false;

  // SECTION 1 – Education
  String? highestQualification;
  final List<String> qualifications = [
    'High School',
    'UG',
    'PG',
    'PhD',
    'Other',
  ];
  final TextEditingController specializationController =
      TextEditingController();
  final TextEditingController collegeController = TextEditingController();
  String? yearOfPassing;
  final List<String> passingYears = List.generate(
    50,
    (index) => '${DateTime.now().year - index}',
  );

  // SECTION 2 – Marksheets & CGPA
  final TextEditingController ugCgpaController = TextEditingController();
  final TextEditingController pgCgpaController = TextEditingController();
  File? marksheet10File;
  File? marksheet12File;
  File? ugCertificateFile;
  File? pgCertificateFile;

  // SECTION 3 – Experience
  bool isExperienced = false;
  final TextEditingController totalExperienceController =
      TextEditingController();
  final TextEditingController prevOrgController = TextEditingController();
  final TextEditingController prevDesignationController =
      TextEditingController();
  File? experienceLetterFile;
  File? relievingLetterFile;

  // SECTION 4 – Identification Documents
  File? resumeFile;
  File? passportPhotoFile;
  File? aadhaarFile;
  File? panFile;
  File? bankDetailsFile;

  final String baseUrl = getBaseUrl();

  @override
  void dispose() {
    specializationController.dispose();
    collegeController.dispose();
    ugCgpaController.dispose();
    pgCgpaController.dispose();
    totalExperienceController.dispose();
    prevOrgController.dispose();
    prevDesignationController.dispose();
    super.dispose();
  }

  Future<void> pickFile(
    Function(File) assignFile,
    File? currentFile, {
    List<String>? allowedExtensions,
  }) async {
    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: allowedExtensions == null ? FileType.any : FileType.custom,
      allowedExtensions: allowedExtensions,
    );

    if (result != null && result.files.single.path != null) {
      final selectedPath = result.files.single.path!;
      final selectedFileName = selectedPath.split('/').last;

      final allSelectedFiles = [
        marksheet10File,
        marksheet12File,
        ugCertificateFile,
        pgCertificateFile,
        experienceLetterFile,
        relievingLetterFile,
        resumeFile,
        passportPhotoFile,
        aadhaarFile,
        panFile,
        bankDetailsFile,
      ];

      if (currentFile != null) {
        allSelectedFiles.removeWhere((f) => f == currentFile);
      }

      bool isDuplicate = allSelectedFiles.any(
          (f) => f != null && f.path.split('/').last == selectedFileName);

      if (isDuplicate) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Please upload a relevant file. This file is already selected."),
              backgroundColor: Colors.red,
            ),
          );
        }
        return;
      }

      setState(() => assignFile(File(selectedPath)));
    }
  }

  Future<void> _submit() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (isSubmitting) return;

    if (!_formKey.currentState!.validate()) return;

    setState(() => isSubmitting = true);

    try {
      final uri = Uri.parse(
        '$baseUrl/api/employee/complete-details/${widget.employeeMongoId}',
      );
      final request = http.MultipartRequest('POST', uri);

      // Education fields
      request.fields['qualification'] = highestQualification ?? '';
      request.fields['specialization'] = specializationController.text.trim();
      request.fields['college'] = collegeController.text.trim();
      request.fields['passingYear'] = yearOfPassing ?? '';
      request.fields['ugCgpa'] = ugCgpaController.text.trim();
      request.fields['pgCgpa'] = pgCgpaController.text.trim();

      // Experience fields
      request.fields['isExperienced'] = isExperienced.toString();
      if (isExperienced) {
        request.fields['experienceYears'] =
            totalExperienceController.text.trim();
        request.fields['previousOrg'] = prevOrgController.text.trim();
        request.fields['designation'] = prevDesignationController.text.trim();
      }

      // File attachments
      Future<void> attach(File? f, String name) async {
        if (f == null) return;
        request.files.add(
          http.MultipartFile(
            name,
            f.readAsBytes().asStream(),
            await f.length(),
            filename: f.path.split('/').last,
          ),
        );
      }

      await attach(marksheet10File, 'marksheet10');
      await attach(marksheet12File, 'marksheet12');
      await attach(ugCertificateFile, 'ugCertificate');
      await attach(pgCertificateFile, 'pgCertificate');
      await attach(experienceLetterFile, 'experienceLetter');
      await attach(relievingLetterFile, 'relievingLetter');
      await attach(resumeFile, 'resume');
      await attach(passportPhotoFile, 'photo');
      await attach(aadhaarFile, 'aadhaar');
      await attach(panFile, 'pan');
      await attach(bankDetailsFile, 'bankProof');

      final response = await http.send(request);

      if (!mounted) return;

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Profile details saved successfully!"),
            backgroundColor: Colors.green,
          ),
        );
        widget.onDone(context);
      } else {
        String errorMsg = "Submission failed";
        try {
          final responseData =
              jsonDecode(await response.stream.bytesToString());
          errorMsg = responseData['message'] ?? errorMsg;
        } catch (_) {}
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(errorMsg), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      debugPrint('Complete details error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Something went wrong. Try again.")),
        );
      }
    } finally {
      if (mounted) setState(() => isSubmitting = false);
    }
  }

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
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              // ── Header ──────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00657F), Color(0xFF003648)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.25),
                        blurRadius: 12,
                        offset: const Offset(0, 8),
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
                                "Complete Your Profile",
                                style: TextStyle(
                                  color: Color(0xFF8ED1DC),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              Text(
                                "Almost Done!",
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 26,
                                  height: 1.1,
                                ),
                              ),
                            ],
                          ),
                          // Skip for now button
                          TextButton(
                            onPressed: () => widget.onDone(context),
                            style: TextButton.styleFrom(
                              backgroundColor:
                                  Colors.white.withOpacity(0.15),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 8,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  "Skip for now",
                                  style: TextStyle(fontSize: 13),
                                ),
                                SizedBox(width: 4),
                                Icon(Icons.arrow_forward_ios, size: 12),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Container(
                        width: 45,
                        height: 3,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFA726),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        "Help us know you better. These details can be submitted now or later, but are required before HR can fully review your profile.",
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.8),
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // ── Form Card ──────────────────────────────────────────
              Expanded(
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(28),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black12,
                        blurRadius: 10,
                        offset: Offset(0, -5),
                      ),
                    ],
                  ),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      16,
                      20,
                      16,
                      MediaQuery.of(context).padding.bottom + 24,
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // EDUCATION
                          _sectionHeader(
                            "Education",
                            icon: Icons.school_outlined,
                          ),
                          _dropdownField(
                            "Highest Qualification *",
                            highestQualification,
                            qualifications,
                            (val) =>
                                setState(() => highestQualification = val),
                          ),
                          _inputField(
                            "Stream/Specialization *",
                            specializationController,
                          ),
                          _inputField(
                            "College/University Name *",
                            collegeController,
                          ),
                          _dropdownField(
                            "Year of Passing *",
                            yearOfPassing,
                            passingYears,
                            (val) => setState(() => yearOfPassing = val),
                          ),

                          // CGPA / MARKSHEETS
                          _sectionHeader(
                            "Marksheets & CGPA",
                            icon: Icons.folder_open_outlined,
                          ),
                          _inputField(
                            "Total CGPA in UG *",
                            ugCgpaController,
                            type: TextInputType.number,
                          ),
                          _inputField(
                            "Total CGPA in PG (optional)",
                            pgCgpaController,
                            type: TextInputType.number,
                            validator: (_) => null,
                          ),
                          _filePickerField(
                            "10th Marksheet (PDF) *",
                            marksheet10File,
                            (f) => marksheet10File = f,
                            ['pdf'],
                          ),
                          _filePickerField(
                            "12th Marksheet (PDF) *",
                            marksheet12File,
                            (f) => marksheet12File = f,
                            ['pdf'],
                          ),
                          _filePickerField(
                            "UG Certificate (PDF) *",
                            ugCertificateFile,
                            (f) => ugCertificateFile = f,
                            ['pdf'],
                          ),
                          _filePickerField(
                            "PG Certificate (PDF, optional)",
                            pgCertificateFile,
                            (f) => pgCertificateFile = f,
                            ['pdf'],
                            required: false,
                          ),

                          // EXPERIENCE TYPE
                          _sectionHeader(
                            "Experience Type",
                            icon: Icons.work_outline,
                          ),
                          Container(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF7F9FC),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: const Color(0xFFE1E6F0),
                              ),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: RadioListTile<bool>(
                                    dense: true,
                                    title: const Text("Fresher"),
                                    value: false,
                                    groupValue: isExperienced,
                                    onChanged: (val) => setState(
                                      () => isExperienced = val ?? false,
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: RadioListTile<bool>(
                                    dense: true,
                                    title: const Text("Experienced"),
                                    value: true,
                                    groupValue: isExperienced,
                                    onChanged: (val) => setState(
                                      () => isExperienced = val ?? false,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          if (isExperienced) ...[
                            _sectionHeader(
                              "Experience Details",
                              icon: Icons.badge_outlined,
                            ),
                            _inputField(
                              "Total Years of Experience",
                              totalExperienceController,
                              type: TextInputType.number,
                              validator: (_) => null,
                            ),
                            _inputField(
                              "Previous Organization(s)",
                              prevOrgController,
                              validator: (_) => null,
                            ),
                            _inputField(
                              "Previous Designation(s)",
                              prevDesignationController,
                              validator: (_) => null,
                            ),
                            _filePickerField(
                              "Experience Letter (PDF)",
                              experienceLetterFile,
                              (f) => experienceLetterFile = f,
                              ['pdf'],
                              required: false,
                            ),
                            _filePickerField(
                              "Relieving Letter (PDF)",
                              relievingLetterFile,
                              (f) => relievingLetterFile = f,
                              ['pdf'],
                              required: false,
                            ),
                          ],

                          // IDENTIFICATION DOCUMENTS
                          _sectionHeader(
                            "Identification Documents",
                            icon: Icons.verified_user_outlined,
                          ),
                          _filePickerField(
                            "Updated Resume (PDF) *",
                            resumeFile,
                            (f) => resumeFile = f,
                            ['pdf'],
                          ),
                          _filePickerField(
                            "Passport-Size Photo (JPG/PNG) *",
                            passportPhotoFile,
                            (f) => passportPhotoFile = f,
                            ['jpg', 'png', 'jpeg'],
                          ),
                          _filePickerField(
                            "Aadhaar Card (PDF) *",
                            aadhaarFile,
                            (f) => aadhaarFile = f,
                            ['pdf'],
                          ),
                          _filePickerField(
                            "PAN Card (PDF) *",
                            panFile,
                            (f) => panFile = f,
                            ['pdf'],
                          ),
                          _filePickerField(
                            "Bank Account Details (PDF) *",
                            bankDetailsFile,
                            (f) => bankDetailsFile = f,
                            ['pdf'],
                          ),

                          const SizedBox(height: 28),

                          // Submit button
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: isSubmitting ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF008C9E),
                                foregroundColor: Colors.white,
                                minimumSize: const Size.fromHeight(52),
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
                                        valueColor:
                                            AlwaysStoppedAnimation<Color>(
                                          Colors.white,
                                        ),
                                      ),
                                    )
                                  : const Text(
                                      "Save & Continue",
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                            ),
                          ),

                          const SizedBox(height: 12),

                          // Skip link (secondary)
                          SizedBox(
                            width: double.infinity,
                            child: TextButton(
                              onPressed: () => widget.onDone(context),
                              child: Text(
                                "Skip for now — I'll complete this later",
                                style: TextStyle(
                                  color: Colors.grey[500],
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ------------- HELPER WIDGETS -------------

  Widget _sectionHeader(String title, {required IconData icon}) {
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

  InputDecoration _deco(String label) => InputDecoration(
        labelText: label,
        floatingLabelBehavior: FloatingLabelBehavior.auto,
        filled: true,
        fillColor: const Color(0xFFF7F9FC),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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

  Widget _inputField(
    String label,
    TextEditingController controller, {
    TextInputType type = TextInputType.text,
    String? Function(String?)? validator,
    int maxLines = 1,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: TextFormField(
        controller: controller,
        keyboardType: type,
        maxLines: maxLines,
        inputFormatters: inputFormatters,
        validator: validator ??
            (val) => val == null || val.trim().isEmpty
                ? 'This field is required'
                : null,
        decoration: _deco(label),
      ),
    );
  }

  Widget _dropdownField(
    String label,
    String? value,
    List<String> options,
    Function(String?) onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: DropdownButtonFormField<String>(
        isExpanded: true,
        value: value,
        items: options
            .map((e) => DropdownMenuItem(value: e, child: Text(e)))
            .toList(),
        onChanged: onChanged,
        decoration: _deco(label),
        validator: (val) => val == null ? 'This field is required' : null,
      ),
    );
  }

  Widget _filePickerField(
    String label,
    File? file,
    Function(File) onPicked,
    List<String> extensions, {
    bool required = true,
  }) {
    final fileName =
        file != null ? file.path.split('/').last : 'No file chosen';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F9FC),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: file != null
                ? const Color(0xFF008C9E).withOpacity(0.4)
                : const Color(0xFFE1E6F0),
          ),
        ),
        child: Row(
          children: [
            Icon(
              file != null
                  ? Icons.check_circle_outline
                  : Icons.upload_file_outlined,
              size: 18,
              color: file != null
                  ? const Color(0xFF008C9E)
                  : Colors.grey[400],
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    fileName,
                    style: TextStyle(
                      fontSize: 13,
                      color: file == null
                          ? Colors.grey[400]
                          : const Color(0xFF102A43),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFFE0F4F7),
                foregroundColor: const Color(0xFF008C9E),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
              onPressed: () => pickFile(onPicked, file, allowedExtensions: extensions),
              child: const Text(
                "Choose",
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
