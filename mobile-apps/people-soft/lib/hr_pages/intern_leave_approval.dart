import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';

class InternLeaveApproval extends StatefulWidget {
  const InternLeaveApproval({super.key});

  @override
  State<InternLeaveApproval> createState() => _InternLeaveApprovalState();
}

class _InternLeaveApprovalState extends State<InternLeaveApproval> {
  late Future<List<LeaveRecord>> _futureLeaves;

  @override
  void initState() {
    super.initState();
    _futureLeaves = fetchPendingLeaves();
  }

  // Fetch pending leaves from API
  Future<List<LeaveRecord>> fetchPendingLeaves() async {
    final url = Uri.parse("${getBaseUrl()}/api/leave/pending");
    final response = await http.get(url);

    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((e) => LeaveRecord.fromJson(e)).toList();
    } else {
      throw Exception('Failed to fetch leaves');
    }
  }

  // date formatting (same style as overview)
  String _formatDate(DateTime d) {
    return DateFormat('d MMM yyyy').format(d);
  }

  String _formatIso(String iso) {
    try {
      final d = DateTime.parse(iso);
      return _formatDate(d);
    } catch (_) {
      return iso;
    }
  }

  String? _perDaySummary(Map<String, String> map) {
    if (map.isEmpty) return null;

    final entries = map.entries.toList()
      ..sort((a, b) => DateTime.parse(a.key).compareTo(DateTime.parse(b.key)));

    final first = entries.first;
    final last = entries.last;

    return '${first.value} on ${_formatIso(first.key)} → '
        '${last.value} on ${_formatIso(last.key)}';
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'accepted':
        return const Color(0xFF2E7D32);
      case 'rejected':
        return const Color(0xFFB00020);
      default:
        return const Color(0xFFFFA726); // pending
    }
  }

  // Rejection dialog, same UX as overview
  Future<String?> _askRejectionReason(String leaveType) async {
    final controller = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: const [
            Icon(Icons.cancel_rounded, color: Color(0xFFB00020), size: 24),
            SizedBox(width: 12),
            Expanded(
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
              controller: controller,
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
            onPressed: () => Navigator.pop(context, false),
            style: TextButton.styleFrom(foregroundColor: Colors.grey.shade600),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final reason = controller.text.trim();
              if (reason.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Please enter a rejection reason'),
                    backgroundColor: Color(0xFFB00020),
                  ),
                );
                return;
              }
              Navigator.pop(context, true);
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

    if (ok == true) {
      return controller.text.trim();
    }
    return null;
  }

  // Approve or reject leave (reuse same API contract as before)
  Future<void> _updateLeaveStatus(LeaveRecord leave, String action) async {
    String rejectionReason = '';

    if (action == 'rejected') {
      final reason = await _askRejectionReason(leave.leaveType);
      if (reason == null || reason.isEmpty) return;
      rejectionReason = reason;
    }

    final url = Uri.parse("${getBaseUrl()}/api/leave/${leave.id}");
    final response = await http.put(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "status": action == 'accepted' ? 'accepted' : 'rejected',
        "rejectionReason": rejectionReason,
      }),
    );

    if (response.statusCode == 200) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Leave ${action == 'accepted' ? 'accepted' : 'rejected'}",
          ),
          backgroundColor: action == 'accepted'
              ? const Color(0xFF2E7D32)
              : const Color(0xFFB00020),
        ),
      );
      setState(() {
        _futureLeaves = fetchPendingLeaves();
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Failed to update leave"),
          backgroundColor: Color(0xFFB00020),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        title: const Text(
          "Intern Leave Approval",
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20),
        ),
        foregroundColor: Colors.white,
        toolbarHeight: 72,
        flexibleSpace: Container(color: const Color(0xFF00657F)),
      ),
      body: FutureBuilder<List<LeaveRecord>>(
        future: _futureLeaves,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
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
                  Text("Error: ${snapshot.error}", textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () =>
                        setState(() => _futureLeaves = fetchPendingLeaves()),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00657F),
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          final leaves = snapshot.data ?? [];

          if (leaves.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.event_note_outlined,
                    size: 64,
                    color: Color(0xFFB0BEC5),
                  ),
                  SizedBox(height: 16),
                  Text(
                    "No pending leave requests",
                    style: TextStyle(fontSize: 16, color: Color(0xFF757575)),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: leaves.length,
            itemBuilder: (context, index) {
              final leave = leaves[index];
              final perDayInfo = _perDaySummary(leave.perDayDurations);

              // Always pending here, but keep badge consistent
              final statusColor = _statusColor(leave.status);

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
                      // TOP ROW: Intern + type + status
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
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  leave.internName,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF003648),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  leave.leaveType,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF607D8B),
                                  ),
                                ),
                              ],
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

                      const SizedBox(height: 14),

                      // DATE SECTION
                      Row(
                        children: [
                          const Icon(
                            Icons.calendar_month,
                            size: 16,
                            color: Color(0xFF607D8B),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            "${_formatIso(leave.fromDate)} → ${_formatIso(leave.toDate)}",
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF212121),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),

                      // REASON BOX
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

                      // ACTION BUTTONS (approve / reject)
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () =>
                                  _updateLeaveStatus(leave, 'accepted'),
                              icon: const Icon(Icons.check_circle, size: 18),
                              label: const Text("Approve"),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF2E7D32),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(30),
                                ),
                                elevation: 2,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () =>
                                  _updateLeaveStatus(leave, 'rejected'),
                              icon: const Icon(
                                Icons.cancel_rounded,
                                size: 18,
                                color: Color(0xFFB00020),
                              ),
                              label: const Text(
                                "Reject",
                                style: TextStyle(color: Color(0xFFB00020)),
                              ),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(
                                  color: Color(0xFFB00020),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(30),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

// Leave Record model (unchanged fields, but used DateTime parsing helper)
class LeaveRecord {
  final String id;
  final String internName;
  final String leaveType;
  final String fromDate;
  final String toDate;
  final String reason;
  final String status;
  final String rejectionReason;
  final Map<String, String> perDayDurations;

  LeaveRecord({
    required this.id,
    required this.internName,
    required this.leaveType,
    required this.fromDate,
    required this.toDate,
    required this.reason,
    this.status = 'pending',
    this.rejectionReason = '',
    this.perDayDurations = const {},
  });

  factory LeaveRecord.fromJson(Map<String, dynamic> json) {
    Map<String, String> perDay = {};
    if (json['perDayDurations'] != null) {
      perDay = Map<String, String>.from(json['perDayDurations']);
    }

    return LeaveRecord(
      id: json['_id'] ?? '',
      internName: json['internName'] ?? '',
      leaveType: json['leaveType'] ?? '',
      fromDate: json['fromDate'] ?? '',
      toDate: json['toDate'] ?? '',
      reason: json['reason'] ?? '',
      status: json['status'] ?? 'pending',
      rejectionReason: json['rejectionReason'] ?? '',
      perDayDurations: perDay,
    );
  }
}
