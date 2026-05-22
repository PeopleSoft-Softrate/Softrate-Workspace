import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:intl/intl.dart';

class ManagerDocumentsPage extends StatefulWidget {
  const ManagerDocumentsPage({super.key});

  @override
  State<ManagerDocumentsPage> createState() => _ManagerDocumentsPageState();
}

class _ManagerDocumentsPageState extends State<ManagerDocumentsPage> {
  // Sophisticated Teal Theme
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  bool _isLoading = true;
  List<dynamic> _interns = [];
  List<dynamic> _employees = [];

  @override
  void initState() {
    super.initState();
    _fetchTeamData();
  }

  Future<void> _fetchTeamData() async {
    setState(() => _isLoading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final managerMongoId = prefs.getString("manager_mongo_id");

      if (managerMongoId == null) {
        setState(() => _isLoading = false);
        return;
      }

      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/assignments/team/$managerMongoId"),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _interns = data["interns"] ?? [];
          _employees = data["employees"] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      print("Error fetching team profiles: $e");
      setState(() => _isLoading = false);
    }
  }

  String _formatDate(dynamic date) {
    if (date == null) return "N/A";
    try {
      DateTime dt;
      if (date is Map && date["\$date"] != null) {
        dt = DateTime.parse(date["\$date"]);
      } else {
        dt = DateTime.parse(date.toString());
      }
      return DateFormat("dd MMM yyyy").format(dt);
    } catch (e) {
      return date.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      body: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator(color: primaryColor))
                    : RefreshIndicator(
                        onRefresh: _fetchTeamData,
                        color: primaryColor,
                        child: _interns.isEmpty && _employees.isEmpty
                            ? _buildEmptyState()
                            : ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
                                children: [
                                  if (_employees.isNotEmpty) ...[
                                    _buildSectionHeader("Full-time Employees"),
                                    ..._employees.map((e) => _buildMemberCard(e, isIntern: false)),
                                    const SizedBox(height: 24),
                                  ],
                                  if (_interns.isNotEmpty) ...[
                                    _buildSectionHeader("Interns"),
                                    ..._interns.map((i) => _buildMemberCard(i, isIntern: true)),
                                  ],
                                ],
                              ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          _buildIconButton(Icons.arrow_back_ios_new_rounded, () => Navigator.pop(context)),
          const SizedBox(width: 16),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Team Profiles",
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: primaryColor,
                  fontSize: 24,
                  letterSpacing: -1.0,
                ),
              ),
              Text(
                "MEMBER DOCUMENTATION & DETAILS",
                style: TextStyle(
                  color: subtitleColor,
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          color: subtitleColor,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.0,
        ),
      ),
    );
  }

  Widget _buildMemberCard(Map<String, dynamic> member, {required bool isIntern}) {
    final String name = member["fullName"] ?? "Team Member";
    final String role = member["role"] ?? "Developer";
    final String id = isIntern ? (member["internid"] ?? "N/A") : (member["EmployeeId"] ?? "N/A");

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor.withOpacity(0.8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(12),
        leading: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: primaryColor.withOpacity(0.08),
            borderRadius: BorderRadius.circular(15),
          ),
          child: Center(
            child: Text(
              name.isNotEmpty ? name[0] : "?",
              style: const TextStyle(
                color: primaryColor,
                fontWeight: FontWeight.w800,
                fontSize: 20,
              ),
            ),
          ),
        ),
        title: Text(
          name,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            color: primaryColor,
            fontSize: 15.5,
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            "$role • ID: $id",
            style: const TextStyle(
              color: subtitleColor,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        trailing: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: primaryColor),
        ),
        onTap: () => _showProfileDetails(member, isIntern),
      ),
    );
  }

  void _showProfileDetails(Map<String, dynamic> member, bool isIntern) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: const BoxDecoration(
          color: surfaceColor,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: borderColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            _buildProfileAvatar(member["fullName"] ?? "U"),
            const SizedBox(height: 16),
            Text(
              member["fullName"] ?? "Unknown Name",
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: primaryColor),
            ),
            Text(
              member["role"] ?? "Team Member",
              style: const TextStyle(fontSize: 14, color: subtitleColor, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 24),
            const Divider(height: 1, indent: 24, endIndent: 24),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: isIntern ? _buildInternDetails(member) : _buildEmployeeDetails(member),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildInternDetails(Map<String, dynamic> m) {
    return [
      _buildSectionTitle("Identification"),
      _buildDetailItem("Intern ID", m["internid"], Icons.badge_outlined),
      _buildDetailItem("Current Role", m["role"], Icons.workspace_premium_outlined),
      _buildDetailItem("Internship Type", m["internshipType"], Icons.card_membership_outlined),
      
      _buildSectionTitle("Academic Background"),
      _buildDetailItem("College", m["college"], Icons.school_outlined),
      _buildDetailItem("Department", m["department"], Icons.category_outlined),
      _buildDetailItem("Year", m["year"], Icons.calendar_month_outlined),
      
      _buildSectionTitle("Contact Information"),
      _buildDetailItem("Email Address", m["email"], Icons.email_outlined),
      _buildDetailItem("Primary Contact", m["contact"], Icons.phone_outlined),
      _buildDetailItem("Emergency Contact", m["emergencyContact"], Icons.emergency_outlined),
      
      _buildSectionTitle("Timeline"),
      _buildDetailItem("Onboarding Date", _formatDate(m["onboardingDate"]), Icons.event_available_outlined),
      _buildDetailItem("Internship End", _formatDate(m["endDate"]), Icons.event_busy_outlined),
      
      if (m["linkedin"] != null && m["linkedin"].toString().isNotEmpty) ...[
        _buildSectionTitle("Social Media"),
        _buildDetailItem("LinkedIn", "View Profile", Icons.link_rounded, isLink: true),
      ],
    ];
  }

  List<Widget> _buildEmployeeDetails(Map<String, dynamic> m) {
    return [
      _buildSectionTitle("Professional Details"),
      _buildDetailItem("Employee ID", m["EmployeeId"], Icons.badge_outlined),
      _buildDetailItem("Current Role", m["role"], Icons.work_outline_rounded),
      _buildDetailItem("Experience", m["experienceYears"] != null && m["experienceYears"].toString().isNotEmpty ? "${m["experienceYears"]} Years" : "Fresher", Icons.work_history_outlined),
      _buildDetailItem("Onboarding", _formatDate(m["onboardingDate"]), Icons.event_available_outlined),

      _buildSectionTitle("Education"),
      _buildDetailItem("Qualification", m["qualification"], Icons.history_edu_outlined),
      _buildDetailItem("Specialization", m["specialization"], Icons.workspace_premium_outlined),
      _buildDetailItem("College", m["college"], Icons.account_balance_outlined),
      _buildDetailItem("Passing Year", m["passingYear"], Icons.calendar_today_outlined),
      if (m["ugCgpa"] != null) _buildDetailItem("UG CGPA", m["ugCgpa"].toString(), Icons.grade_outlined),
      if (m["pgCgpa"] != null) _buildDetailItem("PG CGPA", m["pgCgpa"].toString(), Icons.grade_outlined),

      _buildSectionTitle("Contact & Personal"),
      _buildDetailItem("Email Address", m["email"], Icons.email_outlined),
      _buildDetailItem("Phone Number", m["phone"], Icons.phone_outlined),
      _buildDetailItem("Emergency Phone", m["emergencyPhone"], Icons.emergency_outlined),
      _buildDetailItem("Date of Birth", _formatDate(m["dob"]), Icons.cake_outlined),
      _buildDetailItem("Gender", m["gender"], Icons.person_outline),
      _buildDetailItem("Address", m["address"], Icons.location_on_outlined),

      if (m["linkedin"] != null && m["linkedin"].toString().isNotEmpty) ...[
        _buildSectionTitle("Social Media"),
        _buildDetailItem("LinkedIn", "View Profile", Icons.link_rounded, isLink: true),
      ],
    ];
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 12),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: primaryColor,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildDetailItem(String label, dynamic value, IconData icon, {bool isLink = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: backgroundColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: primaryColor, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, color: subtitleColor, fontWeight: FontWeight.w600)),
                Text(
                  value?.toString() ?? "N/A",
                  style: TextStyle(
                    fontSize: 14.5,
                    color: isLink ? Colors.blue.shade700 : primaryColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileAvatar(String name) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [primaryColor, Color(0xFF004E61)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(color: primaryColor.withOpacity(0.2), blurRadius: 15, offset: const Offset(0, 8)),
        ],
      ),
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0] : "?",
          style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildIconButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Icon(icon, color: primaryColor, size: 20),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline_rounded, size: 64, color: borderColor.withOpacity(0.5)),
          const SizedBox(height: 16),
          const Text("No team members found", style: TextStyle(color: subtitleColor, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
