import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hrmappfrontend/auth_client.dart' as http;
import 'package:hrmappfrontend/port.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import 'package:dropdown_button2/dropdown_button2.dart';

class ManagerProjectsPage extends StatefulWidget {
  const ManagerProjectsPage({super.key});

  @override
  State<ManagerProjectsPage> createState() => _ManagerProjectsPageState();
}

class _ManagerProjectsPageState extends State<ManagerProjectsPage> {
  static const Color primaryColor = Color(0xFF00657F);
  static const Color backgroundColor = Color(0xFFF1F5F9);
  static const Color surfaceColor = Colors.white;
  static const Color borderColor = Color(0xFFE2E8F0);
  static const Color subtitleColor = Color(0xFF64748B);

  List<dynamic> _projects = [];
  List<dynamic> _teamMembers = [];
  bool _isLoading = true;
  String? _managerId;

  @override
  void initState() {
    super.initState();
    _initializeData();
  }

  Future<void> _initializeData() async {
    final prefs = await SharedPreferences.getInstance();
    _managerId = prefs.getString('manager_mongo_id'); // Fixed key: was employeeMongoId
    if (_managerId != null) {
      await Future.wait([
        _fetchProjects(),
        _fetchTeamMembers(),
      ]);
    }
    setState(() => _isLoading = false);
  }

  Future<void> _fetchProjects() async {
    try {
      final response = await http.get(Uri.parse("${getBaseUrl()}/api/projects/manager/$_managerId"));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _projects = data['projects'] ?? [];
        });
      }
    } catch (e) {
      debugPrint("Fetch projects error: $e");
    }
  }

  Future<void> _fetchTeamMembers() async {
    try {
      final response = await http.get(Uri.parse("${getBaseUrl()}/api/assignments/team/$_managerId"));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _teamMembers = [
            ...(data['interns'] as List).map((i) => {...i, 'type': 'intern'}),
            ...(data['employees'] as List).map((e) => {...e, 'type': 'employee'}),
          ];
        });
      }
    } catch (e) {
      debugPrint("Fetch team error: $e");
    }
  }

  Future<void> _deleteProject(String projectId) async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Delete Project?"),
        content: const Text("This action cannot be undone. All project data will be lost."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("Cancel")),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text("Delete", style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm == true) {
      try {
        final response = await http.delete(Uri.parse("${getBaseUrl()}/api/projects/$projectId"));
        if (response.statusCode == 200) {
          _fetchProjects();
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Project deleted successfully")));
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Delete error: $e")));
      }
    }
  }

  void _showProjectTeamDialog(String projectTitle, List<Map<String, String>> team) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.5,
        decoration: const BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: surfaceColor,
                borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(child: Text(projectTitle, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: primaryColor), overflow: TextOverflow.ellipsis)),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              child: Row(
                children: [
                  const Icon(Icons.group_rounded, size: 16, color: subtitleColor),
                  const SizedBox(width: 8),
                  Text("Project Team (${team.length})", style: const TextStyle(fontSize: 11, color: subtitleColor, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: team.length,
                itemBuilder: (context, index) {
                  final member = team[index];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: primaryColor.withOpacity(0.1),
                          child: Text(member["fullName"] != null && member["fullName"]!.isNotEmpty ? member["fullName"]![0] : "?", style: const TextStyle(color: primaryColor, fontSize: 13, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(member["fullName"] ?? "Unknown", style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: primaryColor)),
                              Text((member["memberType"] ?? "Member").toString().toUpperCase(), style: const TextStyle(fontSize: 10, color: subtitleColor, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: Colors.blue.withOpacity(0.05), borderRadius: BorderRadius.circular(6)),
                          child: const Text("ASSIGNED", style: TextStyle(color: Colors.blue, fontSize: 9, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showProjectChecklistDialog(Map<String, dynamic> project) {
    List<dynamic> checklist = List.from(project['checklist'] ?? []);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => Container(
          height: MediaQuery.of(context).size.height * 0.7,
          decoration: const BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: surfaceColor,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text(project['title'], style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: primaryColor), overflow: TextOverflow.ellipsis)),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: checklist.length,
                  itemBuilder: (context, index) {
                    final item = checklist[index];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(16)),
                      child: CheckboxListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        title: Text(item['task'], style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, decoration: item['isCompleted'] ? TextDecoration.lineThrough : null, color: item['isCompleted'] ? subtitleColor : primaryColor)),
                        value: item['isCompleted'],
                        activeColor: primaryColor,
                        onChanged: (val) async {
                          final response = await http.put(
                            Uri.parse("${getBaseUrl()}/api/projects/toggle-task/${project['_id']}/${item['_id']}"),
                            headers: {"Content-Type": "application/json"},
                            body: jsonEncode({"userId": _managerId}),
                          );
                          if (response.statusCode == 200) {
                            setDialogState(() {
                              item['isCompleted'] = val;
                            });
                            _fetchProjects();
                          }
                        },
                      ),
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

  void _showCreateProjectDialog() {
    final titleController = TextEditingController();
    final clientController = TextEditingController();
    final taskController = TextEditingController();
    final deadlineController = TextEditingController();
    DateTime selectedDeadline = DateTime.now();
    deadlineController.text = DateFormat('MMM d, yyyy').format(selectedDeadline);
    List<String> checklistTasks = [];
    List<Map<String, dynamic>> selectedTeam = [];
    bool isCreating = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => Container(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          height: MediaQuery.of(context).size.height * 0.85,
          decoration: const BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: surfaceColor,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text("Create New Project", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor)),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle("PROJECT DETAILS"),
                      _buildInputCard([
                        _buildTextField(titleController, "Project Title", Icons.title),
                        _buildTextField(clientController, "Client Name", Icons.person_outline),
                        GestureDetector(
                          onTap: () async {
                            final date = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now(),
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                            );
                            if (date != null) {
                              setDialogState(() {
                                selectedDeadline = date;
                                deadlineController.text = DateFormat('MMM d, yyyy').format(date);
                              });
                            }
                          },
                          child: AbsorbPointer(
                            child: _buildTextField(deadlineController, "Target Deadline", Icons.calendar_today),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 24),
                      _sectionTitle("TEAM SELECTION"),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(20)),
                        child: Column(
                          children: _teamMembers.isEmpty 
                            ? [const Padding(padding: EdgeInsets.all(16), child: Text("No team members found", style: TextStyle(color: subtitleColor)))]
                            : _teamMembers.map((member) {
                                bool isSelected = selectedTeam.any((m) => m['memberId'] == member['_id']);
                                return CheckboxListTile(
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                                  title: Text(member['fullName'], style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                                  subtitle: Text(member['type'].toString().toUpperCase(), style: const TextStyle(fontSize: 10, color: subtitleColor)),
                                  value: isSelected,
                                  activeColor: primaryColor,
                                  onChanged: (val) {
                                    setDialogState(() {
                                      if (val == true) {
                                        selectedTeam.add({"memberId": member['_id'], "memberType": member['type'], "fullName": member['fullName']});
                                      } else {
                                        selectedTeam.removeWhere((m) => m['memberId'] == member['_id']);
                                      }
                                    });
                                  },
                                );
                              }).toList(),
                        ),
                      ),
                      const SizedBox(height: 24),
                      _sectionTitle("INITIAL CHECKLIST"),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(20)),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Expanded(child: _buildTextField(taskController, "Add a task...", Icons.add_task)),
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: const Icon(Icons.add_circle, color: primaryColor, size: 32),
                                  onPressed: () {
                                    if (taskController.text.isNotEmpty) {
                                      setDialogState(() {
                                        checklistTasks.add(taskController.text);
                                        taskController.clear();
                                      });
                                    }
                                  },
                                )
                              ],
                            ),
                            if (checklistTasks.isNotEmpty) ...[
                              const Divider(height: 32),
                              ...checklistTasks.asMap().entries.map((entry) => ListTile(
                                dense: true,
                                title: Text(entry.value, style: const TextStyle(fontSize: 13)),
                                trailing: IconButton(icon: const Icon(Icons.remove_circle_outline, color: Colors.red, size: 20), onPressed: () => setDialogState(() => checklistTasks.removeAt(entry.key))),
                              )),
                            ]
                          ],
                        ),
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: surfaceColor,
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -5))],
                ),
                child: SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: isCreating ? null : () async {
                      if (titleController.text.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Please enter a project title")));
                        return;
                      }
                      if (_managerId == null || _managerId!.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Error: Manager session invalid. Please log out and back in.")));
                        return;
                      }
                      
                      setDialogState(() => isCreating = true);
                      try {
                        final body = {
                          "title": titleController.text,
                          "client": clientController.text,
                          "deadline": selectedDeadline.toIso8601String(),
                          "managerId": _managerId,
                          "teamMembers": selectedTeam,
                          "checklist": checklistTasks.map((t) => {"task": t, "isCompleted": false}).toList()
                        };
                        debugPrint("Launching Project with body: ${jsonEncode(body)}");
                        final response = await http.post(
                          Uri.parse("${getBaseUrl()}/api/projects/create"),
                          headers: {"Content-Type": "application/json"},
                          body: jsonEncode(body),
                        );
                        
                        if (response.statusCode == 201) {
                          _fetchProjects();
                          if (mounted) Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Project launched successfully!"), backgroundColor: Colors.green));
                        } else {
                          final errorData = jsonDecode(response.body);
                          final String errMsg = errorData['message'] ?? errorData['error'] ?? 'Unknown error';
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Failed: $errMsg")));
                        }
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Connection error: $e")));
                      } finally {
                        if (mounted) setDialogState(() => isCreating = false);
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: primaryColor, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    child: isCreating 
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text("Launch Project", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showEditProjectDialog(Map<String, dynamic> project) {
    final titleController = TextEditingController(text: project['title']);
    final clientController = TextEditingController(text: project['client']);
    final taskController = TextEditingController();
    final deadlineController = TextEditingController(text: project['deadline'] != null ? DateFormat('MMM d, yyyy').format(DateTime.parse(project['deadline'])) : '');
    DateTime selectedDeadline = project['deadline'] != null ? DateTime.parse(project['deadline']) : DateTime.now();
    String selectedStatus = project['status'] ?? 'In Progress';
    List<Map<String, dynamic>> selectedTeam = List<Map<String, dynamic>>.from(project['teamMembers'] ?? []);
    List<Map<String, dynamic>> checklist = List<Map<String, dynamic>>.from(project['checklist'] ?? []);
    bool isUpdating = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => Container(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          height: MediaQuery.of(context).size.height * 0.85,
          decoration: const BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: surfaceColor,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text("Edit Project", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor)),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle("PROJECT STATUS"),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: borderColor),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton2<String>(
                            isExpanded: true,
                            hint: const Text('Select Status', style: TextStyle(fontSize: 14, color: subtitleColor)),
                            items: ['In Progress', 'Completed', 'On Hold']
                                .map((String item) => DropdownMenuItem<String>(
                                      value: item,
                                      child: Text(item, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: primaryColor)),
                                    ))
                                .toList(),
                            value: selectedStatus,
                            onChanged: (value) => setDialogState(() => selectedStatus = value!),
                            buttonStyleData: ButtonStyleData(
                              height: 50,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                              ),
                            ),
                            dropdownStyleData: DropdownStyleData(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(20),
                                color: Colors.white,
                                border: Border.all(color: borderColor),
                                boxShadow: const [],
                              ),
                              elevation: 0,
                            ),
                            menuItemStyleData: const MenuItemStyleData(
                              padding: EdgeInsets.symmetric(horizontal: 16),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      _sectionTitle("PROJECT DETAILS"),
                      _buildInputCard([
                        _buildTextField(titleController, "Project Title", Icons.title),
                        _buildTextField(clientController, "Client Name", Icons.person_outline),
                        GestureDetector(
                          onTap: () async {
                            final date = await showDatePicker(
                              context: context,
                              initialDate: selectedDeadline,
                              firstDate: DateTime.now().subtract(const Duration(days: 365)),
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                            );
                            if (date != null) {
                              setDialogState(() {
                                selectedDeadline = date;
                                deadlineController.text = DateFormat('MMM d, yyyy').format(date);
                              });
                            }
                          },
                          child: AbsorbPointer(
                            child: _buildTextField(deadlineController, "Target Deadline", Icons.calendar_today),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 24),
                      _sectionTitle("TEAM SELECTION"),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(20)),
                        child: Column(
                          children: _teamMembers.map((member) {
                            bool isSelected = selectedTeam.any((m) => m['memberId'] == member['_id']);
                            return CheckboxListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                              title: Text(member['fullName'], style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                              subtitle: Text(member['type'].toString().toUpperCase(), style: const TextStyle(fontSize: 10, color: subtitleColor)),
                              value: isSelected,
                              activeColor: primaryColor,
                              onChanged: (val) {
                                setDialogState(() {
                                  if (val == true) {
                                    selectedTeam.add({"memberId": member['_id'], "memberType": member['type'], "fullName": member['fullName']});
                                  } else {
                                    selectedTeam.removeWhere((m) => m['memberId'] == member['_id']);
                                  }
                                });
                              },
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: 24),
                      _sectionTitle("CHECKLIST"),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(20)),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Expanded(child: _buildTextField(taskController, "Add a task...", Icons.add_task)),
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: const Icon(Icons.add_circle, color: primaryColor, size: 32),
                                  onPressed: () {
                                    if (taskController.text.isNotEmpty) {
                                      setDialogState(() {
                                        checklist.add({"task": taskController.text, "isCompleted": false});
                                        taskController.clear();
                                      });
                                    }
                                  },
                                )
                              ],
                            ),
                            if (checklist.isNotEmpty) ...[
                              const Divider(height: 32),
                              ...checklist.asMap().entries.map((entry) => ListTile(
                                dense: true,
                                title: Text(entry.value['task'], style: const TextStyle(fontSize: 13)),
                                trailing: IconButton(icon: const Icon(Icons.remove_circle_outline, color: Colors.red, size: 20), onPressed: () => setDialogState(() => checklist.removeAt(entry.key))),
                              )),
                            ]
                          ],
                        ),
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: surfaceColor,
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -5))],
                ),
                child: SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: isUpdating ? null : () async {
                      setDialogState(() => isUpdating = true);
                      try {
                        final body = {
                          "title": titleController.text,
                          "client": clientController.text,
                          "deadline": selectedDeadline.toIso8601String(),
                          "status": selectedStatus,
                          "teamMembers": selectedTeam,
                          "checklist": checklist,
                        };
                        final response = await http.put(
                          Uri.parse("${getBaseUrl()}/api/projects/update/${project['_id']}"),
                          headers: {"Content-Type": "application/json"},
                          body: jsonEncode(body),
                        );
                        if (response.statusCode == 200) {
                          _fetchProjects();
                          if (mounted) Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Project updated successfully!"), backgroundColor: Colors.green));
                        }
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Update error: $e")));
                      } finally {
                        if (mounted) setDialogState(() => isUpdating = false);
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: primaryColor, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    child: isUpdating 
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text("Save Changes", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 12),
      child: Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: subtitleColor, letterSpacing: 1.5)),
    );
  }

  Widget _buildInputCard(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: surfaceColor, borderRadius: BorderRadius.circular(20)),
      child: Column(children: children),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, size: 20, color: primaryColor),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: borderColor)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: borderColor)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      floatingActionButton: FloatingActionButton(
        backgroundColor: primaryColor,
        onPressed: _showCreateProjectDialog,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : SafeArea(
            child: Column(
              children: [
                _buildProfessionalHeader(),
                Expanded(
                  child: _projects.isEmpty 
                    ? const Center(child: Text("No projects assigned yet"))
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
                        itemCount: _projects.length,
                        itemBuilder: (context, index) {
                          final project = _projects[index];
                          final int progress = project['progress']?.toInt() ?? 0;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: surfaceColor,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: borderColor.withOpacity(0.8)),
                              boxShadow: [
                                BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 15, offset: const Offset(0, 8)),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        project["title"],
                                        style: const TextStyle(fontWeight: FontWeight.w700, color: primaryColor, fontSize: 17, letterSpacing: -0.5),
                                      ),
                                    ),
                                    Row(
                                      children: [
                                        _statusChip(project["status"] ?? "In Progress"),
                                        const SizedBox(width: 4),
                                        PopupMenuButton<String>(
                                          icon: const Icon(Icons.more_vert, color: subtitleColor, size: 20),
                                          padding: EdgeInsets.zero,
                                          color: Colors.white,
                                          elevation: 0,
                                          surfaceTintColor: Colors.transparent,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                            side: BorderSide(color: borderColor.withOpacity(0.5)),
                                          ),
                                          onSelected: (value) {
                                            if (value == 'edit') {
                                              _showEditProjectDialog(project);
                                            } else if (value == 'delete') {
                                              _deleteProject(project["_id"]);
                                            }
                                          },
                                          itemBuilder: (context) => [
                                            const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit, size: 18, color: primaryColor), SizedBox(width: 8), Text("Edit")])),
                                            const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete, size: 18, color: Colors.red), SizedBox(width: 8), Text("Delete", style: TextStyle(color: Colors.red))])),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text("CLIENT: ${project['client']?.toString().toUpperCase() ?? 'N/A'}", style: const TextStyle(color: subtitleColor, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                                const SizedBox(height: 20),
                                Row(
                                  children: [
                                    Expanded(child: _timelineItem("STARTED", project["startDate"] != null ? DateFormat('MMM d, yyyy').format(DateTime.parse(project["startDate"])) : "N/A", Icons.play_circle_outline_rounded, Colors.blue)),
                                    Container(width: 1, height: 30, color: borderColor, margin: const EdgeInsets.symmetric(horizontal: 16)),
                                    Expanded(child: _timelineItem("DEADLINE", project["deadline"] != null ? DateFormat('MMM d, yyyy').format(DateTime.parse(project["deadline"])) : "N/A", Icons.event_available_rounded, Colors.redAccent)),
                                  ],
                                ),
                                const SizedBox(height: 20),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    GestureDetector(
                                      onTap: () {
                                        final List<dynamic> members = project['teamMembers'] ?? [];
                                        _showProjectTeamDialog(
                                          project['title'],
                                          members.map((m) => {
                                            "fullName": (m['fullName'] ?? "Unknown").toString(),
                                            "memberType": (m['memberType'] ?? "Member").toString()
                                          }).toList(),
                                        );
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        decoration: BoxDecoration(color: primaryColor.withOpacity(0.05), borderRadius: BorderRadius.circular(12)),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.groups_rounded, size: 16, color: primaryColor),
                                            const SizedBox(width: 8),
                                            Text(
                                              (project['teamMembers'] as List?)?.isEmpty ?? true
                                                  ? "Add Team"
                                                  : (project['teamMembers'] as List).length == 1 
                                                    ? (project['teamMembers'] as List)[0]['fullName']
                                                    : "${(project['teamMembers'] as List).length} Members",
                                              style: const TextStyle(fontSize: 12, color: primaryColor, fontWeight: FontWeight.bold),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: () => _showProjectChecklistDialog(project),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        decoration: BoxDecoration(color: primaryColor.withOpacity(0.05), borderRadius: BorderRadius.circular(12)),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.checklist_rounded, size: 16, color: primaryColor),
                                            const SizedBox(width: 8),
                                            Text(
                                              "Tasks (${(project['checklist'] as List?)?.length ?? 0})",
                                              style: const TextStyle(fontSize: 12, color: primaryColor, fontWeight: FontWeight.bold),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 20),
                                Row(
                                  children: [
                                    Expanded(
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(10),
                                        child: LinearProgressIndicator(
                                          value: progress / 100,
                                          backgroundColor: backgroundColor,
                                          valueColor: AlwaysStoppedAnimation<Color>(_getProgressColor(project["status"] ?? "In Progress")),
                                          minHeight: 8,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Text("$progress%", style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: primaryColor)),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                ),
              ],
            ),
          ),
    );
  }

  Widget _timelineItem(String label, String date, IconData icon, Color iconColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: subtitleColor, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        Row(
          children: [
            Icon(icon, size: 14, color: iconColor),
            const SizedBox(width: 6),
            Text(date, style: const TextStyle(fontSize: 12, color: primaryColor, fontWeight: FontWeight.w600)),
          ],
        ),
      ],
    );
  }

  Widget _buildProfessionalHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildModernIconButton(Icons.arrow_back_ios_new_rounded, () => Navigator.pop(context)),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Projects",
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontSize: 24,
                        letterSpacing: -1.0,
                      ),
                    ),
                    Text(
                      "TRACK PERFORMANCE & DEADLINES",
                      style: TextStyle(
                        color: subtitleColor,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildModernIconButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Icon(icon, color: primaryColor, size: 20),
      ),
    );
  }

  Widget _statusChip(String status) {
    Color color = status == "Completed" ? Colors.teal : Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(status.toUpperCase(), style: TextStyle(color: color, fontSize: 8.5, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
    );
  }

  Color _getProgressColor(String status) {
    return status == "Completed" ? Colors.teal : primaryColor;
  }
}
