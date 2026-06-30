import 'dart:convert';
import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:intl/intl.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;

class TerminationForm extends StatefulWidget {
  final String internName;
  final String internId;
  final String department;

  const TerminationForm({
    required this.internName,
    required this.internId,
    required this.department,
    super.key,
  });

  @override
  State<TerminationForm> createState() => _TerminationFormState();
}

class _TerminationFormState extends State<TerminationForm> {
  final String lastWorkingDay =
      DateFormat("dd MMM yyyy").format(DateTime.now());

  // Exit fields
  final String exitType = "Offboarding";
  String? exitReason;
  String? assetReturn;

  final List<String> exitReasons = [
    "End of Internship",
    "Other",
  ];

  final List<String> assetStatus = [
    "All Returned",
    "Pending",
    "Not Applicable",
  ];

  final TextEditingController otherReasonController = TextEditingController();
  String? otherReasonText;

  // Project Links
  final List<TextEditingController> projectLinkControllers =
      List.generate(5, (_) => TextEditingController());
  int visibleProjectLinks = 1;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        centerTitle: true,
        title: const Text(
          "Exit Process Form",
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        flexibleSpace: Container(
          color: const Color(0xFF00657F), // teal header
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        foregroundColor: Colors.white,
        backgroundColor: Colors.transparent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Section
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF00657F).withOpacity(0.08),
                    const Color(0xFF00ACC1).withOpacity(0.05),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(0xFF00657F).withOpacity(0.25),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: const BoxDecoration(
                      color: Color(0xFF00ACC1) ,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.person_remove,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Exit Clearance",
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          "Complete all fields for final clearance",
                          style: TextStyle(
                            fontSize: 14,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Info Cards Grid
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 2.0,
              children: [
                _buildInfoCard(
                  "Intern Name",
                  widget.internName,
                  Icons.person,
                  const Color(0xFF00ACC1)
                ),
                _buildInfoCard(
                  "Intern ID",
                  widget.internId,
                  Icons.badge,
                  const Color(0xFF00ACC1),
                ),
                _buildInfoCard(
                  "Department",
                  widget.department,
                  Icons.business,
                  const Color(0xFF00ACC1),
                ),
                _buildInfoCard(
                  "Last Working Day",
                  lastWorkingDay,
                  Icons.calendar_today,
                  const Color(0xFF00ACC1),
                ),
              ],
            ),
            const SizedBox(height: 32),

            _buildSectionHeader("Exit Details"),
            const SizedBox(height: 20),

            // Exit Type (read-only)
            _buildReadOnlyField(
              label: "Exit Type",
              value: exitType,
              icon: Icons.logout,
            ),
            const SizedBox(height: 20),

            _buildDropdownField(
              "Exit Reason *",
              exitReason,
              exitReasons,
              Icons.person_rounded,
              (val) {
                setState(() {
                  exitReason = val;
                  if (exitReason != "Other") {
                    otherReasonController.clear();
                    otherReasonText = null;
                  }
                });
              },
            ),
            const SizedBox(height: 16),

            if (exitReason == "Other") ...[
              _buildTextAreaField(
                "Specify Other Reason *",
                otherReasonController,
                Icons.edit_note_rounded,
                (val) => otherReasonText = val,
              ),
              const SizedBox(height: 20),
            ],

            _buildDropdownField(
              "Asset Return Status *",
              assetReturn,
              assetStatus,
              Icons.inventory_2,
              (val) => setState(() => assetReturn = val),
            ),
            const SizedBox(height: 32),

            // ------------- PROJECT LINKS SECTION -------------
            _buildSectionHeader("Project Links (Optional)"),
            const SizedBox(height: 8),
            const Text(
              "Add up to 5 project links",
              style: TextStyle(
                color: Color(0xFF64748B),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 16),
            ...List.generate(visibleProjectLinks, (index) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: _buildTextField(
                  "Project Link ${index + 1}",
                  projectLinkControllers[index],
                  Icons.link,
                ),
              );
            }),
            if (visibleProjectLinks < 5)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () {
                    setState(() {
                      visibleProjectLinks++;
                    });
                  },
                  icon: const Icon(Icons.add_circle_outline, color: Color(0xFF00657F), size: 20),
                  label: const Text(
                    "Add Another Link",
                    style: TextStyle(
                      color: Color(0xFF00657F),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    backgroundColor: const Color(0xFF00657F).withValues(alpha: 0.1),
                  ),
                ),
              ),
            const SizedBox(height: 24),

            // Submit Button
            Container(
              width: double.infinity,
              height: 56,
              decoration: BoxDecoration(
                color: Color(0xFF00657F),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00657F).withOpacity(0.35),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: submitForm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.send_rounded, color: Colors.white),
                    SizedBox(width: 12),
                    Text(
                      "Submit Exit Form",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
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

  // ---------------- UI helpers ----------------

  Widget _buildInfoCard(
      String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 24,
          decoration: BoxDecoration(
            color: const Color(0xFF00657F),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }

  Widget _buildReadOnlyField({
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00657F).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: const Color(0xFF00ACC1) ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 16,
                    color: Color(0xFF1E293B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownField(
    String label,
    String? value,
    List<String> items,
    IconData icon,
    Function(String?) onChanged,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: DropdownButtonFormField2<String>(
        value: value,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
          ),
          prefixIcon: Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00657F).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: const Color(0xFF00ACC1)),
          ),
          border: InputBorder.none,
          contentPadding: EdgeInsets.zero,
        ),
        items: items
            .map(
              (e) => DropdownMenuItem(
                value: e,
                child: Text(e),
              ),
            )
            .toList(),
        onChanged: onChanged,
        dropdownStyleData: DropdownStyleData(
          width: MediaQuery.of(context).size.width * 0.91,
          offset: const Offset(-15, 0),
          decoration: BoxDecoration(
            color: Colors.white, // 👈 clean white background
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
        style: const TextStyle(
          fontSize: 16,
          color: Color(0xFF1E293B),
        ),
      ),
    );
  }

  Widget _buildTextAreaField(
    String label,
    TextEditingController controller,
    IconData icon,
    Function(String) onChanged,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TextField(
        controller: controller,
        maxLines: 4,
        onChanged: onChanged,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
          ),
          prefixIcon: Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00657F).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: const Color(0xFF00657F)),
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade200),
          ),
          focusedBorder: const OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: Color(0xFF00657F), width: 2),
          ),
          contentPadding:
              const EdgeInsets.symmetric(vertical: 16, horizontal: 0),
        ),
      ),
    );
  }

  Widget _buildTextField(
    String label,
    TextEditingController controller,
    IconData icon,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
          ),
          prefixIcon: Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF00657F).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: const Color(0xFF00657F)),
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 0),
        ),
      ),
    );
  }

  // ---------------- submit logic ----------------

  void submitForm() async {
    if (exitReason == null || assetReturn == null) {
      _showSnackBar("Please complete all required fields", const Color(0xFFFFA726));
      return;
    }

    if (exitReason == "Other" &&
        (otherReasonText == null || otherReasonText!.isEmpty)) {
      _showSnackBar(
          "Please specify the reason for 'Other'", const Color(0xFFFFA726));
      return;
    }

    _showSnackBar("Submitting...", const Color(0xFF00657F),
        duration: const Duration(seconds: 1));

    final checkUrl =
        Uri.parse("${getBaseUrl()}/api/resignation/check/${widget.internId}");
    final checkRes = await http.get(checkUrl);

    if (checkRes.statusCode == 200) {
      final data = jsonDecode(checkRes.body);
      if (data["exists"] == true) {
        _showSnackBar("Offboarding already submitted", const Color(0xFFB00020));
        return;
      }
    }

    // Collect project links
    final List<String> links = projectLinkControllers
        .map((c) => c.text.trim())
        .where((text) => text.isNotEmpty)
        .toList();

    final formData = {
      "fullName": widget.internName,
      "userId": widget.internId,
      "userType": "intern",
      "department": widget.department,
      "lastWorkingDay": lastWorkingDay,
      "exitType": exitType,
      "exitReason": exitReason == "Other" ? otherReasonText : exitReason,
      "assetReturnStatus": assetReturn,
      "projectLinks": links,
    };

    final url = Uri.parse("${getBaseUrl()}/api/resignation/submit");
    final res = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(formData),
    );

    final body = jsonDecode(res.body);
    if (res.statusCode == 200 && body["success"] == true) {
      _showSnackBar(
          "Exit form submitted successfully!", const Color(0xFF2E7D32));
      Navigator.pop(context);
    } else {
      _showSnackBar(body["message"] ?? "Submission failed",
          const Color(0xFFB00020));
    }
  }

  void _showSnackBar(
    String message,
    Color color, {
    Duration duration = const Duration(seconds: 3),
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: duration,
      ),
    );
  }
}
