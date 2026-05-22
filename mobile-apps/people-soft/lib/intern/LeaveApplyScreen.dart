import 'dart:convert';
import 'dart:io';

import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:intl/intl.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:http_parser/http_parser.dart';

class LeaveApplyScreen extends StatefulWidget {
  final String internId;
  final String internName;

  const LeaveApplyScreen({
    required this.internId,
    required this.internName,
    super.key,
  });

  @override
  State<LeaveApplyScreen> createState() => _LeaveApplyScreenState();
}

class LeaveRecord {
  final String id;
  final String leaveType;
  final String fromDate;
  final String toDate;
  final String managerStatus;
  final String hrStatus;
  final String rejectionReason;
  final Map<String, String> perDayDurations;

  LeaveRecord({
    required this.id,
    required this.leaveType,
    required this.fromDate,
    required this.toDate,
    required this.managerStatus,
    required this.hrStatus,
    this.rejectionReason = "",
    this.perDayDurations = const {},
  });

  factory LeaveRecord.fromJson(Map<String, dynamic> json) {
    Map<String, String> perDay = {};
    if (json['perDayDurations'] != null) {
      perDay = Map<String, String>.from(json['perDayDurations']);
    }

    final from = json['fromDate'] is Map
        ? json['fromDate']['\$date']
        : json['fromDate'];
    final to = json['toDate'] is Map
        ? json['toDate']['\$date']
        : json['toDate'];

    return LeaveRecord(
      id: json['_id'] ?? '',
      leaveType: json['leaveType'] ?? '',
      fromDate: from,
      toDate: to,
      managerStatus: json['managerStatus'] ?? 'pending',
      hrStatus: json['hrStatus'] ?? 'pending',
      rejectionReason: json['rejectionReason'] ?? '',
      perDayDurations: perDay,
    );
  }
}

class _LeaveApplyScreenState extends State<LeaveApplyScreen> {
  final List<String> _leaveTypes = const [
    'Casual Leave',
    'Sick Leave',
    'Half Day',
    'Permission',
  ];

  final List<String> _durationOptions = const [
    'Full Day',
    'Half Day',
    'Permission (30 min)',
    'Permission (1 hrs)',
    'Permission (1:30 hrs)',
    'Permission (2 hrs)',
  ];

  String? _selectedLeaveType;
  DateTime? _fromDate;
  DateTime? _toDate;
  int _numberOfDays = 0;

  bool _isSubmitting = false;

  final Map<String, String> _perDayDurations = {};

  final TextEditingController _reasonController = TextEditingController();
  PlatformFile? _attachedFile;

  final Color _primary = const Color(0xFF00657F);
  final Color _accent = const Color(0xFF42A5B9);

  int _leavesTakenThisMonth = 0;
  late Future<List<LeaveRecord>> _leavesFuture;

  @override
  void initState() {
    super.initState();
    _fetchLeaveCount();
    _leavesFuture = fetchLeavesForIntern();
  }

  Future<void> _fetchLeaveCount() async {
    try {
      final now = DateTime.now();
      final response = await http.get(
        Uri.parse(
          "${getBaseUrl()}/api/employee-leave/count/${widget.internId}?month=${now.month}&year=${now.year}",
        ),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) {
          setState(() {
            _leavesTakenThisMonth = data['totalDays'] ?? 0;
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching leave count: $e");
    }
  }

  bool get _canSubmit =>
      _selectedLeaveType != null &&
      _fromDate != null &&
      _toDate != null &&
      (_leavesTakenThisMonth + _calculateTotalDays()) <= 2 &&
      _reasonController.text.trim().isNotEmpty &&
      (_selectedLeaveType != "Sick Leave" || _attachedFile != null);

  // ------------------------
  // SUBMIT
  // ------------------------

  Future<void> _pickFile() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );

      if (result != null) {
        setState(() {
          _attachedFile = result.files.first;
        });
      }
    } catch (e) {
      debugPrint("File picking error: $e");
    }
  }

  void _submitLeave() async {
    if (!_canSubmit) return;

    setState(() => _isSubmitting = true);

    final payload = {
      "internId": widget.internId,
      "internName": widget.internName,
      "leaveType": _selectedLeaveType,
      "fromDate": _fromDate!.toIso8601String(),
      "toDate": _toDate!.toIso8601String(),
      "numberOfDays": _numberOfDays,
      "reason": _reasonController.text.trim(),
      "status": "pending",
      "rejectionReason": "",
      "perDayDurations": _perDayDurations,
    };

    try {
      final uri = Uri.parse("${getBaseUrl()}/api/employee-leave/apply");
      http.Response response;

      if (_attachedFile == null) {
        // Use standard JSON for better compatibility when no file is attached
        final payload = {
          "employeeId": widget.internId,
          "employeeName": widget.internName,
          "leaveType": _selectedLeaveType,
          "fromDate": DateFormat('yyyy-MM-dd').format(_fromDate!),
          "toDate": DateFormat('yyyy-MM-dd').format(_toDate!),
          "numberOfDays": _numberOfDays,
          "reason": _reasonController.text.trim(),
          "perDayDurations": _perDayDurations,
        };

        response = await http.post(
          uri,
          headers: {"Content-Type": "application/json"},
          body: jsonEncode(payload),
        );
      } else {
        // Use Multipart for file uploads
        final request = http.MultipartRequest('POST', uri);
        request.fields['employeeId'] = widget.internId;
        request.fields['employeeName'] = widget.internName;
        request.fields['leaveType'] = _selectedLeaveType!;
        request.fields['fromDate'] = DateFormat('yyyy-MM-dd').format(_fromDate!);
        request.fields['toDate'] = DateFormat('yyyy-MM-dd').format(_toDate!);
        request.fields['numberOfDays'] = _numberOfDays.toString();
        request.fields['reason'] = _reasonController.text.trim();
        request.fields['perDayDurations'] = jsonEncode(_perDayDurations);

        if (_attachedFile!.path != null) {
          request.files.add(
            await http.MultipartFile.fromPath(
              'document',
              _attachedFile!.path!,
              contentType: MediaType('application', 'octet-stream'),
            ),
          );
        }

        final streamedResponse = await http.send(request);
        response = await http.Response.fromStream(streamedResponse);
      }

      final Map<String, dynamic> body =
          response.body.isNotEmpty ? jsonDecode(response.body) : {};

      final bool success = (response.statusCode == 200 || response.statusCode == 201) && (body["success"] != false);
      final String msg =
          body["message"] ??
          (success ? "Leave applied successfully!" : "Failed to apply leave (Error ${response.statusCode}).");

      void showStyledSnack(bool isSuccess, String text) {
        final Color bg = isSuccess
            ? const Color(0xFF1B5E20)
            : const Color(0xFFB00020);
        final IconData icon = isSuccess
            ? Icons.check_circle
            : Icons.error_outline;

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            backgroundColor: bg,
            content: Row(
              children: [
                Icon(icon, color: Colors.white),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    text,
                    style: const TextStyle(fontSize: 14, color: Colors.white),
                  ),
                ),
              ],
            ),
            duration: const Duration(seconds: 3),
          ),
        );
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        if (success) {
          showStyledSnack(true, msg);
          setState(() {
            _selectedLeaveType = null;
            _fromDate = null;
            _toDate = null;
            _numberOfDays = 0;
            _perDayDurations.clear();
            _reasonController.clear();
            _attachedFile = null;
            _fetchLeaveCount(); // Refresh count after success
            _leavesFuture = fetchLeavesForIntern(); // Refresh history
          });
        } else {
          // e.g. overlapping accepted/pending leave
          showStyledSnack(false, msg);
        }
      } else {
        showStyledSnack(false, msg);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          backgroundColor: const Color(0xFFB00020),
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(
                child: const Text(
                  "Something went wrong. Please try again.",
                  style: TextStyle(fontSize: 14, color: Colors.white),
                ),
              ),
            ],
          ),
          duration: const Duration(seconds: 3),
        ),
      );
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  // ------------------------
  // DATE SELECTION
  // ------------------------
  Future<void> _pickFromDate() async {
    final now = DateTime.now().subtract(const Duration(days: 14));
    final picked = await showDatePicker(
      context: context,
      initialDate: _fromDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF00657F), // header + selected date
              onPrimary: Colors.white, // text on header
              onSurface: Colors.black87, // day labels
            ),
            textButtonTheme: TextButtonThemeData(
              style: TextButton.styleFrom(
                foregroundColor: Color(0xFF00657F), // OK / CANCEL
              ),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _fromDate = picked;
        if (_toDate != null) {
          if (_toDate!.isBefore(_fromDate!)) {
            _toDate = _fromDate;
          } else if (_toDate!.isAfter(
            _fromDate!.add(const Duration(days: 1)),
          )) {
            _toDate = _fromDate!.add(const Duration(days: 1));
          }
        }
        _recalculateDays();
      });
    }
  }

  Future<void> _pickToDate() async {
    if (_fromDate == null) {
      await _pickFromDate();
      if (_fromDate == null) return;
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: _toDate ?? _fromDate!,
      firstDate: _fromDate!,
      lastDate: _fromDate!.add(const Duration(days: 1)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF00657F),
              onPrimary: Colors.white,
              onSurface: Colors.black87,
            ),
            textButtonTheme: TextButtonThemeData(
              style: TextButton.styleFrom(foregroundColor: Color(0xFF00657F)),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _toDate = picked;
        _recalculateDays();
      });
    }
  }

  void _recalculateDays() {
    if (_fromDate != null && _toDate != null) {
      _numberOfDays = _toDate!.difference(_fromDate!).inDays + 1;
      _perDayDurations.clear();
      for (int i = 0; i < _numberOfDays; i++) {
        final d = _fromDate!.add(Duration(days: i));
        _perDayDurations[d.toIso8601String()] = "Full Day";
      }
    } else {
      _numberOfDays = 0;
      _perDayDurations.clear();
    }
  }

  Future<void> _handleDurationChange(String key, String v) async {
    if (v == 'Full Day' || v == 'Half Day') {
      setState(() => _perDayDurations[key] = v);
      return;
    }

    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF00657F),
              onPrimary: Colors.white,
              onSurface: Colors.black87,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final now = DateTime.now();
      final startTime = DateTime(
        now.year,
        now.month,
        now.day,
        picked.hour,
        picked.minute,
      );
      final format = DateFormat("hh:mm a");
      final startTimeStr = format.format(startTime);

      if (v == 'Half Day') {
        setState(() => _perDayDurations[key] = "$v @ $startTimeStr");
      } else if (v.startsWith('Permission')) {
        // Calculate end time
        int addMins = 0;
        if (v.contains("30 min"))
          addMins = 30;
        else if (v.contains("1 hrs"))
          addMins = 60;
        else if (v.contains("1:30 hrs"))
          addMins = 90;
        else if (v.contains("2 hrs"))
          addMins = 120;

        final endTime = startTime.add(Duration(minutes: addMins));
        final endTimeStr = format.format(endTime);
        setState(
          () => _perDayDurations[key] = "$v ($startTimeStr - $endTimeStr)",
        );
      }
    }
  }

  String _formatDateRange() {
    if (_fromDate == null || _toDate == null) return "Select date range";
    final df = DateFormat("dd MMM yyyy");
    return "${df.format(_fromDate!)} - ${df.format(_toDate!)}";
  }

  String _getLeaveSummaryText() {
    List<String> leaveItems = [];
    List<String> permissionItems = [];
    int fullDays = 0;

    _perDayDurations.forEach((key, duration) {
      final date = DateTime.parse(key);
      final dateStr = DateFormat("d MMM").format(date);
      
      if (duration == 'Full Day') {
        fullDays++;
      } else if (duration.contains('Half Day')) {
        leaveItems.add("Half Day on $dateStr");
      } else if (duration.startsWith('Permission')) {
        // duration: "Permission (1 hrs) (10:00 AM - 11:00 AM)"
        final parts = duration.split(" (");
        if (parts.length >= 3) {
          final durStr = parts[1].replaceAll(")", "");
          final timeStr = parts[2].replaceAll(")", "");
          permissionItems.add("$timeStr ($durStr) on $dateStr");
        }
      }
    });

    String result = "";
    
    if (fullDays > 0 || leaveItems.isNotEmpty) {
      result = "Applying leave for ";
      List<String> combined = [];
      if (fullDays > 0) combined.add("$fullDays Day${fullDays > 1 ? 's' : ''}");
      combined.addAll(leaveItems);
      result += combined.join(", ");
    }

    if (permissionItems.isNotEmpty) {
      if (result.isNotEmpty) result += " and ";
      result += "Applying permission for ${permissionItems.join(", ")}";
    }

    if (result.isEmpty) return "Applying leave";
    return result;
  }

  double _calculateTotalDays() {
    double total = 0;
    _perDayDurations.values.forEach((duration) {
      if (duration == 'Full Day') {
        total += 1.0;
      } else if (duration == 'Half Day') {
        total += 0.5;
      }
      // Permissions usually don't count towards the "2 days per month" limit as full days,
      // keeping them at 0 for now as per standard HR policy unless told otherwise.
    });
    return total;
  }


  // ------------------------
  // UI START
  // ------------------------
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bg = const Color(0xFFF5F5F7);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        title: const Text(
          " Leave Application",
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
      ),

      body: SafeArea(
        top: true,
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),

          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildTopCard(),
              const SizedBox(height: 20),

              if (_numberOfDays > 0) _buildPerDayCard(),
              const SizedBox(height: 24),

              if (_numberOfDays > 0)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: (_leavesTakenThisMonth + _calculateTotalDays()) > 2
                        ? Colors.red.shade50
                        : const Color(0xFFE4EBFF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Text(
                        _getLeaveSummaryText(),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color:
                              (_leavesTakenThisMonth + _calculateTotalDays()) >
                                  2
                              ? Colors.red.shade800
                              : _primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if ((_leavesTakenThisMonth + _calculateTotalDays()) > 2)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            "Maximum 2 leaves allowed per month. You have already used $_leavesTakenThisMonth day(s).",
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.red,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

              const SizedBox(height: 20),
              _buildSubmitButton(),

              const SizedBox(height: 16),
              Text(
                "Leave History",
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              _buildLeavesList(),
            ],
          ),
        ),
      ),
    );
  }

  // ------------------------
  // TOP CARD
  // ------------------------
  Future<List<LeaveRecord>> fetchLeavesForIntern() async {
    // use widget.internId from this screen
    final url = Uri.parse("${getBaseUrl()}/api/employee-leave/employee/${widget.internId}");
    final response = await http.get(url);

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((e) => LeaveRecord.fromJson(e)).toList();
    } else {
      throw Exception('Failed to fetch leaves');
    }
  }

  String formatDate(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      return DateFormat("d MMM").format(dt);
    } catch (_) {
      return raw;
    }
  }

  Widget _buildLeavesList() {
    return Container(
      constraints: const BoxConstraints(minHeight: 120),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: FutureBuilder<List<LeaveRecord>>(
        future: _leavesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator()),
            );
          }

          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                "Unable to load leaves. Please try again.",
                style: TextStyle(color: Colors.red.shade700, fontSize: 13),
              ),
            );
          }

          final allLeaves = snapshot.data ?? [];

          // Show leaves from 20 days ago until the future
          final leaves = allLeaves.where((leave) {
            try {
              final from = DateTime.parse(leave.fromDate).toLocal();
              final to = DateTime.parse(leave.toDate).toLocal();
              final now = DateTime.now();
              final twentyDaysAgo = DateTime(now.year, now.month, now.day).subtract(const Duration(days: 20));
              
              // Start of the day for comparison
              final fromDay = DateTime(from.year, from.month, from.day);
              final toDay = DateTime(to.year, to.month, to.day);

              // Show if it ends after 20 days ago (so ongoing or future)
              // OR if it started after 20 days ago
              return toDay.isAtSameMomentAs(twentyDaysAgo) || toDay.isAfter(twentyDaysAgo);
            } catch (_) {
              return false;
            }
          }).toList();

          if (leaves.isEmpty) {
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                "No leave records found in the last 20 days.",
                style: TextStyle(fontSize: 13, color: Colors.black54),
              ),
            );
          }

          return ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: leaves.length,
            separatorBuilder: (_, __) =>
                const Divider(height: 0, indent: 12, endIndent: 12),
            itemBuilder: (context, index) {
              final leave = leaves[index];

              // Determine primary status for color/icon (HR status is final)
              final hrStatus = leave.hrStatus.toLowerCase();
              final managerStatus = leave.managerStatus.toLowerCase();
              
              Color statusColor = Colors.orange;
              IconData statusIcon = Icons.hourglass_top_rounded;
              String statusLabel = 'HR Pending';

              if (hrStatus == 'accepted') {
                statusColor = Colors.green;
                statusLabel = 'Approved';
                statusIcon = Icons.check_circle_rounded;
              } else if (hrStatus == 'rejected') {
                statusColor = Colors.red;
                statusLabel = 'Rejected';
                statusIcon = Icons.cancel_rounded;
              } else if (managerStatus == 'rejected') {
                statusColor = Colors.red;
                statusLabel = 'Rejected';
                statusIcon = Icons.cancel_rounded;
              }

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.08),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(statusIcon, color: statusColor, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  leave.leaveType,
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: statusColor.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  statusLabel,
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              _buildMiniBadge("Manager", managerStatus),
                              const SizedBox(width: 8),
                              _buildMiniBadge("HR", hrStatus),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            "${formatDate(leave.fromDate)}  •  ${formatDate(leave.toDate)}",
                            style: const TextStyle(fontSize: 13, color: Colors.black87),
                          ),
                          if ((hrStatus == "rejected" || managerStatus == "rejected") &&
                              leave.rejectionReason.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              "Reason: ${leave.rejectionReason}",
                              style: TextStyle(fontSize: 12, color: Colors.red.shade700),
                            ),
                          ],
                          if (leave.perDayDurations.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            const Text(
                              "Per day durations",
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 2),
                            ...leave.perDayDurations.entries.map((entry) {
                              final dateStr = formatDate(entry.key);
                              final duration = entry.value;
                              return Text(
                                "$dateStr • $duration",
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Colors.black87,
                                ),
                              );
                            }),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildTopCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),

      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
              ),
              gradient: LinearGradient(
                colors: [_accent, _primary],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_month_rounded, color: Colors.white),
                const SizedBox(width: 8),
                const Text(
                  "Apply for Leave",
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withOpacity(0.3)),
                  ),
                  child: Text(
                    "Monthly: $_leavesTakenThisMonth / 2",
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Label("LEAVE TYPE"),
                _dropdownField(
                  value: _selectedLeaveType,
                  items: _leaveTypes,
                  hint: "Select leave type",
                  onChanged: (v) => setState(() => _selectedLeaveType = v),
                ),

                const SizedBox(height: 18),
                _Label("LEAVE REASON"),
                _textField(_reasonController),

                const SizedBox(height: 18),
                _Label("LEAVE DATES"),
                InkWell(
                  onTap: () async {
                    await _pickFromDate();
                    if (_fromDate != null) {
                      await _pickToDate();
                    }
                  },
                  child: _datePickerField(_formatDateRange()),
                ),
                const SizedBox(height: 18),
                _Label("ATTACH DOCUMENT"),
                const SizedBox(height: 8),
                InkWell(
                  onTap: _pickFile,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F8FB),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E3E8)),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.upload_file_rounded,
                          color: _attachedFile != null
                              ? Colors.green
                              : _primary,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _attachedFile?.name ??
                                (_selectedLeaveType == "Sick Leave"
                                    ? "Upload medical certificate (Required)"
                                    : "Upload document (Optional)"),
                            style: TextStyle(
                              color: _attachedFile == null
                                  ? Colors.black54
                                  : Colors.black87,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        if (_attachedFile != null)
                          IconButton(
                            icon: const Icon(
                              Icons.clear,
                              size: 20,
                              color: Colors.red,
                            ),
                            onPressed: () =>
                                setState(() => _attachedFile = null),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ------------------------
  // PER DAY CARD
  // ------------------------
  Widget _buildPerDayCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                child: const Text(
                  "DATE",
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.black54,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              Container(
                child: const Text(
                  "DURATION",
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Colors.black54,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          ...List.generate(_numberOfDays, (i) {
            final d = _fromDate!.add(Duration(days: i));
            final key = d.toIso8601String();

            return Column(
              children: [
                _PerDayRow(
                  date: d,
                  selected: (() {
                    final full = _perDayDurations[key] ?? "Full Day";
                    if (full.startsWith("Permission")) {
                      final parts = full.split(" (");
                      if (parts.length >= 2) return "${parts[0]} (${parts[1]}";
                    }
                    return full.split(" @ ").first;
                  })(),
                  options: _durationOptions,
                  onChanged: (v) => _handleDurationChange(key, v),
                ),
                const SizedBox(height: 16),
              ],
            );
          }),
        ],
      ),
    );
  }

  // ------------------------
  // BUTTON
  // ------------------------
  Widget _buildSubmitButton() {
    return ElevatedButton(
      onPressed: _canSubmit && !_isSubmitting ? _submitLeave : null,

      style: ElevatedButton.styleFrom(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: _isSubmitting
          ? const CircularProgressIndicator(color: Colors.white)
          : const Text(
              "Submit",
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
            ),
    );
  }

  // ------------------------
  // FIELD WIDGETS
  // ------------------------
  Widget _dropdownField({
    required String? value,
    required List<String> items,
    required String hint,
    required ValueChanged<String?> onChanged,
  }) {
    return _SurfaceField(
      child: DropdownButtonHideUnderline(
        child: DropdownButton2<String>(
          value: value,
          isExpanded: true,
          iconStyleData: const IconStyleData(
            icon: Icon(Icons.keyboard_arrow_down),
          ),
          items: items
              .map(
                (t) => DropdownMenuItem(
                  value: t,
                  child: Text(
                    t,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              )
              .toList(),
          onChanged: onChanged,
          hint: Text(hint, style: const TextStyle(color: Colors.black54)),
          dropdownStyleData: DropdownStyleData(
            width: MediaQuery.of(context).size.width * 0.85,
            offset: const Offset(-13, -16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.12),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _textField(TextEditingController c) {
    return _SurfaceField(
      child: TextField(
        controller: c,
        maxLines: 2,
        decoration: const InputDecoration(
          border: InputBorder.none,
          hintText: "Enter reason",
        ),
        onChanged: (_) => setState(() {}),
      ),
    );
  }

  Widget _datePickerField(String text) {
    return _SurfaceField(
      trailing: Icon(Icons.calendar_today_outlined, color: _primary),
      child: Text(text, style: const TextStyle(fontSize: 16)),
    );
  }

  Widget _buildMiniBadge(String label, String status) {
    Color color = Colors.orange;
    if (status == 'accepted' || status == 'approved') color = Colors.green;
    if (status == 'rejected') color = Colors.red;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            "$label: ",
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w500, color: Colors.black54),
          ),
          Text(
            status.toUpperCase(),
            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}

// -------------------------------------------------------------
// SMALL UI WIDGETS
// -------------------------------------------------------------
class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.7,
        color: Colors.black54,
      ),
    );
  }
}

class _SurfaceField extends StatelessWidget {
  final Widget child;
  final Widget? trailing;

  const _SurfaceField({required this.child, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F8FB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E3E8)),
      ),
      child: Row(
        children: [
          Expanded(child: child),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
      ),
    );
  }
}

// -------------------------------------------------------------
// PREMIUM PER-DAY TILE
// -------------------------------------------------------------
class _PerDayRow extends StatelessWidget {
  final DateTime date;
  final String selected;
  final List<String> options;
  final ValueChanged<String> onChanged;

  const _PerDayRow({
    required this.date,
    required this.selected,
    required this.options,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final df = DateFormat("dd MMM yyyy");

    return Row(
      children: [
        // LEFT COLUMN — DATE
        Expanded(
          flex: 1,
          child: Text(
            df.format(date),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
        ),

        // RIGHT COLUMN — DROPDOWN
        Expanded(
          flex: 1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF7F7FA),
              border: Border.all(color: Color(0xFFE1E3E8)),
              borderRadius: BorderRadius.circular(10),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: selected,
                isExpanded: true,
                icon: const Icon(Icons.keyboard_arrow_down_rounded),
                items: options
                    .map((op) => DropdownMenuItem(value: op, child: Text(op)))
                    .toList(),
                onChanged: (v) => onChanged(v!),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
