import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum FundApprovalRole { manager, hr }

class FundRequestApprovalPage extends StatefulWidget {
  final FundApprovalRole role;

  const FundRequestApprovalPage({super.key, required this.role});

  @override
  State<FundRequestApprovalPage> createState() =>
      _FundRequestApprovalPageState();
}

class _FundRequestApprovalPageState extends State<FundRequestApprovalPage> {
  static const Color primary = Color(0xFF00657F);
  static const Color bg = Color(0xFFF1F5F9);
  static const Color muted = Color(0xFF64748B);

  bool _isLoading = true;
  String? _managerId;
  List<dynamic> _requests = [];

  bool get _isManager => widget.role == FundApprovalRole.manager;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _isLoading = true);
    try {
      if (_isManager) {
        final prefs = await SharedPreferences.getInstance();
        _managerId = prefs.getString('manager_mongo_id');
        if (_managerId == null || _managerId!.isEmpty) {
          if (mounted) setState(() => _requests = []);
          return;
        }
      }

      final path =
          _isManager
              ? '/api/fund-requests/manager-all/$_managerId'
              : '/api/fund-requests/hr-all';
      final response = await http.get(Uri.parse('${getBaseUrl()}$path'));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (mounted) setState(() => _requests = data is List ? data : []);
      }
    } catch (e) {
      debugPrint('Fund approval load error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> _filtered(bool pendingOnly) {
    return _requests.where((request) {
      final status =
          _isManager ? request['managerStatus'] : request['hrStatus'];
      if (pendingOnly) {
        if (_isManager) return status == 'pending';
        return request['managerStatus'] == 'accepted' && status == 'pending';
      }
      return status != 'pending';
    }).toList();
  }

  Future<String?> _askRemarks(String action) async {
    final controller = TextEditingController();
    final isReject = action == 'rejected';

    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            title: Text(
              isReject ? 'Reject fund request' : 'Approve fund request',
            ),
            content: TextField(
              controller: controller,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: isReject ? 'Reason is required' : 'Optional remarks',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () {
                  if (isReject && controller.text.trim().isEmpty) return;
                  Navigator.pop(context, true);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: isReject ? Colors.red.shade700 : primary,
                  foregroundColor: Colors.white,
                ),
                child: Text(isReject ? 'Reject' : 'Approve'),
              ),
            ],
          ),
    );

    if (confirmed != true) return null;
    return controller.text.trim();
  }

  Future<void> _review(dynamic request, String status) async {
    final remarks = await _askRemarks(status);
    if (remarks == null) return;

    final endpoint =
        _isManager
            ? '/api/fund-requests/manager-action/${request['_id']}'
            : '/api/fund-requests/hr-action/${request['_id']}';

    try {
      final response = await http.put(
        Uri.parse('${getBaseUrl()}$endpoint'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'status': status, 'remarks': remarks}),
      );

      final success = response.statusCode == 200;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'Fund request ${status == 'accepted' ? 'approved' : 'rejected'}'
                : 'Unable to update request',
          ),
          backgroundColor:
              success ? Colors.green.shade700 : Colors.red.shade700,
        ),
      );
      if (success) _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Unable to update request: $e'),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  String _money(dynamic value) {
    final amount = num.tryParse((value ?? 0).toString()) ?? 0;
    return NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    ).format(amount);
  }

  String _date(dynamic value) {
    if (value == null) return '-';
    try {
      return DateFormat(
        'd MMM yyyy',
      ).format(DateTime.parse(value.toString()).toLocal());
    } catch (_) {
      return value.toString();
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'accepted':
      case 'approved':
        return Colors.green.shade700;
      case 'rejected':
        return Colors.red.shade700;
      default:
        return Colors.orange.shade700;
    }
  }

  Widget _chip(String label, String status) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$label: ${status.toUpperCase()}',
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 10,
        ),
      ),
    );
  }

  Widget _requestCard(dynamic request, bool isPending) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
                  color: primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    (request['requesterName'] ?? 'U')
                        .toString()
                        .substring(0, 1)
                        .toUpperCase(),
                    style: const TextStyle(
                      color: primary,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request['requesterName'] ?? 'Unknown',
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      '${(request['requesterType'] ?? 'staff').toString().toUpperCase()} | ${request['requesterId'] ?? '-'}',
                      style: const TextStyle(
                        color: muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                _money(request['amount']),
                style: const TextStyle(
                  color: primary,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            request['category'] ?? 'Fund Request',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Spent on ${_date(request['expenseDate'])}',
            style: const TextStyle(color: muted, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Text(
            request['description'] ?? '',
            style: const TextStyle(color: Color(0xFF334155), height: 1.45),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip('Manager', request['managerStatus'] ?? 'pending'),
              _chip('HR', request['hrStatus'] ?? 'pending'),
              _chip(
                'Finance',
                request['isFinanceTeamApprove'] == true
                    ? 'accepted'
                    : 'pending',
              ),
            ],
          ),
          if (isPending) ...[
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _review(request, 'rejected'),
                    icon: const Icon(Icons.close_rounded),
                    label: const Text('Reject'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red.shade700,
                      side: BorderSide(color: Colors.red.shade200),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _review(request, 'accepted'),
                    icon: const Icon(Icons.check_rounded),
                    label: const Text('Approve'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _list(bool pendingOnly) {
    final data = _filtered(pendingOnly);
    if (data.isEmpty) {
      return Center(
        child: Text(
          pendingOnly ? 'No pending fund requests' : 'No request history',
          style: const TextStyle(color: muted, fontWeight: FontWeight.w700),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: primary,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
        itemCount: data.length,
        itemBuilder: (context, index) => _requestCard(data[index], pendingOnly),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = _isManager ? 'Fund Approvals' : 'HR Fund Approval';
    final subtitle =
        _isManager
            ? 'Manager review before HR'
            : 'Manager-approved reimbursement requests';

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: bg,
        appBar: AppBar(
          elevation: 0,
          backgroundColor: primary,
          foregroundColor: Colors.white,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          bottom: const TabBar(
            indicatorColor: Colors.white,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            tabs: [Tab(text: 'Pending'), Tab(text: 'History')],
          ),
        ),
        body:
            _isLoading
                ? const Center(child: CircularProgressIndicator(color: primary))
                : TabBarView(children: [_list(true), _list(false)]),
      ),
    );
  }
}
