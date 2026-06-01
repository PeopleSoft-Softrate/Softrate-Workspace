import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';

class EmployeeLeaveOverview extends StatefulWidget {
  final String employeeId;
  final String employeeName;

  const EmployeeLeaveOverview({
    super.key,
    required this.employeeId,
    required this.employeeName,
  });

  @override
  State<EmployeeLeaveOverview> createState() => _EmployeeLeaveOverviewState();
}

class _EmployeeLeaveOverviewState extends State<EmployeeLeaveOverview> {
  late Future<List<LeaveRecord>> _leaves;
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _leaves = _fetchLeaves();
  }

  // ✅ FIXED: Better error handling + debug logs
  Future<List<LeaveRecord>> _fetchLeaves() async {
    try {
      debugPrint('🔍 Fetching leaves for employeeId: ${widget.employeeId}');
      final uri = Uri.parse(
        '${getBaseUrl()}/api/employee-leave/employee/${widget.employeeId}',
      );
      debugPrint('📡 API URL: $uri');

      final res = await http.get(uri);
      debugPrint('📊 Response: ${res.statusCode}');
      debugPrint('📋 Response body: ${res.body}');

      if (res.statusCode == 404) {
        debugPrint('❌ No leaves found (404)');
        return [];
      }

      if (res.statusCode != 200) {
        debugPrint('❌ API Error: ${res.statusCode}');
        throw Exception('Failed to load leaves: ${res.statusCode}');
      }

      final data = jsonDecode(res.body);
      if (data is List) {
        final leaves = data.map((e) => LeaveRecord.fromJson(e)).toList();
        debugPrint('✅ Found ${leaves.length} leaves');
        return leaves;
      } else {
        debugPrint('❌ Invalid response format');
        return [];
      }
    } catch (e) {
      debugPrint('💥 Fetch error: $e');
      rethrow;
    }
  }

  // ✅ FIXED: Proper async handling
  Future<void> _updateLeaveStatus({
    required String id,
    required String status,
    String? rejectionReason,
  }) async {
    try {
      final uri = Uri.parse('${getBaseUrl()}/api/employee-leave/$id');
      print(uri);
      final res = await http.put(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'status': status,
          'rejectionReason': rejectionReason ?? '',
        }),
      );

      if (res.statusCode == 200) {
        // ✅ FIXED: Async refresh
        final updatedLeaves = await _fetchLeaves();
        if (mounted) {
          setState(() {
            _leaves = Future.value(updatedLeaves);
          });
        }

        final isAccepted = status.toLowerCase() == 'accepted';
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${status.toUpperCase()} updated successfully'),
              backgroundColor: isAccepted
                  ? const Color(0xFF2E7D32)
                  : const Color(0xFFB00020),
            ),
          );
        }
      } else {
        debugPrint('❌ Update failed: ${res.statusCode}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to update leave status')),
          );
        }
      }
    } catch (e) {
      debugPrint('💥 Update error: $e');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  // Rejection dialog (unchanged)
  void _showRejectionDialog(String leaveId, String leaveType) {
    final TextEditingController reasonController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(
              Icons.cancel_rounded,
              color: Color(0xFFB00020),
              size: 24,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Reject Leave Request',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Please provide a reason for rejecting the "$leaveType" leave request:',
              style: TextStyle(color: Colors.grey.shade700, fontSize: 14),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonController,
              maxLines: 3,
              maxLength: 200,
              decoration: InputDecoration(
                hintText: 'Enter rejection reason (max 200 characters)...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                focusedBorder: const OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(12)),
                  borderSide: BorderSide(color: Color(0xFFB00020), width: 2),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                contentPadding: const EdgeInsets.all(16),
                filled: true,
                fillColor: Colors.grey.shade50,
              ),
              style: const TextStyle(fontSize: 14),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            style: TextButton.styleFrom(foregroundColor: Colors.grey.shade600),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final reason = reasonController.text.trim();
              if (reason.isNotEmpty) {
                Navigator.pop(context);
                _updateLeaveStatus(
                  id: leaveId,
                  status: 'rejected',
                  rejectionReason: reason,
                );
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Please enter a rejection reason'),
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFB00020),
              foregroundColor: Colors.white,
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
            child: const Text(
              'Reject',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'accepted':
        return const Color(0xFF2E7D32);
      case 'rejected':
        return const Color(0xFFB00020);
      default:
        return const Color(0xFFFFA726);
    }
  }

  String _formatDate(DateTime d) {
    return DateFormat('d MMM yyyy').format(d);
  }

  String? _perDaySummary(Map<String, dynamic>? map) {
    if (map == null || map.isEmpty) return null;
    final entries = map.entries.toList()
      ..sort((a, b) => DateTime.parse(a.key).compareTo(DateTime.parse(b.key)));
    final first = entries.first;
    final last = entries.last;
    return '${first.value} on ${_formatDate(DateTime.parse(first.key))} → '
        '${last.value} on ${_formatDate(DateTime.parse(last.key))}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        title: Text(
          "${widget.employeeName}'s Leave Overview",
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 20),
        ),
        foregroundColor: Colors.white,
        toolbarHeight: 72,
        flexibleSpace: Container(color: const Color(0xFF00657F)),
      ),
      body: FutureBuilder<List<LeaveRecord>>(
        future: _leaves,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: Color(0xFF00657F)),
            );
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.error_outline,
                    size: 64,
                    color: Color(0xFFB00020),
                  ),
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      "Failed to load leaves\n${snapshot.error}",
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                  const SizedBox(height: 24),
                  // ✅ FIXED: Proper retry button
                  SizedBox(
                    width: 120,
                    child: ElevatedButton(
                      onPressed: () async {
                        final updatedLeaves = await _fetchLeaves();
                        if (mounted) {
                          setState(() => _leaves = Future.value(updatedLeaves));
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00657F),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Text('Retry'),
                    ),
                  ),
                ],
              ),
            );
          }

          final allLeaves = snapshot.data ?? [];
          final leaves = _statusFilter == 'all'
              ? allLeaves
              : allLeaves
                    .where(
                      (l) =>
                          l.status.toLowerCase() == _statusFilter.toLowerCase(),
                    )
                    .toList();

          if (leaves.isEmpty) {
            return Column(
              children: [
                _buildStatusFilterRow(),
                const Expanded(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.event_busy, size: 64, color: Colors.grey),
                        SizedBox(height: 16),
                        Text(
                          "No leave records found",
                          style: TextStyle(
                            fontSize: 16,
                            color: Color(0xFF757575),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          }

          return Column(
            children: [
              _buildStatusFilterRow(),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: leaves.length,
                  itemBuilder: (context, index) {
                    final leave = leaves[index];
                    final statusColor = _statusColor(leave.status);
                    final isPending = leave.status.toLowerCase() == 'pending';
                    final perDayInfo = _perDaySummary(leave.perDayDurations);

                    return Container(
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 12,
                            offset: const Offset(0, 6),
                          ),
                        ],
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Header row (unchanged)
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Color(0xFFE0F3F7),
                                  ),
                                  child: const Icon(
                                    Icons.event,
                                    size: 18,
                                    color: Color(0xFF00657F),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    leave.leaveType,
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF003648),
                                    ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(20),
                                    color: statusColor.withOpacity(0.12),
                                    border: Border.all(
                                      color: statusColor.withOpacity(0.6),
                                    ),
                                  ),
                                  child: Text(
                                    leave.status,
                                    style: TextStyle(
                                      color: statusColor,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            // Rest of card content (unchanged - same as original)
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                const Icon(
                                  Icons.calendar_month,
                                  size: 16,
                                  color: Color(0xFF607D8B),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  "${_formatDate(leave.fromDate)} → ${_formatDate(leave.toDate)}",
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF212121),
                                  ),
                                ),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE3F2FD),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    "${leave.numberOfDays} days",
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF1565C0),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            if (perDayInfo != null) ...[
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.access_time_rounded,
                                    size: 16,
                                    color: Color(0xFF757575),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      perDayInfo,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF616161),
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 14),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey.shade200),
                              ),
                              child: Text(
                                leave.reason,
                                style: const TextStyle(
                                  fontSize: 13,
                                  height: 1.4,
                                  color: Color(0xFF212121),
                                ),
                              ),
                            ),
                            if (leave.status.toLowerCase() == 'rejected' &&
                                (leave.rejectionReason?.isNotEmpty ??
                                    false)) ...[
                              const SizedBox(height: 10),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFEBEE),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: const Color(0xFFEF9A9A),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.warning_amber_rounded,
                                      size: 16,
                                      color: Color(0xFFB00020),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        leave.rejectionReason!,
                                        style: const TextStyle(
                                          color: Color(0xFFB00020),
                                          fontWeight: FontWeight.w600,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            if (isPending) ...[
                              const SizedBox(height: 20),
                              Row(
                                children: [
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () => _updateLeaveStatus(
                                        id: leave.id,
                                        status: "accepted",
                                      ),
                                      icon: const Icon(
                                        Icons.check_circle,
                                        size: 18,
                                      ),
                                      label: const Text("Approve"),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(
                                          0xFF2E7D32,
                                        ),
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12,
                                        ),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            30,
                                          ),
                                        ),
                                        elevation: 2,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      onPressed: () => _showRejectionDialog(
                                        leave.id,
                                        leave.leaveType,
                                      ),
                                      icon: const Icon(
                                        Icons.cancel_rounded,
                                        size: 18,
                                        color: Color(0xFFB00020),
                                      ),
                                      label: const Text(
                                        "Reject",
                                        style: TextStyle(
                                          color: Color(0xFFB00020),
                                        ),
                                      ),
                                      style: OutlinedButton.styleFrom(
                                        side: const BorderSide(
                                          color: Color(0xFFB00020),
                                        ),
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12,
                                        ),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            30,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  // STATUS FILTER ROW (unchanged)
  Widget _buildStatusFilterRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            const Text(
              'Filters:',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF003648),
              ),
            ),
            const SizedBox(width: 8),
            ChoiceChip(
              label: const Text('All'),
              selected: _statusFilter == 'all',
              selectedColor: const Color(0xFF8ED1DC).withOpacity(0.6),
              backgroundColor: Colors.grey.shade100,
              labelStyle: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _statusFilter == 'all'
                    ? const Color(0xFF003648)
                    : Colors.grey.shade700,
              ),
              onSelected: (_) => setState(() => _statusFilter = 'all'),
            ),
            const SizedBox(width: 6),
            ChoiceChip(
              label: const Text('Accepted'),
              selected: _statusFilter == 'accepted',
              selectedColor: const Color(0xFFE8F5E9),
              backgroundColor: Colors.grey.shade100,
              labelStyle: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _statusFilter == 'accepted'
                    ? const Color(0xFF2E7D32)
                    : Colors.grey.shade700,
              ),
              onSelected: (_) => setState(() => _statusFilter = 'accepted'),
            ),
            const SizedBox(width: 6),
            ChoiceChip(
              label: const Text('Rejected'),
              selected: _statusFilter == 'rejected',
              selectedColor: const Color(0xFFFFEBEE),
              backgroundColor: Colors.grey.shade100,
              labelStyle: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _statusFilter == 'rejected'
                    ? const Color(0xFFB00020)
                    : Colors.grey.shade700,
              ),
              onSelected: (_) => setState(() => _statusFilter = 'rejected'),
            ),
            const SizedBox(width: 6),
            ChoiceChip(
              label: const Text('Pending'),
              selected: _statusFilter == 'pending',
              selectedColor: const Color(0xFFFFF3E0),
              backgroundColor: Colors.grey.shade100,
              labelStyle: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _statusFilter == 'pending'
                    ? const Color(0xFFFFA726)
                    : Colors.grey.shade700,
              ),
              onSelected: (_) => setState(() => _statusFilter = 'pending'),
            ),
          ],
        ),
      ),
    );
  }
}

// ✅ COMPLETE LeaveRecord model
class LeaveRecord {
  final String id;
  final String employeeId;
  final String employeeName;
  final String leaveType;
  final DateTime fromDate;
  final DateTime toDate;
  final int numberOfDays;
  final String reason;
  final String status;
  final String? rejectionReason;
  final Map<String, dynamic>? perDayDurations;

  LeaveRecord({
    required this.id,
    required this.employeeId,
    required this.employeeName,
    required this.leaveType,
    required this.fromDate,
    required this.toDate,
    required this.numberOfDays,
    required this.reason,
    required this.status,
    this.rejectionReason,
    this.perDayDurations,
  });

  factory LeaveRecord.fromJson(Map<String, dynamic> json) {
    try {
      return LeaveRecord(
        id: json['_id']?.toString() ?? '',
        employeeId:
            json['employeeId']?.toString() ??
            json['EmployeeId']?.toString() ??
            '',
        employeeName:
            json['employeeName']?.toString() ??
            json['fullName']?.toString() ??
            '',
        leaveType: json['leaveType']?.toString() ?? '',
        fromDate: DateTime.parse(json['fromDate']?.toString() ?? ''),
        toDate: DateTime.parse(json['toDate']?.toString() ?? ''),
        numberOfDays: json['numberOfDays'] ?? 0,
        reason: json['reason']?.toString() ?? '',
        status: json['status']?.toString() ?? '',
        rejectionReason: json['rejectionReason']?.toString(),
        perDayDurations: json['perDayDurations'],
      );
    } catch (e) {
      debugPrint('❌ LeaveRecord parse error: $e');
      rethrow;
    }
  }
}
