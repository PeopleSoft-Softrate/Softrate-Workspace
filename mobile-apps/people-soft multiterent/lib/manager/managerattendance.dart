import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hrmappfrontend/port.dart';

class ManagerAttendancePage extends StatefulWidget {
  const ManagerAttendancePage({super.key});

  @override
  State<ManagerAttendancePage> createState() => _ManagerAttendancePageState();
}

class _ManagerAttendancePageState extends State<ManagerAttendancePage> {
  // Sophisticated Teal Management Palette
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  bool _isLoading = true;
  List<dynamic> _teamAttendance = [];
  List<dynamic> _correctionRequests = [];

  @override
  void initState() {
    super.initState();
    _fetchTeamAttendance();
    _fetchCorrectionRequests();
  }

  Future<void> _refreshData() async {
    await Future.wait([
      _fetchTeamAttendance(),
      _fetchCorrectionRequests(),
    ]);
  }

  Future<void> _fetchCorrectionRequests() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final managerMongoId = prefs.getString("manager_mongo_id");

      if (managerMongoId == null) return;

      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/attendance-requests/manager/$managerMongoId"),
      );

      if (response.statusCode == 200) {
        if (mounted) {
          setState(() {
            _correctionRequests = jsonDecode(response.body);
          });
        }
      }
    } catch (e) {
      print("Error fetching correction requests: $e");
    }
  }

  Future<void> _reviewCorrectionRequest(String id, String status) async {
    final remarksController = TextEditingController();
    final bool isApprove = status == 'approved';
    final Color actionColor = isApprove ? Colors.teal : Colors.red.shade400;

    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(28), border: Border.all(color: borderColor)),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: actionColor.withOpacity(0.1), shape: BoxShape.circle),
                child: Icon(isApprove ? Icons.check_circle_rounded : Icons.cancel_rounded, color: actionColor, size: 32),
              ),
              const SizedBox(height: 20),
              Text(
                "Confirm ${status[0].toUpperCase()}${status.substring(1)}",
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: primaryColor, letterSpacing: -0.5),
              ),
              const SizedBox(height: 8),
              Text(
                "Do you want to $status this correction request?",
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: subtitleColor, height: 1.5),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: remarksController,
                maxLines: 3,
                style: const TextStyle(fontSize: 14, color: primaryColor),
                decoration: InputDecoration(
                  hintText: "Add your remarks here...",
                  hintStyle: const TextStyle(color: subtitleColor, fontSize: 13),
                  filled: true,
                  fillColor: backgroundColor,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.all(16),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text("Cancel", style: TextStyle(color: subtitleColor, fontWeight: FontWeight.w600)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context, true),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: actionColor,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text("Confirm", style: const TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);
    try {
      final response = await http.put(
        Uri.parse("${getBaseUrl()}/api/attendance-requests/manager-review/$id"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"status": status, "remarks": remarksController.text.trim()}),
      );

      if (response.statusCode == 200) {
        _fetchCorrectionRequests();
      }
      setState(() => _isLoading = false);
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchTeamAttendance() async {
    if (mounted) setState(() => _isLoading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final managerMongoId = prefs.getString("manager_mongo_id");

      if (managerMongoId == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/assignments/team-attendance/$managerMongoId"),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() {
            _teamAttendance = data["teamAttendance"] ?? [];
            _isLoading = false;
          });
        }
      } else {
        if (mounted) setState(() => _isLoading = false);
      }
    } catch (e) {
      print("Error fetching team attendance: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatPunchTime(dynamic time) {
    if (time == null) return "--:--";
    try {
      final dt = DateTime.parse(time.toString()).toLocal();
      final hour = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final ampm = dt.hour >= 12 ? "PM" : "AM";
      return "${hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} $ampm";
    } catch (e) {
      return "--:--";
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
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
                  child: TabBarView(
                    children: [_buildLiveStatusList(), _buildCorrectionsList()],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProfessionalHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
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
                      "Attendance",
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontSize: 24,
                        letterSpacing: -1.0,
                      ),
                    ),
                    Text(
                      "TEAM ACTIVITY OVERVIEW",
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
          const SizedBox(height: 24),
          TabBar(
            labelColor: primaryColor,
            unselectedLabelColor: subtitleColor,
            indicatorColor: primaryColor,
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: Colors.transparent,
            labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13.5),
            tabs: const [
              Tab(text: "Live Status"),
              Tab(text: "Corrections"),
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
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Icon(icon, color: primaryColor, size: 20),
      ),
    );
  }

  String _calculateStatus(String inTime, String outTime) {
    if (inTime == "--:--") return "Absent";

    try {
      final inParts = inTime.split(" ");
      final inHMParts = inParts[0].split(":");
      int inH = int.parse(inHMParts[0]);
      int inM = int.parse(inHMParts[1]);
      if (inParts[1] == "PM" && inH != 12) inH += 12;
      if (inParts[1] == "AM" && inH == 12) inH = 0;

      // Rule: Punch in after 09:30 AM is Late
      if (inH > 9 || (inH == 9 && inM > 30)) return "Late";

      // Rule: No punch out is Half Day
      if (outTime == "--:--") return "Half Day";

      final outParts = outTime.split(" ");
      final outHMParts = outParts[0].split(":");
      int outH = int.parse(outHMParts[0]);
      int outM = int.parse(outHMParts[1]);
      if (outParts[1] == "PM" && outH != 12) outH += 12;
      if (outParts[1] == "AM" && outH == 12) outH = 0;

      // Rule: Punch out before 05:30 PM (17:30) is Half Day
      if (outH < 17 || (outH == 17 && outM < 30)) return "Half Day";

      return "Present";
    } catch (e) {
      return "Present";
    }
  }

  Widget _buildLiveStatusList() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: primaryColor));
    }

    return RefreshIndicator(
      onRefresh: _refreshData,
      color: primaryColor,
      child: _teamAttendance.isEmpty
          ? SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: SizedBox(
                height: MediaQuery.of(context).size.height * 0.6,
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.event_busy_rounded, size: 64, color: borderColor),
                      SizedBox(height: 16),
                      Text("No attendance recorded today.", style: TextStyle(color: subtitleColor)),
                    ],
                  ),
                ),
              ),
            )
          : ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
              itemCount: _teamAttendance.length,
              itemBuilder: (context, index) {
                final entry = _teamAttendance[index];
                final String name = entry["name"]?.toString() ?? "Team Member";
                final inStr = _formatPunchTime(entry["punchIn"]);
                final outStr = _formatPunchTime(entry["punchOut"]);
                final calculatedStatus = _calculateStatus(inStr, outStr);

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: surfaceColor,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: borderColor.withOpacity(0.8)),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: Row(
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
                            name.isNotEmpty ? name[0] : "?",
                            style: const TextStyle(color: primaryColor, fontWeight: FontWeight.w700, fontSize: 18),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: const TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 14.5),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                _timeTag(Icons.login_rounded, inStr),
                                const SizedBox(width: 12),
                                _timeTag(Icons.logout_rounded, outStr),
                              ],
                            ),
                          ],
                        ),
                      ),
                      _statusBadge(calculatedStatus),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _buildCorrectionsList() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: primaryColor));
    }

    return RefreshIndicator(
      onRefresh: _refreshData,
      color: primaryColor,
      child: _correctionRequests.isEmpty
          ? SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: SizedBox(
                height: MediaQuery.of(context).size.height * 0.6,
                child: const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.checklist_rtl_rounded, size: 64, color: borderColor),
                      SizedBox(height: 16),
                      Text("No pending correction requests", style: TextStyle(color: subtitleColor, fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
              ),
            )
          : ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
              itemCount: _correctionRequests.length,
              itemBuilder: (context, index) {
                final req = _correctionRequests[index];
                final String internName = req["internName"]?.toString() ?? "Intern";
                final String dateStr = req["date"] != null ? req["date"].toString().split('T')[0] : "N/A";
                final String inTime = _formatPunchTime(req["requestedPunchIn"]);
                final String outTime = _formatPunchTime(req["requestedPunchOut"]);

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
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(color: Colors.orange.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                            child: const Icon(Icons.history_toggle_off_rounded, color: Colors.orange, size: 18),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text("Attendance Correction", style: TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 13.5)),
                                Text(dateStr, style: const TextStyle(fontSize: 10.5, color: subtitleColor, fontWeight: FontWeight.w500)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      _correctionDetail("Intern", internName),
                      const SizedBox(height: 8),
                      if (req["requestedPunchIn"] != null) _correctionDetail("New In", inTime),
                      if (req["requestedPunchOut"] != null) ...[
                        const SizedBox(height: 8),
                        _correctionDetail("New Out", outTime),
                      ],
                      const SizedBox(height: 12),
                      const Text("Reason:", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: subtitleColor)),
                      const SizedBox(height: 4),
                      Text(
                        req["reason"] ?? "No reason provided",
                        style: const TextStyle(fontSize: 12.5, color: primaryColor, height: 1.4),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(child: _buildActionBtn("Reject", Icons.close_rounded, Colors.red.shade400, () => _reviewCorrectionRequest(req["_id"], "rejected"))),
                          const SizedBox(width: 12),
                          Expanded(child: _buildActionBtn("Approve", Icons.check_circle_rounded, Colors.teal, () => _reviewCorrectionRequest(req["_id"], "approved"))),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _correctionDetail(String label, String value) {
    return Row(
      children: [
        Text("$label: ", style: const TextStyle(fontSize: 12.5, color: subtitleColor, fontWeight: FontWeight.w500)),
        Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: primaryColor)),
      ],
    );
  }

  Widget _buildActionBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.1)),
        ),
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

  Widget _timeTag(IconData icon, String time) {
    return Row(
      children: [
        Icon(icon, size: 11, color: subtitleColor),
        const SizedBox(width: 4),
        Text(time, style: const TextStyle(fontSize: 11, color: subtitleColor, fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _statusBadge(String status) {
    Color color = statusTextColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: color, fontSize: 8.5, fontWeight: FontWeight.w600, letterSpacing: 0.5),
      ),
    );
  }

  Color statusTextColor(String status) {
    if (status == "Present") return const Color(0xFF10B981);
    if (status == "Half Day") return const Color(0xFF0284C7);
    if (status == "Late") return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }
}
