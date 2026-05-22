import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:hrmappfrontend/hr_pages/support/TodayEmployeeAttendanceService.dart';

class TodayEmployeeAttendancePage extends StatefulWidget {
  const TodayEmployeeAttendancePage({super.key});

  @override
  State<TodayEmployeeAttendancePage> createState() =>
      _TodayEmployeeAttendancePageState();
}

class _TodayEmployeeAttendancePageState
    extends State<TodayEmployeeAttendancePage> {
  late Future<List<dynamic>> _attendanceFuture;

  @override
  void initState() {
    super.initState();
    _attendanceFuture = TodayEmployeeAttendanceService.fetchTodayAttendance();
  }

  String? _parseDate(dynamic val) {
    if (val == null) return null;
    if (val is String) return val;
    if (val is Map && val['\$date'] != null) return val['\$date'] as String;
    return null;
  }

  String _formatTime(dynamic time, BuildContext context) {
    final parsed = _parseDate(time);
    if (parsed == null) return "--";
    try {
      final dt = DateTime.parse(parsed).toLocal();
      return TimeOfDay.fromDateTime(dt).format(context);
    } catch (_) {
      return "--";
    }
  }

  List<dynamic> _getPunchedIn(List<dynamic> attendance) {
    return attendance.where((a) => _parseDate(a['punchInTime']) != null).toList();
  }

  List<dynamic> _getNotPunchedIn(List<dynamic> attendance) {
    return attendance.where((a) => _parseDate(a['punchInTime']) == null).toList();
  }

  Future<void> _launchPhoneCall(String? phoneNumber) async {
    if (phoneNumber == null || phoneNumber.isEmpty) return;
    print(phoneNumber);

    final Uri launchUri = Uri(scheme: 'tel', path: phoneNumber);

    try {
      await launchUrl(launchUri);
    } catch (e) {
      await Clipboard.setData(ClipboardData(text: phoneNumber));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Phone number copied: $phoneNumber'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  Widget _buildAttendanceCard(dynamic a, BuildContext context) {
    final bool isPunchedOut = _parseDate(a['punchOutTime']) != null;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 6),
        ],
      ),
      child: Row(
        children: [
          const CircleAvatar(
            backgroundColor: Color(0xFF00657F),
            child: Icon(Icons.person, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (a['name'] ?? a['employeeId']).toString().replaceFirstMapped(
                    RegExp(r'^\w'),
                    (match) => match.group(0)!.toUpperCase(),
                  ),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  "Time In  : ${_formatTime(a['punchInTime'], context)}",
                  style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                ),
                Text(
                  "Time Out : ${_formatTime(a['punchOutTime'], context)}",
                  style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                ),
                Text(
                  "Duration : ${a['duration'] ?? '--'}",
                  style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: isPunchedOut ? const Color(0xFF00657F) : Colors.green,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              isPunchedOut ? "OUT" : "IN",
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotPunchedCard(dynamic a, BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 6),
        ],
      ),
      child: Row(
        children: [
          const CircleAvatar(
            backgroundColor: Color(0xFF00657F),
            child: Icon(Icons.person, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (a['name'] ?? a['employeeId']).toString().replaceFirstMapped(
                    RegExp(r'^\w'),
                    (match) => match.group(0)!.toUpperCase(),
                  ),
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  a['employeeId']?.toString() ?? '',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onTap: () => _launchPhoneCall(a['phone']?.toString()),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.call, color: Colors.white, size: 20),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        title: const Text("Today's Attendance"),
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: FutureBuilder<List<dynamic>>(
        future: _attendanceFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00657F)),
              ),
            );
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(
                    "Failed to load attendance",
                    style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () {
                      setState(() {
                        _attendanceFuture =
                            TodayEmployeeAttendanceService.fetchTodayAttendance();
                      });
                    },
                    child: const Text("Retry"),
                  ),
                ],
              ),
            );
          }

          final allAttendance = snapshot.data ?? [];
          final punchedIn = _getPunchedIn(allAttendance);
          final notPunchedIn = _getNotPunchedIn(allAttendance);

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Summary Cards
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          children: [
                            Text(
                              "${punchedIn.length}",
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF00657F),
                              ),
                            ),
                            Text(
                              "Present",
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(height: 40, width: 1, color: Colors.grey[300]),
                      Expanded(
                        child: Column(
                          children: [
                            Text(
                              "${notPunchedIn.length}",
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.red,
                              ),
                            ),
                            Text(
                              "Pending",
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Present Section (Top)
                if (punchedIn.isNotEmpty) ...[
                  Row(
                    children: [
                      Icon(Icons.check_circle, color: Colors.green, size: 24),
                      const SizedBox(width: 8),
                      const Text(
                        "Present",
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF00657F),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ...punchedIn.map(
                    (a) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _buildAttendanceCard(a, context),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Pending Check-in Section (Bottom)
                if (notPunchedIn.isNotEmpty) ...[
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.2),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.schedule_outlined,
                          color: Colors.orange[700],
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        "Pending Check-in",
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF00657F),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ...notPunchedIn.map(
                    (a) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _buildNotPunchedCard(a, context),
                    ),
                  ),
                ],

                if (punchedIn.isEmpty && notPunchedIn.isEmpty) ...[
                  SizedBox(
                    height: MediaQuery.of(context).size.height * 0.4,
                    child: const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.schedule, size: 64, color: Colors.grey),
                        SizedBox(height: 16),
                        Text(
                          "No attendance data today",
                          style: TextStyle(fontSize: 16, color: Colors.grey),
                        ),
                        Text(
                          "Check back later",
                          style: TextStyle(fontSize: 14, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
