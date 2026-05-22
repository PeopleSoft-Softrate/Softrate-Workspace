import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:intl/intl.dart';

class EmployeeTerminationPage extends StatefulWidget {
  final String employeeId;
  final String fullName;
  final String department;
  final String designation;

  const EmployeeTerminationPage({
    super.key,
    required this.employeeId,
    required this.fullName,
    required this.department,
    required this.designation,
  });

  @override
  State<EmployeeTerminationPage> createState() => _EmployeeTerminationPageState();
}

class _EmployeeTerminationPageState extends State<EmployeeTerminationPage> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  // Form controllers
  final _terminationDateController = TextEditingController();
  final _lastWorkingDayController = TextEditingController();
  final _otherReasonController = TextEditingController();
  final _showCauseNoticeController = TextEditingController();
  final _performanceLogsController = TextEditingController();

  // Form state
  String _selectedReason = 'Termination During Probation';
  bool _showCauseNotice = false;
  bool _hasPerformanceLogs = false;
  DateTime _terminationDate = DateTime.now();
  DateTime _lastWorkingDay = DateTime.now();

  // Reason options
  final List<String> _reasons = [
    'Termination During Probation',
    'Termination Due to Performance Issues',
    'Termination Due to Attendance / Absenteeism',
    'Termination Due to Misconduct',
    'Termination Due to Policy Violation',
    'Role Redundancy / Business Decision',
    'Violation of Confidentiality / NDA',
    'Fraud / Integrity Concern',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    // Auto-set current date
    final now = DateTime.now();
    _terminationDate = now;
    _lastWorkingDay = now;
    _terminationDateController.text = DateFormat('dd MMM yyyy').format(now);
    _lastWorkingDayController.text = DateFormat('dd MMM yyyy').format(now);
  }

  Future<void> _selectDate(BuildContext context, bool isTerminationDate) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: isTerminationDate ? _terminationDate : _lastWorkingDay,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF00657F),
              onPrimary: Colors.white,
              onSurface: Color(0xFF1A1A1A),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        if (isTerminationDate) {
          _terminationDate = picked;
          _terminationDateController.text = DateFormat('dd MMM yyyy').format(picked);
        } else {
          _lastWorkingDay = picked;
          _lastWorkingDayController.text = DateFormat('dd MMM yyyy').format(picked);
        }
      });
    }
  }

  Future<void> _submitTermination() async {
    if (!_formKey.currentState!.validate()) return;

    final confirm = await _showConfirmationDialog();
    if (!confirm) return;

    setState(() => _isLoading = true);

    try {
      final formData = {
        'employeeId': widget.employeeId,
        'employeeName': widget.fullName,
        'department': widget.department,
        'designation': widget.designation,
        'terminationDate': _terminationDate.toIso8601String(),
        'lastWorkingDay': _lastWorkingDay.toIso8601String(),
        'reason': _selectedReason,
        'otherReason': _otherReasonController.text.trim(),
        'showCauseNotice': _showCauseNotice,
        'showCauseNoticeDoc': _showCauseNoticeController.text.trim(),
        'performanceLogs': _hasPerformanceLogs ? _performanceLogsController.text.trim() : '',
        'status': 'terminated', // Direct termination by HR - no pending
        'terminatedAt': DateTime.now().toIso8601String(),
        'terminatedBy': 'HR', // Can be enhanced with actual HR user
      };

      final response = await http.post(
        Uri.parse('${getBaseUrl()}/api/employee-terminations'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(formData),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Employee terminated successfully'),
              backgroundColor: Color(0xFF2E7D32),
              duration: Duration(seconds: 3),
            ),
          );
          Navigator.pop(context);
        }
      } else {
        throw Exception('Failed to terminate employee');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: const Color(0xFFB00020)),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<bool> _showConfirmationDialog() async {
    return await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.work_off_rounded, color: Colors.red.shade500, size: 28),
            const SizedBox(width: 12),
            const Text(
              'Confirm Termination',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This action will immediately terminate:',
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text('ID: ${widget.employeeId}', style: TextStyle(color: Colors.grey.shade600)),
                  Text('${widget.designation} - ${widget.department}'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Reason: $_selectedReason',
              style: TextStyle(fontWeight: FontWeight.w500, color: Colors.red.shade700),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.check, color: Colors.white),
            label: const Text('Terminate', style: TextStyle(fontWeight: FontWeight.w600)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade500,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    ) ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F1ED),
      appBar: AppBar(
        elevation: 0,
        title: const Text(
          'Terminate Employee',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20),
        ),
        foregroundColor: Colors.white,
        backgroundColor: const Color(0xFFB00020),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Employee Info Header
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 35,
                        backgroundColor: const Color(0xFFB00020).withOpacity(0.1),
                        child: Text(
                          widget.fullName.isNotEmpty ? widget.fullName[0].toUpperCase() : 'E',
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFB00020),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        widget.fullName,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.red.shade100,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.red.shade300),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.work_off, size: 16, color: Color(0xFFB00020)),
                                SizedBox(width: 6),
                                Text(
                                  'TO TERMINATE',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                    color: Color(0xFFB00020),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text('ID: ${widget.employeeId}', 
                           style: TextStyle(fontSize: 16, color: Colors.grey.shade600)),
                      Text('${widget.department} • ${widget.designation}', 
                           style: TextStyle(fontSize: 16, color: Colors.grey.shade600)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // Termination Details Section
              _SectionContainer(
                title: 'Termination Details',
                accentColor: const Color(0xFFB00020),
                children: [
                  _DateField(
                    label: 'Termination Date *',
                    controller: _terminationDateController,
                    onTap: () => _selectDate(context, true),
                    validator: (value) => value?.isEmpty == true ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  _DateField(
                    label: 'Last Working Day (LWD) *',
                    controller: _lastWorkingDayController,
                    onTap: () => _selectDate(context, false),
                    validator: (value) => value?.isEmpty == true ? 'Required' : null,
                  ),
                  const SizedBox(height: 20),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedReason,
                    decoration: InputDecoration(
                      labelText: 'Reason for Termination *',
                      labelStyle: const TextStyle(color: Color(0xFF00657F)),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      errorStyle: const TextStyle(color: Color(0xFFB00020)),
                    ),
                    items: _reasons.map((String reason) {
                      return DropdownMenuItem<String>(
                        value: reason,
                        child: Text(reason, style: const TextStyle(fontSize: 14)),
                      );
                    }).toList(),
                    onChanged: (value) => setState(() => _selectedReason = value!),
                  ),
                  if (_selectedReason == 'Other') ...[
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _otherReasonController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Other Reason *',
                        hintText: 'Please specify the reason...',
                        border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
                        contentPadding: EdgeInsets.all(16),
                      ),
                      validator: (value) => _selectedReason == 'Other' && (value?.isEmpty ?? true)
                          ? 'Please specify other reason'
                          : null,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 24),

              // Documents Section
              _SectionContainer(
                title: 'Documents & Compliance',
                accentColor: const Color(0xFF00657F),
                children: [
                  _CheckboxWithUpload(
                    label: 'Show-Cause Notice issued? *',
                    value: _showCauseNotice,
                    onChanged: (value) => setState(() => _showCauseNotice = value),
                    controller: _showCauseNoticeController,
                    isMandatory: true,
                  ),
                  const SizedBox(height: 16),
                  _CheckboxWithUpload(
                    label: 'Performance logs (Optional)',
                    value: _hasPerformanceLogs,
                    onChanged: (value) => setState(() => _hasPerformanceLogs = value),
                    controller: _performanceLogsController,
                    isMandatory: false,
                  ),
                ],
              ),
              const SizedBox(height: 40),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 60,
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : _submitTermination,
                  icon: const Icon(Icons.work_off_rounded, size: 24, color: Colors.white),
                  label: Text(
                    _isLoading ? 'Terminating...' : 'Terminate Employee',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFB00020),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 4,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Update _SectionContainer to accept accentColor
class _SectionContainer extends StatelessWidget {
  final String title;
  final Color accentColor;
  final List<Widget> children;

  const _SectionContainer({
    required this.title,
    required this.accentColor,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 5,
                height: 24,
                decoration: BoxDecoration(
                  color: accentColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 16),
              Text(
                title,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 24),
          ...children,
        ],
      ),
    );
  }
}

// Keep other helper classes (_DateField, _CheckboxWithUploadState) same as before

class _DateField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final VoidCallback onTap;
  final String? Function(String?)? validator;

  const _DateField({
    required this.label,
    required this.controller,
    required this.onTap,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      readOnly: true,
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.calendar_today, color: Color(0xFF00657F)),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.all(16),
      ),
      onTap: onTap,
      validator: validator,
    );
  }
}

class _CheckboxWithUpload extends StatefulWidget {
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  final TextEditingController controller;
  final bool isMandatory;

  const _CheckboxWithUpload({
    required this.label,
    required this.value,
    required this.onChanged,
    required this.controller,
    required this.isMandatory,
  });

  @override
  State<_CheckboxWithUpload> createState() => _CheckboxWithUploadState();
}

class _CheckboxWithUploadState extends State<_CheckboxWithUpload> {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Checkbox(
              value: widget.value,
              onChanged: (bool? value) {
                if (value != null) {
                  widget.onChanged(value);
                }
              },
              activeColor: const Color(0xFFB00020),
              checkColor: Colors.white,
            ),
            Expanded(child: Text(widget.label)),
            if (widget.isMandatory)
              Text('Required', style: TextStyle(color: Colors.red.shade400, fontSize: 12)),
          ],
        ),
        if (widget.value) ...[
          const SizedBox(height: 12),
          TextFormField(
            controller: widget.controller,
            decoration: InputDecoration(
              labelText: 'Upload document/file name or URL',
              hintText: 'e.g., show-cause-notice.pdf or Google Drive link',
              prefixIcon: const Icon(Icons.attach_file, color: Color(0xFF00657F)),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.all(16),
            ),
            validator: widget.isMandatory
                ? (value) => (value?.trim().isEmpty ?? true) ? 'Document required' : null
                : null,
          ),
        ],
      ],
    );
  }
}
