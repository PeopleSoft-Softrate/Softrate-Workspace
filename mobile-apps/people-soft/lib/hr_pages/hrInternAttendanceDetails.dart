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
      return DateFormat("dd MMM yy").format(d);
    }
    final d = DateTime.parse(isoOrDate).toLocal();
    return DateFormat("dd MMM yy").format(d);
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
class HrInternAttendanceDetails extends StatefulWidget {
  final String internId;
  final String internName;

  const HrInternAttendanceDetails({
    required this.internId,
    required this.internName,
    super.key,
  });

  @override
  State<HrInternAttendanceDetails> createState() =>
      _HrInternAttendanceDetailsState();
}

class _HrInternAttendanceDetailsState extends State<HrInternAttendanceDetails> {
  Future<void> _updateAttendance(
    String date, {
    String? punchIn,
    String? punchOut,
  }) async {
    try {
      final response = await http.post(
        Uri.parse("${getBaseUrl()}/api/attendance/update-manual"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "internId": widget.internId,
          "date": date,
          if (punchIn != null) "punchInTime": punchIn,
          if (punchOut != null) "punchOutTime": punchOut,
        }),
      );

      if (response.statusCode == 200) {
        setState(() {
          _futureAttendance = fetchAttendance(widget.internId);
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Attendance updated successfully")),
          );
        }
      } else {
        throw Exception("Failed to update attendance");
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _pickAndSaveTime(AttendanceRecord record, bool isPunchIn) async {
    final existingTimeStr = isPunchIn
        ? record.punchInTime
        : record.punchOutTime;
    DateTime dateDT;
    try {
      dateDT = DateTime.parse(record.date);
    } catch (e) {
      final parts = record.date.split('_');
      dateDT = DateTime.parse(parts.last);
    }

    TimeOfDay initialTime = const TimeOfDay(hour: 9, minute: 0);
    if (existingTimeStr != null) {
      try {
        final existingDT = DateTime.parse(existingTimeStr).toLocal();
        initialTime = TimeOfDay.fromDateTime(existingDT);
      } catch (_) {}
    }

    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: initialTime,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF00657F),
              onPrimary: Colors.white,
              onSurface: Colors.black,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final newDT = DateTime(
        dateDT.year,
        dateDT.month,
        dateDT.day,
        picked.hour,
        picked.minute,
      ).toUtc(); // 🔥 FIXED: Convert to UTC before sending

      await _updateAttendance(
        _normalizeDate(record.date),
        punchIn: isPunchIn ? newDT.toIso8601String() : null,
        punchOut: isPunchIn ? null : newDT.toIso8601String(),
      );
    }
  }

  Widget _buildEditableTime(
    String? time,
    VoidCallback onTap, {
    bool isAbsent = false,
    String? label,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isAbsent ? Colors.orange.shade50 : const Color(0xFFF0F7F9),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isAbsent ? Colors.orange.shade200 : const Color(0xFFB3D8E0),
            width: 0.6,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isAbsent
                  ? Icons.add_circle_outline_rounded
                  : Icons.edit_calendar_outlined,
              size: 11,
              color: isAbsent
                  ? Colors.orange.shade800
                  : const Color(0xFF146374),
            ),
            const SizedBox(width: 4),
            Text(
              isAbsent
                  ? "Add Entry"
                  : (label != null
                        ? "$label ${formatTime(time)}"
                        : formatTime(time)),
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                color: isAbsent
                    ? Colors.orange.shade900
                    : const Color(0xFF146374),
              ),
            ),
          ],
        ),
      ),
    );
  }

  late Future<List<AttendanceRecord>> _futureAttendance;
  late Future<List<LeaveRecord>> _futureLeaves;
  DateTimeRange? _selectedRange;
  String _activeTab = "This Month";

  @override
  void initState() {
    super.initState();
    _futureAttendance = fetchAttendance(widget.internId);
    _futureLeaves = fetchLeavesForIntern(widget.internId);
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

    // Determine date range
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
        title: Text(
          "${widget.internName} Attendance",
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.download_rounded),
            tooltip: "Export Attendance",
            onPressed: _pickDateRangeAndExportPdf,
          ),
        ],
        flexibleSpace: Container(color: const Color(0xFF00657F)),
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
                        flex: 2,
                        child: Text(
                          "Date",
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Expanded(
                        flex: 6,
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

                          return Container(
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
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: 12,
                                horizontal: 16,
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    flex: 3,
                                    child: Text(
                                      formatDate(r.date),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13.5,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 8,
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.center,
                                      children: [
                                        Text(
                                          durationText == "--"
                                              ? "NA"
                                              : durationText,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        if (!isAbsent) ...[
                                          const SizedBox(height: 6),
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              _buildEditableTime(
                                                r.punchInTime,
                                                () => _pickAndSaveTime(r, true),
                                                label: "In:",
                                              ),
                                              const SizedBox(width: 4),
                                              _buildEditableTime(
                                                r.punchOutTime,
                                                () =>
                                                    _pickAndSaveTime(r, false),
                                                label: "Out:",
                                              ),
                                            ],
                                          ),
                                        ] else ...[
                                          const SizedBox(height: 6),
                                          _buildEditableTime(
                                            null,
                                            () => _pickAndSaveTime(r, true),
                                            isAbsent: true,
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  Expanded(
                                    flex: 2,
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 3,
                                          ),
                                          decoration: BoxDecoration(
                                            color: statusBg,
                                            borderRadius: BorderRadius.circular(
                                              999,
                                            ),
                                          ),
                                          child: Text(
                                            statusLabel,
                                            style: TextStyle(
                                              color: statusText,
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
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

                  return Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "Upcoming Leave",
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 8,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: bg,
                                  borderRadius: BorderRadius.circular(50),
                                ),
                                child: Text(
                                  nearestLeave.status.toUpperCase(),
                                  style: TextStyle(
                                    color: text,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
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
                  );
                },
              ),
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
                        count: calculateShortDays(finalRecords),
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
        "${getBaseUrl()}/api/attendance/export/pdf/${widget.internId}",
        queryParameters: {
          "from": fromDate.toIso8601String(),
          "to": toDate.toIso8601String(),
        },
        options: Options(responseType: ResponseType.bytes),
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
    bool isSelected = _activeTab == label;
    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() {
            _activeTab = label;
          });
        },
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF00657F) : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isSelected
                  ? Colors.white
                  : const Color(0xFF146374).withOpacity(0.6),
            ),
          ),
        ),
      ),
    );
  }
}
