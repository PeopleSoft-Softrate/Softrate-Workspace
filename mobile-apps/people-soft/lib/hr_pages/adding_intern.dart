import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/hr_pages/intern_service.dart';
import 'package:hrmappfrontend/main.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:printing/printing.dart';



class AddingIntern extends StatefulWidget {
  const AddingIntern({super.key});

  @override
  State<AddingIntern> createState() => _AddingInternState();
}

class _AddingInternState extends State<AddingIntern> {
  List<dynamic> interns = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    loadInterns();
  }

  void loadInterns() async {
    try {
      final data = await InternService.fetchInitialInterns();
      if (mounted) {
        setState(() {
          interns = data;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Failed to load applicants: $e")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Safer counting
    final internshipCount = interns.where((i) {
      if (i is! Map) return false;
      final type = i["applicationType"] ?? "Internship";
      return type == "Internship";
    }).length;

    final jobCount = interns.where((i) {
      if (i is! Map) return false;
      return i["applicationType"] == "Job";
    }).length;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F1ED),
        appBar: AppBar(
          elevation: 0,
          backgroundColor: const Color(0xFF00657F),
          foregroundColor: Colors.white,
          title: const Text(
            'Pending Approvals',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          bottom: TabBar(
            indicatorColor: Colors.white,
            indicatorWeight: 3,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            tabs: [
              Tab(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text("Internships"),
                    if (internshipCount > 0) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          "$internshipCount",
                          style: const TextStyle(
                            color: Color(0xFF00657F),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Tab(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text("Jobs"),
                    if (jobCount > 0) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          "$jobCount",
                          style: const TextStyle(
                            color: Color(0xFF00657F),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF00657F)))
            : TabBarView(
                children: [
                  _buildInternList("Internship"),
                  _buildInternList("Job"),
                ],
              ),
      ),
    );
  }

  Widget _buildInternList(String type) {
    final w = MediaQuery.of(context).size.width;
    final filteredInterns = interns.where((i) {
      if (i is! Map) return false;
      final appType = i["applicationType"] ?? "Internship";
      return appType == type;
    }).toList();

    if (filteredInterns.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inbox_outlined, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              "No $type applications pending",
              style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return Container(
      width: w,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        itemCount: filteredInterns.length,
        itemBuilder: (context, index) {
          final intern = filteredInterns[index];
          if (intern is! Map<String, dynamic>) return const SizedBox.shrink();
          return _buildInternCard(intern);
        },
      ),
    );
  }

  Widget _buildInternCard(Map<String, dynamic> intern) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  intern["fullName"] ?? "-",
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF003648),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFF8ED1DC).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  intern["role"] ?? "-",
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF00657F),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _info("College", intern["college"]),
          _info("Year", intern["year"]),
          _info("Department", intern["department"]),
          _info("Email", intern["email"]),
          _info("Contact", intern["contact"]),
          _info("Emergency Contact", intern["emergencyContact"]),
          _linkedInRow(intern["linkedin"]),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF00657F)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: () => _showAddInternDialog(context, intern, loadInterns),
                  child: const Text(
                    "Accept",
                    style: TextStyle(
                      color: Color(0xFF00657F),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFFB00020),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: () async {
                    final confirm = await showRejectConfirmation(
                      context,
                      intern["fullName"] ?? "this application",
                    );
                    if (!confirm) return;
                    final ok = await InternService.rejectIntern(intern["_id"]);
                    if (ok && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text("${intern["fullName"]} rejected")),
                      );
                      loadInterns();
                    }
                  },
                  child: const Text(
                    "Reject",
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _info(String title, String? value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 12,
                color: Color(0xFF607D8B),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value?.toString() ?? "-",
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF222222),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
Widget _linkedInRow(String? url) {
  final link = url?.trim() ?? '';
  final hasLink = link.isNotEmpty;

  return Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(
          width: 120,
          child: Text(
            "LinkedIn",
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 12,
              color: Color(0xFF607D8B),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: hasLink
              ? InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => _openLink(link),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Text(
                        "View profile",
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF00657F),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(width: 6),
                      Icon(
                        Icons.open_in_new_rounded,
                        size: 16,
                        color: Color(0xFF00657F),
                      ),
                    ],
                  ),
                )
              : const Text(
                  "Not provided",
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF9E9E9E),
                  ),
                ),
        ),
      ],
    ),
  );
}

final List<String> roles = [
  'Data Analyst Intern',
  'Web developer Intern',
  'Artificial Intelligence Intern',
  'App developer Intern',
  'Digital Marketing Intern',
  'Sales Intern',
  'Graphics designer Intern',
  'Business developer (Sales) Intern',
  'Research & Development (R&D) Intern',
  'HR Analyst Intern',
  'Cybersecurity Analyst Intern',
  'Network Security Analyst Intern',
];

void _showAddInternDialog(
  BuildContext context,
  Map<String, dynamic> intern,
  Function onInternApproved,
) {
  final nameCtrl = TextEditingController(text: intern["fullName"]);
  final mailCtrl = TextEditingController(text: intern["email"]);
  final phoneCtrl = TextEditingController(text: intern["contact"]);

  DateTime? onboardingDate;
  String durationType = "day"; // day or month
  final durationCtrl = TextEditingController();
  DateTime? endDate;

  String selectedRole = 'Software Developer';
  String stipendType = "Stipend";

  void calculateEndDate() {
    if (onboardingDate == null || durationCtrl.text.isEmpty) return;

    int value = int.tryParse(durationCtrl.text) ?? 0;

    if (durationType == "day") {
      endDate = onboardingDate!.add(Duration(days: value));
    } else {
      endDate = DateTime(
        onboardingDate!.year,
        onboardingDate!.month + value,
        onboardingDate!.day,
      );
    }
  }

  showDialog(
  context: context,
  builder: (ctx) => Dialog(
    backgroundColor: Colors.white,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: StatefulBuilder(
        builder: (context, setStateSB) {
          return SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Center(
                  child: Text(
                    'Add Intern',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF00657F), // dark teal
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Name
                TextField(
                  controller: nameCtrl,
                  decoration: InputDecoration(
                    labelText: 'Intern Name',
                    labelStyle: TextStyle(color: Colors.grey[700]),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    floatingLabelStyle: const TextStyle(
                      color: Color(0xFF00657F), // focused label teal
                      fontWeight: FontWeight.w600,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: Color(0xFF42A5B9), // medium teal
                        width: 2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Email
                TextField(
                  controller: mailCtrl,
                  decoration: InputDecoration(
                    labelText: 'Email ID',
                    labelStyle: TextStyle(color: Colors.grey[700]),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    floatingLabelStyle: const TextStyle(
                      color: Color(0xFF00657F),
                      fontWeight: FontWeight.w600,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: Color(0xFF42A5B9),
                        width: 2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Phone
                TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: 'Phone Number',
                    labelStyle: TextStyle(color: Colors.grey[700]),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    floatingLabelStyle: const TextStyle(
                      color: Color(0xFF00657F),
                      fontWeight: FontWeight.w600,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: Color(0xFF42A5B9),
                        width: 2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Course/Role (read-only)
                TextField(
                  controller: TextEditingController(text: intern["role"]),
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: "Course/Role",
                    labelStyle: TextStyle(color: Colors.grey[700]),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    focusedBorder: const OutlineInputBorder(
                      borderRadius: BorderRadius.all(Radius.circular(12)),
                      borderSide: BorderSide(
                        color: Color(0xFF42A5B9),
                        width: 2,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Onboarding Date Picker
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2035),
                      builder: (context, child) => Theme(
                        data: Theme.of(context).copyWith(
                          colorScheme: const ColorScheme.light(
                            primary: Color(0xFF00657F), // dark teal
                            onPrimary: Colors.white,
                            onSurface: Colors.black87,
                          ),
                        ),
                        child: child!,
                      ),
                    );
                    if (picked != null) {
                      setStateSB(() {
                        onboardingDate = picked;
                        calculateEndDate();
                      });
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      vertical: 14,
                      horizontal: 14,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade400),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          onboardingDate == null
                              ? "Select Onboarding Date"
                              : "${onboardingDate!.day.toString().padLeft(2, '0')}-${onboardingDate!.month.toString().padLeft(2, '0')}-${onboardingDate!.year}",
                          style: TextStyle(
                            color: onboardingDate == null
                                ? Colors.grey[700]
                                : Colors.black87,
                          ),
                        ),
                        const Icon(
                          Icons.calendar_month,
                          color: Color(0xFF00657F),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Duration Type
                Row(
                  children: [
                    Radio<String>(
                      value: "day",
                      groupValue: durationType,
                      activeColor: const Color(0xFF00657F),
                      onChanged: (val) {
                        setStateSB(() {
                          durationType = val!;
                          durationCtrl.clear();
                          endDate = null;
                        });
                      },
                    ),
                    const Text("Days"),
                    const SizedBox(width: 20),
                    Radio<String>(
                      value: "month",
                      groupValue: durationType,
                      activeColor: const Color(0xFF00657F),
                      onChanged: (val) {
                        setStateSB(() {
                          durationType = val!;
                          durationCtrl.clear();
                          endDate = null;
                        });
                      },
                    ),
                    const Text("Months"),
                  ],
                ),

                // Duration input
                TextField(
                  controller: durationCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: durationType == "day"
                        ? "No. of Days"
                        : "No. of Months",
                    labelStyle: TextStyle(color: Colors.grey[700]),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    focusedBorder: const OutlineInputBorder(
                      borderRadius: BorderRadius.all(Radius.circular(12)),
                      borderSide: BorderSide(
                        color: Color(0xFF42A5B9),
                        width: 2,
                      ),
                    ),
                  ),
                  onChanged: (v) => setStateSB(() => calculateEndDate()),
                ),
                const SizedBox(height: 12),

                // End Date Preview
                if (endDate != null)
                  Text(
                    "End Date: ${endDate!.day.toString().padLeft(2, '0')}-${endDate!.month.toString().padLeft(2, '0')}-${endDate!.year}",
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: Color(0xFF003648),
                    ),
                  ),
                const SizedBox(height: 24),
                // Stipend / Paid
                const Text(
                  "Stipend Type",
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF003648),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Radio<String>(
                      value: "Stipend",
                      groupValue: stipendType,
                      activeColor: const Color(0xFF00657F),
                      onChanged: (val) {
                        setStateSB(() {
                          stipendType = val!;
                        });
                      },
                    ),
                    const Text("Stipend"),
                    const SizedBox(width: 20),
                    Radio<String>(
                      value: "Paid",
                      groupValue: stipendType,
                      activeColor: const Color(0xFF00657F),
                      onChanged: (val) {
                        setStateSB(() {
                          stipendType = val!;
                        });
                      },
                    ),
                    const Text("Paid"),
                  ],
                ),
                const SizedBox(height: 16),


                // Submit Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00657F),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: () async {
                      if (selectedRole.isEmpty ||
                          onboardingDate == null ||
                          durationCtrl.text.isEmpty ||
                          endDate == null ||
                          nameCtrl.text.isEmpty ||
                          mailCtrl.text.isEmpty ||
                          phoneCtrl.text.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            elevation: 0,
                            backgroundColor: Colors.transparent,
                            behavior: SnackBarBehavior.floating,
                            content: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFA726), // orange
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black26,
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: const [
                                  Icon(
                                    Icons.warning_amber_rounded,
                                    color: Colors.white,
                                    size: 28,
                                  ),
                                  SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      "Please fill all the fields",
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            duration: const Duration(seconds: 3),
                          ),
                        );
                        return;
                      }

                      await _generateAndSubmitOffer(
                        nameCtrl.text,
                        mailCtrl.text,
                        phoneCtrl.text,
                        intern["role"],
                        onboardingDate!,
                        durationType,
                        int.parse(durationCtrl.text),
                        endDate!,
                        intern["_id"],
                        onInternApproved,
                        stipendType, 
                      );
                      onInternApproved();
                      Navigator.pop(ctx);
                    },
                    child: const Text(
                      'Generate & Submit Offer Letter',
                      style: TextStyle(fontSize: 16, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    ),
  ),
);

}

Future<void> _generateAndSubmitOffer(
  String name,
  String email,
  String phone,
  String role,
  DateTime onboardingDate,
  String durationType, // "day" or "month"
  int durationValue, // number of days or months
  DateTime endDate,
  String internId,
  Function onInternApproved,
  String stipendType,        // NEW

) async {
  try {
    showDialog(
      context: navigatorKey.currentContext!,
      barrierDismissible: false,
      builder: (_) => Center(child: CircularProgressIndicator()),
    );
    // Calculate end date
    // DateTime endDate;
    // if (durationType == "day") {
    //   endDate = onboardingDate.add(Duration(days: durationValue));
    // } else {
    //   endDate = DateTime(
    //     onboardingDate.year,
    //     onboardingDate.month + durationValue,
    //     onboardingDate.day,
    //   );
    // }

    // Show loading dialog

    // Generate PDF
    final pdf = pw.Document();

    final logo = pw.MemoryImage(
      (await rootBundle.load(
        'assets/images/pdf_logo.png',
      )).buffer.asUint8List(),
    );

    final qr = pw.MemoryImage(
      (await rootBundle.load('assets/images/qr.png')).buffer.asUint8List(),
    );

    final signature = pw.MemoryImage(
      (await rootBundle.load(
        'assets/images/signature.png',
      )).buffer.asUint8List(),
    );

    final ttf = pw.Font.ttf(
      await rootBundle.load('assets/fonts/TimesNewRoman.ttf'),
    );

    final boldTtf = pw.Font.ttf(
      await rootBundle.load('assets/fonts/TimesNewRomanBold.ttf'),
    );

    final annexureBytes = await rootBundle
        .load('assets/pdf/Softrate_Internship_Annexure.pdf')
        .then((data) => data.buffer.asUint8List());

    final NDA = await rootBundle
        .load('assets/pdf/Internship NDA.pdf')
        .then((data) => data.buffer.asUint8List());

    // Generate PDFs

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        build: (pw.Context context) {
          return pw.Container(
            decoration: pw.BoxDecoration(
              border: pw.Border.all(
                width: 2,
                color: PdfColor.fromHex('#A0BBB5'),
              ),
            ),
            padding: const pw.EdgeInsets.all(24),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                /// ================= HEADER =================
                pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    /// Logo - Left
                    pw.Image(logo, height: 100),

                    /// Company Details - Right
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.end,
                      children: [
                        pw.SizedBox(height: 18),
                        pw.Text(
                          'S o f t r a t e  T e c h n o l o g i e s  ( P )  L t d',
                          style: pw.TextStyle(
                            font: boldTtf,
                            fontSize: 16,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          'SOFTRATE TECH PARK, MANGADU, CHENNAI, INDIA, 600 122',
                          textAlign: pw.TextAlign.right,
                          style: pw.TextStyle(fontSize: 9, font: ttf),
                        ),
                        pw.SizedBox(height: 4),
                        pw.Text(
                          '(+91) 8148633580 | hr@softrateglobal.com',
                          style: pw.TextStyle(fontSize: 9, font: ttf),
                        ),
                      ],
                    ),
                  ],
                ),

                pw.SizedBox(height: 30),

                /// ================= DATE =================
                pw.Text(
                  DateFormat("d'th' MMM, yyyy").format(DateTime.now()),
                  style: pw.TextStyle(font: boldTtf, fontSize: 12),
                ),

                pw.SizedBox(height: 20),

                /// ================= BODY =================
                pw.Text(
                  'Dear $name,',
                  style: pw.TextStyle(fontSize: 12, font: ttf),
                ),

                pw.SizedBox(height: 14),

                pw.RichText(
                  text: pw.TextSpan(
                    style: pw.TextStyle(fontSize: 12, font: ttf),
                    children: [
                      const pw.TextSpan(
                        text:
                            'We are pleased to offer you an Internship opportunity as a ',
                      ),
                      pw.TextSpan(
                        text: role,
                        style: pw.TextStyle(font: boldTtf),
                      ),
                      const pw.TextSpan(
                        text:
                            ' at Softrate Technologies Pvt Ltd (Chennai Office).',
                      ),
                    ],
                  ),
                ),

                pw.SizedBox(height: 14),

                pw.RichText(
                  text: pw.TextSpan(
                    style: pw.TextStyle(fontSize: 12, font: ttf),
                    children: [
                      const pw.TextSpan(
                        text: 'Your Internship will be effective from ',
                      ),
                      pw.TextSpan(
                        text: DateFormat('dd.MM.yyyy').format(onboardingDate),
                        style: pw.TextStyle(font: boldTtf),
                      ),
                      const pw.TextSpan(text: ' and continue till '),
                      pw.TextSpan(
                        text: DateFormat('dd.MM.yyyy').format(endDate),
                        style: pw.TextStyle(font: boldTtf),
                      ),
                      const pw.TextSpan(text: '.'),
                    ],
                  ),
                ),

                pw.SizedBox(height: 18),

                pw.Text(
                  'We at Softrate are delighted to welcome you on board. During your internship, '
                  'our focus will be on providing you with practical, hands-on experience that '
                  'will enhance your understanding of real-world applications and prepare you '
                  'for on-field challenges.',
                  textAlign: pw.TextAlign.justify,
                  style: pw.TextStyle(fontSize: 12, font: ttf),
                ),

                pw.SizedBox(height: 18),

                pw.Text(
                  'Congratulations once again, and welcome to the team! We are confident that '
                  'your contributions will play an important role in helping us achieve our '
                  'mission and goals.',
                  textAlign: pw.TextAlign.justify,
                  style: pw.TextStyle(fontSize: 12, font: ttf),
                ),

                pw.SizedBox(height: 18),

                pw.Text(
                  'Your Appointment with us will be governed by the Special Terms and Conditions '
                  'discussed in the Annexure.',
                  style: pw.TextStyle(fontSize: 12, font: ttf),
                ),


                
                pw.SizedBox(height: 18),

                pw.Text(
                  'Work location: Softrate Tech Park, Chennai',
                  style: pw.TextStyle(fontSize: 12, font: boldTtf),
                ),

                pw.SizedBox(height: 40),

                /// ================= SIGN & QR =================
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    /// Signature - Left
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          'Kudos,',
                          style: pw.TextStyle(fontSize: 12, font: boldTtf),
                        ),
                        pw.SizedBox(height: 10),
                        pw.Image(signature, height: 45),
                        pw.SizedBox(height: 6),
                        pw.Text(
                          'Hiring Manager\nSoftrate Global (India)',
                          style: pw.TextStyle(font: ttf),
                        ),
                      ],
                    ),

                    /// QR - Right
                    pw.Image(qr, height: 160),
                  ],
                ),

                pw.Spacer(),

                // pw.Divider(),

                /// ================= FOOTER =================
                pw.Center(
                  child: pw.UrlLink(
                    destination: 'https://www.softrateglobal.com',
                    child: pw.Text(
                      'www.softrateglobal.com',
                      style: pw.TextStyle(
                        fontSize: 12,
                        font: boldTtf,
                        color: PdfColor.fromHex('#A0BBB5'),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );

    final Uint8List flattenedPdfBytes = await flattenPdf(pdf);
    final Uint8List flattenedAnnexureBytes = await flattenPdfBytes(annexureBytes);
    final Uint8List flattenedNdaBytes = await flattenPdfBytes(NDA);
    String baseurl = getBaseUrl();

    final formData = FormData.fromMap({
      'onboardingDate': onboardingDate.toIso8601String(),
      'endDate': endDate.toIso8601String(),
      'internshipType': stipendType,
      'pdf': MultipartFile.fromBytes(
        flattenedPdfBytes,
        filename: '$internId-Softrate Offer Letter.pdf',
      ),
      'pdf_1': MultipartFile.fromBytes(
        flattenedAnnexureBytes,
        filename: 'Softrate_Internship_Annexure.pdf',
      ),
      'pdf_2': MultipartFile.fromBytes(
        flattenedNdaBytes,
        filename: 'Softrate_Internship_NDA.pdf',
      ),
    });

    final response = await Dio().put(
      '$baseurl/api/intern/accept/$internId',
      data: formData,
    );

    // Form Data (with new fields)
    // final formData = FormData.fromMap({
    //   'name': name,
    //   'email': email,
    //   'phone': phone,
    //   'role': role,
    //   'password': "",
    //   'onboardingDate': onboardingDate.toIso8601String(),
    //   'durationType': durationType,
    //   'durationValue': durationValue.toString(),
    //   'endDate': endDate.toIso8601String(),

    //   'offerLetter': MultipartFile.fromBytes(
    //     pdfBytes,
    //     filename: '$name-offer.pdf',
    //   ),
    // });

    // final response = await Dio().post(
    //   'http://10.0.2.2:5001/api/intern/add',
    //   data: formData,
    // );

    Navigator.pop(navigatorKey.currentContext!); // close loader

    // SUCCESS SNACKBAR
    if (response.statusCode == 200) {
      ScaffoldMessenger.of(navigatorKey.currentContext!).showSnackBar(
        SnackBar(
          elevation: 0,
          backgroundColor: Colors.transparent,
          behavior: SnackBarBehavior.floating,
          content: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF3BB78F), Color(0xFF0BAB64)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 8,
                  offset: Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white, size: 28),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    "Intern added & email sent successfully",
                    style: TextStyle(color: Colors.white, fontSize: 15),
                  ),
                ),
              ],
            ),
          ),
          duration: Duration(seconds: 3),
        ),
      );
    } else {
      // ERROR SNACKBAR
      ScaffoldMessenger.of(navigatorKey.currentContext!).showSnackBar(
        SnackBar(
          elevation: 0,
          backgroundColor: Colors.transparent,
          behavior: SnackBarBehavior.floating,
          content: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFFF5F6D), Color(0xFFFF1E56)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 8,
                  offset: Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              children: [
                Icon(Icons.error_outline, color: Colors.white, size: 28),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    "Failed: ${response.data["message"]}",
                    style: TextStyle(color: Colors.white, fontSize: 15),
                  ),
                ),
              ],
            ),
          ),
          duration: Duration(seconds: 3),
        ),
      );
    }
  } catch (e) {
    Navigator.pop(navigatorKey.currentContext!);

    // ERROR SNACKBAR
    ScaffoldMessenger.of(navigatorKey.currentContext!).showSnackBar(
      SnackBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        behavior: SnackBarBehavior.floating,
        content: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFFFF5F6D), Color(0xFFFF1E56)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 8,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.white, size: 28),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  "Error: $e",
                  style: TextStyle(color: Colors.white, fontSize: 15),
                ),
              ),
            ],
          ),
        ),
        duration: Duration(seconds: 3),
      ),
    );
  }
}
Future<Uint8List> flattenPdf(pw.Document originalPdf) async {
  return flattenPdfBytes(await originalPdf.save());
}

/// Flatten raw PDF bytes by rasterising every page to PNG and re-encoding.
/// Each page is composited onto a white canvas first so that transparent
/// areas in the original (logo, signature, QR) don't appear as black.
Future<Uint8List> flattenPdfBytes(Uint8List pdfBytes) async {
  final pages = Printing.raster(pdfBytes, dpi: 300);

  final flattenedPdf = pw.Document();

  await for (final page in pages) {
    // Get the raw ui.Image from the raster so we can composite it.
    final uiImage = await page.toImage();
    final w = uiImage.width.toDouble();
    final h = uiImage.height.toDouble();

    // Draw page onto a white background to replace transparent pixels.
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = Colors.white,
    );
    canvas.drawImage(uiImage, Offset.zero, Paint());
    final picture = recorder.endRecording();
    final composited = await picture.toImage(uiImage.width, uiImage.height);
    final byteData =
        await composited.toByteData(format: ui.ImageByteFormat.png);
    final pngBytes = byteData!.buffer.asUint8List();

    flattenedPdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        build: (_) {
          return pw.Image(
            pw.MemoryImage(pngBytes),
            fit: pw.BoxFit.fill,
          );
        },
      ),
    );
  }

  return flattenedPdf.save();
}
Future<void> _openLink(String url) async {
  if (url.isEmpty) return;

  final uri = Uri.tryParse(url.trim());
  if (uri == null) return;

  if (!await launchUrl(
    uri,
    mode: LaunchMode.externalApplication,
  )) {
    // Optionally show a snackbar if it fails
  }
}

Future<bool> showRejectConfirmation(
  BuildContext context,
  String internName,
) async {
  return await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  size: 48,
                  color: Color(0xFFB00020), // orange accent
                ),
                const SizedBox(height: 12),
                const Text(
                  "Confirm rejection",
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF003648),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  "Are you sure you want to reject\n$internName?",
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF424242),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  "This action can't undo in backend",
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF9E9E9E),
                  ),
                ),
                const SizedBox(height: 20),

                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          side: const BorderSide(
                            color: Color(0xFF42A5B9), // medium teal
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: const Text(
                          "Cancel",
                          style: TextStyle(
                            color: Color(0xFF00657F),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFB00020), // destructive red
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: const Text(
                          "Reject",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ) ??
      false;
}
