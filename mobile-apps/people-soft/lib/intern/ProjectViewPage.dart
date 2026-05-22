import 'package:flutter/material.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'dart:convert';
import 'package:hrmappfrontend/port.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

class UserProjectPage extends StatefulWidget {
  final String userId;
  final String userName;
  final bool isManager;

  const UserProjectPage({
    super.key, 
    required this.userId, 
    required this.userName,
    this.isManager = false,
  });

  @override
  State<UserProjectPage> createState() => _UserProjectPageState();
}

class _UserProjectPageState extends State<UserProjectPage> {
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  List<dynamic> _projects = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchProjects();
  }

  Future<void> _fetchProjects() async {
    try {
      final endpoint = widget.isManager 
          ? "/api/projects/manager/${widget.userId}"
          : "/api/projects/member/${widget.userId}";
          
      final response = await http.get(Uri.parse("${getBaseUrl()}$endpoint"));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _projects = data['projects'];
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint("Fetch projects error: $e");
      setState(() => _isLoading = false);
    }
  }

  void _showChecklist(Map<String, dynamic> project) {
    List<dynamic> checklist = List.from(project['checklist'] ?? []);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          padding: const EdgeInsets.all(24),
          height: MediaQuery.of(context).size.height * 0.6,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(project['title'], style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor)),
              const SizedBox(height: 8),
              const Text("My Tasks", style: TextStyle(color: subtitleColor, fontSize: 12)),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.builder(
                  itemCount: checklist.length,
                  itemBuilder: (context, index) {
                    final item = checklist[index];
                    return CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(item['task'], style: TextStyle(
                        fontSize: 14,
                        decoration: item['isCompleted'] ? TextDecoration.lineThrough : null,
                        color: item['isCompleted'] ? Colors.grey : Colors.black87,
                      )),
                      value: item['isCompleted'],
                      activeColor: primaryColor,
                      onChanged: (val) async {
                        final response = await http.put(
                          Uri.parse("${getBaseUrl()}/api/projects/toggle-task/${project['_id']}/${item['_id']}"),
                          headers: {"Content-Type": "application/json"},
                          body: jsonEncode({"userId": widget.userId}),
                        );
                        if (response.statusCode == 200) {
                          setSheetState(() {
                            item['isCompleted'] = val;
                          });
                          _fetchProjects(); // Refresh the main page progress bar
                        }
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        title: const Text("My Projects", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: surfaceColor,
        elevation: 0,
        foregroundColor: primaryColor,
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : _projects.isEmpty
          ? const Center(child: Text("No projects assigned to you yet"))
          : ListView.builder(
              padding: const EdgeInsets.all(20),
              itemCount: _projects.length,
              itemBuilder: (context, index) {
                final project = _projects[index];
                final int progress = project['progress']?.toInt() ?? 0;
                return GestureDetector(
                  onTap: () => _showChecklist(project),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: surfaceColor,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(project['title'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: primaryColor)),
                            _statusChip(project['status'] ?? "In Progress"),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.calendar_today, size: 14, color: subtitleColor),
                            const SizedBox(width: 8),
                            Text(
                              "Deadline: ${project['deadline'] != null ? DateFormat('MMM d, yyyy').format(DateTime.parse(project['deadline'])) : 'Not set'}",
                              style: const TextStyle(fontSize: 12, color: subtitleColor),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        const Text("Progress", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: LinearProgressIndicator(
                                value: progress / 100,
                                backgroundColor: backgroundColor,
                                valueColor: const AlwaysStoppedAnimation<Color>(primaryColor),
                                minHeight: 6,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text("$progress%", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: primaryColor)),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }

  Widget _statusChip(String status) {
    Color color = status == "Completed" ? Colors.teal : Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
      child: Text(status.toUpperCase(), style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold)),
    );
  }
}
