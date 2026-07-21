import 'package:flutter/material.dart';

class EmployeeProgress extends StatelessWidget {
  final String employeeId;
  final String employeeName;

  const EmployeeProgress({super.key, required this.employeeId, required this.employeeName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Employee Progress')),
      body: const Center(child: Text('Coming Soon')),
    );
  }
}

