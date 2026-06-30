import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

class ManagerOffboardingPage extends StatefulWidget {
  const ManagerOffboardingPage({super.key});

  @override
  State<ManagerOffboardingPage> createState() => _ManagerOffboardingPageState();
}

class _ManagerOffboardingPageState extends State<ManagerOffboardingPage> {
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  List<dynamic> _offboardingRequests = [];
  bool _isLoading = true;
  String? managerMongoId;

  @override
  void initState() {
    super.initState();
    _loadManagerAndFetchOffboarding();
  }

  Future<void> _loadManagerAndFetchOffboarding() async {
    final prefs = await SharedPreferences.getInstance();
    managerMongoId = prefs.getString("manager_mongo_id");
    if (managerMongoId != null) {
      _fetchOffboarding();
    } else {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchOffboarding() async {
    try {
      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/resignation/manager-pending/$managerMongoId"),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _offboardingRequests = data['data'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      print("Error fetching offboarding requests: $e");
      setState(() => _isLoading = false);
    }
  }

  Future<void> _updateOffboardingStatus(String id, String status) async {
    // Show a dialog for remarks
    final TextEditingController remarksController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(status == 'approved' ? 'Approve Offboarding' : 'Reject Offboarding', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: primaryColor)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Please provide remarks:', style: TextStyle(fontSize: 14, color: subtitleColor)),
            const SizedBox(height: 12),
            TextField(
              controller: remarksController,
              decoration: InputDecoration(
                hintText: 'Enter remarks...',
                filled: true,
                fillColor: backgroundColor,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: subtitleColor)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              setState(() => _isLoading = true);
              try {
                final response = await http.put(
                  Uri.parse("${getBaseUrl()}/api/resignation/manager-review/$id"),
                  headers: {"Content-Type": "application/json"},
                  body: jsonEncode({
                    "status": status,
                    "remarks": remarksController.text.trim()
                  }),
                );

                if (response.statusCode == 200) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text("Offboarding $status successfully"), backgroundColor: Colors.green),
                  );
                  _fetchOffboarding();
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Failed to update status"), backgroundColor: Colors.red),
                  );
                  setState(() => _isLoading = false);
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text("Error updating status: $e"), backgroundColor: Colors.red),
                );
                setState(() => _isLoading = false);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: status == 'approved' ? Colors.teal : Colors.red,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Submit', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildProfessionalHeader(),
              Expanded(
                child: _isLoading 
                  ? const Center(child: CircularProgressIndicator(color: primaryColor))
                  : _buildOffboardingList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOffboardingList() {
    final filteredRequests = _offboardingRequests.where((req) => req["status"] == "pending_manager").toList();

    if (filteredRequests.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_off_rounded, size: 48, color: subtitleColor.withOpacity(0.3)),
            const SizedBox(height: 16),
            const Text(
              "No pending offboarding requests",
              style: TextStyle(color: subtitleColor, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
      itemCount: filteredRequests.length,
      itemBuilder: (context, index) {
        final req = filteredRequests[index];
        final employee = req["employeeId"];
        final name = employee != null ? (employee["fullName"] ?? employee["name"] ?? "Unknown") : "Unknown";

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: surfaceColor,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: borderColor.withOpacity(0.8)),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 15, offset: const Offset(0, 8)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        name[0],
                        style: const TextStyle(color: primaryColor, fontWeight: FontWeight.w600, fontSize: 18),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: const TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 14.5)),
                        Text("Offboarding Request", style: const TextStyle(color: subtitleColor, fontSize: 10.5, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  _statusBadge("pending", Colors.orange),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    _dateInfo("Requested On", DateFormat('MMM d, yyyy').format(DateTime.parse(req["createdAt"]))),
                    const SizedBox(width: 24),
                    _dateInfo("Last Working Day", DateFormat('MMM d, yyyy').format(DateTime.parse(req["lastWorkingDay"]))),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text("REASON FOR LEAVING", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: subtitleColor, letterSpacing: 0.4)),
              const SizedBox(height: 6),
              Text(
                req["reason"] ?? "No reason provided",
                style: const TextStyle(fontSize: 12.5, color: subtitleColor, height: 1.5, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 24),
              if (req["projectLinks"] != null && (req["projectLinks"] as List).isNotEmpty) ...[
                const Text("PROJECT LINKS", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: subtitleColor, letterSpacing: 0.4)),
                const SizedBox(height: 6),
                ...List.generate((req["projectLinks"] as List).length, (i) {
                  final link = req["projectLinks"][i].toString();
                  return InkWell(
                    onTap: () async {
                      final url = Uri.parse(link);
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url);
                      }
                    },
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        link,
                        style: const TextStyle(fontSize: 12.5, color: primaryColor, decoration: TextDecoration.underline),
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 24),
              ],
              Row(
                children: [
                  Expanded(child: _buildActionBtn("Reject", Icons.close_rounded, Colors.red.shade400, () => _updateOffboardingStatus(req["_id"], "rejected"))),
                  const SizedBox(width: 12),
                  Expanded(child: _buildActionBtn("Approve", Icons.check_circle_rounded, Colors.teal, () => _updateOffboardingStatus(req["_id"], "approved"))),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildProfessionalHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 20, offset: const Offset(0, 10)),
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
                    Text("Offboarding", style: TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 24, letterSpacing: -1.0)),
                    Text("PENDING TEAM MATES", style: TextStyle(color: subtitleColor, fontSize: 9.5, fontWeight: FontWeight.w500, letterSpacing: 1.4)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              _summaryCard("Pending", "${_offboardingRequests.where((e) => e["status"] == "pending_manager").length}", Colors.orange),
              const SizedBox(width: 12),
              _summaryCard("Total", "${_offboardingRequests.length}", primaryColor),
            ],
          ),
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
        decoration: BoxDecoration(color: backgroundColor, borderRadius: BorderRadius.circular(14), border: Border.all(color: borderColor)),
        child: Icon(icon, color: primaryColor, size: 20),
      ),
    );
  }

  Widget _summaryCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        decoration: BoxDecoration(color: backgroundColor, borderRadius: BorderRadius.circular(20), border: Border.all(color: borderColor)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: color)),
            const SizedBox(height: 4),
            Text(label.toUpperCase(), style: const TextStyle(fontSize: 9, color: subtitleColor, fontWeight: FontWeight.w800, letterSpacing: 0.5)),
          ],
        ),
      ),
    );
  }

  Widget _buildActionBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(16), border: Border.all(color: color.withOpacity(0.1))),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(String status, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(status.toUpperCase(), style: TextStyle(color: color, fontSize: 8.5, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
    );
  }

  Widget _dateInfo(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: const TextStyle(fontSize: 8.5, color: subtitleColor, fontWeight: FontWeight.w600, letterSpacing: 0.4)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: primaryColor)),
      ],
    );
  }
}
