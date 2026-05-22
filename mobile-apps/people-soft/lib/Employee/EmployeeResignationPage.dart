import 'package:dropdown_button2/dropdown_button2.dart';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/port.dart';
import 'package:intl/intl.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'dart:convert';

class EmployeeResignationPage extends StatefulWidget {
  final String employeeId;
  final String fullName;
  final String department;
  final String designation;

  const EmployeeResignationPage({
    super.key,
    required this.employeeId,
    required this.fullName,
    required this.department,
    required this.designation,
  });

  @override
  State<EmployeeResignationPage> createState() => _EmployeeResignationPageState();
}

class _EmployeeResignationPageState extends State<EmployeeResignationPage> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _applyDateController = TextEditingController();
  final TextEditingController _lastWorkingDayController = TextEditingController();
  final TextEditingController _noticePeriodController = TextEditingController(text: '2 months');
  final TextEditingController _additionalCommentsController = TextEditingController();

  String? _selectedReason;
  bool _declarationChecked = false;
  bool _submitting = false;

  final List<String> _reasons = const [
    'Internal Compensation Inequity',
    'External Compensation Inequity',
    'Nature of Work',
    'Role Stagnation',
    'Underutilization of Skills',
    'Limited Career Growth',
    'Lack of Recognition',
    'Performance Assessment Issues',
    'People Manager-related',
    'Work-Life Balance',
    'Work/Shift Timing',
    'Work Environment/Culture',
    'Higher Education',
    'Family Reasons',
    'Relocation',
    'Business Strategies',
    'Entrepreneurial Venture',
    'Others',
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final lastWorking = DateTime(now.year, now.month + 2, now.day);
    _applyDateController.text = DateFormat('dd MMM yyyy').format(now);
    _lastWorkingDayController.text = DateFormat('dd MMM yyyy').format(lastWorking);
  }

  @override
  void dispose() {
    _applyDateController.dispose();
    _lastWorkingDayController.dispose();
    _noticePeriodController.dispose();
    _additionalCommentsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_declarationChecked) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please accept the declaration'), behavior: SnackBarBehavior.floating),
        );
      }
      return;
    }

    setState(() => _submitting = true);

    try {
      final body = {
        "employeeId": widget.employeeId,
        "fullName": widget.fullName,
        "department": widget.department,
        "designation": widget.designation,
        "applyDate": DateTime.now().toIso8601String(),
        "noticePeriodMonths": 2,
        "lastWorkingDay": DateTime.now().add(const Duration(days: 60)).toIso8601String(),
        "reason": _selectedReason,
        "additionalComments": _additionalCommentsController.text.trim(),
      };

      final res = await http.post(
        Uri.parse('${getBaseUrl()}/api/employee-resignations/'),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(body),
      );

      if (res.statusCode == 201) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Resignation submitted successfully'),
              backgroundColor: Colors.green,
              behavior: SnackBarBehavior.floating,
            ),
          );
          Navigator.pop(context);
        }
      } else if (res.statusCode == 409) {
        final msg = jsonDecode(res.body)['message'] ?? 'You already have a resignation in process';
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(msg), backgroundColor: Colors.orange, behavior: SnackBarBehavior.floating),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to submit (${res.statusCode})'), backgroundColor: Colors.red, behavior: SnackBarBehavior.floating),
          );
        }
      }
    } catch (e) {
      print('❌ Resignation Error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Network error. Please try again.'), backgroundColor: Colors.red, behavior: SnackBarBehavior.floating),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF00657F), brightness: MediaQuery.of(context).platformBrightness),
        inputDecorationTheme: InputDecorationTheme(
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), gapPadding: 4),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
            gapPadding: 4,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF00657F), width: 2),
            gapPadding: 4,
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          isDense: true,
        ),
      ),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Submit Resignation', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18)),
          centerTitle: true,
          elevation: 0,
          backgroundColor: const Color(0xFF00657F),
          foregroundColor: Colors.white,
        ),
        backgroundColor: Colors.grey.shade50,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Employee Info Card with Avatar
                  Card(
                    elevation: 2,
                    color: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          // Professional Avatar with Initial
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(0xFF00657F),
                              boxShadow: [
                                BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8, offset: const Offset(0, 2)),
                              ],
                            ),
                            child: Center(
                              child: Text(
                                widget.fullName.isNotEmpty ? widget.fullName[0].toUpperCase() : 'E',
                                style: const TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  letterSpacing: 1,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          _buildInfoField('Full Name', widget.fullName),
                          _buildInfoField('Employee ID', widget.employeeId),
                          _buildInfoField('Department', widget.department),
                          _buildInfoField('Designation', widget.designation),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Date Info Card
                  Card(
                    elevation: 2,
                    color: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          _buildInfoField('Apply Date', _applyDateController.text),
                          _buildInfoField('Notice Period', _noticePeriodController.text),
                          _buildInfoField('Last Working Day', _lastWorkingDayController.text),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Reason Selection
                  Text(
                    'Reason for Leaving',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600, color: Colors.grey.shade800),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    elevation: 2,
                    color: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: DropdownButtonFormField2<String>(
                        isExpanded: true, // <-- Prevent overflow
                        decoration: InputDecoration(
                          labelText: 'Select reason',
                          prefixIcon: Icon(Icons.quiz_outlined, color: Colors.grey.shade500),
                          labelStyle: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                        ),
                        value: _selectedReason,
                        items: _reasons
                            .map((r) => DropdownMenuItem(
                                  value: r,
                                  child: Text(r, overflow: TextOverflow.ellipsis), // Optional
                                ))
                            .toList(),
                        onChanged: (val) => setState(() => _selectedReason = val),
                        validator: (val) =>
                            val == null || val.isEmpty ? 'Please select reason' : null,
                        dropdownStyleData: DropdownStyleData(
                          width: MediaQuery.of(context).size.width * 0.85,
                          maxHeight: 300,
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
                  ),
                  const SizedBox(height: 20),

                  // Additional Comments
                  Text(
                    'Additional Comments (Optional)',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600, color: Colors.grey.shade800),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    elevation: 2,
                    color: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: TextFormField(
                      controller: _additionalCommentsController,
                      maxLines: 4,
                      decoration: InputDecoration(
                        labelText: 'Share your thoughts...',
                        prefixIcon: Icon(Icons.comment_outlined, color: Colors.grey.shade500),
                        alignLabelWithHint: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Declaration
                  Card(
                    color: Colors.grey.shade50,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Checkbox(
                            value: _declarationChecked,
                            onChanged: (val) => setState(() => _declarationChecked = val ?? false),
                            activeColor: const Color(0xFF00657F),
                            checkColor: Colors.white,
                          ),
                          Expanded(
                            child: Text(
                              'I hereby declare that this resignation is being submitted voluntarily by myself.',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Submit Button
                  SizedBox(
                    height: 56,
                    child: ElevatedButton.icon(
                      onPressed: _submitting ? null : _submit,
                      icon: _submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                            )
                          : const Icon(Icons.send, size: 20),
                      label: Text(_submitting ? 'Submitting...' : 'Submit Resignation'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00657F),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 2,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoField(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.grey.shade600)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.grey.shade900)),
          ),
        ],
      ),
    );
  }
}
