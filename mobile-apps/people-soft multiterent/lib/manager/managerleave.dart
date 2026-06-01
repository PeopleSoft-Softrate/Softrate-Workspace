import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ManagerLeavePage extends StatefulWidget {
  const ManagerLeavePage({super.key});

  @override
  State<ManagerLeavePage> createState() => _ManagerLeavePageState();
}

class _ManagerLeavePageState extends State<ManagerLeavePage> {
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  List<dynamic> _leaveRequests = [];
  bool _isLoading = true;
  String? managerMongoId;

  @override
  void initState() {
    super.initState();
    _loadManagerAndFetchLeaves();
  }

  Future<void> _loadManagerAndFetchLeaves() async {
    final prefs = await SharedPreferences.getInstance();
    managerMongoId = prefs.getString("manager_mongo_id");
    if (managerMongoId != null) {
      _fetchLeaves();
    } else {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchLeaves() async {
    try {
      final response = await http.get(
        Uri.parse("${getBaseUrl()}/api/employee-leave/manager-pending/$managerMongoId"),
      );

      if (response.statusCode == 200) {
        setState(() {
          _leaveRequests = jsonDecode(response.body);
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      print("Error fetching leaves: $e");
      setState(() => _isLoading = false);
    }
  }

  Future<void> _updateLeaveStatus(String leaveId, String status) async {
    try {
      final response = await http.put(
        Uri.parse("${getBaseUrl()}/api/employee-leave/manager-action/$leaveId"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"status": status}),
      );

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Leave $status successfully"), backgroundColor: Colors.green),
        );
        _fetchLeaves();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error updating leave: $e"), backgroundColor: Colors.red),
      );
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildProfessionalHeader(),
                Expanded(
                  child: _isLoading 
                    ? const Center(child: CircularProgressIndicator(color: primaryColor))
                    : TabBarView(
                        children: [
                          _buildLeaveList(isPendingOnly: true),
                          _buildLeaveList(isPendingOnly: false),
                        ],
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLeaveList({required bool isPendingOnly}) {
    final filteredRequests = _leaveRequests.where((req) {
      if (isPendingOnly) return req["managerStatus"] == "pending";
      return req["managerStatus"] != "pending";
    }).toList();

    if (filteredRequests.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.event_busy_rounded, size: 48, color: subtitleColor.withOpacity(0.3)),
            const SizedBox(height: 16),
            Text(
              isPendingOnly ? "No pending requests" : "No request history",
              style: const TextStyle(color: subtitleColor, fontWeight: FontWeight.w500),
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
        final bool isPending = req["managerStatus"] == "pending";

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
                        req["employeeName"]?[0] ?? "U",
                        style: const TextStyle(color: primaryColor, fontWeight: FontWeight.w600, fontSize: 18),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(req["employeeName"] ?? "Unknown", style: const TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 14.5)),
                        Text(req["leaveType"] ?? "Leave", style: const TextStyle(color: subtitleColor, fontSize: 10.5, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  _statusBadge(req["managerStatus"] ?? "pending", _getStatusColor(req["managerStatus"] ?? "pending")),
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
                    _dateInfo("Duration", "${req["numberOfDays"]} Day(s)"),
                    const SizedBox(width: 24),
                    _dateInfo("Dates", "${DateFormat('MMM d').format(DateTime.parse(req["fromDate"]))} - ${DateFormat('MMM d').format(DateTime.parse(req["toDate"]))}"),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text("REASON", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: subtitleColor, letterSpacing: 0.4)),
              const SizedBox(height: 6),
              Text(
                req["reason"] ?? "No reason provided",
                style: const TextStyle(fontSize: 12.5, color: subtitleColor, height: 1.5, fontWeight: FontWeight.w500),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (isPending) ...[
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(child: _buildActionBtn("Reject", Icons.close_rounded, Colors.red.shade400, () => _updateLeaveStatus(req["_id"], "rejected"))),
                    const SizedBox(width: 12),
                    Expanded(child: _buildActionBtn("Approve", Icons.check_circle_rounded, Colors.teal, () => _updateLeaveStatus(req["_id"], "accepted"))),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Color _getStatusColor(String status) {
    if (status == "pending") return Colors.orange;
    if (status == "accepted") return Colors.teal;
    return Colors.red;
  }

  Widget _buildProfessionalHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
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
                    Text("Leave", style: TextStyle(fontWeight: FontWeight.w600, color: primaryColor, fontSize: 24, letterSpacing: -1.0)),
                    Text("MANAGEMENT & APPROVALS", style: TextStyle(color: subtitleColor, fontSize: 9.5, fontWeight: FontWeight.w500, letterSpacing: 1.4)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              _summaryCard("Pending", "${_leaveRequests.where((e) => e["managerStatus"] == "pending").length}", Colors.orange),
              const SizedBox(width: 12),
              _summaryCard("Total Requests", "${_leaveRequests.length}", primaryColor),
            ],
          ),
          const SizedBox(height: 16),
          TabBar(
            indicatorColor: primaryColor,
            indicatorSize: TabBarIndicatorSize.label,
            dividerColor: Colors.transparent,
            labelColor: primaryColor,
            unselectedLabelColor: subtitleColor,
            labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
            tabs: const [
              Tab(text: "Pending"),
              Tab(text: "History"),
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
