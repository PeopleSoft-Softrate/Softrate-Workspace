import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:media_store_plus/media_store_plus.dart';
import 'package:path_provider/path_provider.dart';

// ------------------- MODELS -------------------
class AttendanceRecord {
  final String id;
  final String date;
  final String? punchInTime;
  final String? punchOutTime;

  AttendanceRecord({
    required this.id,
    required this.date,
    this.punchInTime,
    this.punchOutTime,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    String? parseDate(dynamic val) {
      if (val == null) return null;
      if (val is String) return val;
      if (val is Map && val['\$date'] != null) return val['\$date'] as String;
      return null;
    }

    String parseId(dynamic val) {
      if (val == null) return '';
      if (val is String) return val;
      if (val is Map && val['\$oid'] != null) return val['\$oid'] as String;
      return '';
    }

    return AttendanceRecord(
      id: parseId(json['_id']),
      date: json['date'] ?? '',
      punchInTime: parseDate(json['punchInTime']),
      punchOutTime: parseDate(json['punchOutTime']),
    );
  }
}

class LeaveRecord {
  final String leaveType;
  final String status;
  final String reason;
  final String fromDate;
  final String toDate;

  LeaveRecord({
    required this.leaveType,
    required this.status,
    required this.reason,
    required this.fromDate,
    required this.toDate,
  });

  factory LeaveRecord.fromJson(Map<String, dynamic> json) {
    String parseDateField(dynamic val) {
      if (val is String) return val;
      if (val is Map && val['\$date'] != null) return val['\$date'];
      return "";
    }

    return LeaveRecord(
      leaveType: json['leaveType'] ?? "",
      status: json['status'] ?? "",
      reason: json['reason'] ?? "",
      fromDate: parseDateField(json['fromDate']),
      toDate: parseDateField(json['toDate']),
    );
  }
}

// ------------------- FETCH FUNCTIONS -------------------
Future<List<AttendanceRecord>> fetchAttendance(String employeeId) async {
  print(employeeId);
  final response = await http.get(
    Uri.parse("${getBaseUrl()}/api/employeeAttanance/employee/$employeeId"),
    headers: {"Content-Type": "application/json"},
  );

  if (response.statusCode == 200) {
    final body = jsonDecode(response.body);
    print(body['attendance'].runtimeType);
    final List list = body['attendance'] ?? [];
    return list
        .map((e) => AttendanceRecord.fromJson(e as Map<String, dynamic>))
        .toList();
  } else {
    throw Exception("Failed to load attendance");
  }
}

/// Fetches work duration settings from company settings API.
/// Returns a map like { 'employee': 480, 'intern': 360, 'hr': 480, 'manager': 480 } (in minutes)
Future<Map<String, int>> fetchWorkDurationMinutes() async {
  try {
    final response = await http.get(
      Uri.parse("${getBaseUrl()}/api/settings/company"),
      headers: {"Content-Type": "application/json"},
    );
    if (response.statusCode == 200) {
      final body = jsonDecode(response.body);
      final wd = body['workDurationSettings'] ?? {};
      return {
        'hr':       ((wd['hr']       as num?)?.toDouble() ?? 8.0) ~/ 1 * 60,
        'manager':  ((wd['manager']  as num?)?.toDouble() ?? 8.0) ~/ 1 * 60,
        'employee': ((wd['employee'] as num?)?.toDouble() ?? 8.0) ~/ 1 * 60,
        'intern':   ((wd['intern']   as num?)?.toDouble() ?? 6.0) ~/ 1 * 60,
      };
    }
  } catch (_) {}
  // Defaults if API fails
  return { 'hr': 480, 'manager': 480, 'employee': 480, 'intern': 360 };
}

// Future<List<LeaveRecord>> fetchLeavesForEmployee(String employeeId) async {
//   final response = await http.get(
//     Uri.parse(
//       "${getBaseUrl()}/api/employeeAttanance/employee/$employeeId",
//     ),
//   );

//   if (response.statusCode == 200) {
//     // 🔹 Step 1: Decode as MAP
//     final Map<String, dynamic> body =
//         jsonDecode(response.body) as Map<String, dynamic>;

//     // 🔹 Step 2: Extract LIST from map
//     final List data = body['attendance']; // ✅ THIS IS THE LIST

//     // 🔹 Step 3: Convert to model
//     return data
//         .map((e) => LeaveRecord.fromJson(e as Map<String, dynamic>))
//         .toList();
//   } else {
//     throw Exception("Failed to load leave data");
//   }
// }

// ------------------- UTILS -------------------
String formatDate(String isoOrDate) {
  try {
    if (isoOrDate.length == 10) {
      final d = DateTime.parse(isoOrDate);
      return DateFormat("E, dd MMM yyyy").format(d);
    }
    final d = DateTime.parse(isoOrDate).toLocal();
    return DateFormat("E, dd MMM yyyy").format(d);
  } catch (_) {
    return isoOrDate;
  }
}

String formatTime(String? iso) {
  if (iso == null) return "--";
  try {
    final t = DateTime.parse(iso).toLocal();
    return DateFormat("h:mm a").format(t);
  } catch (_) {
    return "--";
  }
}

/// Returns true if the worked time is less than requiredMinutes.
bool isShortTime(String? inTime, String? outTime, {int requiredMinutes = 360}) {
  if (inTime == null || outTime == null) return false;
  try {
    final start = DateTime.parse(inTime);
    final end = DateTime.parse(outTime);
    final diff = end.difference(start);
    return diff.inMinutes < requiredMinutes;
  } catch (_) {
    return false;
  }
}

/// Returns how much time the employee was short of the required duration.
String shortByText(String? inTime, String? outTime, {int requiredMinutes = 360}) {
  if (inTime == null || outTime == null) return '';
  try {
    final start = DateTime.parse(inTime);
    final end = DateTime.parse(outTime);
    final worked = end.difference(start);
    final required = Duration(minutes: requiredMinutes);
    if (worked >= required) return '';
    final diff = required - worked;
    final h = diff.inHours;
    final m = diff.inMinutes % 60;
    if (h > 0 && m > 0) return '${h}h ${m}m short';
    if (h > 0) return '${h}h short';
    return '${m}m short';
  } catch (_) {
    return '';
  }
}

String formatDuration(String? inTime, String? outTime) {
  if (inTime == null || outTime == null) return "--";
  try {
    final start = DateTime.parse(inTime);
    final end = DateTime.parse(outTime);
    final diff = end.difference(start);
    final h = diff.inHours.toString().padLeft(2, '0');
    final m = (diff.inMinutes % 60).toString().padLeft(2, '0');
    return "$h h $m m";
  } catch (_) {
    // Check if it's already in h m format
    if (inTime.contains('h') || outTime.contains('h')) return inTime;
    return "--";
  }
}

int calculatePresentDays(List<AttendanceRecord> records) => records
    .where((r) => r.punchInTime != null && r.punchOutTime != null)
    .length;

int calculateShortDays(List<AttendanceRecord> records, {int requiredMinutes = 360}) => records
    .where(
      (r) =>
          r.punchInTime != null &&
          r.punchOutTime != null &&
          isShortTime(r.punchInTime, r.punchOutTime, requiredMinutes: requiredMinutes),
    )
    .length;

int calculateAbsentDays(List<AttendanceRecord> records) => records
    .where((r) => r.punchInTime == null && r.punchOutTime == null)
    .length;

// ------------------- WIDGETS -------------------
Widget _leaveRow(String title, String value, {int maxLines = 1}) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(
            "$title:",
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
        ),
        Expanded(
          child: Text(
            value,
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w400,
              color: Colors.black87,
            ),
          ),
        ),
      ],
    ),
  );
}

Widget _buildSummaryBox({
  required int count,
  required String label,
  required Color bgColor,
  required Color textColor,
}) {
  return Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text(
            "$count",
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: textColor,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: textColor.withOpacity(0.8),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    ),
  );
}

// ------------------- MAIN WIDGET -------------------
class Employeeattendancedetails extends StatefulWidget {
  final String employeeId;
  final String employeeName;
  final String? userRole; // e.g. 'employee', 'intern', 'hr', 'manager'

  const Employeeattendancedetails({
    required this.employeeId,
    required this.employeeName,
    this.userRole,
    super.key,
  });

  @override
  State<Employeeattendancedetails> createState() =>
      _EmployeeattendancedetailsState();
}

class _EmployeeattendancedetailsState extends State<Employeeattendancedetails> {
  late Future<List<AttendanceRecord>> _futureAttendance;
  late Future<Map<String, int>> _futureWorkDuration;
  // late Future<List<LeaveRecord>> _futureLeaves;
  DateTimeRange? _selectedRange;
  String _activeTab = "This Month";
  /// Role of the currently logged-in user — set from localStorage-backed widget param or defaults to 'employee'
  String get _userRole => widget.userRole?.toLowerCase() ?? 'employee';

  @override
  void initState() {
    super.initState();
    _futureAttendance = fetchAttendance(widget.employeeId);
    _futureWorkDuration = fetchWorkDurationMinutes();
    // _futureLeaves = fetchLeavesForEmployee(widget.employeeId);
  }

  Future<void> _showRatificationDialog(AttendanceRecord record) async {
    final df = DateFormat("yyyy-MM-dd");
    final date = record.date;

    TimeOfDay? newPunchIn;
    TimeOfDay? newPunchOut;
    final reasonController = TextEditingController();

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text(
            "Edit Attendance",
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Date: ${formatDate(date)}",
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 20),
                const Text(
                  "New Punch-In Time",
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                  ),
                ),
                InkWell(
                  onTap: () async {
                    final t = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.now(),
                    );
                    if (t != null) setDialogState(() => newPunchIn = t);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      vertical: 12,
                      horizontal: 12,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.access_time,
                          size: 18,
                          color: const Color(0xFF00657F),
                        ),
                        const SizedBox(width: 8),
                        Text(newPunchIn?.format(context) ?? "Select Time"),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  "New Punch-Out Time",
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                  ),
                ),
                InkWell(
                  onTap: () async {
                    final t = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.now(),
                    );
                    if (t != null) setDialogState(() => newPunchOut = t);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      vertical: 12,
                      horizontal: 12,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.access_time,
                          size: 18,
                          color: const Color(0xFF00657F),
                        ),
                        const SizedBox(width: 8),
                        Text(newPunchOut?.format(context) ?? "Select Time"),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  "Reason for correction",
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                  ),
                ),
                TextField(
                  controller: reasonController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: "Why was it marked wrongly?",
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () async {
                if (reasonController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Please provide a reason")),
                  );
                  return;
                }

                final payload = {
                  "employeeId": widget.employeeId,
                  "employeeName": widget.employeeName,
                  "leaveType": "Attendance Correction",
                  "fromDate": date,
                  "toDate": date,
                  "numberOfDays": 0,
                  "reason":
                      "Correction Request: Punch-In [${newPunchIn?.format(context) ?? 'No Change'}], Punch-Out [${newPunchOut?.format(context) ?? 'No Change'}]. Reason: ${reasonController.text.trim()}",
                  "status": "pending",
                  "perDayDurations": {date: "Correction Request"},
                };

                final response = await http.post(
                  Uri.parse("${getBaseUrl()}/api/employee-leave/apply"),
                  headers: {"Content-Type": "application/json"},
                  body: jsonEncode(payload),
                );

                if (response.statusCode == 200 || response.statusCode == 201) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Correction request sent to HR"),
                      backgroundColor: Colors.green,
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Failed to send request"),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00657F),
                foregroundColor: Colors.white,
              ),
              child: const Text("Submit Request"),
            ),
          ],
        ),
      ),
    );
  }

  List<AttendanceRecord> mergeAttendanceWithFilters(
    List<AttendanceRecord> records,
  ) {
    final now = DateTime.now();

    // 🔥 FIX 1: Normalize ALL dates to YYYY-MM-DD format
    Map<String, AttendanceRecord> recordMap = {
      for (var r in records) _normalizeDate(r.date): r, // Always "2025-11-18"
    };

    List<AttendanceRecord> finalList = [];

    // Determine date range based on active tab
    DateTime startDate;
    DateTime endDate = now;

    if (_activeTab == "Last 7 Days") {
      startDate = now.subtract(const Duration(days: 6));
    } else if (_activeTab == "This Month") {
      startDate = DateTime(now.year, now.month, 1);
      endDate = DateTime(now.year, now.month + 1, 0);
    } else {
      // Custom
      if (_selectedRange != null) {
        startDate = _selectedRange!.start;
        endDate = _selectedRange!.end;
      } else {
        // Default to this month if no range picked
        startDate = DateTime(now.year, now.month, 1);
        endDate = DateTime(now.year, now.month + 1, 0);
      }
    }

    // Generate all dates in range
    for (int i = 0; i <= endDate.difference(startDate).inDays; i++) {
      final date = startDate.add(Duration(days: i));
      final dateKey = _normalizeDate(
        date.toIso8601String(),
      ); // Always "2025-11-18"

      // Skip weekends unless they have records
      if ((date.weekday == DateTime.saturday ||
              date.weekday == DateTime.sunday) &&
          !recordMap.containsKey(dateKey)) {
        continue;
      }

      if (recordMap.containsKey(dateKey)) {
        finalList.add(recordMap[dateKey]!);
      } else if (date.isBefore(now)) {
        // Add absent record
        finalList.add(
          AttendanceRecord(
            id: "absent_$dateKey",
            date: dateKey,
            punchInTime: null,
            punchOutTime: null,
          ),
        );
      }
    }
    // In mergeAttendanceWithFilters, after building recordMap:

    return finalList.reversed.toList();
  }

  // 🔥 FIX 2: Add this helper method
  String _normalizeDate(String dateStr) {
    try {
      // Handle both "2025-11-18" and full ISO "2025-11-18T05:38:56.799Z"
      final date = DateTime.parse(dateStr);
      return "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
    } catch (e) {
      // Fallback for malformed dates
      return dateStr.split('T')[0].split(' ')[0];
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F8),
      appBar: AppBar(
        elevation: 0,
        centerTitle: true,
        title: const Text(
          "My Attendance",
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 22,
            letterSpacing: -0.5,
            color: Colors.white,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.download_rounded, color: Colors.white),
            tooltip: "Export Attendance",
            onPressed: _pickDateRangeAndExportPdf,
          ),
        ],
        flexibleSpace: Container(color: const Color(0xFF00657F)),
        iconTheme: const IconThemeData(color: Colors.white),
        foregroundColor: Colors.white,
        backgroundColor: Colors.transparent,
      ),
      body: FutureBuilder<List<dynamic>>(
        future: Future.wait([_futureAttendance, _futureWorkDuration]),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Text(
                "Error: ${snapshot.error}",
                style: const TextStyle(color: Colors.red),
              ),
            );
          }

          final attendanceRecords = (snapshot.data?[0] as List<AttendanceRecord>?) ?? [];
          final workDurationMap = (snapshot.data?[1] as Map<String, int>?) ??
              { 'hr': 480, 'manager': 480, 'employee': 480, 'intern': 360 };
          final int requiredMinutes = workDurationMap[_userRole] ?? workDurationMap['employee'] ?? 480;

          // ✅ FIXED: Proper merge with filters (using class method)
          final finalRecords = mergeAttendanceWithFilters(attendanceRecords);

          return Column(
            children: [
              const SizedBox(height: 12),
              // Filter UI - Tabbed Style
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F4F8),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      _buildFilterTab("Last 7 Days"),
                      _buildFilterTab("This Month"),
                      _buildFilterTab("Custom"),
                    ],
                  ),
                ),
              ),
              if (_activeTab == "Custom") ...[
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: InkWell(
                    onTap: () async {
                      final picked = await showDateRangePicker(
                        context: context,
                        firstDate: DateTime(2023),
                        lastDate: DateTime.now(),
                        initialDateRange: _selectedRange,
                      );
                      if (picked != null) {
                        setState(() {
                          _selectedRange = picked;
                        });
                      }
                    },
                    child: Row(
                      children: [
                        const Icon(
                          Icons.calendar_month,
                          size: 20,
                          color: Color(0xFF00657F),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _selectedRange == null
                              ? "Select Date Range"
                              : "${DateFormat('d MMM yyyy').format(_selectedRange!.start)} - ${DateFormat('d MMM yyyy').format(_selectedRange!.end)}",
                          style: const TextStyle(
                            color: Color(0xFF00657F),
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12.0),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFC857), Color(0xFFFFB336)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Row(
                    children: [
                      Expanded(
                        flex: 4,
                        child: Text(
                          "Date",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          "Work Hours",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          "Status",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // List
              Expanded(
                child: finalRecords.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(
                              Icons.filter_alt_off,
                              size: 48,
                              color: Colors.grey,
                            ),
                            SizedBox(height: 12),
                            Text(
                              "No attendance records found",
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        itemCount: finalRecords.length,
                        itemBuilder: (context, index) {
                          final r = finalRecords[index];
                          final isAbsent =
                              r.punchInTime == null && r.punchOutTime == null;
                          final short = isShortTime(
                            r.punchInTime,
                            r.punchOutTime,
                            requiredMinutes: requiredMinutes,
                          );
                          final durationText = formatDuration(
                            r.punchInTime,
                            r.punchOutTime,
                          );
                          final shortLabel = short
                              ? shortByText(r.punchInTime, r.punchOutTime, requiredMinutes: requiredMinutes)
                              : '';

                          String statusLabel;
                          Color statusBg;
                          Color statusText;

                          if (isAbsent) {
                            statusLabel = "A";
                            statusBg = const Color(0xFFFFE4E4);
                            statusText = const Color(0xFFD32F2F);
                          } else if (short) {
                            statusLabel = "S";
                            statusBg = Colors.blue.shade100;
                            statusText = Colors.blue.shade800;
                          } else {
                            statusLabel = "P";
                            statusBg = const Color(0xFFE0F6EA);
                            statusText = const Color(0xFF2E7D32);
                          }

                          return _FadeInWrapper(
                            delay: (index % 6) * 100,
                            child: Container(
                              margin: const EdgeInsets.symmetric(vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.04),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Theme(
                                data: Theme.of(
                                  context,
                                ).copyWith(dividerColor: Colors.transparent),
                                child: ExpansionTile(
                                  tilePadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 4,
                                  ),
                                  childrenPadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 8,
                                  ),
                                  title: Row(
                                    children: [
                                      Expanded(
                                        flex: 4,
                                        child: Builder(
                                          builder: (context) {
                                            DateTime d;
                                            try {
                                              d = DateTime.parse(r.date);
                                            } catch (_) {
                                              return Text(
                                                formatDate(r.date),
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 14,
                                                ),
                                              );
                                            }
                                            return Text(
                                              DateFormat(
                                                "E, dd MMM yyyy",
                                              ).format(d),
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 14,
                                              ),
                                            );
                                          },
                                        ),
                                      ),
                                      Expanded(
                                        flex: 3,
                                        child: Text(
                                          durationText == "--"
                                              ? "NA"
                                              : durationText,
                                          textAlign: TextAlign.center,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ),
                                      Expanded(
                                        flex: 2,
                                        child: Align(
                                          alignment: Alignment.centerRight,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 8,
                                              vertical: 4,
                                            ),
                                            decoration: BoxDecoration(
                                              color: statusBg,
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              statusLabel,
                                              style: TextStyle(
                                                color: statusText,
                                                fontWeight: FontWeight.w800,
                                                fontSize: 11,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  iconColor: const Color(0xFF00657F),
                                  collapsedIconColor: Colors.grey,
                                  children: [
                                    const Divider(
                                      height: 1,
                                      color: Color(0xFFF1F1F1),
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            const Text(
                                              "Punch In",
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.grey,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              formatTime(r.punchInTime),
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ],
                                        ),
                                        Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            const Text(
                                              "Punch Out",
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.grey,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              formatTime(r.punchOutTime),
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ],
                                        ),
                                        ElevatedButton.icon(
                                          onPressed: () =>
                                              _showRatificationDialog(r),
                                          icon: const Icon(
                                            Icons.edit_note_rounded,
                                            size: 18,
                                          ),
                                          label: const Text(
                                            "Edit",
                                            style: TextStyle(fontSize: 12),
                                          ),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(
                                              0xFF00657F,
                                            ),
                                            foregroundColor: Colors.white,
                                            elevation: 0,
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 0,
                                            ),
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),
              // Leave History
              // FutureBuilder<List<LeaveRecord>>(
              //   future: _futureLeaves,
              //   builder: (context, snap) {
              //     if (snap.connectionState == ConnectionState.waiting) {
              //       return const Padding(
              //         padding: EdgeInsets.all(12.0),
              //         child: CircularProgressIndicator(),
              //       );
              //     }
              //     if (!snap.hasData || snap.data!.isEmpty) {
              //       return const SizedBox();
              //     }

              //     final now = DateTime.now();
              //     final futureLeaves = snap.data!
              //         .where(
              //           (l) =>
              //               DateTime.parse(l.fromDate).isAfter(now) ||
              //               DateTime.parse(l.fromDate).isAtSameMomentAs(now),
              //         )
              //         .toList();

              //     if (futureLeaves.isEmpty) return const SizedBox();

              //     futureLeaves.sort(
              //       (a, b) => DateTime.parse(
              //         a.fromDate,
              //       ).compareTo(DateTime.parse(b.fromDate)),
              //     );
              //     final nearestLeave = futureLeaves.first;

              //     Color bg;
              //     Color text;

              //     switch (nearestLeave.status.toLowerCase()) {
              //       case "approved":
              //         bg = Colors.green.shade100;
              //         text = Colors.green.shade800;
              //         break;
              //       case "rejected":
              //         bg = Colors.red.shade100;
              //         text = Colors.red.shade800;
              //         break;
              //       default:
              //         bg = Colors.amber.shade100;
              //         text = Colors.orange.shade800;
              //     }

              //     return Padding(
              //       padding: const EdgeInsets.all(12.0),
              //       child: Column(
              //         crossAxisAlignment: CrossAxisAlignment.start,
              //         children: [
              //           const Text(
              //             "Upcoming Leave",
              //             style: TextStyle(
              //               fontSize: 18,
              //               fontWeight: FontWeight.w700,
              //             ),
              //           ),
              //           const SizedBox(height: 10),
              //           Container(
              //             padding: const EdgeInsets.all(16),
              //             decoration: BoxDecoration(
              //               color: Colors.white,
              //               borderRadius: BorderRadius.circular(16),
              //               boxShadow: [
              //                 BoxShadow(
              //                   color: Colors.black.withOpacity(0.05),
              //                   blurRadius: 8,
              //                   offset: const Offset(0, 4),
              //                 ),
              //               ],
              //             ),
              //             child: Column(
              //               crossAxisAlignment: CrossAxisAlignment.start,
              //               children: [
              //                 Container(
              //                   padding: const EdgeInsets.symmetric(
              //                     horizontal: 10,
              //                     vertical: 4,
              //                   ),
              //                   decoration: BoxDecoration(
              //                     color: bg,
              //                     borderRadius: BorderRadius.circular(50),
              //                   ),
              //                   child: Text(
              //                     nearestLeave.status.toUpperCase(),
              //                     style: TextStyle(
              //                       color: text,
              //                       fontWeight: FontWeight.bold,
              //                       fontSize: 12,
              //                     ),
              //                   ),
              //                 ),
              //                 const SizedBox(height: 10),
              //                 _leaveRow("Leave Type", nearestLeave.leaveType),
              //                 _leaveRow(
              //                   "Reason",
              //                   nearestLeave.reason,
              //                   maxLines: 3,
              //                 ),
              //                 _leaveRow(
              //                   "Period",
              //                   "${formatDate(nearestLeave.fromDate)} → ${formatDate(nearestLeave.toDate)}",
              //                 ),
              //               ],
              //             ),
              //           ),
              //         ],
              //       ),
              //     );
              //   },
              // ),
              // Summary
              SafeArea(
                top: true,
                bottom: false,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 8,
                        offset: const Offset(0, -2),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      _buildSummaryBox(
                        count: calculatePresentDays(finalRecords),
                        label: "Present",
                        bgColor: Colors.green.shade100,
                        textColor: Colors.green.shade800,
                      ),
                      const SizedBox(width: 10),
                      _buildSummaryBox(
                        count: calculateShortDays(finalRecords, requiredMinutes: requiredMinutes),
                        label: "Short Time",
                        bgColor: Colors.blue.shade100,
                        textColor: Colors.blue.shade800,
                      ),
                      const SizedBox(width: 10),
                      _buildSummaryBox(
                        count: calculateAbsentDays(finalRecords),
                        label: "Absent",
                        bgColor: Colors.red.shade100,
                        textColor: Colors.red.shade800,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _pickDateRangeAndExportPdf() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2023),
      lastDate: DateTime.now(),
      initialDateRange: DateTimeRange(
        start: DateTime.now().subtract(const Duration(days: 7)),
        end: DateTime.now(),
      ),
    );

    if (picked == null) return;

    await _exportAttendancePdf(fromDate: picked.start, toDate: picked.end);
  }

  Future<void> _exportAttendancePdf({
    required DateTime fromDate,
    required DateTime toDate,
  }) async {
    try {
      await MediaStore.ensureInitialized();
      MediaStore.appFolder = "SoftPeople";

      final dio = Dio();

      final response = await dio.get(
        "${getBaseUrl()}/api/employeeAttanance/export/pdf/employee/${widget.employeeId}",
        queryParameters: {
          "from": fromDate.toIso8601String(),
          "to": toDate.toIso8601String(),
        },
        options: Options(responseType: ResponseType.bytes),
      );

      final fileName =
          "${widget.employeeName}_attendance_${DateFormat('ddMMMyy').format(fromDate)}_${DateFormat('ddMMMyy').format(toDate)}.pdf";

      final tempPath = await _createTempFile(response.data, fileName);

      final mediaStore = MediaStore();
      await mediaStore.saveFile(
        tempFilePath: tempPath,
        dirType: DirType.download,
        dirName: DirName.download,
        relativePath: "SoftPeople",
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("PDF saved to Downloads/SoftPeople/$fileName")),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("PDF export failed"),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<String> _createTempFile(List<int> bytes, String fileName) async {
    final dir = await getTemporaryDirectory();
    final file = File("${dir.path}/$fileName");
    await file.writeAsBytes(bytes);
    return file.path;
  }

  Widget _buildFilterTab(String label) {
    final isActive = _activeTab == label;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _activeTab = label),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFF001E3C) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isActive ? Colors.white : Colors.grey.shade600,
              fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}

class _FadeInWrapper extends StatefulWidget {
  final Widget child;
  final int delay;

  const _FadeInWrapper({required this.child, required this.delay});

  @override
  State<_FadeInWrapper> createState() => _FadeInWrapperState();
}

class _FadeInWrapperState extends State<_FadeInWrapper> {
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) {
        setState(() {
          _visible = true;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 600),
      curve: Curves.easeOut,
      opacity: _visible ? 1.0 : 0.0,
      child: AnimatedPadding(
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(top: _visible ? 0 : 20),
        child: widget.child,
      ),
    );
  }
}
