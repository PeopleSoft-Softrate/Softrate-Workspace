import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';

class HRResignationListPage extends StatefulWidget {
  const HRResignationListPage({super.key});

  @override
  State<HRResignationListPage> createState() => _HRResignationListPageState();
}

class _HRResignationListPageState extends State<HRResignationListPage> {
  List<dynamic> _resignations = [];
  bool _loading = true;
  String _filterStatus = 'all';

  final List<String> _statusFilters = ['all', 'pending', 'approved', 'rejected'];

  @override
  void initState() {
    super.initState();
    _fetchResignations();
  }

  Future<void> _fetchResignations() async {
    setState(() => _loading = true);
    try {
      final res = await http.get(
        Uri.parse('${getBaseUrl()}/api/employee-resignations/?status=$_filterStatus'),
        headers: {'Content-Type': 'application/json'},
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        setState(() {
          _resignations = data['data'] ?? [];
          _loading = false;
        });
      } else {
        setState(() => _loading = false);
      }
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error fetching resignations: $e')),
        );
      }
    }
  }

  Future<void> _updateStatus(String resignationId, String status, {String? rejectionReason}) async {
    try {
      final body = {
        'status': status,
        if (status == 'rejected' && rejectionReason?.trim().isNotEmpty == true)
          'rejectionReason': rejectionReason!.trim(),
      };

      final res = await http.patch(
        Uri.parse('${getBaseUrl()}/api/employee-resignations/$resignationId/status'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      if (res.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Resignation $status successfully'),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 2),
            ),
          );
        }
        _fetchResignations();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error updating status: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Resignation Requests'),
        backgroundColor: const Color(0xFF00657F),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Filter chips below AppBar
          Container(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(right: 16),
              child: Row(
                children: _statusFilters.map((status) {
                  final isSelected = _filterStatus == status;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(status.toUpperCase(),style: TextStyle(color: isSelected ? const Color.fromARGB(255, 255, 255, 255) : const Color.fromARGB(255, 86, 86, 86))),
                      selected: isSelected,
                      onSelected: (_) {
                        setState(() => _filterStatus = status);
                        _fetchResignations();
                      },
                      selectedColor: const Color(0xFF00657F),
                      checkmarkColor: Colors.white,
                      backgroundColor: Colors.grey.shade100,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: BorderSide(
                          color: isSelected ? const Color(0xFF00657F) : Colors.transparent,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _resignations.isEmpty
                    ? _emptyState()
                    : RefreshIndicator(
                        onRefresh: _fetchResignations,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _resignations.length,
                          itemBuilder: (context, index) {
                            return _buildResignationCard(_resignations[index]);
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _emptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.inbox_outlined,
            size: 64,
            color: Colors.grey.shade400,
          ),
          const SizedBox(height: 16),
          Text(
            'No ${_filterStatus == "all" ? "resignations" : _filterStatus.toUpperCase()} found',
            style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _fetchResignations,
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00657F),
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResignationCard(Map<String, dynamic> resignation) {
    final status = resignation['status']?.toString().toLowerCase() ?? 'pending';
    final statusColor = {
      'pending': Colors.orange.shade400,
      'approved': Colors.green.shade400,
      'rejected': Colors.red.shade400,
    }[status] ?? Colors.grey.shade400;

    final fullName = (resignation['fullName'] ?? 'Employee').toString();
    final avatarLetter = fullName.isNotEmpty ? fullName[0].toUpperCase() : 'E';
    final designation = resignation['designation']?.toString().isNotEmpty == true
        ? resignation['designation']
        : 'Employee';
    final formattedApplyDate = _formatDate(resignation['applyDate']);
    final formattedLastDay = _formatDate(resignation['lastWorkingDay']);

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 5,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: Colors.white
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status and date row
              Row(
                children: [
                  _statusChip(status, statusColor),
                  const Spacer(),
                  Text(
                    formattedApplyDate,
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
                  ),
                ],
              ),
              const SizedBox(height: 20),
        
              // Employee info row
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: const Color(0xFF00657F),
                    child: Text(
                      avatarLetter,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullName,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$designation • ${resignation['department'] ?? 'N/A'}',
                          style: TextStyle(
                            fontSize: 15,
                            color: Colors.grey.shade600,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
        
              // Reason
              if (resignation['reason']?.toString().trim().isNotEmpty == true) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Reason for Resignation',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.blue.shade800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        resignation['reason'],
                        style: TextStyle(
                          fontSize: 15,
                          color: Colors.grey.shade800,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
        
              // Additional comments
              if (resignation['additionalComments']?.toString().trim().isNotEmpty == true) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Additional Comments',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        resignation['additionalComments'],
                        style: TextStyle(
                          fontSize: 15,
                          color: Colors.grey.shade800,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
        
              // Last working day
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color.fromARGB(255, 225, 244, 255),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color.fromARGB(255, 130, 224, 255)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today, color: const Color.fromARGB(255, 0, 157, 255), size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Last Working Day: $formattedLastDay',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: const Color.fromARGB(255, 0, 166, 255),
                      ),
                    ),
                  ],
                ),
              ),
        
              // Action buttons for pending only
              if (status == 'pending') ...[
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _updateStatus(resignation['_id'], 'approved'),
                        icon: const Icon(Icons.check_circle, size: 20),
                        label: const Text('Approve'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green.shade500,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          elevation: 2,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _showRejectDialog(resignation['_id']),
                        icon: const Icon(Icons.cancel_outlined, size: 20),
                        label: const Text('Reject'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          elevation: 2,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: Colors.red.shade400, width: 2),
                          ),
                          foregroundColor: Colors.red.shade600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusChip(String status, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            status == 'pending'
                ? Icons.hourglass_empty_outlined
                : status == 'approved'
                    ? Icons.check_circle_outline
                    : Icons.cancel_outlined,
            size: 18,
            color: color,
          ),
          const SizedBox(width: 8),
          Text(
            status.toUpperCase(),
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: color,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(dynamic date) {
    try {
      final parsedDate = DateTime.parse(date.toString());
      return DateFormat('dd MMM yyyy').format(parsedDate);
    } catch (_) {
      return 'Invalid date';
    }
  }

  void _showRejectDialog(String resignationId) {
    final controller = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.cancel_outlined, color: Colors.red.shade500, size: 28),
            const SizedBox(width: 12),
            const Text('Reject Resignation', style: TextStyle(fontWeight: FontWeight.w600)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Provide a reason for rejection (optional):',
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Enter rejection reason...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF00657F), width: 2),
                ),
                contentPadding: const EdgeInsets.all(16),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              _updateStatus(resignationId, 'rejected', rejectionReason: controller.text);
            },
            icon: const Icon(Icons.cancel, size: 18),
            label: const Text('Reject'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade500,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }
}
