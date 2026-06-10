import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/success_dialog.dart';
import 'package:hrmappfrontend/intern/userdashboard.dart';

class FormTwo extends StatefulWidget {
  final String internName;
  const FormTwo({super.key, required this.internName});

  @override
  State<FormTwo> createState() => _FormTwoState();
}

class _FormTwoState extends State<FormTwo> {
  String get name => widget.internName;

  File? aadhaarFile;
  File? collegeIdFile;
  File? annexureFile;
  File? ndaFile;
  File? passbookFile;

  bool consentGiven = false;
  bool infoAccurate = false;
  bool consentBgVerification = false;
  bool agreeCommunication = false;

  bool isUploading = false;
  int uploadedCount = 0;
  int totalFiles = 0;

  Map<String, bool> showFieldError = {
    'aadhaar': false,
    'college': false,
    'annexure': false,
    'nda': false,
    'passbook': false,
  };

  Map<String, bool?> uploadStatus = {
    'aadhaar': null,
    'college': null,
    'annexure': null,
    'nda': null,
    'passbook': null,
  };

  final String backendUrl = "${getBaseUrl()}/api/upload";

  Future<void> pickFile(String type) async {
    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
      withData: false,
      withReadStream: false,
    );

    if (result == null || result.files.single.path == null) return;

    final fileInfo = result.files.single;
    final path = fileInfo.path!;
    final sizeBytes = fileInfo.size;
    const maxSizeBytes = 2 * 1024 * 1024; // 2 MB

    if (!path.toLowerCase().endsWith('.pdf')) {
      _showSnackBar("Only PDF files are allowed.", const Color(0xFFB00020));
      return;
    }

    if (sizeBytes > maxSizeBytes) {
      _showSnackBar("File must be less than 2 MB.", const Color(0xFFB00020));
      return;
    }

    final selectedFileName = path.split('/').last;

    final allSelectedFiles = [
      if (type != 'aadhaar') aadhaarFile,
      if (type != 'college') collegeIdFile,
      if (type != 'annexure') annexureFile,
      if (type != 'nda') ndaFile,
      if (type != 'passbook') passbookFile,
    ];

    bool isDuplicate = allSelectedFiles.any(
        (f) => f != null && f.path.split('/').last == selectedFileName);

    if (isDuplicate) {
      _showSnackBar("Please upload a relevant file. This file is already selected.", const Color(0xFFB00020));
      return;
    }

    setState(() {
      final file = File(path);
      switch (type) {
        case 'aadhaar':
          aadhaarFile = file;
          break;
        case 'college':
          collegeIdFile = file;
          break;
        case 'annexure':
          annexureFile = file;
          break;
        case 'nda':
          ndaFile = file;
          break;
        case 'passbook':
          passbookFile = file;
          break;
      }
      uploadStatus[type] = null;
      showFieldError[type] = false;
    });
  }

  Future<void> updateInternStatus(String internId, String newStatus) async {
    final url = Uri.parse("${getBaseUrl()}/api/intern/update-status");

    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "internId": internId,
        "status": newStatus,
      }),
    );

    if (response.statusCode == 200) {
      debugPrint("Status updated successfully");
    } else {
      debugPrint("Failed to update intern status: ${response.body}");
    }
  }

  Future<String?> _getInternId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('internId');
  }

  Future<void> uploadAll() async {
    FocusManager.instance.primaryFocus?.unfocus();
    if (!infoAccurate ||
        !consentBgVerification ||
        !agreeCommunication ||
        !consentGiven) {
      _showSnackBar(
        "Please agree to all declarations and consents before uploading.",
        const Color(0xFFFFA726),
      );
      return;
    }

    final requiredMap = <String, File?>{
      'aadhaar': aadhaarFile,
      'college': collegeIdFile,
      'annexure': annexureFile,
      'nda': ndaFile,
      'passbook': passbookFile,
    };

    bool hasMissingRequired = false;
    requiredMap.forEach((key, file) {
      if (file == null) {
        hasMissingRequired = true;
        showFieldError[key] = true;
      }
    });

    if (hasMissingRequired) {
      setState(() {});
      _showSnackBar(
        "Please upload all required documents.",
        const Color(0xFFB00020),
      );
      return;
    }

    final internId = await _getInternId();
    if (internId == null || internId.isEmpty) {
      _showSnackBar(
        "Intern ID not found. Please login again.",
        const Color(0xFFB00020),
      );
      return;
    }

    setState(() {
      isUploading = true;
      uploadedCount = 0;
      totalFiles = 5;
      uploadStatus.updateAll((key, value) => null);
    });

    final uri = Uri.parse("${getBaseUrl()}/api/send-documents");
    final request = http.MultipartRequest('POST', uri);

    request.fields['internName'] = name;
    request.fields['internId'] = internId;

    final files = [
      {'file': aadhaarFile, 'name': 'Aadhaar.pdf', 'type': 'aadhaar'},
      {'file': collegeIdFile, 'name': 'CollegeID.pdf', 'type': 'college'},
      {'file': annexureFile, 'name': 'Annexure.pdf', 'type': 'annexure'},
      {'file': ndaFile, 'name': 'NDA.pdf', 'type': 'nda'},
      {'file': passbookFile, 'name': 'Passbook.pdf', 'type': 'passbook'},
    ];

    for (var f in files) {
      final path = (f['file'] as File).path;
      final typeName = (f['name'] as String).split('.').first.toLowerCase();
      final finalName = "${internId}_$typeName.pdf";

      request.files.add(
        await http.MultipartFile.fromPath(
          "files",
          path,
          filename: finalName,
        ),
      );
    }

    try {
      final response = await http.send(request);
      final body = await response.stream.bytesToString();

      setState(() => isUploading = false);

      if (response.statusCode == 200) {
        setState(() {
          uploadStatus.updateAll((key, value) => true);
        });

        await updateInternStatus(internId, "ongoing");
        showSuccessPopup(
          context,
          "Your application is submitted and thank you for applying!",
          targetPage: const AttendancePage(),
        );
        return;
      } else {
        setState(() {
          uploadStatus.updateAll((key, value) => value ?? false);
        });
        _showSnackBar(
          "Upload failed: ${response.statusCode} - $body",
          const Color(0xFFB00020),
        );
      }
    } catch (e) {
      setState(() => isUploading = false);
      _showSnackBar(
        "Upload error: ${e.toString()}",
        const Color(0xFFB00020),
      );
    }

    setState(() {});
  }

  String _mapOriginalNameToTypeKey(String typeName) {
    switch (typeName) {
      case 'aadhaar':
        return 'aadhaar';
      case 'collegeid':
      case 'id':
        return 'college';
      case 'annexure':
        return 'annexure';
      case 'nda':
        return 'nda';
      case 'passbook':
        return 'passbook';
      default:
        return typeName;
    }
  }

  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.info, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: color,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Widget documentCard({
    required String title,
    required String subtitle,
    required String type,
    required File? file,
    required IconData icon,
    required bool requiredDoc,
  }) {
    final bool showError = showFieldError[type] == true;
    final bool? status = uploadStatus[type];

    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
        border: Border.all(
          color: showError ? Colors.red.shade300 : Colors.grey.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [Color(0xFF00657F), Color(0xFF00ACC1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Icon(icon, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF003648),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              if (requiredDoc)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEE),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    "Required",
                    style: TextStyle(
                      color: Color(0xFFB00020),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: 220,
            height: 44,
            child: OutlinedButton.icon(
              onPressed: isUploading ? null : () => pickFile(type),
              icon: Icon(
                file == null ? Icons.upload_file : Icons.edit,
                size: 20,
                color: const Color(0xFF00657F),
              ),
              label: Text(
                file == null ? "Select PDF file" : file.path.split('/').last,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF00657F),
                ),
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
                side: const BorderSide(
                  color: Color(0xFF00657F),
                  width: 1.4,
                ),
                backgroundColor: Colors.white,
              ),
            ),
          ),
          if (showError) ...[
            const SizedBox(height: 8),
            Text(
              "Please upload this document.",
              style: TextStyle(
                color: Colors.red.shade700,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ] else if (status != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  status ? Icons.check_circle : Icons.error,
                  color: status ? const Color(0xFF2E7D32) : const Color(0xFFB00020),
                  size: 18,
                ),
                const SizedBox(width: 6),
                Text(
                  status ? "Uploaded successfully" : "Upload failed",
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color:
                        status ? const Color(0xFF2E7D32) : const Color(0xFFB00020),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildConsentCheckbox({
    required bool value,
    required ValueChanged<bool?> onChanged,
    required String text,
  }) {
    return CheckboxListTile(
      value: value,
      onChanged: isUploading ? null : onChanged,
      dense: true,
      contentPadding: EdgeInsets.zero,
      activeColor: const Color(0xFF00657F),
      title: Text(
        text,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
      ),
      controlAffinity: ListTileControlAffinity.leading,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        title: const Text(
          "Complete Profile",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        foregroundColor: Colors.white,
        flexibleSpace: Container(
          color: const Color(0xFF00657F),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (isUploading) ...[
              LinearProgressIndicator(
                value: totalFiles > 0 ? uploadedCount / totalFiles : null,
                backgroundColor: Colors.grey.shade300,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  Color(0xFF00657F),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                totalFiles > 0
                    ? "Uploading $uploadedCount/$totalFiles"
                    : "Uploading...",
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF00657F),
                ),
              ),
              const SizedBox(height: 16),
            ],
            Text(
              "Hi $name, please upload the following documents in PDF format.",
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Color(0xFF212121),
              ),
            ),
            const SizedBox(height: 16),

            documentCard(
              title: "Aadhaar Card",
              subtitle: "• Max 2 MB",
              type: 'aadhaar',
              file: aadhaarFile,
              icon: Icons.badge,
              requiredDoc: true,
            ),
            documentCard(
              title: "College ID / Bonafide",
              subtitle: "• Max 2 MB",
              type: 'college',
              file: collegeIdFile,
              icon: Icons.school,
              requiredDoc: true,
            ),
            documentCard(
              title: "Internship Annexure",
              subtitle: "• Max 2 MB",
              type: 'annexure',
              file: annexureFile,
              icon: Icons.description_outlined,
              requiredDoc: true,
            ),
            documentCard(
              title: "Internship NDA",
              subtitle: "• Max 2 MB",
              type: 'nda',
              file: ndaFile,
              icon: Icons.privacy_tip_outlined,
              requiredDoc: true,
            ),
            documentCard(
              title: "Bank Passbook",
              subtitle: "• Max 2 MB",
              type: 'passbook',
              file: passbookFile,
              icon: Icons.account_balance_wallet_outlined,
              requiredDoc: true,
            ),

            const SizedBox(height: 8),
            const Divider(),
            const SizedBox(height: 4),

            _buildConsentCheckbox(
              value: consentGiven,
              onChanged: (v) => setState(() => consentGiven = v ?? false),
              text: "I consent to upload my documents for verification.",
            ),
            _buildConsentCheckbox(
              value: infoAccurate,
              onChanged: (v) => setState(() => infoAccurate = v ?? false),
              text: "I declare that the information provided is accurate.",
            ),
            _buildConsentCheckbox(
              value: consentBgVerification,
              onChanged: (v) =>
                  setState(() => consentBgVerification = v ?? false),
              text: "I consent to background verification by the company.",
            ),
            _buildConsentCheckbox(
              value: agreeCommunication,
              onChanged: (v) => setState(() => agreeCommunication = v ?? false),
              text:
                  "I agree to receive communication through WhatsApp and email.",
            ),

            const SizedBox(height: 20),
            SizedBox(
              height: 54,
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF00657F), Color(0xFF00ACC1)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.all(Radius.circular(16)),
                ),
                child: ElevatedButton(
                  onPressed: isUploading ? null : uploadAll,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: isUploading
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            ),
                            SizedBox(width: 12),
                            Text(
                              "Uploading...",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        )
                      : const Text(
                          "Upload All Documents",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
