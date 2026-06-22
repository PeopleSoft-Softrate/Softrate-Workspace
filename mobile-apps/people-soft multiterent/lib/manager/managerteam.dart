import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:hrmappfrontend/hr_pages/InternFullDetails.dart';
import 'package:hrmappfrontend/hr_pages/emplyee/EmployeeFullDetails.dart';

class ManagerTeamPage extends StatefulWidget {
  const ManagerTeamPage({super.key});

  @override
  State<ManagerTeamPage> createState() => _ManagerTeamPageState();
}

class _ManagerTeamPageState extends State<ManagerTeamPage> {
  // Sophisticated Teal Management Palette
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  List<dynamic> _teamMembers = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchTeamMembers();
  }

  Future<void> _fetchTeamMembers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final managerId = prefs.getString("manager_mongo_id");

      if (managerId == null || managerId.isEmpty) {
        setState(() {
          _error = "Manager session not found. Please log in again.";
          _isLoading = false;
        });
        return;
      }

      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/assignments/team/$managerId"),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List<dynamic> interns = data['interns'] ?? [];
        final List<dynamic> employees = data['employees'] ?? [];

        setState(() {
          _teamMembers = [...interns, ...employees];
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = "Failed to load team members";
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = "Connection error: $e";
        _isLoading = false;
      });
    }
  }

  Future<void> _launchEmail(String email) async {
    final Uri emailLaunchUri = Uri(
      scheme: 'mailto',
      path: email,
    );
    try {
      if (!await launchUrl(emailLaunchUri, mode: LaunchMode.externalApplication)) {
        throw 'Could not launch $emailLaunchUri';
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Error opening email client: $e")),
        );
      }
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
          statusBarBrightness: Brightness.light,
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildProfessionalHeader(),
              Expanded(
                child: _isLoading
                    ? _buildLoadingState()
                    : _error != null
                        ? _buildErrorState()
                        : _teamMembers.isEmpty
                            ? _buildEmptyState()
                            : _buildTeamList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTeamList() {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
      itemCount: _teamMembers.length,
      itemBuilder: (context, index) {
        final member = _teamMembers[index];
        final String name = member["fullName"] ?? "Unknown";
        final String role = member["role"] ?? "Team Member";
        final String id = member["EmployeeId"] ?? member["internid"] ?? "N/A";
        final String email = member["email"] ?? "";
        final String status = member["status"] ?? "Active";

        final bool isIntern = member.containsKey("internid") || (member["role"]?.toString().toLowerCase().contains("intern") ?? false);

        return GestureDetector(
          onTap: () {
            if (isIntern) {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => InternFullDetails(internId: member["_id"]),
                ),
              );
            } else {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => EmployeeFullDetails(employeeId: member["_id"]),
                ),
              );
            }
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
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
            child: Row(
              children: [
                Stack(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: primaryColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(
                        child: Text(
                          name.isNotEmpty ? name[0] : "?",
                          style: const TextStyle(
                            color: primaryColor,
                            fontWeight: FontWeight.w600,
                            fontSize: 18,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: _getStatusColor(status),
                          border: Border.all(color: surfaceColor, width: 2.5),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: primaryColor,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(width: 8),
                          _buildStatusBadge(status),
                        ],
                      ),
                      Text(
                        role,
                        style: const TextStyle(
                          color: subtitleColor,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "ID: $id",
                        style: const TextStyle(
                          color: subtitleColor,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                if (email.isNotEmpty)
                  _buildModernIconButton(
                    Icons.mail_outline_rounded,
                    () => _launchEmail(email),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: CircularProgressIndicator(color: primaryColor),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: Colors.redAccent),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: subtitleColor)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchTeamMembers,
              child: const Text("Retry"),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.group_off_rounded, size: 64, color: borderColor),
          SizedBox(height: 16),
          Text(
            "No team members assigned yet.",
            style: TextStyle(color: subtitleColor, fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildProfessionalHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildModernIconButton(Icons.arrow_back_ios_new_rounded, () => Navigator.pop(context)),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "My Team",
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontSize: 24,
                        letterSpacing: -1.0,
                      ),
                    ),
                    Text(
                      "DIRECTORY & STATUS OVERVIEW",
                      style: TextStyle(
                        color: subtitleColor,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          Row(
            children: [
              _teamStat("Total", "${_teamMembers.length}"),
              _teamStat("Interns", "${_teamMembers.where((m) => m.containsKey("internid") || (m["role"]?.toString().toLowerCase().contains("intern") ?? false)).length}"),
              _teamStat("Employees", "${_teamMembers.where((m) => m.containsKey("EmployeeId") && !(m["role"]?.toString().toLowerCase().contains("intern") ?? false)).length}"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _teamStat(String label, String value) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: primaryColor)),
          const SizedBox(height: 2),
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 8.5, color: subtitleColor, fontWeight: FontWeight.w600, letterSpacing: 0.4)),
        ],
      ),
    );
  }

  Widget _buildModernIconButton(IconData icon, VoidCallback onTap) {
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

  Widget _buildStatusBadge(String status) {
    final Color color = _getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 8,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case "active":
      case "approved":
      case "ongoing":
        return const Color(0xFF10B981);
      case "finished":
      case "completed":
        return const Color(0xFF3B82F6);
      case "initial":
      case "pending":
        return Colors.orangeAccent;
      default:
        return const Color(0xFF94A3B8);
    }
  }
}
