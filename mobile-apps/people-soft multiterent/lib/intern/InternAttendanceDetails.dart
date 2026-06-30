import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:media_store_plus/media_store_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
      if (val is Map && val['\$date'] != null) return val['\$date'];
      return null;
    }

    return AttendanceRecord(
      id: json['_id']?.toString() ?? '',
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
Future<List<AttendanceRecord>> fetchAttendance(String internId) async {
  final response = await http.get(
    Uri.parse("${getBaseUrl()}/api/attendance/intern/$internId"),
    headers: {"Content-Type": "application/json"},
  );

  if (response.statusCode == 200) {
    final body = jsonDecode(response.body);
    final List list = body['attendance'] ?? [];
    return list
        .map((e) => AttendanceRecord.fromJson(e as Map<String, dynamic>))
        .toList();
  } else {
    throw Exception("Failed to load attendance");
  }
}

Future<List<LeaveRecord>> fetchLeavesForIntern(String internId) async {
  final url = Uri.parse("${getBaseUrl()}/api/leave/$internId");
  final response = await http.get(url);

  if (response.statusCode == 200) {
    final List data = jsonDecode(response.body);
    return data.map((e) => LeaveRecord.fromJson(e)).toList();
  } else {
    throw Exception("Failed to load leave data");
  }
}

// ------------------- UTILS -------------------
String formatDate(String isoOrDate) {
  try {
    if (isoOrDate.length == 10) {
      final d = DateTime.parse(isoOrDate);
      return DateFormat("E, dd MMM").format(d);
    }
    final d = DateTime.parse(isoOrDate).toLocal();
    return DateFormat("E, dd MMM").format(d);
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

bool isShortTime(String? inTime, String? outTime) {
  if (inTime == null || outTime == null) return false;
  try {
    final start = DateTime.parse(inTime);
    final end = DateTime.parse(outTime);
    final diff = end.difference(start);
    return diff.inMinutes < 360; // < 6 hours
  } catch (_) {
    return false;
  }
}

int calculatePresentDays(List<AttendanceRecord> records) => records
    .where((r) => r.punchInTime != null && r.punchOutTime != null)
    .length;

int calculateShortDays(List<AttendanceRecord> records) => records
    .where(
      (r) =>
          r.punchInTime != null &&
          r.punchOutTime != null &&
          isShortTime(r.punchInTime, r.punchOutTime),
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
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: bgColor.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: bgColor.withOpacity(0.25), width: 1),
      ),
      child: Column(
        children: [
          Text(
            "$count",
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w900,
              color: textColor,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: textColor.withOpacity(0.9),
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    ),
  );
}

// ------------------- MAIN WIDGET -------------------
class InternAttendanceDetails extends StatefulWidget {
  final String internId;
  final String internName;

  const InternAttendanceDetails({
    required this.internId,
    required this.internName,
    super.key,
  });

  @override
  State<InternAttendanceDetails> createState() =>
      _InternAttendanceDetailsState();
}

class _InternAttendanceDetailsState extends State<InternAttendanceDetails> {
  late Future<List<AttendanceRecord>> _futureAttendance;
  late Future<List<LeaveRecord>> _futureLeaves;
  DateTimeRange? _selectedRange;
  String _activeTab = "This Month";

  // ── Dynamic holiday config from backend ────────────────────────────────────
  /// Weekly rules: each entry is {day: "Sat", weeks: [1, 2]}
  List<Map<String, dynamic>> _weeklyHolidays = [];
  /// Special holiday dates as "YYYY-MM-DD" strings
  Set<String> _specialHolidayDates = {};

  @override
  void initState() {
    super.initState();
    _futureAttendance = fetchAttendance(widget.internId);
    _futureLeaves = fetchLeavesForIntern(widget.internId);
    _loadHolidays();
  }

  Future<void> _loadHolidays() async {
    try {
      final resp = await http.get(
        Uri.parse("${getBaseUrl()}/api/holidays"),
        headers: {"Content-Type": "application/json"},
      );
      if (resp.statusCode == 200) {
        final List raw = jsonDecode(resp.body);
        final List<Map<String, dynamic>> weekly = [];
        final Set<String> special = {};
        for (final h in raw) {
          if (h['type'] == 'weekly' && h['day'] != null) {
            final List<dynamic> weeks = h['weeks'] ?? [];
            weekly.add({'day': h['day'].toString(), 'weeks': weeks.map((w) => w as int).toList()});
          } else if (h['type'] == 'special') {
            // Expand fromDate..toDate into individual YYYY-MM-DD keys
            final fromRaw = h['fromDate'];
            final toRaw   = h['toDate'];
            if (fromRaw != null && toRaw != null) {
              try {
                DateTime from = DateTime.parse(fromRaw.toString().split('T')[0]);
                final DateTime to = DateTime.parse(toRaw.toString().split('T')[0]);
                while (!from.isAfter(to)) {
                  special.add(_normalizeDate(from.toIso8601String()));
                  from = from.add(const Duration(days: 1));
                }
              } catch (_) {}
            }
          }
        }
        if (mounted) {
          setState(() {
            _weeklyHolidays = weekly;
            _specialHolidayDates = special;
          });
        }
      }
    } catch (_) {
      // Fallback: if fetch fails, no dates are skipped (safe default)
    }
  }

  /// Returns true if [date] is a configured holiday (weekly rule OR special range).
  /// Days that have actual punch records are NEVER skipped — caller checks that.
  bool _isHolidayDate(DateTime date) {
    // 1. Special date ranges
    final key = _normalizeDate(date.toIso8601String());
    if (_specialHolidayDates.contains(key)) return true;

    // 2. Weekly rules — e.g. "Sat" on week 1 & 2
    const dayMap = {1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat',7:'Sun'};
    final dayName = dayMap[date.weekday] ?? '';
    final weekOfMonth = ((date.day - 1) ~/ 7) + 1; // 1-based week of month
    for (final rule in _weeklyHolidays) {
      if (rule['day'] == dayName) {
        final List<int> weeks = List<int>.from(rule['weeks'] ?? []);
        // If weeks list is empty → ALL occurrences of that day are holidays
        if (weeks.isEmpty || weeks.contains(weekOfMonth)) return true;
      }
    }
    return false;
  }

  Future<void> _showRatificationDialog(AttendanceRecord record) async {
    final date = record.date;
    TimeOfDay? newPunchIn;
    TimeOfDay? newPunchOut;
    final reasonController = TextEditingController();

    // Fetch internMongoId from SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    final internMongoId = prefs.getString("internMongoId");

    if (internMongoId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Authentication error. Please re-login.")),
        );
      }
      return;
    }

    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text(
            "Request Attendance Correction",
            style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF00657F)),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Date: ${formatDate(date)}",
                  style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.black87),
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
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.login_rounded,
                          size: 18,
                          color: Color(0xFF00657F),
                        ),
                        const SizedBox(width: 8),
                        Text(newPunchIn?.format(context) ?? "Select Time", style: const TextStyle(fontSize: 14)),
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
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.logout_rounded,
                          size: 18,
                          color: Color(0xFF00657F),
                        ),
                        const SizedBox(width: 8),
                        Text(newPunchOut?.format(context) ?? "Select Time", style: const TextStyle(fontSize: 14)),
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
                const SizedBox(height: 4),
                TextField(
                  controller: reasonController,
                  maxLines: 2,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: "Why was it marked wrongly?",
                    hintStyle: const TextStyle(fontSize: 13, color: Colors.grey),
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
              child: const Text("Cancel", style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () async {
                if (reasonController.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Please provide a reason")),
                  );
                  return;
                }

                if (newPunchIn == null && newPunchOut == null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Please select at least one new time")),
                  );
                  return;
                }

                // Helper to format TimeOfDay to ISO-ish time string for the backend
                String formatTimeOfDay(TimeOfDay? tod, String recordDate) {
                  if (tod == null) return "";
                  final baseDate = DateTime.parse(recordDate);
                  final dt = DateTime(baseDate.year, baseDate.month, baseDate.day, tod.hour, tod.minute);
                  return dt.toUtc().toIso8601String();
                }

                final payload = {
                  "internMongoId": internMongoId,
                  "date": date,
                  "requestedPunchIn": newPunchIn != null ? formatTimeOfDay(newPunchIn, date) : null,
                  "requestedPunchOut": newPunchOut != null ? formatTimeOfDay(newPunchOut, date) : null,
                  "reason": reasonController.text.trim()
                };

                final response = await http.post(
                  Uri.parse("${getBaseUrl()}/api/attendance-requests/apply"),
                  headers: {"Content-Type": "application/json"},
                  body: jsonEncode(payload),
                );

                if (response.statusCode == 201 || response.statusCode == 200) {
                  if (!context.mounted) return;
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Correction request sent to your Manager"),
                      backgroundColor: Colors.green,
                    ),
                  );
                } else {
                  final error = jsonDecode(response.body);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(error['message'] ?? "Failed to send request"),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00657F),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text("Submit to Manager"),
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

    // Prevent showing absent days before the user's first attendance record
    if (records.isNotEmpty) {
      DateTime? earliest;
      for (var r in records) {
        try {
          final d = DateTime.parse(_normalizeDate(r.date));
          if (earliest == null || d.isBefore(earliest)) earliest = d;
        } catch (_) {}
      }
      if (earliest != null && startDate.isBefore(earliest)) {
        startDate = earliest;
      }
    } else {
      final today = DateTime(now.year, now.month, now.day);
      if (startDate.isBefore(today)) {
        startDate = today;
      }
    }

    // Generate all dates in range
    for (int i = 0; i <= endDate.difference(startDate).inDays; i++) {
      final date = startDate.add(Duration(days: i));
      final dateKey = _normalizeDate(
        date.toIso8601String(),
      ); // Always "2025-11-18"

      // Skip holiday dates (dynamic: weekly rules + special ranges) unless they have records
      if (_isHolidayDate(date) && !recordMap.containsKey(dateKey)) {
        continue;
      }

      if (recordMap.containsKey(dateKey)) {
        finalList.add(recordMap[dateKey]!);
      } else if (date.isBefore(now)) {
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
            icon: const Icon(Icons.file_download_outlined),
            tooltip: "Export Attendance",
            onPressed: _pickDateRangeAndExportPdf,
          ),
          const SizedBox(width: 8),
        ],
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF00657F), Color(0xFF004E61)],
            ),
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        foregroundColor: Colors.white,
        backgroundColor: Colors.transparent,
      ),
      body: FutureBuilder<List<AttendanceRecord>>(
        future: _futureAttendance,
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

          // ✅ FIXED: Proper merge with filters (using class method)
          final finalRecords = mergeAttendanceWithFilters(snapshot.data ?? []);

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
              const SizedBox(height: 16),
              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12.0),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 16,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      colors: [Color(0xFFFFC857), Color(0xFFFFB336)],
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFFB336).withOpacity(0.25),
                        blurRadius: 15,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 4,
                        child: Text(
                          "Day / Date",
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.95),
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          "Work Hours",
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.95),
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: 0.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          "Status",
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.95),
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: 0.5,
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
                          );
                          final durationText = formatDuration(
                            r.punchInTime,
                            r.punchOutTime,
                          );

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
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.04),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Material(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                clipBehavior: Clip.antiAlias,
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
                                                "E, dd MMM",
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
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                        },
                      ),
              ),
              // Leave History
              FutureBuilder<List<LeaveRecord>>(
                future: _futureLeaves,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Padding(
                      padding: EdgeInsets.all(12.0),
                      child: CircularProgressIndicator(),
                    );
                  }
                  if (!snap.hasData || snap.data!.isEmpty) {
                    return const SizedBox();
                  }

                  final now = DateTime.now();
                  final futureLeaves = snap.data!
                      .where(
                        (l) =>
                            DateTime.parse(l.fromDate).isAfter(now) ||
                            DateTime.parse(l.fromDate).isAtSameMomentAs(now),
                      )
                      .toList();

                  if (futureLeaves.isEmpty) return const SizedBox();

                  futureLeaves.sort(
                    (a, b) => DateTime.parse(
                      a.fromDate,
                    ).compareTo(DateTime.parse(b.fromDate)),
                  );
                  final nearestLeave = futureLeaves.first;

                  Color bg;
                  Color text;

                  switch (nearestLeave.status.toLowerCase()) {
                    case "approved":
                      bg = Colors.green.shade100;
                      text = Colors.green.shade800;
                      break;
                    case "rejected":
                      bg = Colors.red.shade100;
                      text = Colors.red.shade800;
                      break;
                    default:
                      bg = Colors.amber.shade100;
                      text = Colors.orange.shade800;
                  }

                  return _FadeInWrapper(
                    delay: 400,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Upcoming Leave",
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: bg.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                color: bg.withOpacity(0.2),
                                width: 1.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: bg.withOpacity(0.05),
                                  blurRadius: 15,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                        boxShadow: [
                                          BoxShadow(
                                            color: bg.withOpacity(0.1),
                                            blurRadius: 8,
                                          ),
                                        ],
                                      ),
                                      child: Icon(
                                        nearestLeave.status.toLowerCase() ==
                                                "approved"
                                            ? Icons.check_circle_rounded
                                            : nearestLeave.status
                                                      .toLowerCase() ==
                                                  "rejected"
                                            ? Icons.cancel_rounded
                                            : Icons.hourglass_top_rounded,
                                        color: text,
                                        size: 20,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      nearestLeave.status.toUpperCase(),
                                      style: TextStyle(
                                        color: text,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 14,
                                        letterSpacing: 1.0,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 20),
                                _leaveRow("Leave Type", nearestLeave.leaveType),
                                _leaveRow(
                                  "Reason",
                                  nearestLeave.reason,
                                  maxLines: 3,
                                ),
                                _leaveRow(
                                  "Period",
                                  "${formatDate(nearestLeave.fromDate)} → ${formatDate(nearestLeave.toDate)}",
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              // Summary
              SafeArea(
                top: false,
                bottom: true,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.08),
                        blurRadius: 25,
                        offset: const Offset(0, -5),
                      ),
                    ],
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(32),
                      topRight: Radius.circular(32),
                    ),
                  ),
                  child: Row(
                    children: [
                      _buildSummaryBox(
                        count: calculatePresentDays(finalRecords),
                        label: "Present",
                        bgColor: Colors.green,
                        textColor: Colors.green.shade900,
                      ),
                      const SizedBox(width: 12),
                      _buildSummaryBox(
                        count: calculateShortDays(finalRecords),
                        label: "Short Time",
                        bgColor: Colors.blue,
                        textColor: Colors.blue.shade900,
                      ),
                      const SizedBox(width: 12),
                      _buildSummaryBox(
                        count: calculateAbsentDays(finalRecords),
                        label: "Absent",
                        bgColor: Colors.red,
                        textColor: Colors.red.shade900,
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

      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';

      final dio = Dio();

      final response = await dio.get(
        "${getBaseUrl()}/api/attendance/export/pdf/${widget.internId}",
        queryParameters: {
          "from": DateFormat('yyyy-MM-dd').format(fromDate),
          "to": DateFormat('yyyy-MM-dd').format(toDate),
        },
        options: Options(
          responseType: ResponseType.bytes,
          headers: {
            if (token.isNotEmpty) 'Authorization': 'Bearer $token',
          },
        ),
      );

      final fileName =
          "${widget.internName}_attendance_${DateFormat('ddMMMyy').format(fromDate)}_${DateFormat('ddMMMyy').format(toDate)}.pdf";

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
          content: Text("PDF export failed: ${e.toString()}"),
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
