import 'dart:convert';

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
  final String status;
  final String rejectionReason;
  final Map<String, String> perDayDurations;

  LeaveRecord({
    required this.id,
    required this.leaveType,
    required this.fromDate,
    required this.toDate,
    required this.status,
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
      status: json['hrStatus'] ?? 'pending',
      rejectionReason: json['rejectionReason'] ?? '',
      perDayDurations: perDay,
    );
  }
}

class _LeaveApplyScreenState extends State<LeaveApplyScreen> {
  late Future<List<LeaveBalance>> _leaveBalanceFuture;
  late Future<List<LeaveRecord>> _leaveHistoryFuture;
  int _leavesTakenThisMonth = 0;

  @override
  void initState() {
    super.initState();
    _leaveBalanceFuture = fetchLeaveBalance();
    _leaveHistoryFuture = fetchLeavesForEmployee();
    _fetchInternLeaveCount();
  }

  Future<void> _fetchInternLeaveCount() async {
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



  List<String> _leaveTypes = [
    'Casual Leave',
    'Sick Leave',
    'Bereavement Leave',
    'Maternity Leave',
    'Paternity Leave',
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
  int _selectedHistoryMonth = DateTime.now().month;
  int _selectedHistoryYear = DateTime.now().year;

  final Map<String, String> _perDayDurations = {};
  final TextEditingController _reasonController = TextEditingController();
  PlatformFile? _attachedFile;

  final Color _primary = const Color(0xFF00657F);
  final Color _accent = const Color(0xFF42A5B9);

  bool get _canSubmit =>
      _selectedLeaveType != null &&
      _fromDate != null &&
      _toDate != null &&
      _reasonController.text.trim().isNotEmpty &&
      (_selectedLeaveType != "Sick Leave" || _attachedFile != null);

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
        if (v.contains("30 min")) {
          addMins = 30;
        } else if (v.contains("1 hrs"))
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

  Future<void> _submitLeave() async {
    if (!_canSubmit) return;

    setState(() => _isSubmitting = true);


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
          "status": "pending",
          "rejectionReason": "",
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
        request.fields['status'] = "pending";
        request.fields['rejectionReason'] = "";
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

            // Refresh futures
            _leaveBalanceFuture = fetchLeaveBalance();
            _fetchInternLeaveCount();
            _leaveHistoryFuture = fetchLeavesForEmployee();
          });
        } else {
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

  /* -------------------------------------------------------
     DATE PICKERS
  ------------------------------------------------------- */

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
        _fromDate = picked;
        if (_toDate != null && _toDate!.isBefore(_fromDate!)) {
          _toDate = _fromDate;
        }
        _recalculateDays();
      });
    }
  }

  // ================leave balance==========

  Future<List<LeaveBalance>> fetchLeaveBalance() async {
    final response = await http.get(
      Uri.parse(
        "${getBaseUrl()}/api/employee-leave/balance/${widget.internId}",
      ),
      headers: {"Content-Type": "application/json"},
    );

    if (response.statusCode == 200) {
      final body = jsonDecode(response.body);
      final List data = body['data'];
      final balances = data.map((e) => LeaveBalance.fromJson(e)).toList();
      
      if (mounted) {
        setState(() {
          if (balances.isNotEmpty) {
            _leaveTypes = balances
                .where((b) => b.balance > 0)
                .map((b) => b.leaveType)
                .toList();
          } else {
            // Fallback for Interns who don't use LeaveCounter collection
            _leaveTypes = [
              'Casual Leave',
              'Sick Leave',
              'Half Day',
              'Permission'
            ];
          }
              
          if (_selectedLeaveType != null && !_leaveTypes.contains(_selectedLeaveType)) {
            _selectedLeaveType = null;
          }
        });
      }
      return balances;
    } else {
      // If 404 or other error, use the fallback for interns
      if (mounted) {
        setState(() {
          _leaveTypes = [
            'Casual Leave',
            'Sick Leave',
            'Half Day',
            'Permission'
          ];
        });
      }
      return [];
    }
  }

  Future<void> _pickToDate() async {
    if (_fromDate == null) {
      await _pickFromDate();
      if (_fromDate == null) return;
    }

    final picked = await showDatePicker(
      context: context,
      initialDate: _toDate ?? _fromDate!.add(const Duration(days: 1)),
      firstDate: _fromDate!,
      lastDate: _fromDate!.add(const Duration(days: 365)),
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
    for (var duration in _perDayDurations.values) {
      if (duration == 'Full Day') {
        total += 1.0;
      } else if (duration == 'Half Day') {
        total += 0.5;
      }
    }
    return total;
  }

  /* -------------------------------------------------------
     HISTORY FETCH
  ------------------------------------------------------- */

  Future<List<LeaveRecord>> fetchLeavesForEmployee() async {
    try {
      final url = Uri.parse(
        "${getBaseUrl()}/api/employee-leave/employee/${widget.internId}",
      );
      final response = await http.get(
        url,
        headers: {"Content-Type": "application/json"},
      );

      if (response.statusCode == 200) {
        if (response.body.isEmpty) {
          return []; // Empty response is valid
        }

        final dynamic data = jsonDecode(response.body);

        // Handle both direct array and {data: [...]} wrapper
        final List<dynamic> leaves = data is List
            ? data
            : (data['data'] ?? data);

        return leaves
            .map((e) => LeaveRecord.fromJson(e as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception(
          'Failed to fetch leaves: ${response.statusCode} - ${response.reasonPhrase}',
        );
      }
    } on FormatException catch (e) {
      print("JSON Parse Error: $e");
      throw Exception('Invalid response format: $e');
    } catch (e) {
      print("Network Error: $e");
      throw Exception('Failed to fetch leaves: $e');
    }
  }

  bool _isRelevantForHistory(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final cutoff = today.subtract(const Duration(days: 14));
    final d = DateTime(date.year, date.month, date.day);
    return d.isAtSameMomentAs(cutoff) || d.isAfter(cutoff);
  }

  String formatDate(String raw) {
    try {
      final dt = DateTime.parse(raw);
      return DateFormat("d MMM").format(dt);
    } catch (_) {
      return raw;
    }
  }

  Future<void> _refreshData() async {
    setState(() {
      _leaveBalanceFuture = fetchLeaveBalance();
      _leaveHistoryFuture = fetchLeavesForEmployee();
    });
    await Future.wait([_leaveBalanceFuture, _leaveHistoryFuture]);
  }

  /* -------------------------------------------------------
     BUILD
  ------------------------------------------------------- */

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
          " Intern Leave",
          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
        ),
      ),
      body: SafeArea(
        top: true,
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _refreshData,
          color: const Color(0xFF00657F),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildLeaveBalanceSection(),
              const SizedBox(height: 20),
              _buildTopCard(),
              const SizedBox(height: 20),
              if (_numberOfDays > 0) _buildPerDayCard(),
              const SizedBox(height: 24),
              if (_numberOfDays > 0)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE4EBFF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _getLeaveSummaryText(),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              const SizedBox(height: 20),
              _buildSubmitButton(),
              const SizedBox(height: 16),
                            Text(
                "Upcoming Leave",
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              _buildLeavesList(isUpcoming: true),

              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "Leave History",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Row(
                    children: [
                      DropdownButton2<int>(
                        value: _selectedHistoryMonth,
                        underline: const SizedBox(),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF00657F)),
                        iconStyleData: const IconStyleData(
                          icon: Icon(Icons.keyboard_arrow_down, color: Color(0xFF00657F), size: 16),
                        ),
                        buttonStyleData: ButtonStyleData(
                          height: 36,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                        ),
                        dropdownStyleData: DropdownStyleData(
                          elevation: 0,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                        ),
                        menuItemStyleData: const MenuItemStyleData(height: 40),
                        items: List.generate(12, (index) {
                          final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                          return DropdownMenuItem(value: index + 1, child: Text(months[index]));
                        }),
                        onChanged: (val) => setState(() => _selectedHistoryMonth = val!),
                      ),
                      const SizedBox(width: 8),
                      DropdownButton2<int>(
                        value: _selectedHistoryYear,
                        underline: const SizedBox(),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF00657F)),
                        iconStyleData: const IconStyleData(
                          icon: Icon(Icons.keyboard_arrow_down, color: Color(0xFF00657F), size: 16),
                        ),
                        buttonStyleData: ButtonStyleData(
                          height: 36,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                        ),
                        dropdownStyleData: DropdownStyleData(
                          elevation: 0,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                        ),
                        menuItemStyleData: const MenuItemStyleData(height: 40),
                        items: [DateTime.now().year, DateTime.now().year - 1, DateTime.now().year - 2].map((y) {
                          return DropdownMenuItem(value: y, child: Text(y.toString()));
                        }).toList(),
                        onChanged: (val) => setState(() => _selectedHistoryYear = val!),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _buildLeavesList(isUpcoming: false),
            ],
          ),
        ),
      ),
      ),
    );
  }

  /* -------------------------------------------------------
     TOP CARD
  ------------------------------------------------------- */
  Widget _buildLeaveBalanceSection() {
    return FutureBuilder<List<LeaveBalance>>(
      future: _leaveBalanceFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SizedBox(
            height: 80,
            child: Center(child: CircularProgressIndicator()),
          );
        }

        if (snapshot.hasError || !snapshot.hasData) {
          return const SizedBox();
        }

        final balances = snapshot.data!;

        return SizedBox(
          height: 95,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: balances.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final b = balances[index];

              Color cardColor;
              Color accentColor;
              final t = b.leaveType.toLowerCase();
              if (t.contains('casual')) {
                cardColor = const Color(0xFFEEF2FF); // Indigo-ish
                accentColor = const Color(0xFF4338CA);
              } else if (t.contains('sick')) {
                cardColor = const Color(0xFFFEF2F2); // Rose-ish
                accentColor = const Color(0xFFB91C1C);
              } else if (t.contains('bereavement')) {
                cardColor = const Color(0xFFF8FAFC); // Slate-ish
                accentColor = const Color(0xFF334155);
              } else if (t.contains('maternity')) {
                cardColor = const Color(0xFFFDF2F8); // Pink-ish
                accentColor = const Color(0xFFBE185D);
              } else if (t.contains('paternity')) {
                cardColor = const Color(0xFFF0F9FF); // Sky-ish
                accentColor = const Color(0xFF0369A1);
              } else if (t.contains('half')) {
                cardColor = const Color(0xFFF0FDF4); // Mint-ish
                accentColor = const Color(0xFF15803D);
              } else if (t.contains('permission')) {
                cardColor = const Color(0xFFFFFBEB); // Amber-ish
                accentColor = const Color(0xFFB45309);
              } else {
                cardColor = const Color(0xFFF9FAFB);
                accentColor = const Color(0xFF374151);
              }

              return Container(
                width: 150,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: cardColor,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: accentColor.withOpacity(0.12),
                    width: 1.2,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      b.leaveType,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: accentColor.withOpacity(0.8),
                        letterSpacing: 0.3,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      "Used ${b.used} / ${b.totalAllowed}",
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: accentColor.withOpacity(0.9),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Leaves Taken",
                      style: TextStyle(
                        fontSize: 11,
                        color: accentColor.withOpacity(0.6),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
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
              children: const [
                Icon(Icons.calendar_month_rounded, color: Colors.white),
                SizedBox(width: 8),
                Text(
                  "Apply for Leave",
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
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
                const SizedBox(height: 8),
                _dropdownField(
                  value: _selectedLeaveType,
                  items: _leaveTypes,
                  hint: "Select leave type",
                  onChanged: (v) => setState(() => _selectedLeaveType = v),
                ),
                const SizedBox(height: 18),
                _Label("LEAVE REASON"),
                const SizedBox(height: 8),
                _textField(_reasonController),
                const SizedBox(height: 18),
                _Label("LEAVE DATES"),
                const SizedBox(height: 8),
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

  /* -------------------------------------------------------
     PER-DAY CARD
  ------------------------------------------------------- */

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
            children: const [
              Text(
                "DATE",
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.black54,
                  letterSpacing: 0.5,
                ),
              ),
              Text(
                "DURATION",
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.black54,
                  letterSpacing: 0.5,
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

  /* -------------------------------------------------------
     HISTORY LIST
  ------------------------------------------------------- */

  Widget _buildLeavesList({required bool isUpcoming}) {
    return Container(
      constraints: const BoxConstraints(minHeight: 120),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: FutureBuilder<List<LeaveRecord>>(
        future: _leaveHistoryFuture,
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

          final leaves = allLeaves.where((leave) {
            try {
              final from = DateTime.parse(leave.fromDate).toLocal();
              final now = DateTime.now();
              final today = DateTime(now.year, now.month, now.day);
              final fromDay = DateTime(from.year, from.month, from.day);
              
              if (isUpcoming) {
                return fromDay.isAtSameMomentAs(today) || fromDay.isAfter(today);
              } else {
                return fromDay.isBefore(today) && fromDay.month == _selectedHistoryMonth && fromDay.year == _selectedHistoryYear;
              }
            } catch (_) {
              return false;
            }
          }).toList();

          // Sort leaves: Upcoming -> nearest first. History -> latest first.
          leaves.sort((a, b) {
            try {
              final dateA = DateTime.parse(a.fromDate).toLocal();
              final dateB = DateTime.parse(b.fromDate).toLocal();
              if (isUpcoming) {
                return dateA.compareTo(dateB);
              } else {
                return dateB.compareTo(dateA);
              }
            } catch (_) {
              return 0;
            }
          });

          if (leaves.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                isUpcoming ? "No upcoming leave records." : "No leave history found for selected month/year.",
                style: const TextStyle(fontSize: 13, color: Colors.black54),
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

              final statusLower = leave.status.toLowerCase();
              Color statusColor;
              String statusLabel;
              IconData statusIcon;

              if (statusLower == 'accepted') {
                statusColor = Colors.green;
                statusLabel = 'Approved';
                statusIcon = Icons.check_circle_rounded;
              } else if (statusLower == 'rejected') {
                statusColor = Colors.red;
                statusLabel = 'Rejected';
                statusIcon = Icons.cancel_rounded;
              } else {
                statusColor = Colors.orange;
                statusLabel = 'Pending';
                statusIcon = Icons.hourglass_top_rounded;
              }

              return Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
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
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: statusColor.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  statusLabel,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: statusColor,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "${formatDate(leave.fromDate)}  •  ${formatDate(leave.toDate)}",
                            style: const TextStyle(
                              fontSize: 13,
                              color: Colors.black87,
                            ),
                          ),
                          if (leave.status.toLowerCase() == "rejected" &&
                              leave.rejectionReason.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              "Reason: ${leave.rejectionReason}",
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.red.shade700,
                              ),
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

  /* -------------------------------------------------------
     BUTTON + FIELDS
  ------------------------------------------------------- */

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
}

/* -------------------------------------------------------
   SMALL UI WIDGETS
------------------------------------------------------- */

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

class LeaveBalance {
  final String leaveType;
  final int totalAllowed;
  final int used;
  final int balance;

  LeaveBalance({
    required this.leaveType,
    required this.totalAllowed,
    required this.used,
    required this.balance,
  });

  factory LeaveBalance.fromJson(Map<String, dynamic> json) {
    return LeaveBalance(
      leaveType: json['leaveType'],
      totalAllowed: json['totalAllowed'],
      used: json['used'],
      balance: json['balance'],
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
              border: Border.all(color: const Color(0xFFE1E3E8)),
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
